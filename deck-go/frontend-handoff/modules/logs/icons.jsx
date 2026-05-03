/* deck-go logs prototype v2 — icons + level / source glyphs */

const icon = (path) =>
  function Icon({ size = 14, strokeWidth = 1.6, className }) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        {path}
      </svg>
    );
  };

const IconSearch = icon(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3-3" />
  </>,
);
const IconRefresh = icon(
  <>
    <path d="M21 12a9 9 0 0 1-15.46 6.36L3 16" />
    <path d="M3 12a9 9 0 0 1 15.46-6.36L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M3 21v-5h5" />
  </>,
);
const IconPause = icon(
  <>
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </>,
);
const IconPlay = icon(<path d="M8 5v14l11-7z" />);
const IconClear = icon(
  <>
    <path d="M3 6h18" />
    <path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </>,
);
const IconExport = icon(
  <>
    <path d="M12 3v12" />
    <path d="m7 8 5-5 5 5" />
    <path d="M5 21h14" />
  </>,
);
const IconCopy = icon(
  <>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </>,
);
const IconChevronRight = icon(<path d="m9 6 6 6-6 6" />);
const IconChevronDown = icon(<path d="m6 9 6 6 6-6" />);
const IconClose = icon(
  <>
    <path d="m6 6 12 12" />
    <path d="m18 6-12 12" />
  </>,
);
const IconLink = icon(
  <>
    <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
    <path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
  </>,
);
const IconCircleDot = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="3" />
  </>,
);
const IconBug = icon(
  <>
    <path d="M9 9h6v8a3 3 0 0 1-6 0z" />
    <path d="M5 11h4" />
    <path d="M15 11h4" />
    <path d="M5 17h4" />
    <path d="M15 17h4" />
    <path d="M9 5a3 3 0 0 1 6 0v4H9z" />
  </>,
);
const IconInfo = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5" />
    <path d="M12 8h0" />
  </>,
);
const IconAlert = icon(
  <>
    <path d="M12 3 2 21h20z" />
    <path d="M12 9v5" />
    <path d="M12 17h0" />
  </>,
);
const IconError = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="m9 9 6 6" />
    <path d="m15 9-6 6" />
  </>,
);
const IconStream = icon(
  <>
    <path d="M3 7h13a4 4 0 0 1 0 8H3" />
    <path d="m13 11 4 4" />
    <path d="m13 19 4-4" />
  </>,
);
const IconClock = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </>,
);
const IconLayers = icon(
  <>
    <path d="m12 3 9 5-9 5-9-5z" />
    <path d="m3 13 9 5 9-5" />
    <path d="m3 18 9 5 9-5" />
  </>,
);

const LEVEL_META = {
  debug: {
    label: "debug",
    Icon: IconBug,
    cls: "level--debug",
    badge: "log-row__pill--debug",
  },
  info: {
    label: "info",
    Icon: IconInfo,
    cls: "level--info",
    badge: "log-row__pill--info",
  },
  warn: {
    label: "warn",
    Icon: IconAlert,
    cls: "level--warn",
    badge: "log-row__pill--warn",
  },
  error: {
    label: "error",
    Icon: IconError,
    cls: "level--error",
    badge: "log-row__pill--error",
  },
};

const SOURCE_META = {
  gateway: { label: "gateway", glyph: "GW", tone: "tone-accent" },
  agent: { label: "agent", glyph: "AG", tone: "tone-violet" },
  channel: { label: "channel", glyph: "CH", tone: "tone-cyan" },
  tool: { label: "tool", glyph: "TL", tone: "tone-warm" },
  "deck-bff": { label: "deck-bff", glyph: "BF", tone: "tone-success" },
  scheduler: { label: "scheduler", glyph: "SC", tone: "tone-magenta" },
  router: { label: "router", glyph: "RT", tone: "tone-amber" },
  http: { label: "http", glyph: "HT", tone: "tone-iron" },
};

function LevelPill({ level, compact = false }) {
  const meta = LEVEL_META[level] ?? LEVEL_META.info;
  const { Icon } = meta;
  return (
    <span className={`log-pill ${meta.badge}${compact ? " log-pill--compact" : ""}`}>
      <Icon size={12} />
      <span>{meta.label}</span>
    </span>
  );
}

function SourceTile({ source }) {
  const meta = SOURCE_META[source] ?? { label: source, glyph: "??", tone: "tone-iron" };
  return (
    <span className={`source-tile source-tile--${meta.tone}`} title={meta.label}>
      <span className="source-tile__glyph">{meta.glyph}</span>
      <span className="source-tile__label">{meta.label}</span>
    </span>
  );
}

Object.assign(window, {
  IconSearch,
  IconRefresh,
  IconPause,
  IconPlay,
  IconClear,
  IconExport,
  IconCopy,
  IconChevronRight,
  IconChevronDown,
  IconClose,
  IconLink,
  IconCircleDot,
  IconBug,
  IconInfo,
  IconAlert,
  IconError,
  IconStream,
  IconClock,
  IconLayers,
  LEVEL_META,
  SOURCE_META,
  LevelPill,
  SourceTile,
});
