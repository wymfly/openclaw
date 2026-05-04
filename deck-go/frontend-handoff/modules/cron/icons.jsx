// Cron icons + local molecules: ScheduleBadge / RunStatusBadge /
// CountdownTimer (live ticking, promoted from approvals) / EnabledToggle.

const svgProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const Icon = ({ d, size = 16 }) => (
  <svg {...svgProps} width={size} height={size}>
    <path d={d} />
  </svg>
);

const IconClock = () => (
  <svg {...svgProps}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
const IconRefresh = () => (
  <svg {...svgProps}>
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
    <path d="M21 3v5h-5M3 21v-5h5" />
  </svg>
);
const IconPlus = () => <Icon d="M12 5v14M5 12h14" />;
const IconClose = () => <Icon d="M6 6l12 12M18 6L6 18" />;
const IconCheck = () => <Icon d="M5 12l4 4 10-10" />;
const IconAlert = () => (
  <svg {...svgProps}>
    <path d="M12 3l10 18H2L12 3z" />
    <path d="M12 10v5M12 18.5v.01" />
  </svg>
);
const IconPlay = () => <Icon d="M5 4l16 8-16 8z" />;
const IconPause = () => (
  <svg {...svgProps}>
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </svg>
);
const IconEdit = () => (
  <svg {...svgProps}>
    <path d="M14 4l6 6-12 12H2v-6L14 4z" />
  </svg>
);
const IconTrash = () => (
  <svg {...svgProps}>
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14" />
  </svg>
);
const IconChevronR = () => <Icon d="M9 6l6 6-6 6" />;
const IconChevronD = () => <Icon d="M6 9l6 6 6-6" />;
const IconSearch = () => (
  <svg {...svgProps}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.5-4.5" />
  </svg>
);
const IconCalendar = () => (
  <svg {...svgProps}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M16 3v4M8 3v4M3 11h18" />
  </svg>
);
const IconRotate = () => (
  <svg {...svgProps}>
    <path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 6.7 3" />
    <path d="M21 3v6h-6" />
  </svg>
);
const IconBolt = () => <Icon d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />;
const IconLayers = () => (
  <svg {...svgProps}>
    <path d="M12 3l10 5-10 5L2 8l10-5z" />
    <path d="M2 13l10 5 10-5M2 18l10 5 10-5" />
  </svg>
);
const IconAt = () => (
  <svg {...svgProps}>
    <circle cx="12" cy="12" r="4" />
    <path d="M16 12v2a3 3 0 0 0 6 0v-2a10 10 0 1 0-3.5 7.6" />
  </svg>
);

// -- ScheduleBadge --------------------------------------------------------

const ScheduleBadge = ({ schedule }) => {
  if (!schedule) return null;
  const map = {
    cron: { icon: IconCalendar, label: "cron" },
    every: { icon: IconRotate, label: "every" },
    at: { icon: IconAt, label: "at" },
  };
  const m = map[schedule.kind] || { icon: IconClock, label: schedule.kind };
  const Ic = m.icon;
  return (
    <span className={`schedule-badge schedule-badge--${schedule.kind}`}>
      <Ic />
      <span className="schedule-badge__label">{m.label}</span>
    </span>
  );
};

// -- ScheduleSummary (mono compact human-readable) -----------------------

const ScheduleSummary = ({ schedule }) => {
  if (!schedule) return <span className="muted small">—</span>;
  if (schedule.kind === "cron") {
    return (
      <code className="schedule-summary">
        {schedule.expr}
        {schedule.tz && schedule.tz !== "UTC" ? ` (${schedule.tz})` : ""}
      </code>
    );
  }
  if (schedule.kind === "every") {
    const ms = schedule.everyMs || 0;
    let label;
    if (ms >= 86_400_000) label = `${Math.round(ms / 86_400_000)}d`;
    else if (ms >= 3_600_000) label = `${Math.round(ms / 3_600_000)}h`;
    else if (ms >= 60_000) label = `${Math.round(ms / 60_000)}m`;
    else label = `${Math.round(ms / 1000)}s`;
    return (
      <code className="schedule-summary">
        every {label}
        {schedule.staggerMs ? ` (±${Math.round(schedule.staggerMs / 1000)}s)` : ""}
      </code>
    );
  }
  if (schedule.kind === "at") {
    return <code className="schedule-summary">at {new Date(schedule.at).toLocaleString()}</code>;
  }
  return <span className="muted small">{schedule.kind}</span>;
};

// -- RunStatusBadge -------------------------------------------------------

const RunStatusBadge = ({ status }) => {
  const map = {
    ok: { label: "ok", tone: "ok" },
    error: { label: "error", tone: "err" },
    skipped: { label: "skipped", tone: "warn" },
  };
  const m = map[status] || { label: status, tone: "neutral" };
  return <span className={`run-status-badge run-status-badge--${m.tone}`}>{m.label}</span>;
};

// -- CountdownTimer (live, promoted from approvals) -----------------------

const CountdownTimer = ({ targetMs, prefix = "" }) => {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    const id = setInterval(force, 1000);
    return () => clearInterval(id);
  }, []);
  if (!targetMs) return <span className="muted small">—</span>;
  const remaining = targetMs - Date.now();
  if (remaining < 0) {
    return (
      <span className="countdown-chip countdown-chip--overdue">
        <IconClock />
        overdue
      </span>
    );
  }
  const seconds = Math.floor(remaining / 1000);
  let label;
  if (seconds >= 86400)
    label = `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
  else if (seconds >= 3600)
    label = `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  else if (seconds >= 60) label = `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  else label = `${seconds}s`;
  const tone = remaining < 60_000 ? "imminent" : remaining < 60 * 60_000 ? "soon" : "later";
  return (
    <span className={`countdown-chip countdown-chip--${tone}`}>
      <IconClock />
      {prefix}
      {label}
    </span>
  );
};

// -- EnabledToggle (visual only here; mutations through actions in detail)

const EnabledToggle = ({ enabled }) => (
  <span className={`enabled-toggle ${enabled ? "enabled-toggle--on" : "enabled-toggle--off"}`}>
    <span className="enabled-toggle__dot" />
    {enabled ? "enabled" : "disabled"}
  </span>
);

// -- formatters -----------------------------------------------------------

function formatRelative(ms) {
  if (!ms) return "—";
  const diff = Date.now() - ms;
  if (diff < 0) return `in ${formatDuration(-diff)}`;
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function formatDuration(ms) {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
  return `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
}

function formatTime(ms) {
  if (!ms) return "—";
  const d = new Date(ms);
  return d.toLocaleString([], { dateStyle: "short", timeStyle: "medium" });
}

Object.assign(window, {
  IconClock,
  IconRefresh,
  IconPlus,
  IconClose,
  IconCheck,
  IconAlert,
  IconPlay,
  IconPause,
  IconEdit,
  IconTrash,
  IconChevronR,
  IconChevronD,
  IconSearch,
  IconCalendar,
  IconRotate,
  IconBolt,
  IconLayers,
  IconAt,
  ScheduleBadge,
  ScheduleSummary,
  RunStatusBadge,
  CountdownTimer,
  EnabledToggle,
  formatRelative,
  formatDuration,
  formatTime,
});
