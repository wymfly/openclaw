// Icons + small molecules for the nodes module.
// Resolved as window globals so each <script type="text/babel"> tag can use them.

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

const IconNode = (p) => <Icon {...p} d="M3 6h18M3 12h18M3 18h18" />;
const IconRefresh = (p) => <Icon {...p} d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" />;
const IconLink = (p) => (
  <Icon
    {...p}
    d="M10 14a5 5 0 0 1 0-7l2-2a5 5 0 0 1 7 7l-1 1M14 10a5 5 0 0 1 0 7l-2 2a5 5 0 0 1-7-7l1-1"
  />
);
const IconUnlink = (p) => (
  <Icon {...p} d="M16 8h2a4 4 0 0 1 0 8h-2M8 16H6a4 4 0 0 1 0-8h2M8 12h8M3 3l18 18" />
);
const IconAlert = (p) => (
  <Icon
    {...p}
    d="M12 9v4M12 17v.01M10.3 3.7 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3l-8.5-14.3a2 2 0 0 0-3.4 0Z"
  />
);
const IconCheck = (p) => <Icon {...p} d="M5 12.5l4 4 10-10" />;
const IconX = (p) => <Icon {...p} d="M18 6 6 18M6 6l12 12" />;
const IconPlay = (p) => <Icon {...p} d="m6 4 14 8-14 8z" fill="currentColor" stroke="none" />;
const IconQueue = (p) => <Icon {...p} d="M3 6h13M3 12h13M3 18h9M19 6v12M16 9l3-3 3 3" />;
const IconShield = (p) => <Icon {...p} d="M12 3 4 6v6c0 5 3.6 8.5 8 9 4.4-.5 8-4 8-9V6Z" />;
const IconShieldOff = (p) => (
  <Icon {...p} d="M12 3 4 6v6c0 5 3.6 8.5 8 9 1.4-.2 2.7-.6 3.9-1.3M3 3l18 18M20 12V6l-8-3v6" />
);
const IconLock = (p) => <Icon {...p} d="M5 11h14v10H5zM8 11V7a4 4 0 1 1 8 0v4" />;
const IconUnlock = (p) => <Icon {...p} d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0" />;
const IconCpu = (p) => (
  <Icon {...p} d="M4 4h16v16H4zM9 4v3M15 4v3M9 17v3M15 17v3M4 9h3M4 15h3M17 9h3M17 15h3" />
);
const IconWifi = (p) => (
  <Icon {...p} d="M5 12.5a10 10 0 0 1 14 0M2.5 9a14 14 0 0 1 19 0M8 16a6 6 0 0 1 8 0M12 19v.01" />
);
const IconWifiOff = (p) => (
  <Icon {...p} d="M3 3l18 18M8.5 16.5a4 4 0 0 1 7 0M5 12.5a10 10 0 0 1 7-3.5" />
);
const IconClock = (p) => <Icon {...p} d="M12 7v5l3 2M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z" />;
const IconCopy = (p) => <Icon {...p} d="M9 9h11v11H9zM4 14h1V4h11v1" />;
const IconChevron = (p) => <Icon {...p} d="m9 18 6-6-6-6" />;
const IconExternal = (p) => (
  <Icon {...p} d="M14 4h6v6M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
);
const IconTerminal = (p) => <Icon {...p} d="m4 17 6-6-6-6M12 19h8" />;
const IconKey = (p) => <Icon {...p} d="M14 7a4 4 0 1 1-4 4l-7 7v3h3l1-1v-2h2v-2h2l3-3" />;
const IconHash = (p) => <Icon {...p} d="M4 9h16M4 15h16M10 3l-3 18M17 3l-3 18" />;
const IconWrench = (p) => (
  <Icon {...p} d="M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 0 5.4-5.4z" />
);

// Platform-specific dot styling (for inventory rows + hero).
const PLATFORM_TONE = {
  darwin: "platform--mac",
  linux: "platform--linux",
  windows: "platform--windows",
  android: "platform--android",
  ios: "platform--ios",
};

