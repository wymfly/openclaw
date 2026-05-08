import { useCallback, useEffect, useMemo, useState } from "react";
import type { DeckGoLogStreamEvent } from "../../../../../contracts/generated/ts/deck-api.generated";
import type { DeckGoLogsTailResponse } from "../../../api-types";
import { useLogsTailQuery, useLogTailProjectionSubscription } from "../../../data/modules/logs";
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
import {
  IconCopy,
  IconEye,
  IconFilter,
  IconInfo,
  IconRefresh,
  IconSearch,
  IconStream,
  IconX,
} from "../../../design-system/icons";
import { useTranslations } from "../../../i18n/provider";
import { parseLogEvent, summarizeLogEvent } from "../../../stream-contract";
import "./logs-panel.css";

type LogsState = "idle" | "loading" | "ready";
type StreamState = "idle" | "connecting" | "connected" | "reconnecting" | "stale" | "error";
type LogLevel = "debug" | "info" | "warn" | "error";

type ParsedLogEntry = {
  id: string;
  cursor?: number;
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
  sessionKey?: string;
  correlationId?: string;
  fields?: Record<string, unknown>;
  stack?: string;
  raw: unknown;
};

const LOG_CURSOR_KEY = "deckGoLogsCursor";
const LOG_BUFFER_LIMIT = 5_000;
const ALL_LOG_LEVELS: LogLevel[] = ["debug", "info", "warn", "error"];
const ALL_VALUE = "__all__";
const LOG_LEVEL_MAP: Record<string, LogLevel> = {
  DEBUG: "debug",
  ERR: "error",
  ERROR: "error",
  INFO: "info",
  WARN: "warn",
  WARNING: "warn",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function formatLogLine(line: unknown) {
  if (typeof line === "string") {
    return line;
  }
  return JSON.stringify(line, null, 2);
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizeLogLevel(value: unknown): LogLevel {
  if (typeof value !== "string") {
    return "info";
  }
  return LOG_LEVEL_MAP[value.toUpperCase()] ?? "info";
}

function normalizeLogSource(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    return "unknown";
  }
  return value.trim().toLowerCase();
}

function extractSessionKey(message: string) {
  return (
    message.match(/(?:sessionKey|session|key)=([A-Za-z0-9:._-]+)/)?.[1] ??
    message.match(/session:([A-Za-z0-9:._-]+)/)?.[1] ??
    undefined
  );
}

function extractCorrelationId(message: string) {
  return (
    message.match(/(?:correlationId|correlation|traceId|trace)=([A-Za-z0-9:._-]+)/)?.[1] ??
    message.match(/\b(trace-[A-Za-z0-9._-]+)\b/)?.[1] ??
    undefined
  );
}

function parseObjectLogLine(record: Record<string, unknown>, index: number): ParsedLogEntry | null {
  const message =
    stringValue(record.message) ??
    stringValue(record.msg) ??
    stringValue(record.text) ??
    stringValue(record.line) ??
    formatLogLine(record).trim();
  if (!message) {
    return null;
  }

  const cursor = numberValue(record.cursor);
  const timestamp =
    stringValue(record.ts) ??
    stringValue(record.timestamp) ??
    stringValue(record.time) ??
    new Date().toISOString();
  const rawFields = asRecord(record.fields);
  return {
    id:
      cursor === undefined
        ? `row:${index}:${timestamp}:${message.slice(0, 36)}`
        : `cursor:${cursor}:${index}`,
    correlationId:
      stringValue(record.correlationId) ??
      stringValue(record.traceId) ??
      stringValue(record.trace) ??
      extractCorrelationId(message),
    cursor,
    fields: rawFields ?? undefined,
    level: normalizeLogLevel(record.level),
    message,
    raw: record,
    sessionKey:
      stringValue(record.sessionKey) ?? stringValue(record.session) ?? extractSessionKey(message),
    source: normalizeLogSource(record.source),
    stack: stringValue(record.stack),
    timestamp,
  };
}

function parseStringLogLine(line: string, index: number): ParsedLogEntry | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  const structured = trimmed.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\s+\[(\w+)]\s+\[(\w+)]\s+(.*)$/);
  const cursor = numberValue(trimmed.match(/\bcursor=([0-9]+)/)?.[1]);
  if (structured) {
    const [, timestamp, rawLevel, rawSource, message] = structured;
    const text = message ?? trimmed;
    return {
      id:
        cursor === undefined
          ? `row:${index}:${timestamp}:${text.slice(0, 36)}`
          : `cursor:${cursor}:${index}`,
      correlationId: extractCorrelationId(text),
      cursor,
      level: normalizeLogLevel(rawLevel),
      message: text,
      raw: line,
      sessionKey: extractSessionKey(text),
      source: normalizeLogSource(rawSource),
      timestamp: timestamp ?? new Date().toISOString(),
    };
  }

  return {
    id:
      cursor === undefined
        ? `row:${index}:raw:${trimmed.slice(0, 36)}`
        : `cursor:${cursor}:${index}`,
    correlationId: extractCorrelationId(trimmed),
    cursor,
    level: normalizeLogLevel(trimmed.match(/\[(\w+)]/)?.[1]),
    message: trimmed,
    raw: line,
    sessionKey: extractSessionKey(trimmed),
    source: "unknown",
    timestamp: new Date().toISOString(),
  };
}

