// SVG icon set — channels-specific. Stroke 1.5px, 14px size by default.
// Production: move to @/design-system/icons/ and follow lucide-react re-export
// pattern (see frontend-new/src/design-system/icons/index.ts).

const _Icon = ({ children, size = 14, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    {children}
  </svg>
);

const IconSearch = (p) => (
  <_Icon {...p}>
    <circle cx="7" cy="7" r="5" />
    <path d="M11 11l3.5 3.5" />
  </_Icon>
);
const IconPlus = (p) => (
  <_Icon {...p}>
    <path d="M8 3v10M3 8h10" />
  </_Icon>
);
const IconArrowL = (p) => (
  <_Icon {...p}>
    <path d="M10 3L5 8l5 5" />
  </_Icon>
);
const IconRefresh = (p) => (
  <_Icon {...p}>
    <path d="M2.5 8a5.5 5.5 0 019.3-4M13.5 8a5.5 5.5 0 01-9.3 4" />
    <path d="M12 1v3h-3M4 12v3h3" />
  </_Icon>
);
const IconCheck = (p) => (
  <_Icon {...p} strokeWidth="2">
    <path d="M3 8l4 4 6-7" />
  </_Icon>
);
const IconX = (p) => (
  <_Icon {...p}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </_Icon>
);
const IconWarn = (p) => (
  <_Icon {...p}>
    <path d="M8 2l6.5 11.5h-13L8 2z" />
    <path d="M8 6.5v3M8 11.5v.01" strokeWidth="2" />
  </_Icon>
);
const IconActivity = (p) => (
  <_Icon {...p}>
    <path d="M1 8h3l2-5 4 10 2-5h3" />
  </_Icon>
);
const IconRoute = (p) => (
  <_Icon {...p}>
    <circle cx="3" cy="3" r="1.5" />
    <circle cx="13" cy="13" r="1.5" />
    <path d="M3 5v3a3 3 0 003 3h4a3 3 0 003 3" />
  </_Icon>
);
const IconShield = (p) => (
  <_Icon {...p}>
    <path d="M8 1l6 2v5a7 7 0 01-6 7 7 7 0 01-6-7V3l6-2z" />
  </_Icon>
);
const IconPlug = (p) => (
  <_Icon {...p}>
    <path d="M5 1v4M11 1v4" />
    <path d="M3 5h10v2a5 5 0 01-5 5 5 5 0 01-5-5V5z" />
    <path d="M8 12v3" />
  </_Icon>
);
const IconLogout = (p) => (
  <_Icon {...p}>
    <path d="M9 13H3a1 1 0 01-1-1V4a1 1 0 011-1h6" />
    <path d="M11 5l3 3-3 3M6 8h8" />
  </_Icon>
);
const IconSlash = (p) => (
  <_Icon {...p}>
    <circle cx="8" cy="8" r="6.5" />
    <path d="M3.5 12.5l9-9" />
  </_Icon>
);
const IconDot = (p) => (
  <_Icon {...p}>
    <circle cx="8" cy="8" r="3" fill="currentColor" />
  </_Icon>
);
const IconChevronD = (p) => (
  <_Icon {...p}>
    <path d="M3 6l5 5 5-5" />
  </_Icon>
);
const IconCog = (p) => (
  <_Icon {...p}>
    <circle cx="8" cy="8" r="2" />
    <path d="M8 1v2M8 13v2M3 3l1.5 1.5M11.5 11.5L13 13M1 8h2M13 8h2M3 13l1.5-1.5M11.5 4.5L13 3" />
  </_Icon>
);
const IconCopy = (p) => (
  <_Icon {...p}>
    <rect x="5" y="5" width="9" height="9" rx="1" />
    <path d="M2 10V3a1 1 0 011-1h7" />
  </_Icon>
);
const IconEmpty = (p) => (
  <_Icon {...p} size={20}>
    <path d="M3 3h14v14H3z" strokeDasharray="2 2" />
    <path d="M7 10h6" />
  </_Icon>
);

// Channel provider glyphs — minimal, monochrome, square frame.
const ChannelGlyph = ({ id, size = 28 }) => {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const fontSize = s * 0.42;
  const initial = (id || "?").slice(0, 1).toUpperCase();
  const palette =
    {
      telegram: "#62a8ff",
      discord: "#a18bff",
      wecom: "#5fc99c",
      slack: "#e6a55a",
      qq: "#e16b8c",
    }[id] || "var(--ds-text-3)";
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden="true">
      <rect
        x="1"
        y="1"
        width={s - 2}
        height={s - 2}
        rx="6"
        fill="var(--ds-bg-2)"
        stroke={palette}
        strokeOpacity="0.55"
      />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontWeight="600"
        fontSize={fontSize}
        fill={palette}
      >
        {initial}
      </text>
    </svg>
  );
};

Object.assign(window, {
  IconSearch,
  IconPlus,
  IconArrowL,
  IconRefresh,
  IconCheck,
  IconX,
  IconWarn,
  IconActivity,
  IconRoute,
  IconShield,
  IconPlug,
  IconLogout,
  IconSlash,
  IconDot,
  IconChevronD,
  IconCog,
  IconCopy,
  IconEmpty,
  ChannelGlyph,
});
