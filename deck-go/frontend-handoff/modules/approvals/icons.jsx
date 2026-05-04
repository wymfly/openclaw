// Icons + local molecules (KindBadge / DecisionBadge / CountdownTimer /
// CommandTag) and formatters (formatRelative, formatCountdown).

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

const IconShield = () => <Icon d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" />;
const IconCheck = () => <Icon d="M5 12l4 4 10-10" />;
const IconClose = () => <Icon d="M6 6l12 12M18 6L6 18" />;
const IconAlert = () => (
  <svg {...svgProps}>
    <path d="M12 3l10 18H2L12 3z" />
    <path d="M12 10v5M12 18.5v.01" />
  </svg>
);
const IconClock = () => (
  <svg {...svgProps}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
const IconBolt = () => <Icon d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />;
const IconRefresh = () => (
  <svg {...svgProps}>
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
    <path d="M21 3v5h-5M3 21v-5h5" />
  </svg>
);
const IconTerminal = () => (
  <svg {...svgProps}>
    <path d="M5 8l4 4-4 4M11 16h8" />
    <rect x="2" y="3" width="20" height="18" rx="2" />
  </svg>
);
const IconPlug = () => (
  <svg {...svgProps}>
    <path d="M9 7V3M15 7V3M7 7h10v5a5 5 0 0 1-10 0V7zM12 17v4" />
  </svg>
);
const IconUser = () => (
  <svg {...svgProps}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1-4 5-6 8-6s7 2 8 6" />
  </svg>
);
const IconHistory = () => (
  <svg {...svgProps}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
    <path d="M12 7v5l3 2" />
  </svg>
);
const IconSettings = () => (
  <svg {...svgProps}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.4.8a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.5a7 7 0 0 0-2 1.2L5 6l-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.4-.8a7 7 0 0 0 2 1.2L10 21h4l.5-2.5a7 7 0 0 0 2-1.2l2.4.8 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z" />
  </svg>
);
const IconChevronD = () => <Icon d="M6 9l6 6 6-6" />;
const IconCopy = () => (
  <svg {...svgProps}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
);
const IconSearch = () => (
  <svg {...svgProps}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.5-4.5" />
  </svg>
);

// -- KindBadge ------------------------------------------------------------

const KindBadge = ({ kind }) => {
  const map = {
    exec: { label: "exec", className: "kind-badge--exec" },
    plugin: { label: "plugin", className: "kind-badge--plugin" },
  };
  const m = map[kind] || { label: kind, className: "kind-badge--other" };
  return <span className={`kind-badge ${m.className}`}>{m.label}</span>;
};

// -- DecisionBadge --------------------------------------------------------

const DecisionBadge = ({ decision }) => {
  const map = {
    allow_once: { label: "allow once", tone: "ok" },
    allow_always: { label: "allow always", tone: "ok-strong" },
    deny: { label: "deny", tone: "err" },
    expired: { label: "expired", tone: "warn" },
    pending: { label: "pending", tone: "neutral" },
  };
  const m = map[decision] || { label: decision, tone: "neutral" };
  return <span className={`decision-badge decision-badge--${m.tone}`}>{m.label}</span>;
};

// -- CountdownTimer (live ticking) ----------------------------------------

const CountdownTimer = ({ expiresAtMs, onExpire }) => {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    const id = setInterval(force, 500);
    return () => clearInterval(id);
  }, []);
  const remaining = Math.max(0, expiresAtMs - Date.now());
  React.useEffect(() => {
    if (remaining === 0 && onExpire) onExpire();
  }, [remaining === 0]);
  const seconds = Math.floor(remaining / 1000);
  const tone = remaining < 15_000 ? "danger" : remaining < 30_000 ? "warn" : "ok";
  return (
    <span className={`countdown-timer countdown-timer--${tone}`}>
      <IconClock />
      <span className="countdown-timer__value">{seconds}s</span>
    </span>
  );
};

// -- CommandTag (mono command display, copy on click) --------------------

const CommandTag = ({ command, truncate = 46 }) => {
  const display = command.length > truncate ? `${command.slice(0, truncate - 1)}…` : command;
  return (
    <code className="command-tag" title={command}>
      {display}
    </code>
  );
};

// -- Formatters ------------------------------------------------------------

function formatRelative(ms) {
  const diff = Date.now() - ms;
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function formatTime(ms) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

Object.assign(window, {
  IconShield,
  IconCheck,
  IconClose,
  IconAlert,
  IconClock,
  IconBolt,
  IconRefresh,
  IconTerminal,
  IconPlug,
  IconUser,
  IconHistory,
  IconSettings,
  IconChevronD,
  IconCopy,
  IconSearch,
  KindBadge,
  DecisionBadge,
  CountdownTimer,
  CommandTag,
  formatRelative,
  formatTime,
});
