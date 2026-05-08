import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import type { DeckGoActivityEvent } from "../../../api";
import { useActivityEventsQuery } from "../../../data/modules/activity";
import {
  IconAgent,
  IconAlert,
  IconCheck,
  IconClock,
  IconCopy,
  IconFilter,
  IconInfo,
  IconRefresh,
  IconSearch,
  IconShield,
  IconStream,
  IconSubagents,
  IconX,
} from "../../../design-system/icons";
import type { IconProps } from "../../../design-system/icons";
import { useTranslations } from "../../../i18n/provider";
import {
  GatewayNotConfiguredEmptyState,
  gatewayNotConfiguredValue,
  isGatewayNotConfiguredValue,
} from "../../runtime/GatewayNotConfiguredEmptyState";
import { useActivitySSE } from "./useActivitySSE";
import "./activity-panel.css";

type PanelState = "idle" | "loading" | "ready" | "error";
type ActivityFamily = "all" | "agent" | "tool" | "msg" | "subagent" | "channel" | "ops";
type ActivitySeverity = "all" | "info" | "ok" | "warn" | "err";
type ActivityTimeRange = "1h" | "6h" | "24h" | "all";

type EventPresentation = {
  family: Exclude<ActivityFamily, "all">;
  severity: Exclude<ActivitySeverity, "all"> | "muted";
  Icon: ComponentType<IconProps>;
};

const ACTIVITY_LIMIT = 100;

const FAMILY_FILTERS: Array<{ id: ActivityFamily; labelKey: string }> = [
  { id: "all", labelKey: "familyAll" },
  { id: "agent", labelKey: "familyAgent" },
  { id: "tool", labelKey: "familyTools" },
  { id: "msg", labelKey: "familyMessages" },
  { id: "subagent", labelKey: "familySubagents" },
  { id: "channel", labelKey: "familyChannels" },
  { id: "ops", labelKey: "familyOps" },
];

const SEVERITY_FILTERS: Array<{ id: ActivitySeverity; labelKey: string }> = [
  { id: "all", labelKey: "severityAll" },
  { id: "info", labelKey: "severityInfo" },
  { id: "ok", labelKey: "severityOk" },
  { id: "warn", labelKey: "severityWarn" },
  { id: "err", labelKey: "severityErrors" },
];

const TIME_RANGES: Array<{ id: ActivityTimeRange; labelKey: string; windowMs: number }> = [
  { id: "1h", labelKey: "time1h", windowMs: 60 * 60 * 1_000 },
  { id: "6h", labelKey: "time6h", windowMs: 6 * 60 * 60 * 1_000 },
  { id: "24h", labelKey: "time24h", windowMs: 24 * 60 * 60 * 1_000 },
  { id: "all", labelKey: "timeAll", windowMs: Number.POSITIVE_INFINITY },
];

const TYPE_PRESENTATION: Record<string, EventPresentation> = {
  "agent.start": { family: "agent", severity: "ok", Icon: IconAgent },
  "agent.stop": { family: "agent", severity: "info", Icon: IconAgent },
  "agent.error": { family: "agent", severity: "err", Icon: IconAlert },
  "agent.handoff": { family: "agent", severity: "info", Icon: IconAgent },
  "tool.call": { family: "tool", severity: "info", Icon: IconShield },
  "tool.result": { family: "tool", severity: "ok", Icon: IconCheck },
  "tool.deny": { family: "tool", severity: "warn", Icon: IconShield },
  tool_call: { family: "tool", severity: "info", Icon: IconShield },
  tool: { family: "tool", severity: "info", Icon: IconShield },
  "message.in": { family: "msg", severity: "info", Icon: IconStream },
  "message.out": { family: "msg", severity: "ok", Icon: IconStream },
  chat: { family: "msg", severity: "ok", Icon: IconStream },
  "subagent.spawn": { family: "subagent", severity: "info", Icon: IconSubagents },
  "subagent.kill": { family: "subagent", severity: "warn", Icon: IconSubagents },
  "subagent.steer": { family: "subagent", severity: "info", Icon: IconSubagents },
  subagent: { family: "subagent", severity: "info", Icon: IconSubagents },
  "channel.connect": { family: "channel", severity: "ok", Icon: IconStream },
  "channel.disconnect": { family: "channel", severity: "warn", Icon: IconStream },
  "channel.error": { family: "channel", severity: "err", Icon: IconAlert },
  "config.change": { family: "ops", severity: "info", Icon: IconFilter },
  "auth.rotate": { family: "ops", severity: "warn", Icon: IconShield },
  "alert.fire": { family: "ops", severity: "err", Icon: IconAlert },
  "approval.request": { family: "ops", severity: "warn", Icon: IconShield },
  "approval.grant": { family: "ops", severity: "ok", Icon: IconCheck },
  "approval.deny": { family: "ops", severity: "err", Icon: IconX },
  "run.completed": { family: "agent", severity: "ok", Icon: IconCheck },
  "run.failed": { family: "agent", severity: "err", Icon: IconAlert },
  "session.created": { family: "agent", severity: "info", Icon: IconAgent },
};

