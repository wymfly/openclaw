import { useCallback, useEffect, useRef, useState } from "react";
import type { DeckGoLogStreamEvent } from "../../../../../contracts/generated/ts/deck-api.generated";
import { fetchLogsTail, streamLogEvents, type DeckGoLogsTailResponse } from "../../../api";
import {
  Badge,
  Button,
  Card,
  Code,
  Input,
  Select,
  Spinner,
  Toggle,
} from "../../../design-system/atoms";
import { useTranslations } from "../../../i18n/provider";
import { parseLogEvent, summarizeLogEvent } from "../../../stream-contract";
import { EventFeedCard, JsonDetails } from "../../shared/ShellComponents";
import "./logs-panel.css";

type LogsState = "idle" | "loading" | "ready";
type StreamState = "idle" | "connecting" | "connected" | "reconnecting" | "error";
type LogLevel = "debug" | "info" | "warn" | "error";
type LogSource = "gateway" | "agent" | "channel" | "unknown";

type ParsedLogEntry = {
  timestamp: string;
  level: LogLevel;
  source: LogSource;
  message: string;
  sessionKey?: string;
};

const LOG_CURSOR_KEY = "deckGoLogsCursor";
const LOG_LAST_EVENT_ID_KEY = "deckGoLogsLastEventId";
const LOG_BUFFER_LIMIT = 5_000;
const ALL_LOG_LEVELS: LogLevel[] = ["debug", "info", "warn", "error"];
const ALL_LOG_SOURCES: Array<LogSource | "all"> = ["all", "gateway", "agent", "channel", "unknown"];
const LOG_LEVEL_MAP: Record<string, LogLevel> = {
  DEBUG: "debug",
  ERR: "error",
  ERROR: "error",
  INFO: "info",
  WARN: "warn",
  WARNING: "warn",
};
const LOG_SOURCE_MAP: Record<string, LogSource> = {
  agent: "agent",
  channel: "channel",
  gateway: "gateway",
};

function formatLogLine(line: unknown) {
  if (typeof line === "string") {
    return line;
  }
  return JSON.stringify(line, null, 2);
}

function normalizeLogLevel(value: unknown): LogLevel {
  if (typeof value !== "string") {
    return "info";
  }
  return LOG_LEVEL_MAP[value.toUpperCase()] ?? "info";
}

function normalizeLogSource(value: unknown): LogSource {
  if (typeof value !== "string") {
    return "unknown";
  }
  return LOG_SOURCE_MAP[value.toLowerCase()] ?? "unknown";
}

function extractSessionKey(message: string) {
  return (
    message.match(/(?:sessionKey|session|key)=([A-Za-z0-9:._-]+)/)?.[1] ??
    message.match(/session:([A-Za-z0-9:._-]+)/)?.[1] ??
    undefined
  );
}

function parseLogLine(line: unknown): ParsedLogEntry | null {
  if (line && typeof line === "object" && !Array.isArray(line)) {
    const record = line as Record<string, unknown>;
    const message =
      typeof record.message === "string" ? record.message : formatLogLine(record).trim();
    if (!message) {
      return null;
    }
    return {
      level: normalizeLogLevel(record.level),
      message,
      sessionKey:
        typeof record.sessionKey === "string" ? record.sessionKey : extractSessionKey(message),
      source: normalizeLogSource(record.source),
      timestamp: typeof record.timestamp === "string" ? record.timestamp : new Date().toISOString(),
    };
  }

  if (typeof line !== "string") {
    return null;
  }
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  const structured = trimmed.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\s+\[(\w+)]\s+\[(\w+)]\s+(.*)$/);
  if (structured) {
    const [, timestamp, rawLevel, rawSource, message] = structured;
    const text = message ?? trimmed;
    return {
      level: normalizeLogLevel(rawLevel),
      message: text,
      sessionKey: extractSessionKey(text),
      source: normalizeLogSource(rawSource),
      timestamp: timestamp ?? new Date().toISOString(),
    };
  }

  const level = normalizeLogLevel(trimmed.match(/\[(\w+)]/)?.[1]);
  return {
    level,
    message: trimmed,
    sessionKey: extractSessionKey(trimmed),
    source: "unknown",
    timestamp: new Date().toISOString(),
  };
}

function buildLogExport(entries: ParsedLogEntry[]) {
  return entries
    .map((entry) =>
      [
        entry.timestamp,
        `[${entry.level.toUpperCase()}]`,
        `[${entry.source}]`,
        entry.sessionKey ? `sessionKey=${entry.sessionKey}` : "",
        entry.message,
      ]
        .filter(Boolean)
        .join(" "),
    )
    .join("\n");
}

