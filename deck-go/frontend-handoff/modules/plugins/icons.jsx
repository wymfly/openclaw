// SVG icon set for plugins prototype.
// Plain function components — translated to @/design-system/icons when the
// real frontend lands. Names follow domain semantics, not lucide naming.

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

function IconFilter(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="M3 5h18l-7 9v6l-4-2v-4z" />
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

function IconChannel(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="M4 4v16l5-4h11V4z" />
      <path d="M8 9h8" />
      <path d="M8 13h6" />
    </svg>
  );
}

function IconTool(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="m14 7 3 3-7 7H7v-3z" />
      <path d="m17 4 3 3-2 2-3-3z" />
    </svg>
  );
}

function IconAgent(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <rect x="4" y="6" width="16" height="12" rx="2" />
      <circle cx="9" cy="12" r="1.2" />
      <circle cx="15" cy="12" r="1.2" />
      <path d="M12 3v3" />
    </svg>
  );
}

function IconProvider(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <rect x="4" y="4" width="16" height="6" rx="1.5" />
      <rect x="4" y="14" width="16" height="6" rx="1.5" />
      <path d="M8 7h.01M8 17h.01" />
    </svg>
  );
}

function IconBundled(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="M12 3 4 7v8l8 4 8-4V7z" />
      <path d="M4 7l8 4 8-4" />
      <path d="M12 11v8" />
    </svg>
  );
}

function IconExtension(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="M5 9h2V7a2 2 0 0 1 4 0v2h2a2 2 0 0 1 0 4h-2v6H5v-2a2 2 0 0 0 0-4z" />
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

function IconErrorCircle(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6" />
      <path d="m15 9-6 6" />
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

function IconSettings(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3 1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8 1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
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

function IconClock(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function IconBookOpen(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="M3 5h7a3 3 0 0 1 3 3v12a3 3 0 0 0-3-3H3z" />
      <path d="M21 5h-7a3 3 0 0 0-3 3v12a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function IconLink(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="M10 14a4 4 0 0 1 0-5.6l3-3a4 4 0 0 1 5.6 5.6l-1.5 1.5" />
      <path d="M14 10a4 4 0 0 1 0 5.6l-3 3a4 4 0 0 1-5.6-5.6l1.5-1.5" />
    </svg>
  );
}

function IconShield(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6z" />
      <path d="m9 12 2 2 4-4" />
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

// PluginGlyph — colored initial avatar based on origin + first letter.
// Bundled = accent gradient; extension = warm gradient; implicit = muted.
function PluginGlyph({ id, name, origin, size = 36 }) {
  const initial = (name || id || "?").trim().charAt(0).toUpperCase();
  const palette =
    origin === "bundled"
      ? "linear-gradient(135deg, var(--ds-accent-soft, #1f3a5f) 0%, var(--ds-accent, #6aa9ff) 100%)"
      : origin === "extension"
        ? "linear-gradient(135deg, #4a3520 0%, #d39256 100%)"
        : "linear-gradient(135deg, #2a2f3a 0%, #4a5160 100%)";
  return (
    <div
      className="plugin-glyph"
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
        letterSpacing: -0.4,
      }}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}

Object.assign(window, {
  IconSearch,
  IconFilter,
  IconChevronRight,
  IconChevronLeft,
  IconChannel,
  IconTool,
  IconAgent,
  IconProvider,
  IconBundled,
  IconExtension,
  IconCheck,
  IconX,
  IconAlert,
  IconInfo,
  IconErrorCircle,
  IconRefresh,
  IconSettings,
  IconCopy,
  IconCode,
  IconClock,
  IconBookOpen,
  IconLink,
  IconShield,
  IconKbd,
  PluginGlyph,
});