function eventPresentation(type: string): EventPresentation {
  const exact = TYPE_PRESENTATION[type];
  if (exact) {
    return exact;
  }
  if (type.startsWith("agent.") || type.startsWith("run.") || type.startsWith("session.")) {
    return { family: "agent", severity: "info", Icon: IconAgent };
  }
  if (type.startsWith("tool")) {
    return { family: "tool", severity: "info", Icon: IconShield };
  }
  if (type.startsWith("message.") || type.startsWith("chat")) {
    return { family: "msg", severity: "info", Icon: IconStream };
  }
  if (type.startsWith("subagent")) {
    return { family: "subagent", severity: "info", Icon: IconSubagents };
  }
  if (type.startsWith("channel.")) {
    return { family: "channel", severity: "info", Icon: IconStream };
  }
  if (type.startsWith("alert.") || type.startsWith("approval.") || type.startsWith("config.")) {
    return { family: "ops", severity: "info", Icon: IconInfo };
  }
  return { family: "ops", severity: "muted", Icon: IconInfo };
}

function formatClock(timestamp: number) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "-";
  }
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatBucket(timestamp: number) {
  const date = new Date(timestamp);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:00`;
}

function formatRelative(timestamp: number, nowMs: number) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "-";
  }
  const seconds = Math.max(0, Math.round((nowMs - timestamp) / 1_000));
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.round(hours / 24)}d ago`;
}

function stringifyDetails(value: unknown) {
  if (typeof value === "string") {
    return value;
  }
  if (value === undefined || value === null) {
    return "";
  }
  try {
    return JSON.stringify(value);
  } catch {
    return value instanceof Error ? value.message : "Unable to serialize details";
  }
}

