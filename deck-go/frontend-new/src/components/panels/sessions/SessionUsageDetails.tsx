import { useMemo } from "react";
import type {
  DeckGoContextWeightReport,
  DeckGoUsageSessionEntry,
  DeckGoUsageSessionLogEntry,
} from "@/api-types";
import { useSessionUsageLogsQuery, useSessionUsageQuery } from "../../../data/modules/sessions";
import { Badge } from "../../../design-system/atoms";
import { useTranslations } from "../../../i18n/provider";

type UsageLoadState = "idle" | "loading" | "ready";

type SessionUsageDetailsProps = {
  compactionCount?: number;
  sessionKey: string;
};

const SESSION_LOG_LIMIT = 50;

type ContextWeightSummary = {
  files: number;
  fileEntries: number;
  skills: number;
  skillEntries: number;
  system: number;
  tools: number;
  toolEntries: number;
  total: number;
};

function numericValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

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

function contextWeightSummary(
  report: DeckGoContextWeightReport | null | undefined,
): ContextWeightSummary | null {
  if (!report) {
    return null;
  }
  const systemPrompt = objectValue(report.systemPrompt);
  const skillsRecord = objectValue(report.skills);
  const toolsRecord = objectValue(report.tools);
  const workspaceFiles = arrayValue(report.injectedWorkspaceFiles);
  const files = workspaceFiles.reduce(
    (sum, file) => sum + numericValue(objectValue(file).injectedChars),
    0,
  );
  const skills = numericValue(skillsRecord.promptChars);
  const system = numericValue(systemPrompt.chars);
  const tools = numericValue(toolsRecord.listChars) + numericValue(toolsRecord.schemaChars);
  return {
    fileEntries: workspaceFiles.length,
    files,
    skills,
    skillEntries: arrayValue(skillsRecord.entries).length,
    system,
    tools,
    toolEntries: arrayValue(toolsRecord.entries).length,
    total: files + skills + system + tools,
  } satisfies ContextWeightSummary;
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

function UsageStat(props: { label: string; value: string | number }) {
  return (
    <div className="sessions-stat">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

export function SessionUsageDetails(props: SessionUsageDetailsProps) {
  const t = useTranslations("sessions");
  const sessionKey = props.sessionKey.trim();
  const usageQuery = useSessionUsageQuery(sessionKey);
  const logsQuery = useSessionUsageLogsQuery(sessionKey, SESSION_LOG_LIMIT);
  const usageEntry =
    usageQuery.data?.sessions.find((entry) => entry.key === sessionKey) ??
    usageQuery.data?.sessions[0] ??
    null;
  const logs = logsQuery.data?.logs ?? [];
  const queryError = usageQuery.error ?? logsQuery.error;
  const error =
    queryError instanceof Error
      ? queryError.message
      : queryError
        ? t("failedLoadSessionUsage")
        : "";
  const loadState: UsageLoadState =
    usageQuery.isLoading || logsQuery.isLoading
      ? "loading"
      : usageQuery.data || logsQuery.data
        ? "ready"
        : "idle";

  const contextSummary = contextWeightSummary(usageEntry?.contextWeight);
  const threshold = useMemo(() => highTokenThreshold(logs), [logs]);

  return (
    <section className="sessions-surface sessions-usage-panel">
      <div className="sessions-section-heading">
        <h3>{t("usageContext")}</h3>
        <Badge variant={loadState === "ready" ? "ok" : "neutral"}>
          {t("usageStatus", { state: t(loadState) })}
        </Badge>
      </div>
      {error ? <p className="sessions-error">{error}</p> : null}
      <div className="sessions-stat-grid">
        <UsageStat label={t("usageTokens")} value={usageTotal(usageEntry)} />
        <UsageStat
          label={t("usageCost")}
          value={formatCurrency(usageEntry?.usage?.totalCost ?? 0)}
        />
        <UsageStat label={t("compactions")} value={props.compactionCount ?? 0} />
      </div>
      {contextSummary ? (
        <>
          <div className="sessions-stat-grid">
            <UsageStat label={t("contextTotal")} value={formatChars(contextSummary.total)} />
            <UsageStat
              label={t("contextSource")}
              value={usageEntry?.contextWeight?.source ?? t("unknown")}
            />
            <UsageStat
              label={t("contextGenerated")}
              value={formatTimestamp(usageEntry?.contextWeight?.generatedAt)}
            />
          </div>
          <ul className="sessions-list">
            <li className="sessions-timeline-row">
              <strong>{t("systemPrompt")}</strong>
              <div className="sessions-meta">
                {t("charsValue", { count: formatChars(contextSummary.system) })}
              </div>
            </li>
            <li className="sessions-timeline-row">
              <strong>{t("toolsLower")}</strong>
              <div className="sessions-meta">
                {t("contextEntryDetail", {
                  chars: formatChars(contextSummary.tools),
                  count: contextSummary.toolEntries,
                })}
              </div>
            </li>
            <li className="sessions-timeline-row">
              <strong>{t("skillsLower")}</strong>
              <div className="sessions-meta">
                {t("contextEntryDetail", {
                  chars: formatChars(contextSummary.skills),
                  count: contextSummary.skillEntries,
                })}
              </div>
            </li>
            <li className="sessions-timeline-row">
              <strong>{t("filesLower")}</strong>
              <div className="sessions-meta">
                {t("contextFilesDetail", {
                  chars: formatChars(contextSummary.files),
                  count: contextSummary.fileEntries,
                })}
              </div>
            </li>
          </ul>
        </>
      ) : (
        <p className="sessions-empty">{t("noContextWeight")}</p>
      )}
      <h3>{t("sessionTurnTimeline")}</h3>
      {logs.length === 0 ? (
        <p className="sessions-empty">{t("noSessionUsageLogs")}</p>
      ) : (
        <ul className="sessions-list">
          {logs.slice(0, 8).map((entry, index) => {
            const isHighToken = typeof entry.tokens === "number" && entry.tokens > threshold;
            return (
              <li
                className={
                  isHighToken ? "sessions-timeline-row is-warning" : "sessions-timeline-row"
                }
                key={`${entry.timestamp}-${index}`}
              >
                <strong>{entry.role || t("message")}</strong>
                <div className="sessions-meta">
                  {t("timelineEntryMeta", {
                    cost: formatCurrency(entry.cost ?? 0),
                    tokens: entry.tokens ?? 0,
                    timestamp: formatTimestamp(entry.timestamp),
                  })}
                  {isHighToken ? ` | ${t("highTokenTurn")}` : ""}
                </div>
                <p className="sessions-note">{entry.content}</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
