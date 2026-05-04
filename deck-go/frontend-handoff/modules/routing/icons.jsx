// Icons + small molecules for the routing module.

const Icon = ({ d, size = 16, stroke = 1.7, fill = "none" }) =>
  React.createElement(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill,
      stroke: "currentColor",
      strokeWidth: stroke,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
    React.createElement("path", { d }),
  );

const IconRoute = (p) => (
  <Icon
    {...p}
    d="M6 4v5a3 3 0 0 0 3 3h6a3 3 0 0 1 3 3v5M3 4a2 2 0 1 0 4 0 2 2 0 1 0-4 0M17 20a2 2 0 1 0 4 0 2 2 0 1 0-4 0"
  />
);
const IconRefresh = (p) => <Icon {...p} d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" />;
const IconChevronR = (p) => <Icon {...p} d="m9 18 6-6-6-6" />;
const IconChevronD = (p) => <Icon {...p} d="m6 9 6 6 6-6" />;
const IconAlert = (p) => (
  <Icon
    {...p}
    d="M12 9v4M12 17v.01M10.3 3.7 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3l-8.5-14.3a2 2 0 0 0-3.4 0Z"
  />
);
const IconCheck = (p) => <Icon {...p} d="M5 12.5l4 4 10-10" />;
const IconX = (p) => <Icon {...p} d="M18 6 6 18M6 6l12 12" />;
const IconPlay = (p) => <Icon {...p} d="m6 4 14 8-14 8z" fill="currentColor" stroke="none" />;
const IconArrowUp = (p) => <Icon {...p} d="M12 19V5M5 12l7-7 7 7" />;
const IconArrowDown = (p) => <Icon {...p} d="M12 5v14M5 12l7 7 7-7" />;
const IconArrowRight = (p) => <Icon {...p} d="M5 12h14M12 5l7 7-7 7" />;
const IconPlus = (p) => <Icon {...p} d="M12 5v14M5 12h14" />;
const IconTrash = (p) => (
  <Icon
    {...p}
    d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
  />
);
const IconHash = (p) => <Icon {...p} d="M4 9h16M4 15h16M10 3l-3 18M17 3l-3 18" />;
const IconCopy = (p) => <Icon {...p} d="M9 9h11v11H9zM4 14h1V4h11v1" />;
const IconFilter = (p) => <Icon {...p} d="M3 4h18l-7 9v6l-4 2v-8L3 4z" />;
const IconAgent = (p) => (
  <Icon {...p} d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
);
const IconChannel = (p) => <Icon {...p} d="M4 6h16v12H4zM4 9h16M9 12h11" />;
const IconUsers = (p) => (
  <Icon
    {...p}
    d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M19 8a3 3 0 1 0 0-6M22 21v-1a4 4 0 0 0-3-3.87"
  />
);
const IconShield = (p) => <Icon {...p} d="M12 3 4 6v6c0 5 3.6 8.5 8 9 4.4-.5 8-4 8-9V6Z" />;
const IconHash2 = (p) => <Icon {...p} d="M4 9h16M4 15h16M10 3l-3 18M17 3l-3 18" />;
const IconClock = (p) => <Icon {...p} d="M12 7v5l3 2M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z" />;
const IconExternal = (p) => (
  <Icon {...p} d="M14 4h6v6M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
);
const IconChain = (p) => (
  <Icon
    {...p}
    d="M10 14a5 5 0 0 1 0-7l2-2a5 5 0 0 1 7 7l-1 1M14 10a5 5 0 0 1 0 7l-2 2a5 5 0 0 1-7-7l1-1"
  />
);
const IconCircle = (p) => <Icon {...p} d="M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z" />;
const IconDot = ({ size = 8 }) => (
  <svg width={size} height={size} viewBox="0 0 8 8" fill="currentColor">
    <circle cx="4" cy="4" r="3" />
  </svg>
);

// Tier badge — color-coded by tier specificity.
const TIER_TONE = {
  peer: "tier--peer",
  "guild+roles": "tier--guildroles",
  guild: "tier--guild",
  team: "tier--team",
  channel: "tier--channel",
};
const TierBadge = ({ tier }) => (
  <span className={`tier-badge ${TIER_TONE[tier] || "tier--other"}`}>
    <IconDot />
    {tier}
  </span>
);

// MatchChip — labeled key/value chip ("channel · discord").
const MatchChip = ({ label, value, icon }) => (
  <span className="match-chip" title={`${label}: ${value}`}>
    {icon ? icon : null}
    <span className="match-chip__label">{label}</span>
    <span className="match-chip__sep">·</span>
    <span className="match-chip__value">{value}</span>
  </span>
);

