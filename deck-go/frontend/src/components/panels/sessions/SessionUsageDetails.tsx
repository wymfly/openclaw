import { useEffect, useMemo, useState } from "react";
import type {
  DeckGoContextWeightReport,
  DeckGoUsageSessionEntry,
  DeckGoUsageSessionLogEntry,
} from "../../../api";
import { fetchUsageSessionLogs, fetchUsageSessions } from "../../../api";
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
        setError(loadError instanceof Error ? loadError.message : "failed to load session usage");
      });

    return () => {
      cancelled = true;
    };
  }, [props.sessionKey]);

  const contextSummary = contextWeightSummary(usageEntry?.contextWeight);
  const threshold = useMemo(() => highTokenThreshold(logs), [logs]);

  return (
    <div className="deckgo-surface-tile deck-ui-sessions-surface deck-ui-sessions-usage">
      <div className="deckgo-pill-row deck-ui-sessions-status-row">
        <p className="deckgo-surface-label">Usage and context</p>
        <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
          usage {loadState}
        </span>
      </div>
      {error ? <p className="deckgo-note deck-ui-sessions-error">{error}</p> : null}
      <div className="deckgo-grid deckgo-grid-3 deck-ui-sessions-stats">
        <ShellStat label="usage tokens" value={usageTotal(usageEntry)} />
        <ShellStat label="usage cost" value={formatCurrency(usageEntry?.usage?.totalCost ?? 0)} />
        <ShellStat label="compactions" value={props.compactionCount ?? 0} />
      </div>
      {contextSummary ? (
        <>
          <div className="deckgo-grid deckgo-grid-3 deck-ui-sessions-stats">
            <ShellStat label="context total" value={formatChars(contextSummary.total)} />
            <ShellStat
              label="context source"
              value={usageEntry?.contextWeight?.source ?? "unknown"}
            />
            <ShellStat
              label="context generated"
              value={formatTimestamp(usageEntry?.contextWeight?.generatedAt)}
            />
          </div>
          <ul className="deckgo-shell-list deck-ui-sessions-list">
            <li>
              <strong>system prompt</strong>
              <div className="deckgo-meta deck-ui-sessions-meta">
                {formatChars(contextSummary.system)} chars
              </div>
            </li>
            <li>
              <strong>tools</strong>
              <div className="deckgo-meta deck-ui-sessions-meta">
                {formatChars(contextSummary.tools)} chars |{" "}
                {usageEntry?.contextWeight?.tools.entries.length ?? 0} entries
              </div>
            </li>
            <li>
              <strong>skills</strong>
              <div className="deckgo-meta deck-ui-sessions-meta">
                {formatChars(contextSummary.skills)} chars |{" "}
                {usageEntry?.contextWeight?.skills.entries.length ?? 0} entries
              </div>
            </li>
            <li>
              <strong>files</strong>
              <div className="deckgo-meta deck-ui-sessions-meta">
                {formatChars(contextSummary.files)} chars |{" "}
                {usageEntry?.contextWeight?.injectedWorkspaceFiles.length ?? 0} files
              </div>
            </li>
          </ul>
        </>
      ) : (
        <p className="deckgo-note deck-ui-sessions-empty">No context weight data available.</p>
      )}
      <p className="deckgo-surface-label">Session turn timeline</p>
      {logs.length === 0 ? (
        <p className="deckgo-note deck-ui-sessions-empty">No session usage logs loaded.</p>
      ) : (
        <ul className="deckgo-shell-list deck-ui-sessions-list">
          {logs.slice(0, 8).map((entry, index) => {
            const isHighToken = typeof entry.tokens === "number" && entry.tokens > threshold;
            return (
              <li key={`${entry.timestamp}-${index}`}>
                <strong>{entry.role || "message"}</strong>
                <div className="deckgo-meta deck-ui-sessions-meta">
                  {formatTimestamp(entry.timestamp)} | {entry.tokens ?? 0} tokens |{" "}
                  {formatCurrency(entry.cost ?? 0)}
                  {isHighToken ? " | high token turn" : ""}
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
