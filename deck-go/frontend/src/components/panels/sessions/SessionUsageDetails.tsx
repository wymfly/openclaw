import { useEffect, useMemo, useState } from "react";
import type {
  DeckGoContextWeightReport,
  DeckGoUsageSessionEntry,
  DeckGoUsageSessionLogEntry,
} from "../../../api";
import { fetchUsageSessionLogs, fetchUsageSessions } from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import { ShellStat } from "../../shared/ShellComponents";

type UsageLoadState = "idle" | "loading" | "ready";

type SessionUsageDetailsProps = {
  compactionCount?: number;
  sessionKey: string;
};

const SESSION_LOG_LIMIT = 50;

function formatChars(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return String(value);
}

function formatCurrency(value: number) {
  return `$${value.toFixed(4)}`;
}

function formatTimestamp(value?: number) {
  return value ? new Date(value).toLocaleString() : "n/a";
}

function contextWeightSummary(report: DeckGoContextWeightReport | null | undefined) {
  if (!report) {
    return null;
  }
  const files = report.injectedWorkspaceFiles.reduce((sum, file) => sum + file.injectedChars, 0);
  const skills = report.skills.promptChars;
  const system = report.systemPrompt.chars;
  const tools = report.tools.listChars + report.tools.schemaChars;
  return {
    files,
    skills,
    system,
    tools,
    total: files + skills + system + tools,
  };
}

function usageTotal(entry: DeckGoUsageSessionEntry | null) {
  return entry?.usage?.totalTokens ?? entry?.usage?.input ?? entry?.usage?.output ?? 0;
}

function highTokenThreshold(logs: DeckGoUsageSessionLogEntry[]) {
  const tokenValues = logs.map((entry) => entry.tokens ?? 0).filter((tokens) => tokens > 0);
  if (tokenValues.length === 0) {
    return Number.POSITIVE_INFINITY;
  }
  return (tokenValues.reduce((sum, tokens) => sum + tokens, 0) / tokenValues.length) * 2;
}

export function SessionUsageDetails(props: SessionUsageDetailsProps) {
  const t = useTranslations("sessions");
  const [loadState, setLoadState] = useState<UsageLoadState>("idle");
  const [usageEntry, setUsageEntry] = useState<DeckGoUsageSessionEntry | null>(null);
  const [logs, setLogs] = useState<DeckGoUsageSessionLogEntry[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const sessionKey = props.sessionKey.trim();
    if (!sessionKey) {
      setLoadState("idle");
      setUsageEntry(null);
      setLogs([]);
      setError("");
      return undefined;
    }

    let cancelled = false;
    setLoadState("loading");
    void Promise.all([
      fetchUsageSessions({ includeContextWeight: true, key: sessionKey, limit: 1 }),
      fetchUsageSessionLogs({ key: sessionKey, limit: SESSION_LOG_LIMIT }),
    ])
      .then(([usageResult, logsResult]) => {
        if (cancelled) {
          return;
        }
        const nextUsage =
          usageResult.sessions.find((entry) => entry.key === sessionKey) ??
          usageResult.sessions[0] ??
          null;
        setUsageEntry(nextUsage);
        setLogs(logsResult.logs ?? []);
        setLoadState("ready");
        setError("");
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }
        setUsageEntry(null);
        setLogs([]);
        setLoadState("idle");
        setError(loadError instanceof Error ? loadError.message : t("failedLoadSessionUsage"));
      });

    return () => {
      cancelled = true;
    };
  }, [props.sessionKey, t]);

  const contextSummary = contextWeightSummary(usageEntry?.contextWeight);
  const threshold = useMemo(() => highTokenThreshold(logs), [logs]);

  return (
    <div className="deckgo-surface-tile deck-ui-sessions-surface deck-ui-sessions-usage">
      <div className="deckgo-pill-row deck-ui-sessions-status-row">
        <p className="deckgo-surface-label">{t("usageContext")}</p>
        <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
          {t("usageStatus", { state: t(loadState) })}
        </span>
      </div>
      {error ? <p className="deckgo-note deck-ui-sessions-error">{error}</p> : null}
      <div className="deckgo-grid deckgo-grid-3 deck-ui-sessions-stats">
        <ShellStat label={t("usageTokens")} value={usageTotal(usageEntry)} />
        <ShellStat
          label={t("usageCost")}
          value={formatCurrency(usageEntry?.usage?.totalCost ?? 0)}
        />
        <ShellStat label={t("compactions")} value={props.compactionCount ?? 0} />
      </div>
      {contextSummary ? (
        <>
          <div className="deckgo-grid deckgo-grid-3 deck-ui-sessions-stats">
            <ShellStat label={t("contextTotal")} value={formatChars(contextSummary.total)} />
            <ShellStat
              label={t("contextSource")}
              value={usageEntry?.contextWeight?.source ?? t("unknown")}
            />
            <ShellStat
              label={t("contextGenerated")}
              value={formatTimestamp(usageEntry?.contextWeight?.generatedAt)}
            />
          </div>
          <ul className="deckgo-shell-list deck-ui-sessions-list">
            <li>
              <strong>{t("systemPrompt")}</strong>
              <div className="deckgo-meta deck-ui-sessions-meta">
                {t("charsValue", { count: formatChars(contextSummary.system) })}
              </div>
            </li>
            <li>
              <strong>{t("toolsLower")}</strong>
              <div className="deckgo-meta deck-ui-sessions-meta">
                {t("contextEntryDetail", {
                  chars: formatChars(contextSummary.tools),
                  count: usageEntry?.contextWeight?.tools.entries.length ?? 0,
                })}
              </div>
            </li>
            <li>
              <strong>{t("skillsLower")}</strong>
              <div className="deckgo-meta deck-ui-sessions-meta">
                {t("contextEntryDetail", {
                  chars: formatChars(contextSummary.skills),
                  count: usageEntry?.contextWeight?.skills.entries.length ?? 0,
                })}
              </div>
            </li>
            <li>
              <strong>{t("filesLower")}</strong>
              <div className="deckgo-meta deck-ui-sessions-meta">
                {t("contextFilesDetail", {
                  chars: formatChars(contextSummary.files),
                  count: usageEntry?.contextWeight?.injectedWorkspaceFiles.length ?? 0,
                })}
              </div>
            </li>
          </ul>
        </>
      ) : (
        <p className="deckgo-note deck-ui-sessions-empty">{t("noContextWeight")}</p>
      )}
      <p className="deckgo-surface-label">{t("sessionTurnTimeline")}</p>
      {logs.length === 0 ? (
        <p className="deckgo-note deck-ui-sessions-empty">{t("noSessionUsageLogs")}</p>
      ) : (
        <ul className="deckgo-shell-list deck-ui-sessions-list">
          {logs.slice(0, 8).map((entry, index) => {
            const isHighToken = typeof entry.tokens === "number" && entry.tokens > threshold;
            return (
              <li key={`${entry.timestamp}-${index}`}>
                <strong>{entry.role || t("message")}</strong>
                <div className="deckgo-meta deck-ui-sessions-meta">
                  {t("timelineEntryMeta", {
                    cost: formatCurrency(entry.cost ?? 0),
                    tokens: entry.tokens ?? 0,
                    timestamp: formatTimestamp(entry.timestamp),
                  })}
                  {isHighToken ? ` | ${t("highTokenTurn")}` : ""}
                </div>
                <p className="deckgo-note">{entry.content}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