// MatchChipRow — auto-renders all defined match dimensions for a binding.
const MatchChipRow = ({ match }) => {
  const chips = [];
  chips.push(
    <MatchChip
      key="channel"
      label="channel"
      value={match.channel}
      icon={<IconChannel size={11} />}
    />,
  );
  if (match.accountId) {
    chips.push(<MatchChip key="account" label="account" value={match.accountId} />);
  }
  if (match.peer) {
    chips.push(
      <MatchChip
        key="peer"
        label={`peer(${match.peer.kind})`}
        value={match.peer.id}
        icon={<IconUsers size={11} />}
      />,
    );
  }
  if (match.guildId) {
    chips.push(
      <MatchChip key="guild" label="guild" value={match.guildId} icon={<IconShield size={11} />} />,
    );
  }
  if (match.teamId) {
    chips.push(<MatchChip key="team" label="team" value={match.teamId} />);
  }
  if (match.roles && match.roles.length) {
    chips.push(<MatchChip key="roles" label="roles" value={match.roles.join(", ")} />);
  }
  return <div className="match-chip-row">{chips}</div>;
};

// ConflictMarker — small inline pill with detail.
const ConflictMarker = ({ conflict }) => (
  <span
    className={`conflict-marker conflict-marker--${conflict.type.replace(/[^a-z0-9]/gi, "-")}`}
    title={conflict.detail}
  >
    <IconAlert size={11} />
    <span className="conflict-marker__type">{conflict.type}</span>
    <span className="conflict-marker__sep">·</span>
    <span className="conflict-marker__agent">{conflict.agentId}</span>
  </span>
);

// JsonView — pretty JSON with copy chip + scroll bound.
const JsonView = ({ value, label, max = 220 }) => {
  const [copied, setCopied] = React.useState(false);
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const onCopy = () => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  };
  return (
    <div className="json-view">
      <div className="json-view__head">
        <span className="json-view__label">{label || "JSON"}</span>
        <button type="button" className="json-view__copy" onClick={onCopy}>
          <IconCopy size={11} />
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <pre className="json-view__body" style={{ maxHeight: max }}>
        {text}
      </pre>
    </div>
  );
};

// HashChip — abbreviated config hash with copy.
const HashChip = ({ hash, label = "hash" }) => {
  const [copied, setCopied] = React.useState(false);
  const onCopy = () => {
    if (!navigator.clipboard || !hash) return;
    navigator.clipboard.writeText(hash).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  };
  return (
    <button type="button" className="hash-chip" onClick={onCopy} title={`Click to copy: ${hash}`}>
      <IconHash size={11} />
      <span className="hash-chip__label">{label}</span>
      <span className="hash-chip__hash">{hash ? hash.slice(0, 8) : "—"}…</span>
      {copied && <span className="hash-chip__copied">copied</span>}
    </button>
  );
};

// AgentChip — agent id with bullet color.
const AGENT_TONE = {
  main: "#7aa2ff",
  ops: "#ef8f8f",
  security: "#e4b45f",
  support: "#6fca95",
  marketing: "#c597e5",
  research: "#56a4d6",
};
const AgentChip = ({ id }) => (
  <span className="agent-chip">
    <span className="agent-chip__bullet" style={{ background: AGENT_TONE[id] || "#7f8a9b" }} />
    <span>{id}</span>
  </span>
);

// formatRelative — "12s ago" / "4m ago" / "3h ago"
function formatRelative(ms) {
  if (!ms) return "—";
  const diff = Date.now() - ms;
  if (diff < 60_000) return `${Math.max(1, Math.round(diff / 1000))}s ago`;
  if (diff < 60 * 60_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 24 * 60 * 60_000) return `${Math.round(diff / 60 / 60_000)}h ago`;
  return `${Math.round(diff / 24 / 60 / 60_000)}d ago`;
}

Object.assign(window, {
  Icon,
  IconRoute,
  IconRefresh,
  IconChevronR,
  IconChevronD,
  IconAlert,
  IconCheck,
  IconX,
  IconPlay,
  IconArrowUp,
  IconArrowDown,
  IconArrowRight,
  IconPlus,
  IconTrash,
  IconHash,
  IconHash2,
  IconCopy,
  IconFilter,
  IconAgent,
  IconChannel,
  IconUsers,
  IconShield,
  IconClock,
  IconExternal,
  IconChain,
  IconCircle,
  IconDot,
  TierBadge,
  MatchChip,
  MatchChipRow,
  ConflictMarker,
  JsonView,
  HashChip,
  AgentChip,
  formatRelative,
});
