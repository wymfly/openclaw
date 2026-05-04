// Webhooks icons + local molecules: StatusCodeBadge / DeliveryStatusBadge
// (reused 3-tone pattern from cron's RunStatusBadge) / EventTag /
// EnabledToggle / SecretReveal / CountdownTimer (live ticking).

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
const IconBolt = () => <Icon d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />;
const IconLink = () => (
  <svg {...svgProps}>
    <path d="M10 14a5 5 0 0 1 0-7l3-3a5 5 0 1 1 7 7l-1.5 1.5" />
    <path d="M14 10a5 5 0 0 1 0 7l-3 3a5 5 0 1 1-7-7l1.5-1.5" />
  </svg>
);
const IconKey = () => (
  <svg {...svgProps}>
    <path d="M14 9a5 5 0 1 0-10 0 5 5 0 0 0 10 0z" />
    <path d="M14 9l8 8M18 13l3 3M16 11l3 3" />
  </svg>
);
const IconEye = () => (
  <svg {...svgProps}>
    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const IconEyeOff = () => (
  <svg {...svgProps}>
    <path d="M3 3l18 18" />
    <path d="M10.5 5.1A10.5 10.5 0 0 1 12 5c6 0 10 7 10 7a16 16 0 0 1-3.4 4" />
    <path d="M14 14a3 3 0 0 1-4-4" />
    <path d="M2 12s4-7 10-7" />
  </svg>
);
const IconSend = () => <Icon d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />;
const IconRetry = () => (
  <svg {...svgProps}>
    <path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 6.7 3" />
    <path d="M21 3v6h-6" />
    <path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-6.7-3" />
    <path d="M3 21v-6h6" />
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
const IconClock = () => (
  <svg {...svgProps}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
const IconShield = () => <Icon d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" />;
const IconActivity = () => <Icon d="M22 12h-4l-3 9L9 3l-3 9H2" />;
const IconCopy = () => (
  <svg {...svgProps}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
);

// -- StatusCodeBadge (HTTP status pill) ----------------------------------

const StatusCodeBadge = ({ statusCode }) => {
  if (statusCode === null || statusCode === undefined) {
    return <span className="status-code-badge status-code-badge--none">—</span>;
  }
  let tone = "neutral";
  if (statusCode >= 200 && statusCode < 300) tone = "ok";
  else if (statusCode >= 300 && statusCode < 400) tone = "info";
  else if (statusCode >= 400 && statusCode < 500) tone = "warn";
  else if (statusCode >= 500) tone = "err";
  return <span className={`status-code-badge status-code-badge--${tone}`}>{statusCode}</span>;
};

// -- DeliveryStatusBadge (success / failure / pending) -------------------

const DeliveryStatusBadge = ({ delivery }) => {
  if (!delivery) return null;
  if (delivery.success)
    return (
      <span className="delivery-status-badge delivery-status-badge--ok">
        <IconCheck />
        success
      </span>
    );
  if (delivery.statusCode === null)
    return (
      <span className="delivery-status-badge delivery-status-badge--err">
        <IconAlert />
        network
      </span>
    );
  return (
    <span className="delivery-status-badge delivery-status-badge--err">
      <IconAlert />
      failed
    </span>
  );
};

// -- WebhookHealthBadge (per-row health indicator) -----------------------

const WebhookHealthBadge = ({ webhook }) => {
  if (!webhook.enabled)
    return <span className="webhook-health-badge webhook-health-badge--disabled">disabled</span>;
  if (webhook.consecutiveFailures >= 3)
    return (
      <span className="webhook-health-badge webhook-health-badge--err">
        <IconAlert />
        failing ({webhook.consecutiveFailures})
      </span>
    );
  if (webhook.consecutiveFailures > 0)
    return (
      <span className="webhook-health-badge webhook-health-badge--warn">
        degraded ({webhook.consecutiveFailures})
      </span>
    );
  return (
    <span className="webhook-health-badge webhook-health-badge--ok">
      <IconCheck />
      healthy
    </span>
  );
};

// -- EnabledToggle (visual only) -----------------------------------------

const EnabledToggle = ({ enabled }) => (
  <span className={`enabled-toggle ${enabled ? "enabled-toggle--on" : "enabled-toggle--off"}`}>
    <span className="enabled-toggle__dot" />
    {enabled ? "enabled" : "disabled"}
  </span>
);

// -- EventTag (single event chip) ----------------------------------------

const EventTag = ({ event, onRemove, removable = false }) => (
  <span className="event-tag">
    <code>{event}</code>
    {removable && (
      <button className="event-tag__remove" onClick={onRemove} aria-label={`Remove ${event}`}>
        <IconClose />
      </button>
    )}
  </span>
);

// -- SecretReveal (mask + click-to-reveal) -------------------------------

const SecretReveal = ({ value }) => {
  const [shown, setShown] = React.useState(false);
  if (!value) return <span className="muted small">no secret</span>;
  return (
    <span className="secret-reveal">
      <code>{shown ? value : "••••••••••••"}</code>
      <button
        className="secret-reveal__btn"
        onClick={() => setShown(!shown)}
        aria-label={shown ? "Hide secret" : "Show secret"}
      >
        {shown ? <IconEyeOff /> : <IconEye />}
      </button>
    </span>
  );
};

// -- CountdownTimer (live, promoted from approvals/cron) -----------------

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
  if (seconds >= 3600)
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

// -- formatters -----------------------------------------------------------

function formatRelative(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function formatDuration(ms) {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

function truncateUrl(url, max = 56) {
  if (!url) return "—";
  if (url.length <= max) return url;
  return url.slice(0, max - 1) + "…";
}

Object.assign(window, {
  IconRefresh,
  IconPlus,
  IconClose,
  IconCheck,
  IconAlert,
  IconBolt,
  IconLink,
  IconKey,
  IconEye,
  IconEyeOff,
  IconSend,
  IconRetry,
  IconEdit,
  IconTrash,
  IconChevronR,
  IconChevronD,
  IconSearch,
  IconClock,
  IconShield,
  IconActivity,
  IconCopy,
  StatusCodeBadge,
  DeliveryStatusBadge,
  WebhookHealthBadge,
  EnabledToggle,
  EventTag,
  SecretReveal,
  CountdownTimer,
  formatRelative,
  formatDuration,
  truncateUrl,
});