function tailStateVariant(state: LogsState) {
  if (state === "ready") {
    return "ok";
  }
  if (state === "loading") {
    return "running";
  }
  return "neutral";
}

function streamStateVariant(state: StreamState) {
  if (state === "connected") {
    return "ok";
  }
  if (state === "connecting" || state === "reconnecting") {
    return "running";
  }
  if (state === "error") {
    return "err";
  }
  return "neutral";
}

function levelVariant(level: LogLevel) {
  if (level === "error") {
    return "err";
  }
  if (level === "warn") {
    return "warn";
  }
  if (level === "info") {
    return "ok";
  }
  return "neutral";
}

function MetricTile(props: { hint?: string; label: string; value: string | number }) {
  return (
    <article className="logs-metric">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
      {props.hint ? <small>{props.hint}</small> : null}
    </article>
  );
}

export function LogsPanel() {
  const t = useTranslations("logs");
  const [tail, setTail] = useState<DeckGoLogsTailResponse | null>(null);
  const [tailState, setTailState] = useState<LogsState>("idle");
  const [streamState, setStreamState] = useState<StreamState>("idle");
  const [logEvents, setLogEvents] = useState<DeckGoLogStreamEvent[]>([]);
  const [liveTape, setLiveTape] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState(ALL_LOG_LEVELS);
  const [sourceFilter, setSourceFilter] = useState<LogSource | "all">("all");
  const [sessionFilter, setSessionFilter] = useState("");
  const [streamingEnabled, setStreamingEnabled] = useState(true);
  const [exportPreview, setExportPreview] = useState("");
  const [error, setError] = useState("");
  const lastEventIdRef = useRef(
    typeof window === "undefined"
      ? ""
      : window.localStorage.getItem(LOG_LAST_EVENT_ID_KEY)?.trim() || "",
  );

  const refreshLogsTail = useCallback(
    async (cursor?: number) => {
      setTailState("loading");
      try {
        const result = await fetchLogsTail({ cursor, limit: 200, maxBytes: 65536 });
        setTail(result);
        if (typeof result.cursor === "number") {
          window.localStorage.setItem(LOG_CURSOR_KEY, String(result.cursor));
        }
        setTailState("ready");
        setError("");
      } catch (tailError) {
        setTailState("idle");
        setError(tailError instanceof Error ? tailError.message : t("failedFetchTail"));
      }
    },
    [t],
  );

  useEffect(() => {
    const initialCursorRaw =
      typeof window === "undefined"
        ? ""
        : window.localStorage.getItem(LOG_CURSOR_KEY)?.trim() || "";
    const initialCursor = initialCursorRaw ? Number.parseInt(initialCursorRaw, 10) : undefined;
    void refreshLogsTail(Number.isFinite(initialCursor) ? initialCursor : undefined);
  }, [refreshLogsTail]);

  useEffect(() => {
    if (!streamingEnabled) {
      setStreamState("idle");
      return undefined;
    }
    const controller = new AbortController();
    void streamLogEvents({
      signal: controller.signal,
      initialLastEventId: lastEventIdRef.current,
      onStatusChange(status) {
        setStreamState(status);
      },
      onEvent(event) {
        if (event.id) {
          lastEventIdRef.current = event.id;
          window.localStorage.setItem(LOG_LAST_EVENT_ID_KEY, event.id);
        }
        setLogEvents((current) => [event, ...current].slice(0, 20));

        const parsed = parseLogEvent(event);
        if (parsed.kind === "log.reset") {
          setLiveTape((current) => [t("logReset"), ...current].slice(0, 10));
          setTail((current) => (current ? { ...current, lines: [], reset: true } : current));
          return;
        }
        if (parsed.kind === "log.batch") {
          if (typeof parsed.payload.cursor === "number") {
            window.localStorage.setItem(LOG_CURSOR_KEY, String(parsed.payload.cursor));
          }
          setLiveTape((current) => [summarizeLogEvent(event), ...current].slice(0, 10));
          setTail((current) => ({
            cursor: parsed.payload.cursor ?? current?.cursor,
            lines: [...(current?.lines ?? []), ...(parsed.payload.lines ?? [])].slice(
              -LOG_BUFFER_LIMIT,
            ),
            reset: false,
          }));
        }
      },
    }).catch((streamError) => {
      if (!controller.signal.aborted) {
        setError(streamError instanceof Error ? streamError.message : t("failedConnectStream"));
      }
    });

    return () => {
      controller.abort();
    };
  }, [streamingEnabled, t]);

  const parsedLogEntries = (tail?.lines ?? []).map(parseLogLine).filter((entry) => entry !== null);
  const filteredLogEntries = parsedLogEntries.filter((entry) => {
    if (!selectedLevels.includes(entry.level)) {
      return false;
    }
    if (sourceFilter !== "all" && entry.source !== sourceFilter) {
      return false;
    }
    const needle = sessionFilter.trim().toLowerCase();
    if (!needle) {
      return true;
    }
    return (
      entry.sessionKey?.toLowerCase().includes(needle) ||
      entry.message.toLowerCase().includes(needle)
    );
  });

  const toggleLevelFilter = (level: LogLevel) => {
    setSelectedLevels((current) =>
      current.includes(level) ? current.filter((item) => item !== level) : [...current, level],
    );
  };

  const clearLocalLogs = () => {
    setTail((current) => (current ? { ...current, lines: [] } : current));
    setLogEvents([]);
    setLiveTape([]);
    setExportPreview("");
  };

  return (
    <section className="logs-panel" data-testid="logs-panel">
      <div className="logs-panel__header">
        <div>
          <p className="logs-panel__eyebrow">operations / logs</p>
          <h2>{t("title")}</h2>
          <p>{t("tailDescription")}</p>
        </div>
        <div className="logs-panel__header-actions">
          <Badge variant={tailStateVariant(tailState)}>
            {t("tailStatus", { state: t(tailState) })}
          </Badge>
          <Badge variant={streamStateVariant(streamState)}>
            {t("streamStatus", { state: t(streamState) })}
          </Badge>
          {tailState === "loading" ? <Spinner aria-label={t("loading")} size="sm" /> : null}
          <div className="logs-toggle">
            <Toggle
              aria-label={streamingEnabled ? t("pauseStream") : t("resumeStream")}
              checked={streamingEnabled}
              onCheckedChange={setStreamingEnabled}
            />
            <span>{streamingEnabled ? t("connected") : t("idle")}</span>
          </div>
          <Button size="sm" onClick={() => void refreshLogsTail(tail?.cursor)}>
            {t("refreshTail")}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="logs-panel__banner" role="status">
          <Badge variant="err">{t("error")}</Badge>
          <span>{error}</span>
        </div>
      ) : null}

      <div className="logs-panel__metrics">
        <MetricTile
          hint={t("cursorValue", { cursor: tail?.cursor ?? 0 })}
          label={t("tailPayload")}
          value={tail?.cursor ?? 0}
        />
        <MetricTile
          hint={t("visibleCount", { count: filteredLogEntries.length })}
          label={t("latestLines")}
          value={filteredLogEntries.length}
        />
        <MetricTile
          hint={t("bufferCount", { current: parsedLogEntries.length, max: LOG_BUFFER_LIMIT })}
          label={t("bufferCount", { current: parsedLogEntries.length, max: LOG_BUFFER_LIMIT })}
          value={parsedLogEntries.length}
        />
        <MetricTile label={t("liveEventTape")} value={liveTape.length} />
        <MetricTile label={t("streamEventsTitle")} value={logEvents.length} />
      </div>

      <div className="logs-workbench">
        <Card className="logs-card logs-tail-card" padded={false}>
          <div className="logs-card__header">
            <div>
              <h3>{t("latestLines")}</h3>
              <p>{t("tailDescription")}</p>
            </div>
            <Badge>{t("visibleCount", { count: filteredLogEntries.length })}</Badge>
          </div>
          <div className="logs-card__body">
            <section className="logs-surface logs-filter-surface">
              <div className="logs-section-heading">
                <div>
                  <h3>{t("filters")}</h3>
                  <p>{t("session")}</p>
                </div>
                <Badge>{t("all")}</Badge>
              </div>
              <div className="logs-filter-grid">
                <label className="logs-label">
                  <span>{t("level")}</span>
                  <span className="logs-level-row">
                    {ALL_LOG_LEVELS.map((level) => (
                      <span className="logs-level-pill" key={level}>
                        <input
                          checked={selectedLevels.includes(level)}
                          onChange={() => toggleLevelFilter(level)}
                          type="checkbox"
                        />
                        {level}
                      </span>
                    ))}
                  </span>
                </label>
                <label className="logs-label">
                  <span>{t("source")}</span>
                  <Select
                    aria-label={t("sourceFilter")}
                    onChange={(event) => setSourceFilter(event.target.value as LogSource | "all")}
                    selectSize="sm"
                    value={sourceFilter}
                  >
                    {ALL_LOG_SOURCES.map((source) => (
                      <option key={source} value={source}>
                        {source}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="logs-label">
                  <span>{t("session")}</span>
                  <Input
                    inputSize="sm"
                    onChange={(event) => setSessionFilter(event.target.value)}
                    placeholder={t("sessionKeyPlaceholder")}
                    value={sessionFilter}
                  />
                </label>
              </div>
            </section>

            <div className="logs-action-row">
              <Button
                size="sm"
                variant="primary"
                onClick={() => void refreshLogsTail(tail?.cursor)}
              >
                {t("refreshTail")}
              </Button>
              <Button
                aria-pressed={!streamingEnabled}
                size="sm"
                onClick={() => setStreamingEnabled((current) => !current)}
              >
                {streamingEnabled ? t("pauseStream") : t("resumeStream")}
              </Button>
              <Button size="sm" onClick={clearLocalLogs}>
                {t("clearLocalLogs")}
              </Button>
              <Button
                size="sm"
                onClick={() => setExportPreview(buildLogExport(filteredLogEntries))}
              >
                {t("prepareExport")}
              </Button>
            </div>

            <section className="logs-surface logs-lines">
              <div className="logs-section-heading">
                <div>
                  <h3>{t("latestLines")}</h3>
                  <p>{t("visibleCount", { count: filteredLogEntries.length })}</p>
                </div>
                <Badge variant={tailStateVariant(tailState)}>{t(tailState)}</Badge>
              </div>
              {filteredLogEntries.length === 0 ? (
                <p className="logs-panel__empty">{t("noLogLines")}</p>
              ) : (
                <ul className="logs-line-list">
                  {filteredLogEntries.slice(0, 50).map((entry, index) => (
                    <li key={`log-line-${index}-${entry.timestamp}`}>
                      <article className="logs-line-row">
                        <div className="logs-row__top">
                          <strong>
                            <Badge variant={levelVariant(entry.level)}>{entry.level}</Badge>
                            <span>{entry.source}</span>
                          </strong>
                          <span className="logs-row__meta">
                            {entry.timestamp}
                            {entry.sessionKey ? ` | ${entry.sessionKey}` : ""}
                          </span>
                        </div>
                        <Code
                          aria-label={`${entry.level} ${entry.source}`}
                          className="logs-code"
                          content={entry.message}
                          language="log"
                        />
                      </article>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {exportPreview ? (
              <section className="logs-surface logs-export">
                <div className="logs-section-heading">
                  <div>
                    <h3>{t("preparedLogExport")}</h3>
                    <p>{t("visibleCount", { count: filteredLogEntries.length })}</p>
                  </div>
                  <Badge>{t("filteredTailSeam")}</Badge>
                </div>
                <Code
                  aria-label={t("preparedLogExport")}
                  className="logs-code logs-code--export"
                  content={exportPreview}
                  language="log"
                />
              </section>
            ) : null}
          </div>
        </Card>

        <aside className="logs-sidecar">
          <Card className="logs-card logs-live-tape" padded={false}>
            <div className="logs-card__header">
              <div>
                <h3>{t("liveEventTape")}</h3>
                <p>{t("streamStatus", { state: t(streamState) })}</p>
              </div>
              <Badge variant={streamStateVariant(streamState)}>{t(streamState)}</Badge>
            </div>
            <div className="logs-card__body">
              {liveTape.length === 0 ? (
                <p className="logs-panel__empty">{t("noLiveEvents")}</p>
              ) : (
                <ul className="logs-tape-list">
                  {liveTape.map((item, index) => (
                    <li className="logs-tape-row" key={`${item}-${index}`}>
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          <Card className="logs-card logs-stream-events" padded={false}>
            <div className="logs-card__header">
              <div>
                <h3>{t("streamEventsTitle")}</h3>
                <p>{t("logEvents")}</p>
              </div>
              <Badge>{logEvents.length}</Badge>
            </div>
            <div className="logs-card__body">
              {logEvents.length === 0 ? (
                <p className="logs-panel__empty">{t("noLogEvents")}</p>
              ) : (
                <EventFeedCard title={t("logEvents")} events={logEvents} kind="log" />
              )}
            </div>
          </Card>

          {tail ? (
            <Card className="logs-card logs-payload-seam" padded={false}>
              <div className="logs-card__header">
                <div>
                  <h3>{t("filteredTailSeam")}</h3>
                  <p>{t("tailPayload")}</p>
                </div>
                <Badge>{t("cursorValue", { cursor: tail.cursor ?? 0 })}</Badge>
              </div>
              <div className="logs-card__body">
                <JsonDetails
                  title={t("tailPayload")}
                  payload={{
                    cursor: tail.cursor,
                    lines: filteredLogEntries,
                    reset: tail.reset,
                  }}
                />
              </div>
            </Card>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
