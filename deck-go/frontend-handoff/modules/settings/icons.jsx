// icons.jsx — SVG icons + small molecules for the settings panel.

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

const IconKey = icon(
  <>
    <circle cx="6" cy="10" r="2.5" />
    <path d="M8 9.5L13.5 4M11.5 6L13 7.5" />
  </>,
);
const IconRuntime = icon(
  <>
    <rect x="2.5" y="3.5" width="11" height="9" rx="1.5" />
    <path d="M5 12.5v-2M11 12.5v-2M2.5 7.5h11" />
  </>,
);
const IconAppearance = icon(
  <>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 2v12" />
  </>,
);
const IconBell = icon(
  <>
    <path d="M3.5 11.5h9c-1-1-1.5-2-1.5-3.5V6.5a3 3 0 1 0-6 0V8c0 1.5-.5 2.5-1.5 3.5z" />
    <path d="M6.5 11.5a1.5 1.5 0 0 0 3 0" />
  </>,
);
const IconDevices = icon(
  <>
    <rect x="2" y="3.5" width="9" height="6" rx="1" />
    <rect x="11" y="6" width="3" height="7" rx="0.5" />
  </>,
);
const IconVersion = icon(
  <>
    <path d="M2.5 8h2l1-2 2 4 2-4 1.5 2h2" />
  </>,
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
const IconEye = icon(
  <>
    <path d="M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8z" />
    <circle cx="8" cy="8" r="2" />
  </>,
);
const IconEyeOff = icon(
  <>
    <path d="M3 3l10 10" />
    <path d="M2.5 8s2-3.5 5.5-4.3M9 6.7c1.7 0 3 1.3 3 3 0 .5-.1.9-.3 1.3" />
  </>,
);
const IconArrowOut = icon(<path d="M5.5 10.5L11 5M11 5h-4M11 5v4" />);
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
const IconWand = icon(
  <>
    <path d="M12 2l1 1M14 4l1 1" />
    <path d="M11.5 4.5L3 13l-1 .5.5-1 8.5-8.5z" />
  </>,
);
const IconLink = icon(
  <>
    <path d="M6.5 9.5L9.5 6.5" />
    <path d="M5.5 8.5l-1 1a2 2 0 0 0 2.8 2.8l1-1M10.5 7.5l1-1a2 2 0 0 0-2.8-2.8l-1 1" />
  </>,
);
const IconUnlink = icon(
  <>
    <path d="M6.5 9.5L9.5 6.5" />
    <path d="M5.5 8.5l-1 1a2 2 0 0 0 2.8 2.8l1-1M10.5 7.5l1-1a2 2 0 0 0-2.8-2.8l-1 1" />
    <path d="M3 3l10 10" />
  </>,
);

const SECTION_ICONS = {
  key: IconKey,
  runtime: IconRuntime,
  appearance: IconAppearance,
  bell: IconBell,
  devices: IconDevices,
  version: IconVersion,
};

// Small molecules ----------------------------------------------------------

function SectionIcon({ icon: name }) {
  const Component = SECTION_ICONS[name] || IconKey;
  return <Component size={14} />;
}

function StatusPill({ tone = "iron", icon: Icon, children }) {
  return (
    <span className={`status-pill status-pill--${tone}`}>
      {Icon ? <Icon size={11} /> : null}
      <span>{children}</span>
    </span>
  );
}

function HealthDot({ health }) {
  const tone = health === "healthy" ? "success" : health === "unhealthy" ? "error" : "iron";
  return (
    <span
      className={`health-dot health-dot--${tone}`}
      aria-label={`Health: ${health || "unknown"}`}
    />
  );
}

function ModeBadge({ mode }) {
  return (
    <span className={`mode-badge mode-badge--${mode}`}>
      <span className="mode-badge__dot" />
      <span className="mode-badge__label">{mode === "bundled" ? "BUNDLED" : "REMOTE"}</span>
    </span>
  );
}

function SourcePill({ source }) {
  if (source === "env") {
    return (
      <span className="source-pill source-pill--env">
        <IconLock size={10} />
        <span>from .env</span>
      </span>
    );
  }
  if (source === "json") {
    return (
      <span className="source-pill source-pill--json">
        <span>from JSON</span>
      </span>
    );
  }
  return (
    <span className="source-pill source-pill--missing">
      <IconAlert size={10} />
      <span>missing</span>
    </span>
  );
}

Object.assign(window, {
  IconKey,
  IconRuntime,
  IconAppearance,
  IconBell,
  IconDevices,
  IconVersion,
  IconRefresh,
  IconSave,
  IconUndo,
  IconClose,
  IconCheck,
  IconAlert,
  IconLock,
  IconEye,
  IconEyeOff,
  IconArrowOut,
  IconClock,
  IconUser,
  IconSearch,
  IconCopy,
  IconWand,
  IconLink,
  IconUnlink,
  SectionIcon,
  StatusPill,
  HealthDot,
  ModeBadge,
  SourcePill,
  SECTION_ICONS,
});
