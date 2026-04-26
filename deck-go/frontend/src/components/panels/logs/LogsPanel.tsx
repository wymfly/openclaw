import { useCallback, useEffect, useRef, useState } from "react";
import type { DeckGoLogStreamEvent } from "../../../../../contracts/generated/ts/deck-api.generated";
import { fetchLogsTail, streamLogEvents, type DeckGoLogsTailResponse } from "../../../api";
import { parseLogEvent, summarizeLogEvent } from "../../../stream-contract";
import { EventFeedCard, JsonDetails } from "../../shared/ShellComponents";

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

export function LogsPanel() {
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

  const refreshLogsTail = useCallback(async (cursor?: number) => {
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
      setError(tailError instanceof Error ? tailError.message : "failed to fetch logs tail");
    }
  }, []);

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
          setLiveTape((current) => ["log reset", ...current].slice(0, 10));
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
        setError(
          streamError instanceof Error ? streamError.message : "failed to connect logs stream",
        );
      }
    });

    return () => {
      controller.abort();
    };
  }, [streamingEnabled]);

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
    <section className="deckgo-panel-workspace deck-ui-logs">
      <div className="deckgo-column deck-ui-logs-column">
        <article className="deckgo-card is-float deck-ui-logs-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Logs tail</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Logs are loaded from `/logs` and live `/logs/stream` events, with local filtering and
            export preview controls.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-logs-body">
            <div className="deckgo-pill-row deck-ui-logs-status-row">
              <span className={`deckgo-pill ${tailState === "ready" ? "is-positive" : "is-muted"}`}>
                Tail {tailState}
              </span>
              <span
                className={`deckgo-pill ${streamState === "connected" ? "is-positive" : "is-muted"}`}
              >
                Stream {streamState}
              </span>
              <span className="deckgo-pill">cursor {tail?.cursor ?? 0}</span>
              <span className="deckgo-pill">{filteredLogEntries.length} visible</span>
            </div>
            <div className="deckgo-surface-tile deck-ui-logs-surface deck-ui-logs-filter">
              <p className="deckgo-surface-label">Filters</p>
              <div className="deckgo-pill-row deck-ui-logs-levels">
                {ALL_LOG_LEVELS.map((level) => (
                  <label key={level} className="deckgo-checkbox-row deck-ui-logs-level">
                    <input
                      checked={selectedLevels.includes(level)}
                      onChange={() => toggleLevelFilter(level)}
                      type="checkbox"
                    />
                    {level}
                  </label>
                ))}
              </div>
              <div className="deckgo-actions deck-ui-logs-controls">
                <select
                  aria-label="Log source filter"
                  className="deckgo-input deck-ui-logs-input"
                  onChange={(event) => setSourceFilter(event.target.value as LogSource | "all")}
                  value={sourceFilter}
                >
                  {ALL_LOG_SOURCES.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </select>
                <input
                  className="deckgo-input deck-ui-logs-input"
                  onChange={(event) => setSessionFilter(event.target.value)}
                  placeholder="session key"
                  value={sessionFilter}
                />
              </div>
            </div>
            <div className="deckgo-actions deck-ui-logs-actions">
              <button
                className="deckgo-button deck-ui-logs-button"
                type="button"
                onClick={() => void refreshLogsTail(tail?.cursor)}
              >
                Refresh tail
              </button>
              <button
                className="deckgo-button deck-ui-logs-button"
                onClick={() => setStreamingEnabled((current) => !current)}
                type="button"
              >
                {streamingEnabled ? "Pause stream" : "Resume stream"}
              </button>
              <button
                className="deckgo-button deck-ui-logs-button"
                onClick={clearLocalLogs}
                type="button"
              >
                Clear local logs
              </button>
              <button
                className="deckgo-button deck-ui-logs-button"
                onClick={() => setExportPreview(buildLogExport(filteredLogEntries))}
                type="button"
              >
                Prepare export
              </button>
            </div>
            <div className="deckgo-surface-tile deck-ui-logs-surface deck-ui-logs-lines">
              <p className="deckgo-surface-label">Latest lines</p>
              {filteredLogEntries.length === 0 ? (
                <p className="deckgo-note">No log lines yet.</p>
              ) : (
                <ul className="deckgo-shell-list deck-ui-logs-list">
                  {filteredLogEntries.slice(0, 50).map((entry, index) => (
                    <li key={`log-line-${index}-${entry.timestamp}`}>
                      <div className="deckgo-selectable-card deck-ui-logs-row">
                        <strong>
                          [{entry.level}] [{entry.source}]
                        </strong>
                        <div className="deckgo-meta">
                          {entry.timestamp}
                          {entry.sessionKey ? ` | ${entry.sessionKey}` : ""}
                        </div>
                        <pre className="deckgo-code deck-ui-logs-code">{entry.message}</pre>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {exportPreview ? (
              <div className="deckgo-surface-tile deck-ui-logs-surface deck-ui-logs-export">
                <p className="deckgo-surface-label">Prepared log export</p>
                <pre className="deckgo-code deck-ui-logs-code">{exportPreview}</pre>
              </div>
            ) : null}
            {error ? <p className="deckgo-note deck-ui-logs-error">{error}</p> : null}
          </div>
        </article>
      </div>

      <aside className="deckgo-column deck-ui-logs-column deck-ui-logs-sidecar">
        <article className="deckgo-card deck-ui-logs-card deck-ui-logs-tape">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Live event tape</h2>
          </div>
          <div className="deckgo-card-body deck-ui-logs-body">
            {liveTape.length === 0 ? (
              <p className="deckgo-note">No live log events captured yet.</p>
            ) : (
              <ul className="deckgo-shell-list deck-ui-logs-list">
                {liveTape.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        </article>

        <article className="deckgo-card deck-ui-logs-card deck-ui-logs-stream-events">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Log stream events</h2>
          </div>
          <div className="deckgo-card-body deck-ui-logs-body">
            {logEvents.length === 0 ? (
              <p className="deckgo-note">No log events yet.</p>
            ) : (
              <EventFeedCard title="Log events" events={logEvents} kind="log" />
            )}
          </div>
        </article>

        {tail ? (
          <article className="deckgo-card deck-ui-logs-card deck-ui-logs-seam">
            <div className="deckgo-card-header">
              <h2 className="deckgo-card-title">Filtered tail seam</h2>
            </div>
            <div className="deckgo-card-body deck-ui-logs-body">
              <JsonDetails
                title="Logs tail payload"
                payload={{
                  cursor: tail.cursor,
                  lines: filteredLogEntries,
                  reset: tail.reset,
                }}
              />
            </div>
          </article>
        ) : null}
      </aside>
    </section>
  );
}
