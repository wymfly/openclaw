// SVG icon set — models-specific. Stroke 1.5px, 14px size.

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
const IconBolt = (p) => (
  <_Icon {...p}>
    <path d="M9 1L2 9h5l-1 6 7-8H8z" />
  </_Icon>
);
const IconCpu = (p) => (
  <_Icon {...p}>
    <rect x="3" y="3" width="10" height="10" rx="1" />
    <rect x="6" y="6" width="4" height="4" />
    <path d="M3 6H1M3 10H1M13 6h2M13 10h2M6 3V1M10 3V1M6 15v-2M10 15v-2" />
  </_Icon>
);
const IconBrain = (p) => (
  <_Icon {...p}>
    <path d="M5 3a2 2 0 00-2 2v1a2 2 0 00-1 1.7v.6A2 2 0 003 10v1a2 2 0 002 2h1" />
    <path d="M11 3a2 2 0 012 2v1a2 2 0 011 1.7v.6A2 2 0 0113 10v1a2 2 0 01-2 2h-1" />
    <path d="M8 3v10" />
  </_Icon>
);
const IconLock = (p) => (
  <_Icon {...p}>
    <rect x="3.5" y="7" width="9" height="7" rx="1" />
    <path d="M5 7V5a3 3 0 016 0v2" />
  </_Icon>
);
const IconKey = (p) => (
  <_Icon {...p}>
    <circle cx="5" cy="11" r="3" />
    <path d="M7 9l6-6 2 2-2 2 1 1-2 2-1-1-2 2" />
  </_Icon>
);
const IconDollar = (p) => (
  <_Icon {...p}>
    <path d="M8 1v14M11 4H6.5A2 2 0 005 8h6a2 2 0 010 4H4.5" />
  </_Icon>
);
const IconHistory = (p) => (
  <_Icon {...p}>
    <path d="M2 8a6 6 0 11.5 2.4" />
    <path d="M8 4v4l3 2" />
  </_Icon>
);
const IconShield = (p) => (
  <_Icon {...p}>
    <path d="M8 1l6 2v5a7 7 0 01-6 7 7 7 0 01-6-7V3l6-2z" />
  </_Icon>
);
const IconActivity = (p) => (
  <_Icon {...p}>
    <path d="M1 8h3l2-5 4 10 2-5h3" />
  </_Icon>
);
const IconDownload = (p) => (
  <_Icon {...p}>
    <path d="M8 1v10M4 7l4 4 4-4M2 14h12" />
  </_Icon>
);
const IconStar = (p) => (
  <_Icon {...p}>
    <path d="M8 1l2.2 4.5 5 .7-3.6 3.5.85 5L8 12.5l-4.45 2.2.85-5L.8 6.2l5-.7z" />
  </_Icon>
);
const IconChain = (p) => (
  <_Icon {...p}>
    <path d="M6 10l4-4" />
    <path d="M9 4l1.5-1.5a2.5 2.5 0 113.5 3.5L12.5 7.5" />
    <path d="M7 8.5L5.5 10A2.5 2.5 0 102 6.5L3.5 5" />
  </_Icon>
);
const IconEmpty = (p) => (
  <_Icon {...p} size={20}>
    <path d="M3 3h14v14H3z" strokeDasharray="2 2" />
    <path d="M7 10h6" />
  </_Icon>
);

const PROVIDER_PALETTE = {
  anthropic: "#cc9b7a",
  openai: "#5fc99c",
  google: "#62a8ff",
  ollama: "#a18bff",
  openrouter: "#e6a55a",
};
const PROVIDER_GLYPH_TEXT = {
  anthropic: "A",
  openai: "O",
  google: "G",
  ollama: "ol",
  openrouter: "or",
};

const ProviderGlyph = ({ id, size = 28 }) => {
  const palette = PROVIDER_PALETTE[id] || "var(--ds-text-3)";
  const text = PROVIDER_GLYPH_TEXT[id] || (id || "?").slice(0, 1).toUpperCase();
  const fontSize = text.length > 1 ? size * 0.32 : size * 0.42;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <rect
        x="1"
        y="1"
        width={size - 2}
        height={size - 2}
        rx="6"
        fill="var(--ds-bg-2)"
        stroke={palette}
        strokeOpacity="0.55"
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontWeight="600"
        fontSize={fontSize}
        fill={palette}
      >
        {text}
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
  IconBolt,
  IconCpu,
  IconBrain,
  IconLock,
  IconKey,
  IconDollar,
  IconHistory,
  IconShield,
  IconActivity,
  IconDownload,
  IconStar,
  IconChain,
  IconEmpty,
  ProviderGlyph,
});
