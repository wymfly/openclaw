// activity — Feed view
//
// Single-page panel: KPI strip + filter bar + virtualized timeline.
// Each row is one DeckGoActivityEvent; clicking a row opens EventDetailDialog.
// Time is rendered as relative-from-now (computed off `nowMs` for stable
// snapshots in tests / screenshots).

const { useMemo: _fvMemo } = React;

const FILTER_GROUPS = [
  { id: "all", label: "All" },
  {
    id: "agent",
    label: "Agent",
    types: ["agent.start", "agent.stop", "agent.error", "agent.handoff"],
  },
  { id: "tool", label: "Tools", types: ["tool.call", "tool.result", "tool.deny"] },
  { id: "msg", label: "Messages", types: ["message.in", "message.out"] },
  {
    id: "subagent",
    label: "Subagents",
    types: ["subagent.spawn", "subagent.kill", "subagent.steer"],
  },
  {
    id: "channel",
    label: "Channels",
    types: ["channel.connect", "channel.disconnect", "channel.error"],
  },
  {
    id: "ops",
    label: "Ops",
    types: [
      "config.change",
      "auth.rotate",
      "alert.fire",
      "approval.request",
      "approval.grant",
      "approval.deny",
    ],
  },
];

const SEVERITY_FILTERS = [
  { id: "all", label: "All" },
  { id: "info", label: "Info" },
  { id: "ok", label: "OK" },
  { id: "warn", label: "Warn" },
  { id: "err", label: "Errors" },
];

const TIME_RANGES = [
  { id: "1h", label: "1h", windowMs: 60 * 60 * 1000 },
  { id: "6h", label: "6h", windowMs: 6 * 60 * 60 * 1000 },
  { id: "24h", label: "24h", windowMs: 24 * 60 * 60 * 1000 },
  { id: "all", label: "All", windowMs: Infinity },
];

function fmtRel(ms, nowMs) {
  if (!ms) return "—";
  const dt = (nowMs - ms) / 1000;
  if (dt < 60) return `${Math.round(dt)}s ago`;
  if (dt < 3600) return `${Math.round(dt / 60)}m ago`;
  if (dt < 86400) return `${Math.round(dt / 3600)}h ago`;
  return `${Math.round(dt / 86400)}d ago`;
}

function fmtClock(ms) {
  return new Date(ms).toLocaleTimeString();
}

function ActivityKpiStrip({ events, asOfMs, runtimeId }) {
  const total = events.length;
  const errors = events.filter((e) => eventSeverity(e.type) === "err").length;
  const warns = events.filter((e) => eventSeverity(e.type) === "warn").length;
  const lastTs = events.length ? Math.max(...events.map((e) => e.timestamp)) : 0;
  const sinceLabel = new Date(asOfMs || Date.now()).toLocaleTimeString();
  return (
    <div className="kpi-strip">
      <div className="kpi">
        <div className="kpi__label">Events</div>
        <div className="kpi__value">{total}</div>
        <div className="kpi__sub">{runtimeId || "deck-runtime"}</div>
      </div>
      <div className="kpi">
        <div className="kpi__label">Errors</div>
        <div className={`kpi__value${errors > 0 ? " kpi__value--err" : ""}`}>{errors}</div>
        <div className="kpi__sub">last 24h window</div>
      </div>
      <div className="kpi">
        <div className="kpi__label">Warnings</div>
        <div className={`kpi__value${warns > 0 ? " kpi__value--warn" : ""}`}>{warns}</div>
        <div className="kpi__sub">last 24h window</div>
      </div>
      <div className="kpi">
        <div className="kpi__label">Most recent</div>
        <div className="kpi__value-mono">{lastTs ? fmtClock(lastTs) : "—"}</div>
        <div className="kpi__sub">{lastTs ? fmtRel(lastTs, asOfMs) : "no events"}</div>
      </div>
      <div className="kpi kpi--ts">
        <div className="kpi__label">As of</div>
        <div className="kpi__value-mono">{sinceLabel}</div>
        <div className="kpi__sub">last sync</div>
      </div>
    </div>
  );
}

