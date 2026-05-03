// SVG icon set for skills prototype.
// Translated to @/design-system/icons re-exports (lucide-react under the hood)
// at production time. Names follow domain semantics, not lucide naming.

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

function IconDownload(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="M12 4v12" />
      <path d="m8 12 4 4 4-4" />
      <path d="M5 20h14" />
    </svg>
  );
}

function IconUpload(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="M12 20V8" />
      <path d="m8 12 4-4 4 4" />
      <path d="M5 4h14" />
    </svg>
  );
}

function IconExternal(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="M14 4h6v6" />
      <path d="m20 4-9 9" />
      <path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

function IconBox(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="M12 3 4 7v10l8 4 8-4V7z" />
      <path d="M4 7l8 4 8-4" />
      <path d="M12 11v10" />
    </svg>
  );
}

function IconCloud(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="M6 18a4 4 0 0 1 .9-7.9A6 6 0 0 1 18 11a4 4 0 0 1 0 7z" />
    </svg>
  );
}

function IconPuzzle(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="M5 9h2V7a2 2 0 0 1 4 0v2h2a2 2 0 0 1 0 4h-2v6H5v-2a2 2 0 0 0 0-4z" />
    </svg>
  );
}

function IconZap(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="M13 3 4 14h7l-1 7 9-11h-7z" />
    </svg>
  );
}

function IconTerminal(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="m7 9 3 3-3 3" />
      <path d="M13 15h4" />
    </svg>
  );
}

function IconKey(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <circle cx="8" cy="14" r="4" />
      <path d="m11 11 9-9" />
      <path d="m17 5 3 3" />
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

function IconFile(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
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

function IconSettings(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3 1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8 1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
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

function IconHash(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="M5 9h14M5 15h14" />
      <path d="M10 4 8 20" />
      <path d="M16 4l-2 16" />
    </svg>
  );
}

// SkillGlyph — emoji-anchored avatar with source-aware tint.
// Bundled = accent gradient; managed = warm gradient; plugin = teal gradient.
function SkillGlyph({ skill, size = 36 }) {
  const emoji = skill?.emoji || "✨";
  const source = skill?.source || "bundled";
  const palette =
    source === "bundled"
      ? "linear-gradient(135deg, #1f3a5f 0%, #6aa9ff 100%)"
      : source === "managed"
        ? "linear-gradient(135deg, #4a3520 0%, #d39256 100%)"
        : "linear-gradient(135deg, #1f4a3f 0%, #5fb09a 100%)";
  return (
    <div
      className="skill-glyph"
      style={{
        width: size,
        height: size,
        background: palette,
        borderRadius: 8,
        display: "grid",
        placeItems: "center",
        fontSize: Math.round(size * 0.5),
      }}
      aria-hidden="true"
    >
      {emoji}
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
  IconDownload,
  IconUpload,
  IconExternal,
  IconBox,
  IconCloud,
  IconPuzzle,
  IconZap,
  IconTerminal,
  IconKey,
  IconClock,
  IconBookOpen,
  IconFile,
  IconCopy,
  IconTrash,
  IconSettings,
  IconKbd,
  IconHash,
  SkillGlyph,
});
