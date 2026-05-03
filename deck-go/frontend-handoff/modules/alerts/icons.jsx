// SVG icon set for alerts prototype.

const _iconBase = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

function IconSearch(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
function IconChevronRight(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
function IconChevronLeft(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}
function IconCheck(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="m5 12 4 4 10-10" />
    </svg>
  );
}
function IconX(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </svg>
  );
}
function IconAlert(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="M12 4 2 20h20z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}
function IconInfo(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8h.01" />
      <path d="M11 12h1v4h1" />
    </svg>
  );
}
function IconRefresh(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 4v5h-5" />
    </svg>
  );
}
function IconClock(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function IconBell(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="M6 18a6 6 0 0 1 12 0" />
      <path d="M6 18h12" />
      <path d="M12 4a4 4 0 0 0-4 4v4" />
      <path d="M16 12V8a4 4 0 0 0-4-4" />
      <path d="M10 22h4" />
    </svg>
  );
}
function IconWebhook(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
      <circle cx="12" cy="6" r="2" />
      <path d="m11 8-3 6" />
      <path d="m13 8 3 6" />
      <path d="M8 18h6" />
    </svg>
  );
}
function IconActivity(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="M3 12h4l3-8 4 16 3-8h4" />
    </svg>
  );
}
function IconToast(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <rect x="3" y="9" width="18" height="10" rx="2" />
      <path d="M7 13h.01M11 13h.01M15 13h.01" />
    </svg>
  );
}
function IconPlus(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function IconTrash(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M5 7l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13" />
      <path d="M9 7V4h6v3" />
    </svg>
  );
}
function IconKbd(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 11h.01M11 11h.01M15 11h.01M7 15h10" />
    </svg>
  );
}
function IconCopy(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}
function IconCode(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="m9 9-4 3 4 3" />
      <path d="m15 9 4 3-4 3" />
    </svg>
  );
}
function IconPower(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="M12 4v8" />
      <path d="M7.8 7.8a6 6 0 1 0 8.4 0" />
    </svg>
  );
}
function IconEntity(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h6" />
    </svg>
  );
}
function IconThreshold(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="M3 12h6l3-6 3 12 3-6h3" />
    </svg>
  );
}

const ACTION_ICONS = {
  toast: IconToast,
  activity: IconActivity,
  webhook: IconWebhook,
};

function ActionPill({ action }) {
  const Icon = ACTION_ICONS[action] || IconBell;
  return (
    <span className={`action-pill action-pill--${action}`}>
      <Icon />
      <span>{action}</span>
    </span>
  );
}

const ENTITY_PALETTES = {
  channel: "linear-gradient(135deg, #1f3a5f 0%, #6aa9ff 100%)",
  model: "linear-gradient(135deg, #1f4a3f 0%, #5fb09a 100%)",
  subagent: "linear-gradient(135deg, #4a3520 0%, #d39256 100%)",
  budget: "linear-gradient(135deg, #4a4520 0%, #d3c356 100%)",
  approval: "linear-gradient(135deg, #2a1f4a 0%, #8c6ad3 100%)",
  plugin: "linear-gradient(135deg, #4a2030 0%, #d3568f 100%)",
  session: "linear-gradient(135deg, #1f4a4a 0%, #5fc3c3 100%)",
  test: "linear-gradient(135deg, #2a3a1f 0%, #82c350 100%)",
  auth: "linear-gradient(135deg, #20203a 0%, #5670ff 100%)",
  pr: "linear-gradient(135deg, #4a2050 0%, #c356d3 100%)",
  provider: "linear-gradient(135deg, #1f4a3f 0%, #50a395 100%)",
  routing: "linear-gradient(135deg, #1f354a 0%, #4a8ec0 100%)",
};

function EntityGlyph({ entityType, size = 32 }) {
  const initial = (entityType || "?").charAt(0).toUpperCase();
  const palette =
    ENTITY_PALETTES[entityType] || "linear-gradient(135deg, #2a2f3a 0%, #4a5160 100%)";
  return (
    <div
      className="entity-glyph"
      style={{
        width: size,
        height: size,
        background: palette,
        borderRadius: 8,
        display: "grid",
        placeItems: "center",
        color: "var(--ds-text-1)",
        fontSize: Math.round(size * 0.42),
        fontWeight: 600,
      }}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}

Object.assign(window, {
  IconSearch,
  IconChevronRight,
  IconChevronLeft,
  IconCheck,
  IconX,
  IconAlert,
  IconInfo,
  IconRefresh,
  IconClock,
  IconBell,
  IconWebhook,
  IconActivity,
  IconToast,
  IconPlus,
  IconTrash,
  IconKbd,
  IconCopy,
  IconCode,
  IconPower,
  IconEntity,
  IconThreshold,
  ActionPill,
  EntityGlyph,
  ACTION_ICONS,
});