function ActivityToolbar({
  searchQuery,
  filter,
  severity,
  timeRange,
  onSearch,
  onFilter,
  onSeverity,
  onTimeRange,
  onRefresh,
}) {
  return (
    <div className="toolbar">
      <div className="toolbar__search">
        <IconSearch />
        <input
          type="search"
          placeholder="Search events: type, agent, description, details…"
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          aria-label="Search events"
        />
        <span className="kbd-hint">⌘K</span>
      </div>
      <div className="toolbar__group">
        <div className="seg" role="tablist" aria-label="Family filter">
          {FILTER_GROUPS.map((g) => (
            <button
              key={g.id}
              className={`seg__btn${filter === g.id ? " seg__btn--active" : ""}`}
              type="button"
              role="tab"
              aria-selected={filter === g.id}
              onClick={() => onFilter(g.id)}
            >
              {g.label}
            </button>
          ))}
        </div>
        <div className="seg" role="tablist" aria-label="Severity filter">
          {SEVERITY_FILTERS.map((s) => (
            <button
              key={s.id}
              className={`seg__btn${severity === s.id ? " seg__btn--active" : ""}`}
              type="button"
              onClick={() => onSeverity(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="seg" role="tablist" aria-label="Time range">
          {TIME_RANGES.map((t) => (
            <button
              key={t.id}
              className={`seg__btn${timeRange === t.id ? " seg__btn--active" : ""}`}
              type="button"
              onClick={() => onTimeRange(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="toolbar__actions">
        <button className="btn btn--ghost" type="button" onClick={onRefresh}>
          <IconRefresh /> Refresh
        </button>
      </div>
    </div>
  );
}

function FeedRow({ event, nowMs, onSelect }) {
  const sev = eventSeverity(event.type);
  return (
    <div
      className={`feed-row feed-row--${sev}`}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(event.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(event.id);
        }
      }}
    >
      <div className="feed-row__rail">
        <EventGlyph type={event.type} />
      </div>
      <div className="feed-row__main">
        <div className="feed-row__head">
          <span className="feed-row__type">{event.type}</span>
          {event.agentId ? (
            <AgentChip agentId={event.agentId} agentName={event.agentName} />
          ) : (
            <span className="muted small">system</span>
          )}
        </div>
        <div className="feed-row__desc">{event.description}</div>
        {event.details ? <div className="feed-row__details">{event.details}</div> : null}
      </div>
      <div className="feed-row__ts">
        <div className="mono">{fmtClock(event.timestamp)}</div>
        <div className="muted small">{fmtRel(event.timestamp, nowMs)}</div>
      </div>
    </div>
  );
}

function GroupHeader({ label, count }) {
  return (
    <div className="feed-group-header">
      <div className="feed-group-header__bar" />
      <div className="feed-group-header__label">{label}</div>
      <span className="muted small">
        {count} event{count === 1 ? "" : "s"}
      </span>
    </div>
  );
}

function FeedView({
  events,
  feedState,
  searchQuery,
  filter,
  severity,
  timeRange,
  asOfMs,
  runtimeId,
  onSearch,
  onFilter,
  onSeverity,
  onTimeRange,
  onSelect,
  onRefresh,
}) {
  const filtered = _fvMemo(() => {
    let xs = events;
    const family = FILTER_GROUPS.find((g) => g.id === filter);
    if (family && family.types) xs = xs.filter((e) => family.types.includes(e.type));
    if (severity && severity !== "all") {
      xs = xs.filter((e) => eventSeverity(e.type) === severity);
    }
    const range = TIME_RANGES.find((t) => t.id === timeRange);
    if (range && range.windowMs !== Infinity) {
      const cutoff = (asOfMs || Date.now()) - range.windowMs;
      xs = xs.filter((e) => e.timestamp >= cutoff);
    }
    const q = (searchQuery || "").trim().toLowerCase();
    if (q) {
      xs = xs.filter((e) =>
        [e.type, e.description, e.details, e.agentId, e.agentName, e.id]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }
    return [...xs].sort((a, b) => b.timestamp - a.timestamp);
  }, [events, filter, severity, timeRange, searchQuery, asOfMs]);

  // Group by hour for timeline scannability.
  const grouped = _fvMemo(() => {
    const out = [];
    let lastBucket = "";
    for (const ev of filtered) {
      const d = new Date(ev.timestamp);
      const bucket = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:00`;
      if (bucket !== lastBucket) {
        out.push({ kind: "header", bucket, label: bucket, count: 0 });
        lastBucket = bucket;
      }
      out[out.length - 1].count += 1;
      out.push({ kind: "row", event: ev });
    }
    return out;
  }, [filtered]);

  return (
    <div className="list-view">
      <header className="page-header">
        <div className="page-header__title">
          <h1>Activity</h1>
          <p>
            Unified timeline across agent runs, tool calls, channel lifecycle, config changes, and
            ops events. Severity is decoded from event type by the BFF; raw frame is{" "}
            <span className="kbd">DeckGoActivityEvent</span>.
          </p>
        </div>
        <div className="page-header__hint">
          <IconKbd /> <span>⌘K</span> search · <span>⌘R</span> refresh · <span>Esc</span> close
          detail
        </div>
      </header>

      <ActivityKpiStrip events={events} asOfMs={asOfMs} runtimeId={runtimeId} />

      <ActivityToolbar
        searchQuery={searchQuery}
        filter={filter}
        severity={severity}
        timeRange={timeRange}
        onSearch={onSearch}
        onFilter={onFilter}
        onSeverity={onSeverity}
        onTimeRange={onTimeRange}
        onRefresh={onRefresh}
      />

      {feedState === "loading" ? (
        <div className="list-state list-state--loading">
          <IconRefresh className="spin" />
          <div>Loading activity feed…</div>
        </div>
      ) : feedState === "error" ? (
        <div className="list-state list-state--error">
          <IconAlert />
          <div>
            <strong>Failed to load activity feed.</strong>
            <p>BFF returned 5xx. Retry or check Gateway logs.</p>
            <button className="btn btn--primary" type="button" onClick={onRefresh}>
              <IconRefresh /> Retry
            </button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="list-state list-state--empty">
          <IconActivity />
          <div>
            <strong>No events match this filter.</strong>
            <p>Try widening the time range, switching family, or clearing search.</p>
          </div>
        </div>
      ) : (
        <div className="feed">
          {grouped.map((g, i) =>
            g.kind === "header" ? (
              <GroupHeader key={`h-${i}`} label={g.label} count={g.count} />
            ) : (
              <FeedRow
                key={g.event.id}
                event={g.event}
                nowMs={asOfMs || Date.now()}
                onSelect={onSelect}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

Object.assign(window, {
  FeedView,
  ActivityKpiStrip,
  ActivityToolbar,
  FeedRow,
  GroupHeader,
  FILTER_GROUPS,
  SEVERITY_FILTERS,
  TIME_RANGES,
  fmtRel,
  fmtClock,
});