function parseLogLine(line: unknown, index: number): ParsedLogEntry | null {
  const record = asRecord(line);
  if (record) {
    return parseObjectLogLine(record, index);
  }
  if (typeof line === "string") {
    return parseStringLogLine(line, index);
  }
  return null;
}

function buildLogExport(entries: ParsedLogEntry[]) {
  return entries
    .map((entry) =>
      [
        entry.timestamp,
        `[${entry.level.toUpperCase()}]`,
        `[${entry.source}]`,
        entry.sessionKey ? `sessionKey=${entry.sessionKey}` : "",
        entry.correlationId ? `correlationId=${entry.correlationId}` : "",
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

function MetricTile(props: {
  className?: string;
  hint?: string;
  label: string;
  value: string | number;
}) {
  return (
    <article className={["logs-metric", props.className].filter(Boolean).join(" ")}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
      {props.hint ? <small>{props.hint}</small> : null}
    </article>
  );
}

export function LogsPanel() {
  const t = useTranslations("logs");
  const [tail, setTail] = useState<DeckGoLogsTailResponse | null>(null);
  const [streamState, setStreamState] = useState<StreamState>("idle");
  const [logEvents, setLogEvents] = useState<DeckGoLogStreamEvent[]>([]);
  const [selectedLevels, setSelectedLevels] = useState(ALL_LOG_LEVELS);
  const [sourceFilter, setSourceFilter] = useState(ALL_VALUE);
  const [sessionFilter, setSessionFilter] = useState(ALL_VALUE);
  const [correlationFilter, setCorrelationFilter] = useState("");
  const [query, setQuery] = useState("");
  const [streamingEnabled, setStreamingEnabled] = useState(true);
  const [exportPreview, setExportPreview] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState("");
  const [selectedRawEvent, setSelectedRawEvent] = useState<DeckGoLogStreamEvent | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [streamError, setStreamError] = useState("");
  const [tailCursor, setTailCursor] = useState<number | undefined>(() => {
    const initialCursorRaw =
      typeof window === "undefined"
        ? ""
        : window.localStorage.getItem(LOG_CURSOR_KEY)?.trim() || "";
    const initialCursor = initialCursorRaw ? Number.parseInt(initialCursorRaw, 10) : undefined;
    return Number.isFinite(initialCursor) ? initialCursor : undefined;
  });
  const tailQuery = useLogsTailQuery({ cursor: tailCursor, limit: 200, maxBytes: 65536 });

  const refreshLogsTail = useCallback(
    (cursor?: number) => {
      setTailCursor(cursor);
      if (cursor === tailCursor) {
        void tailQuery.refetch();
      }
    },
    [tailCursor, tailQuery],
  );

  useEffect(() => {
    if (!tailQuery.data) {
      return;
    }
    setTail(tailQuery.data);
    if (typeof tailQuery.data.cursor === "number") {
      window.localStorage.setItem(LOG_CURSOR_KEY, String(tailQuery.data.cursor));
    }
  }, [tailQuery.data]);

  const handleLogStreamEvent = useCallback((event: DeckGoLogStreamEvent) => {
    setLogEvents((current) => [event, ...current].slice(0, 30));

    const parsed = parseLogEvent(event);
    if (parsed.kind === "log.reset") {
      setTail((current) => (current ? { ...current, lines: [], reset: true } : current));
      setSelectedEntryId("");
      return;
    }
    if (parsed.kind === "log.batch") {
      if (typeof parsed.payload.cursor === "number") {
        window.localStorage.setItem(LOG_CURSOR_KEY, String(parsed.payload.cursor));
      }
      setTail((current) => ({
        cursor: parsed.payload.cursor ?? current?.cursor,
        lines: [...(current?.lines ?? []), ...(parsed.payload.lines ?? [])].slice(
          -LOG_BUFFER_LIMIT,
        ),
        reset: false,
      }));
    }
  }, []);

  useLogTailProjectionSubscription({
    enabled: streamingEnabled,
    onEvent: handleLogStreamEvent,
    onStatusChange(nextState) {
      setStreamState(nextState.status);
      if (nextState.status === "error") {
        setStreamError(t("failedConnectStream"));
      }
    },
  });

  const parsedLogEntries = useMemo(
    () => (tail?.lines ?? []).map(parseLogLine).filter((entry) => entry !== null),
    [tail?.lines],
  );
  const sourceOptions = useMemo(
    () =>
      Array.from(new Set(parsedLogEntries.map((entry) => entry.source))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [parsedLogEntries],
  );
  const sessionOptions = useMemo(
    () =>
      Array.from(
        new Set(
          parsedLogEntries
            .map((entry) => entry.sessionKey)
            .filter((entry): entry is string => Boolean(entry)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [parsedLogEntries],
  );
  const filteredLogEntries = useMemo(() => {
    const correlation = correlationFilter.trim().toLowerCase();
    const freeText = query.trim().toLowerCase();
    return parsedLogEntries.filter((entry) => {
      if (!selectedLevels.includes(entry.level)) {
        return false;
      }
      if (sourceFilter !== ALL_VALUE && entry.source !== sourceFilter) {
        return false;
      }
      if (sessionFilter !== ALL_VALUE && entry.sessionKey !== sessionFilter) {
        return false;
      }
      if (correlation && entry.correlationId?.toLowerCase() !== correlation) {
        return false;
      }
      if (!freeText) {
        return true;
      }
      const haystack = [
        entry.timestamp,
        entry.level,
        entry.source,
        entry.sessionKey ?? "",
        entry.correlationId ?? "",
        entry.message,
        JSON.stringify(entry.fields ?? {}),
      ]
        .join("|")
        .toLowerCase();
      return haystack.includes(freeText);
    });
  }, [correlationFilter, parsedLogEntries, query, selectedLevels, sessionFilter, sourceFilter]);

  useEffect(() => {
    if (selectedEntryId && filteredLogEntries.some((entry) => entry.id === selectedEntryId)) {
      return;
    }
    setSelectedEntryId(filteredLogEntries[0]?.id ?? "");
  }, [filteredLogEntries, selectedEntryId]);

  const selectedEntry = filteredLogEntries.find((entry) => entry.id === selectedEntryId) ?? null;
  const warnCount = filteredLogEntries.filter((entry) => entry.level === "warn").length;
  const errorCount = filteredLogEntries.filter((entry) => entry.level === "error").length;

  const toggleLevelFilter = (level: LogLevel) => {
    setSelectedLevels((current) =>
      current.includes(level) ? current.filter((item) => item !== level) : [...current, level],
    );
  };

  const clearFilters = () => {
    setSelectedLevels(ALL_LOG_LEVELS);
    setSourceFilter(ALL_VALUE);
    setSessionFilter(ALL_VALUE);
    setCorrelationFilter("");
    setQuery("");
  };

  const clearLocalLogs = () => {
    setTail((current) => (current ? { ...current, lines: [] } : current));
    setLogEvents([]);
    setSelectedRawEvent(null);
    setSelectedEntryId("");
    setExportPreview(null);
  };

  const prepareExport = () => {
    setExportPreview(buildLogExport(filteredLogEntries));
  };

  const copySelectedLine = async () => {
    if (!selectedEntry) {
      return;
    }
    try {
      await navigator.clipboard?.writeText(buildLogExport([selectedEntry]));
    } catch {
      // Clipboard availability varies in tests and hardened browsers; the raw line stays visible.
    }
    setCopyState("copied");
    window.setTimeout(() => setCopyState("idle"), 1400);
  };

  const labelForLevel = (level: LogLevel) => t(level);
  const labelForSource = (source: string) => {
    if (source === "gateway" || source === "agent" || source === "channel") {
      return t(source);
    }
    return source;
  };
  const tailState: LogsState = tailQuery.isLoading && !tail ? "loading" : tail ? "ready" : "idle";
  const tailError = tailQuery.error
    ? tailQuery.error instanceof Error
      ? tailQuery.error.message
      : t("failedFetchTail")
    : "";
  const error = tailError || streamError;

  return (
    <section className="logs-panel" data-testid="logs-panel">
      <header className="logs-panel__header">
        <div>
          <p className="logs-panel__eyebrow">{t("eyebrow")}</p>
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
          <label className="logs-toggle">
            <Toggle
              aria-label={streamingEnabled ? t("pauseStream") : t("resumeStream")}
              checked={streamingEnabled}
              onCheckedChange={setStreamingEnabled}
            />
            <span>{streamingEnabled ? t("streamLive") : t("streamPaused")}</span>
          </label>
          <Button size="sm" onClick={() => refreshLogsTail(tail?.cursor)}>
            <span className="logs-button-content">
              <IconRefresh size={14} />
              {t("refreshTail")}
            </span>
          </Button>
        </div>
      </header>

      {error ? (
        <div className="logs-panel__banner" role="status">
          <Badge variant="err">{t("error")}</Badge>
          <span>{error}</span>
        </div>
      ) : null}

      <section className="logs-filter-bar" aria-label={t("filters")}>
        <label className="logs-field logs-field--search">
          <span>{t("freeText")}</span>
          <span className="logs-input-wrap">
            <IconSearch size={14} />
            <Input
              aria-label={t("freeTextFilter")}
              inputSize="sm"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("freeTextPlaceholder")}
              type="search"
              value={query}
            />
          </span>
        </label>
        <label className="logs-field logs-field--correlation">
          <span>{t("correlationId")}</span>
          <span className="logs-input-wrap">
            <IconFilter size={14} />
            <Input
              aria-label={t("correlationFilter")}
              inputSize="sm"
              onChange={(event) => setCorrelationFilter(event.target.value)}
              placeholder={t("correlationPlaceholder")}
              value={correlationFilter}
            />
          </span>
        </label>
        <fieldset className="logs-levels">
          <legend>{t("level")}</legend>
          <span className="logs-level-row">
            {ALL_LOG_LEVELS.map((level) => (
              <label className={`logs-level-pill logs-level-pill--${level}`} key={level}>
                <input
                  checked={selectedLevels.includes(level)}
                  onChange={() => toggleLevelFilter(level)}
                  type="checkbox"
                />
                {labelForLevel(level)}
              </label>
            ))}
          </span>
        </fieldset>
        <label className="logs-field logs-field--select">
          <span>{t("source")}</span>
          <Select
            aria-label={t("sourceFilter")}
            onChange={(event) => setSourceFilter(event.target.value)}
            selectSize="sm"
            value={sourceFilter}
          >
            <option value={ALL_VALUE}>{t("allSources")}</option>
            {sourceOptions.map((source) => (
              <option key={source} value={source}>
                {labelForSource(source)}
              </option>
            ))}
          </Select>
        </label>
        <label className="logs-field logs-field--select">
          <span>{t("session")}</span>
          <Select
            aria-label={t("sessionFilter")}
            onChange={(event) => setSessionFilter(event.target.value)}
            selectSize="sm"
            value={sessionFilter}
          >
            <option value={ALL_VALUE}>{t("allSessions")}</option>
            {sessionOptions.map((sessionKey) => (
              <option key={sessionKey} value={sessionKey}>
                {sessionKey}
              </option>
            ))}
          </Select>
        </label>
        <Button size="sm" onClick={clearFilters}>
          <span className="logs-button-content">
            <IconX size={14} />
            {t("clearAll")}
          </span>
        </Button>
      </section>

      <div className="logs-workbench">
        <section className="log-stream" aria-label={t("tailTitle")}>
          <div className="log-stream__metrics">
            <MetricTile
              hint={t("cursorValue", { cursor: tail?.cursor ?? 0 })}
              label={t("cursor")}
              value={tail?.cursor ?? 0}
            />
            <MetricTile
              hint={t("afterLocalFilters")}
              label={t("visibleRows")}
              value={filteredLogEntries.length}
            />
            <MetricTile
              hint={t("tailLimitHint")}
              label={t("loadedRows")}
              value={parsedLogEntries.length}
            />
            <MetricTile
              className="logs-metric--warn"
              hint={t("visibleWindow")}
              label={t("warningRows")}
              value={warnCount}
            />
            <MetricTile
              className="logs-metric--error"
              hint={t("visibleWindow")}
              label={t("errorRows")}
              value={errorCount}
            />
            <MetricTile
              hint={t("localBufferCap")}
              label={t("buffer")}
              value={LOG_BUFFER_LIMIT.toLocaleString()}
            />
          </div>

          <div className="log-stream__action-row">
            <Button variant="primary" size="sm" onClick={() => refreshLogsTail(tail?.cursor)}>
              <span className="logs-button-content">
                <IconRefresh size={14} />
                {t("refreshTail")}
              </span>
            </Button>
            <Button
              aria-pressed={!streamingEnabled}
              size="sm"
              onClick={() => setStreamingEnabled((current) => !current)}
            >
              <span className="logs-button-content">
                <IconStream size={14} />
                {streamingEnabled ? t("pauseStream") : t("resumeStream")}
              </span>
            </Button>
            <Button size="sm" onClick={clearLocalLogs}>
              <span className="logs-button-content">
                <IconX size={14} />
                {t("clearLocalLogs")}
              </span>
            </Button>
            <Button size="sm" onClick={prepareExport}>
              <span className="logs-button-content">
                <IconCopy size={14} />
                {t("prepareExport")}
              </span>
            </Button>
            <span className="log-stream__live">
              <span
                className={`logs-live-dot${streamingEnabled ? "" : " logs-live-dot--paused"}`}
              />
              {streamingEnabled ? t("streamingHint") : t("streamPausedHint")}
            </span>
          </div>

          <Card className="logs-card logs-tail-card" padded={false}>
            <div className="logs-card__header">
              <div>
                <h3>{t("tailTitle")}</h3>
                <p>
                  {t("visibleOfLoaded", {
                    visible: filteredLogEntries.length,
                    loaded: parsedLogEntries.length,
                  })}
                </p>
              </div>
              <Badge variant={tailStateVariant(tailState)}>{t(tailState)}</Badge>
            </div>
            {filteredLogEntries.length === 0 ? (
              <div className="log-stream__empty">
                <IconInfo size={22} />
                <h4>{t("noLinesMatch")}</h4>
                <p>{parsedLogEntries.length === 0 ? t("noLogLines") : t("loosenFilters")}</p>
              </div>
            ) : (
              <ul className="log-row-list" role="list">
                <li className="log-row log-row--header" aria-hidden="true">
                  <span>{t("time")}</span>
                  <span>{t("level")}</span>
                  <span>{t("source")}</span>
                  <span>{t("sessionTrace")}</span>
                  <span>{t("message")}</span>
                  <span>{t("cursor")}</span>
                </li>
                {filteredLogEntries.slice(0, 200).map((entry) => (
                  <li key={entry.id}>
                    <button
                      className={`log-row${entry.id === selectedEntryId ? " log-row--selected" : ""}`}
                      onClick={() => setSelectedEntryId(entry.id)}
                      type="button"
                    >
                      <span className="log-row__ts">{entry.timestamp}</span>
                      <span>
                        <Badge variant={levelVariant(entry.level)}>
                          {labelForLevel(entry.level)}
                        </Badge>
                      </span>
                      <span className="log-row__source">{labelForSource(entry.source)}</span>
                      <span className="log-row__session">
                        {entry.sessionKey ?? t("unavailable")}
                        {entry.correlationId ? <small>{entry.correlationId}</small> : null}
                      </span>
                      <span className="log-row__message">{entry.message}</span>
                      <span className="log-row__cursor">{entry.cursor ?? t("unavailable")}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {exportPreview !== null ? (
            <Card className="logs-card logs-export-card" padded={false}>
              <div className="logs-card__header">
                <div>
                  <h3>{t("preparedLogExport")}</h3>
                  <p>{t("visibleCount", { count: filteredLogEntries.length })}</p>
                </div>
                <Badge>{t("previewOnly")}</Badge>
              </div>
              <Code
                aria-label={t("preparedLogExport")}
                className="logs-code logs-code--export"
                content={exportPreview || t("noLogLines")}
                language="log"
              />
            </Card>
          ) : null}
        </section>

        <aside className="details-pane" aria-label={t("selectedLine")}>
          <Card className="logs-card details-card" padded={false}>
            {selectedEntry ? (
              <>
                <div className={`details-pane__hero details-pane__hero--${selectedEntry.level}`}>
                  <div className="details-pane__hero-top">
                    <Badge variant={levelVariant(selectedEntry.level)}>
                      {labelForLevel(selectedEntry.level)}
                    </Badge>
                    <Badge>{labelForSource(selectedEntry.source)}</Badge>
                    <span>#{selectedEntry.cursor ?? t("unavailable")}</span>
                  </div>
                  <h3>{selectedEntry.message}</h3>
                  <p>
                    <span>{selectedEntry.timestamp}</span>
                    <span>{selectedEntry.sessionKey ?? t("unavailable")}</span>
                    {selectedEntry.correlationId ? (
                      <span>{selectedEntry.correlationId}</span>
                    ) : null}
                  </p>
                  <div className="details-pane__actions">
                    <Button size="sm" onClick={() => void copySelectedLine()}>
                      <span className="logs-button-content">
                        <IconCopy size={14} />
                        {copyState === "copied" ? t("copied") : t("copyLine")}
                      </span>
                    </Button>
                    {selectedEntry.correlationId ? (
                      <Button
                        size="sm"
                        onClick={() => setCorrelationFilter(selectedEntry.correlationId ?? "")}
                      >
                        <span className="logs-button-content">
                          <IconFilter size={14} />
                          {t("filterByCorrelation")}
                        </span>
                      </Button>
                    ) : null}
                  </div>
                </div>

                <section className="details-pane__section">
                  <div className="details-pane__section-head">
                    <h3>{t("structuredFields")}</h3>
                    <span>
                      {t("fieldCount", { count: Object.keys(selectedEntry.fields ?? {}).length })}
                    </span>
                  </div>
                  {selectedEntry.fields && Object.keys(selectedEntry.fields).length > 0 ? (
                    <dl className="details-pane__kv">
                      {Object.entries(selectedEntry.fields).map(([key, value]) => (
                        <div key={key}>
                          <dt>{key}</dt>
                          <dd>{String(value)}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="details-pane__muted">{t("noStructuredFields")}</p>
                  )}
                </section>

                <section className="details-pane__section">
                  <div className="details-pane__section-head">
                    <h3>{t("correlationContext")}</h3>
                  </div>
                  {selectedEntry.correlationId ? (
                    <p>
                      {t("correlationContextDescription", {
                        correlationId: selectedEntry.correlationId,
                      })}
                    </p>
                  ) : (
                    <p className="details-pane__muted">{t("noCorrelationId")}</p>
                  )}
                </section>

                {selectedEntry.stack ? (
                  <section className="details-pane__section">
                    <div className="details-pane__section-head">
                      <h3>{t("stackTrace")}</h3>
                      <span>{t("attachedOnError")}</span>
                    </div>
                    <pre className="details-pane__stack">{selectedEntry.stack}</pre>
                  </section>
                ) : null}

                <section className="details-pane__section">
                  <div className="details-pane__section-head">
                    <h3>{t("rawLine")}</h3>
                    <span>DeckGoLogsTailResponse.lines[i]</span>
                  </div>
                  <Code
                    aria-label={t("rawLine")}
                    className="logs-code"
                    content={formatLogLine(selectedEntry.raw)}
                    language="json"
                  />
                </section>
              </>
            ) : (
              <div className="details-pane__empty">
                <IconEye size={28} />
                <h3>{t("noLineSelected")}</h3>
                <p>{t("noLineSelectedDescription")}</p>
              </div>
            )}
          </Card>

          <Card className="logs-card logs-live-tape" padded={false}>
            <div className="logs-card__header">
              <div>
                <h3>{t("liveEventTape")}</h3>
                <p>{t("streamStatus", { state: t(streamState) })}</p>
              </div>
              <Badge variant={streamStateVariant(streamState)}>{t(streamState)}</Badge>
            </div>
            {logEvents.length === 0 ? (
              <p className="logs-panel__empty">{t("noLiveEvents")}</p>
            ) : (
              <ul className="logs-tape-list">
                {logEvents.slice(0, 8).map((event, index) => (
                  <li key={`${event.id ?? "event"}-${index}`}>
                    <button
                      className="logs-tape-row"
                      onClick={() => setSelectedRawEvent(event)}
                      type="button"
                    >
                      <span>{event.id ?? t("unavailable")}</span>
                      <strong>{event.event ?? "unknown"}</strong>
                      <small>{summarizeLogEvent(event)}</small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="logs-card logs-raw-card" padded={false}>
            <div className="logs-card__header">
              <div>
                <h3>{selectedRawEvent ? t("rawStreamEvent") : t("tailPayload")}</h3>
                <p>{selectedRawEvent ? "/logs/stream" : "GET /logs"}</p>
              </div>
              <Badge>{selectedRawEvent?.event ?? t("tailTitle")}</Badge>
            </div>
            <Code
              aria-label={selectedRawEvent ? t("rawStreamEvent") : t("tailPayload")}
              className="logs-code logs-code--raw"
              content={formatLogLine(selectedRawEvent ?? tail ?? {})}
              language="json"
            />
          </Card>
        </aside>
      </div>
    </section>
  );
}