function eventSearchText(event: DeckGoActivityEvent) {
  return [
    event.id,
    event.type,
    event.description,
    stringifyDetails(event.details),
    event.agentId,
    event.agentName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function passesTimeRange(event: DeckGoActivityEvent, range: ActivityTimeRange, nowMs: number) {
  const timeRange = TIME_RANGES.find((entry) => entry.id === range);
  if (!timeRange || timeRange.windowMs === Number.POSITIVE_INFINITY) {
    return true;
  }
  return event.timestamp >= nowMs - timeRange.windowMs;
}

function ActivityKpi(props: { label: string; value: string | number; sub: string; tone?: string }) {
  return (
    <div className={`activity-kpi ${props.tone ? `activity-kpi--${props.tone}` : ""}`}>
      <span className="activity-kpi__label">{props.label}</span>
      <strong className="activity-kpi__value">{props.value}</strong>
      <span className="activity-kpi__sub">{props.sub}</span>
    </div>
  );
}

function EventGlyph(props: { event: DeckGoActivityEvent }) {
  const presentation = eventPresentation(props.event.type);
  const Icon = presentation.Icon;
  return (
    <span className={`event-glyph event-glyph--${presentation.severity}`} aria-hidden="true">
      <Icon size={16} />
    </span>
  );
}

function AgentChip(props: { event: DeckGoActivityEvent }) {
  const label = props.event.agentName || props.event.agentId || "system";
  const initials = label.slice(0, 2).toUpperCase();
  return (
    <span className="agent-chip">
      <span className="agent-chip__avatar" aria-hidden="true">
        {initials}
      </span>
      {label}
    </span>
  );
}

function SegmentGroup<T extends string>(props: {
  label: string;
  items: Array<{ id: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="activity-seg" role="tablist" aria-label={props.label}>
      {props.items.map((item) => (
        <button
          aria-selected={props.value === item.id}
          className={`activity-seg__button ${props.value === item.id ? "is-active" : ""}`}
          key={item.id}
          onClick={() => props.onChange(item.id)}
          role="tab"
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function groupEvents(events: DeckGoActivityEvent[]) {
  const groups: Array<{ label: string; events: DeckGoActivityEvent[] }> = [];
  for (const event of events) {
    const label = formatBucket(event.timestamp);
    const last = groups.at(-1);
    if (!last || last.label !== label) {
      groups.push({ label, events: [event] });
    } else {
      last.events.push(event);
    }
  }
  return groups;
}

function EventDetailDialog(props: {
  event: DeckGoActivityEvent | null;
  onClose: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return undefined;
    }
    const timeout = window.setTimeout(() => setCopied(false), 1_400);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  useEffect(() => {
    if (!props.event) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        props.onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [props]);

  if (!props.event) {
    return null;
  }

  const json = JSON.stringify(props.event, null, 2);
  const presentation = eventPresentation(props.event.type);

  const copyJson = async () => {
    await navigator.clipboard?.writeText(json).catch(() => undefined);
    setCopied(true);
  };

  return (
    <div className="activity-modal-backdrop" onClick={props.onClose} role="presentation">
      <section
        aria-label={props.t("eventDetail")}
        aria-modal="true"
        className="activity-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="activity-modal__header">
          <span className={`activity-pill activity-pill--${presentation.severity}`}>
            <EventGlyph event={props.event} />
            {props.event.type}
          </span>
          <h3>{props.event.description}</h3>
          <button
            aria-label={props.t("close")}
            className="activity-icon-button"
            onClick={props.onClose}
            type="button"
          >
            <IconX size={16} />
          </button>
        </header>
        <div className="activity-modal__body">
          <div className="activity-diag">
            <span>{props.t("when")}</span>
            <p>
              <code>{new Date(props.event.timestamp).toLocaleString()}</code>
              <span> · </span>
              <code>{props.event.id}</code>
            </p>
          </div>
          {props.event.agentId || props.event.agentName ? (
            <div className="activity-diag">
              <span>{props.t("agent")}</span>
              <AgentChip event={props.event} />
            </div>
          ) : null}
          {props.event.details ? (
            <div className="activity-diag">
              <span>{props.t("details")}</span>
              <pre>{stringifyDetails(props.event.details)}</pre>
            </div>
          ) : null}
          <div className="activity-diag">
            <span>{props.t("rawEvent")}</span>
            <pre className="activity-code">
              <code>{json}</code>
            </pre>
          </div>
        </div>
        <footer className="activity-modal__footer">
          <button className="activity-button" onClick={copyJson} type="button">
            <IconCopy size={15} />
            {copied ? props.t("copied") : props.t("copyJson")}
          </button>
          <button
            className="activity-button activity-button--primary"
            onClick={props.onClose}
            type="button"
          >
            {props.t("close")}
          </button>
        </footer>
      </section>
    </div>
  );
}

export function ActivityPanel() {
  const t = useTranslations("activity");
  const [liveEvents, setLiveEvents] = useState<DeckGoActivityEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<DeckGoActivityEvent | null>(null);
  const [search, setSearch] = useState("");
  const [family, setFamily] = useState<ActivityFamily>("all");
  const [severity, setSeverity] = useState<ActivitySeverity>("all");
  const [timeRange, setTimeRange] = useState<ActivityTimeRange>("24h");
  const [asOfMs, setAsOfMs] = useState(() => Date.now());
  const activityQuery = useActivityEventsQuery(ACTIVITY_LIMIT);

  const mergeEvent = useCallback((event: DeckGoActivityEvent) => {
    setLiveEvents((current) => {
      const withoutDuplicate = current.filter((entry) => entry.id !== event.id);
      return [event, ...withoutDuplicate]
        .toSorted((left, right) => right.timestamp - left.timestamp)
        .slice(0, 200);
    });
  }, []);

  useActivitySSE(mergeEvent);

  const events = useMemo(() => {
    const readEvents = activityQuery.data?.events ?? [];
    const seen = new Set(readEvents.map((event) => event.id));
    return [...readEvents, ...liveEvents.filter((event) => !seen.has(event.id))]
      .toSorted((left, right) => right.timestamp - left.timestamp)
      .slice(0, 200);
  }, [activityQuery.data?.events, liveEvents]);

  const refresh = useCallback(() => {
    setAsOfMs(Date.now());
    void activityQuery.refetch();
  }, [activityQuery]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>(".activity-toolbar__search input")?.focus();
      }
      if (meta && event.key.toLowerCase() === "r") {
        event.preventDefault();
        refresh();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [refresh]);

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return events.filter((event) => {
      const presentation = eventPresentation(event.type);
      if (family !== "all" && presentation.family !== family) {
        return false;
      }
      if (severity !== "all" && presentation.severity !== severity) {
        return false;
      }
      if (!passesTimeRange(event, timeRange, asOfMs)) {
        return false;
      }
      return !query || eventSearchText(event).includes(query);
    });
  }, [asOfMs, events, family, search, severity, timeRange]);

  const groupedEvents = useMemo(() => groupEvents(filteredEvents), [filteredEvents]);
  const counts = useMemo(() => {
    const errors = events.filter(
      (event) => eventPresentation(event.type).severity === "err",
    ).length;
    const warnings = events.filter(
      (event) => eventPresentation(event.type).severity === "warn",
    ).length;
    const mostRecent = events.reduce(
      (latest, event) => (event.timestamp > latest ? event.timestamp : latest),
      0,
    );
    return { errors, mostRecent, warnings };
  }, [events]);

  const clearFilters = () => {
    setSearch("");
    setFamily("all");
    setSeverity("all");
    setTimeRange("all");
  };

  const state: PanelState = activityQuery.isLoading
    ? "loading"
    : activityQuery.error
      ? "error"
      : "ready";
  const error = activityQuery.error
    ? gatewayNotConfiguredValue(activityQuery.error, t("failedLoadActivity"))
    : "";
  const notConfigured = isGatewayNotConfiguredValue(error);
  const familyItems = FAMILY_FILTERS.map((entry) => ({ id: entry.id, label: t(entry.labelKey) }));
  const severityItems = SEVERITY_FILTERS.map((entry) => ({
    id: entry.id,
    label: t(entry.labelKey),
  }));
  const timeItems = TIME_RANGES.map((entry) => ({ id: entry.id, label: t(entry.labelKey) }));

  return (
    <section className="activity-panel" data-testid="activity-panel">
      <header className="activity-page-header">
        <div>
          <p className="activity-eyebrow">{t("title")}</p>
          <h2>{t("activityTitle")}</h2>
          <p>{t("activityDescription")}</p>
        </div>
        <div className="activity-page-header__hint">
          <IconClock size={15} />
          <span>{t("keyboardHint")}</span>
        </div>
      </header>

      <div className="activity-kpi-strip">
        <ActivityKpi
          label={t("eventsMetric")}
          sub={t("loadedCount", { count: events.length })}
          value={events.length}
        />
        <ActivityKpi
          label={t("errorsMetric")}
          sub={t("last24hWindow")}
          tone={counts.errors > 0 ? "err" : undefined}
          value={counts.errors}
        />
        <ActivityKpi
          label={t("warningsMetric")}
          sub={t("last24hWindow")}
          tone={counts.warnings > 0 ? "warn" : undefined}
          value={counts.warnings}
        />
        <ActivityKpi
          label={t("mostRecentMetric")}
          sub={counts.mostRecent ? formatRelative(counts.mostRecent, asOfMs) : t("noEventsLower")}
          value={counts.mostRecent ? formatClock(counts.mostRecent) : "-"}
        />
        <ActivityKpi label={t("asOfMetric")} sub={t(state)} value={formatClock(asOfMs)} />
      </div>

      <div className="activity-toolbar">
        <label className="activity-toolbar__search">
          <IconSearch size={16} />
          <input
            aria-label={t("searchEvents")}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("searchPlaceholder")}
            type="search"
            value={search}
          />
          <kbd>{t("searchShortcut")}</kbd>
        </label>
        <div className="activity-toolbar__segments">
          <SegmentGroup
            items={familyItems}
            label={t("familyFilter")}
            onChange={setFamily}
            value={family}
          />
          <SegmentGroup
            items={severityItems}
            label={t("severityFilter")}
            onChange={setSeverity}
            value={severity}
          />
          <SegmentGroup
            items={timeItems}
            label={t("timeRange")}
            onChange={setTimeRange}
            value={timeRange}
          />
        </div>
        <button className="activity-button" onClick={() => refresh()} type="button">
          <IconRefresh size={15} />
          {t("refreshActivity")}
        </button>
      </div>

      {notConfigured ? <GatewayNotConfiguredEmptyState className="activity-list-state" /> : null}

      {!notConfigured && state === "loading" && events.length === 0 ? (
        <div className="activity-list-state activity-list-state--loading">
          <IconRefresh className="activity-spin" size={18} />
          <strong>{t("loadingFeed")}</strong>
        </div>
      ) : null}

      {!notConfigured && error && state === "error" ? (
        <div className="activity-list-state activity-list-state--error" role="alert">
          <IconAlert size={20} />
          <strong>{t("failedLoadActivity")}</strong>
          <p>{error}</p>
          <button
            className="activity-button activity-button--primary"
            onClick={() => refresh()}
            type="button"
          >
            <IconRefresh size={15} />
            {t("retry")}
          </button>
        </div>
      ) : null}

      {!notConfigured && !error && filteredEvents.length === 0 ? (
        <div className="activity-list-state activity-list-state--empty">
          <IconStream size={22} />
          <strong>{events.length === 0 ? t("noActivityEvents") : t("noFilteredActivity")}</strong>
          <p>{t("emptyHint")}</p>
          <button className="activity-button" onClick={clearFilters} type="button">
            {t("clearFilters")}
          </button>
        </div>
      ) : null}

      {filteredEvents.length > 0 ? (
        <div className="activity-feed" aria-live="polite">
          <div className="activity-feed__summary">
            <span>{t("visibleCount", { count: filteredEvents.length })}</span>
            <span>{t("loadedCount", { count: events.length })}</span>
          </div>
          {groupedEvents.map((group) => (
            <section className="activity-feed-group" key={group.label}>
              <div className="activity-feed-group__header" role="separator">
                <span />
                <strong>{group.label}</strong>
                <small>{t("groupCount", { count: group.events.length })}</small>
              </div>
              <div className="activity-feed-group__rows">
                {group.events.map((event) => {
                  const presentation = eventPresentation(event.type);
                  return (
                    <button
                      className={`activity-feed-row activity-feed-row--${presentation.severity}`}
                      key={event.id}
                      onClick={() => setSelectedEvent(event)}
                      type="button"
                    >
                      <span className="activity-feed-row__rail">
                        <EventGlyph event={event} />
                      </span>
                      <span className="activity-feed-row__main">
                        <span className="activity-feed-row__head">
                          <span className="activity-feed-row__type">{event.type}</span>
                          <AgentChip event={event} />
                        </span>
                        <strong>{event.description}</strong>
                        {event.details ? <small>{stringifyDetails(event.details)}</small> : null}
                      </span>
                      <span className="activity-feed-row__time">
                        <code>{formatClock(event.timestamp)}</code>
                        <small>{formatRelative(event.timestamp, asOfMs)}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : null}

      <EventDetailDialog event={selectedEvent} onClose={() => setSelectedEvent(null)} t={t} />
    </section>
  );
}
