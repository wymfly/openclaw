// icons.jsx — SVG icons + small molecules used across the config workbench.

const icon =
  (path) =>
  (props = {}) => (
    <svg
      viewBox="0 0 16 16"
      width={props.size || 14}
      height={props.size || 14}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {path}
    </svg>
  );

const IconRefresh = icon(
  <path d="M2 8a6 6 0 0 1 10.5-3.9M14 8a6 6 0 0 1-10.5 3.9M12 2v3h-3M4 14v-3h3" />,
);
const IconSave = icon(
  <>
    <path d="M3 3h8l2 2v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
    <path d="M5 3v3h6V3M5 9h6v4H5z" />
  </>,
);
const IconUndo = icon(
  <>
    <path d="M3.5 9.5a4 4 0 1 0 3.7-5.5h-4" />
    <path d="M5.5 2.5L3 4.5l2.5 2" />
  </>,
);
const IconChevronRight = icon(<path d="M6 3.5L10 8L6 12.5" />);
const IconChevronDown = icon(<path d="M3.5 6L8 10L12.5 6" />);
const IconClose = icon(<path d="M3.5 3.5L12.5 12.5M12.5 3.5L3.5 12.5" />);
const IconCheck = icon(<path d="M3 8.5L6.5 12L13 4.5" />);
const IconAlert = icon(
  <>
    <path d="M8 2L1.5 13h13z" />
    <path d="M8 6.5v3.5M8 11.5v.5" />
  </>,
);
const IconLock = icon(
  <>
    <rect x="3.5" y="7" width="9" height="6.5" rx="1" />
    <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
  </>,
);
const IconKey = icon(
  <>
    <circle cx="6" cy="10" r="2.5" />
    <path d="M8 9.5L13.5 4M11.5 6L13 7.5" />
  </>,
);
const IconJson = icon(
  <>
    <path d="M3 2.5h2.5a2.5 2.5 0 0 0-2.5 2.5v6a2.5 2.5 0 0 0 2.5 2.5H3" />
    <path d="M13 2.5h-2.5a2.5 2.5 0 0 1 2.5 2.5v6a2.5 2.5 0 0 1-2.5 2.5H13" />
  </>,
);
const IconDiff = icon(
  <>
    <path d="M3 4h6M5 6h4M3 11h6M5 13h4" />
    <path d="M11 2v5M11 9v5M9 4l2-2 2 2M9 12l2 2 2-2" />
  </>,
);
const IconClock = icon(
  <>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 4.5V8l2.5 1.5" />
  </>,
);
const IconUser = icon(
  <>
    <circle cx="8" cy="6" r="2.5" />
    <path d="M3 13.5c1-2.4 3-3.5 5-3.5s4 1.1 5 3.5" />
  </>,
);
const IconAgent = icon(
  <>
    <circle cx="8" cy="6" r="3" />
    <path d="M3 14c.5-2.5 2.5-4 5-4s4.5 1.5 5 4" />
  </>,
);
const IconModel = icon(
  <>
    <circle cx="8" cy="8" r="5" />
    <path d="M5.5 8h5M8 5.5v5" />
  </>,
);
const IconChannel = icon(
  <>
    <path d="M3 5l5 3 5-3" />
    <rect x="3" y="3.5" width="10" height="9" rx="1.5" />
  </>,
);
const IconPlugin = icon(
  <>
    <path d="M5 4V2M11 4V2" />
    <rect x="4" y="4" width="8" height="6" rx="1" />
    <path d="M7 10v2a1 1 0 0 0 2 0v-2" />
  </>,
);
const IconHook = icon(
  <>
    <path d="M5.5 2v3.5a3 3 0 0 0 5 0V2" />
    <circle cx="8" cy="11.5" r="2" />
  </>,
);
const IconRuntime = icon(
  <>
    <rect x="2.5" y="3.5" width="11" height="9" rx="1.5" />
    <path d="M5 12.5v-2M11 12.5v-2M2.5 7.5h11" />
  </>,
);
const IconSearch = icon(
  <>
    <circle cx="7" cy="7" r="4" />
    <path d="M10 10l3 3" />
  </>,
);
const IconCopy = icon(
  <>
    <rect x="3" y="3" width="7.5" height="7.5" rx="1" />
    <path d="M5.5 13h6.5a1 1 0 0 0 1-1V5.5" />
  </>,
);
const IconArrowOut = icon(<path d="M5.5 10.5L11 5M11 5h-4M11 5v4" />);
const IconBan = icon(
  <>
    <circle cx="8" cy="8" r="6" />
    <path d="M3.5 3.5L12.5 12.5" />
  </>,
);

const SECTION_ICONS = {
  agents: IconAgent,
  models: IconModel,
  channels: IconChannel,
  plugins: IconPlugin,
  hooks: IconHook,
  runtime: IconRuntime,
};

// Small molecules ----------------------------------------------------------

function SectionIcon({ section }) {
  const Component = SECTION_ICONS[section] || IconJson;
  return <Component size={14} />;
}

function HashChip({ hash, kind = "current" }) {
  const tone = kind === "base" ? "iron" : "accent";
  return (
    <span className={`hash-chip hash-chip--${tone}`}>
      <span className="hash-chip__label">{kind}</span>
      <code className="hash-chip__value">{hash}</code>
    </span>
  );
}

function FieldTypeBadge({ type }) {
  const label = Array.isArray(type) ? type.join(" | ") : type || "any";
  const tone = label.includes("string")
    ? "accent"
    : label.includes("integer") || label.includes("number")
      ? "violet"
      : label.includes("boolean")
        ? "success"
        : label.includes("array")
          ? "amber"
          : label.includes("object")
            ? "magenta"
            : "iron";
  return <span className={`field-type field-type--${tone}`}>{label}</span>;
}

function RequiredDot({ required }) {
  if (!required) return null;
  return (
    <span className="required-dot" aria-label="Required field">
      required
    </span>
  );
}

function StatusPill({ tone = "iron", icon: Icon, children }) {
  return (
    <span className={`status-pill status-pill--${tone}`}>
      {Icon ? <Icon size={11} /> : null}
      <span>{children}</span>
    </span>
  );
}

Object.assign(window, {
  IconRefresh,
  IconSave,
  IconUndo,
  IconChevronRight,
  IconChevronDown,
  IconClose,
  IconCheck,
  IconAlert,
  IconLock,
  IconKey,
  IconJson,
  IconDiff,
  IconClock,
  IconUser,
  IconAgent,
  IconModel,
  IconChannel,
  IconPlugin,
  IconHook,
  IconRuntime,
  IconSearch,
  IconCopy,
  IconArrowOut,
  IconBan,
  SectionIcon,
  HashChip,
  FieldTypeBadge,
  RequiredDot,
  StatusPill,
  SECTION_ICONS,
});