const PlatformPill = ({ platform }) => (
  <span className={`pill platform-pill ${PLATFORM_TONE[platform] || "platform--other"}`}>
    {platform || "unknown"}
  </span>
);

// Status dot for connection / pairing state.
const StatusDot = ({ tone, label }) => (
  <span className={`status-dot status-dot--${tone}`} aria-label={label} title={label}>
    <span className="status-dot__core" />
  </span>
);

// Capability cluster — renders up to N caps then a +overflow chip.
const CapsCluster = ({ caps, max = 4 }) => {
  const list = caps || [];
  const head = list.slice(0, max);
  const tail = list.length - head.length;
  return (
    <div className="caps-cluster">
      {head.map((c) => (
        <span key={c} className="cap-chip">
          {c}
        </span>
      ))}
      {tail > 0 && <span className="cap-chip cap-chip--more">+{tail}</span>}
    </div>
  );
};

// Permission grid — bools rendered as colored chips.
const PermissionGrid = ({ permissions }) => {
  const entries = Object.entries(permissions || {});
  if (entries.length === 0) {
    return <span className="muted">no permission map</span>;
  }
  return (
    <div className="perm-grid">
      {entries.map(([k, v]) => (
        <span key={k} className={`perm-chip perm-chip--${v ? "ok" : "denied"}`}>
          <span className="perm-chip__name">{k}</span>
          <span className="perm-chip__verdict">{v ? "allowed" : "denied"}</span>
        </span>
      ))}
    </div>
  );
};

// Lifecycle strip tone helper.
const lifecycleTone = (node, pendingForNode) => {
  if (pendingForNode)
    return { tone: "warn", label: pendingForNode.isRepair ? "repair pending" : "pairing pending" };
  if (!node.paired) return { tone: "neutral", label: "unpaired" };
  if (!node.connected) return { tone: "warn", label: "paired · offline" };
  return { tone: "ok", label: "connected · paired" };
};

// JSON viewer — pretty-printed, scroll-bounded, copy chip.
const JsonView = ({ value, copyId }) => {
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
        <span className="json-view__label">{copyId || "JSON"}</span>
        <button type="button" className="json-view__copy" onClick={onCopy}>
          <IconCopy size={12} />
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <pre className="json-view__body">{text}</pre>
    </div>
  );
};

// Format relative time — "12s ago", "4m ago", "3h ago".
function formatRelative(ms) {
  if (!ms) return "—";
  const diff = Date.now() - ms;
  if (diff < 60_000) return `${Math.max(1, Math.round(diff / 1000))}s ago`;
  if (diff < 60 * 60_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 24 * 60 * 60_000) return `${Math.round(diff / 60 / 60_000)}h ago`;
  return `${Math.round(diff / 24 / 60 / 60_000)}d ago`;
}

// Shorten node id for compact display.
function shortId(id) {
  if (!id) return "—";
  if (id.length <= 18) return id;
  return `${id.slice(0, 7)}…${id.slice(-6)}`;
}

// Find pending pairing request for a node id.
function pendingFor(nodeId, pairing) {
  return (pairing || []).find((p) => p.nodeId === nodeId) || null;
}

Object.assign(window, {
  Icon,
  IconNode,
  IconRefresh,
  IconLink,
  IconUnlink,
  IconAlert,
  IconCheck,
  IconX,
  IconPlay,
  IconQueue,
  IconShield,
  IconShieldOff,
  IconLock,
  IconUnlock,
  IconCpu,
  IconWifi,
  IconWifiOff,
  IconClock,
  IconCopy,
  IconChevron,
  IconExternal,
  IconTerminal,
  IconKey,
  IconHash,
  IconWrench,
  PlatformPill,
  StatusDot,
  CapsCluster,
  PermissionGrid,
  JsonView,
  lifecycleTone,
  formatRelative,
  shortId,
  pendingFor,
});
