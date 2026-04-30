// Icon set — minimal stroke icons inlined as React components.
const Icon = ({
  d,
  size = 14,
  fill = "none",
  stroke = "currentColor",
  sw = 1.5,
  children,
  viewBox = "0 0 24 24",
}) => (
  <svg
    width={size}
    height={size}
    viewBox={viewBox}
    fill={fill}
    stroke={stroke}
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children || <path d={d} />}
  </svg>
);

const I = {
  Plus: (p) => (
    <Icon {...p}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  ),
  Search: (p) => (
    <Icon {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Icon>
  ),
  Trash: (p) => (
    <Icon {...p}>
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
    </Icon>
  ),
  Bot: (p) => (
    <Icon {...p}>
      <rect x="4" y="7" width="16" height="12" rx="3" />
      <path d="M12 3v4M9 13h.01M15 13h.01M9 17h6" />
    </Icon>
  ),
  User: (p) => (
    <Icon {...p}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
    </Icon>
  ),
  Send: (p) => (
    <Icon {...p}>
      <path d="m4 12 16-8-6 18-3-7-7-3z" />
    </Icon>
  ),
  Stop: (p) => (
    <Icon {...p}>
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </Icon>
  ),
  Paperclip: (p) => (
    <Icon {...p}>
      <path d="M21 11.5 12 20.5a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.67 3.67 0 1 1 5.19 5.19l-8.84 8.84a1.83 1.83 0 0 1-2.6-2.6L14.5 7.5" />
    </Icon>
  ),
  Wand: (p) => (
    <Icon {...p}>
      <path d="M5 19 18 6m-3-1 1.5 1.5M19 8l1.5 1.5M16 13l1.5 1.5" />
    </Icon>
  ),
  Canvas: (p) => (
    <Icon {...p}>
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <path d="M3 9h18M7 14h6" />
    </Icon>
  ),
  Artifact: (p) => (
    <Icon {...p}>
      <path d="M14 3h6v6M10 21H4v-6M21 3l-9 9M3 21l9-9" />
    </Icon>
  ),
  Wifi: (p) => (
    <Icon {...p}>
      <path d="M5 12a10 10 0 0 1 14 0M8 15a6 6 0 0 1 8 0M11 18h2" />
    </Icon>
  ),
  WifiOff: (p) => (
    <Icon {...p}>
      <path d="M3 3l18 18M5 12a10 10 0 0 1 4-2.8M19 12a10 10 0 0 0-2.5-2M16 15a6 6 0 0 0-2-1.4M11 18h2" />
    </Icon>
  ),
  ChevronRight: (p) => (
    <Icon {...p}>
      <path d="m9 6 6 6-6 6" />
    </Icon>
  ),
  ChevronDown: (p) => (
    <Icon {...p}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  ),
  Copy: (p) => (
    <Icon {...p}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </Icon>
  ),
  Check: (p) => (
    <Icon {...p}>
      <path d="m4 12 5 5L20 6" />
    </Icon>
  ),
  X: (p) => (
    <Icon {...p}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Icon>
  ),
  Refresh: (p) => (
    <Icon {...p}>
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" />
    </Icon>
  ),
  Shield: (p) => (
    <Icon {...p}>
      <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3z" />
    </Icon>
  ),
  Brain: (p) => (
    <Icon {...p}>
      <path d="M9 4a3 3 0 0 0-3 3v1a3 3 0 0 0-2 5 3 3 0 0 0 2 5v1a3 3 0 0 0 3 3 3 3 0 0 0 3-3V4M15 4a3 3 0 0 1 3 3v1a3 3 0 0 1 2 5 3 3 0 0 1-2 5v1a3 3 0 0 1-3 3 3 3 0 0 1-3-3" />
    </Icon>
  ),
  Tool: (p) => (
    <Icon {...p}>
      <path d="M14 7a4 4 0 1 1-4 4l-7 7 3 3 7-7a4 4 0 0 1 4-4" />
    </Icon>
  ),
  Terminal: (p) => (
    <Icon {...p}>
      <path d="M4 6h16v12H4z" />
      <path d="m7 10 3 2-3 2M13 14h4" />
    </Icon>
  ),
  File: (p) => (
    <Icon {...p}>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
    </Icon>
  ),
  Image: (p) => (
    <Icon {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m4 18 5-5 5 5 3-3 3 3" />
    </Icon>
  ),
  Diff: (p) => (
    <Icon {...p}>
      <path d="M5 4v6m-3-3h6M16 14h5m-3-3v6M3 21l18-18" />
    </Icon>
  ),
  Eye: (p) => (
    <Icon {...p}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  ),
  Download: (p) => (
    <Icon {...p}>
      <path d="M12 4v12m-5-5 5 5 5-5M5 20h14" />
    </Icon>
  ),
  Maximize: (p) => (
    <Icon {...p}>
      <path d="M4 9V4h5M20 15v5h-5M20 9V4h-5M4 15v5h5" />
    </Icon>
  ),
  Settings: (p) => (
    <Icon {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </Icon>
  ),
  Bug: (p) => (
    <Icon {...p}>
      <rect x="6" y="8" width="12" height="12" rx="6" />
      <path d="M9 4 7 7M15 4l2 3M3 13h3M18 13h3M3 17h3M18 17h3M12 8v12" />
    </Icon>
  ),
  Layers: (p) => (
    <Icon {...p}>
      <path d="m12 3 9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 18l9 5 9-5" />
    </Icon>
  ),
  Hash: (p) => (
    <Icon {...p}>
      <path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />
    </Icon>
  ),
  Sparkle: (p) => (
    <Icon {...p}>
      <path d="m12 3 2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6zM18 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" />
    </Icon>
  ),
  Pencil: (p) => (
    <Icon {...p}>
      <path d="M4 20h4l11-11-4-4L4 16v4z" />
    </Icon>
  ),
  Branch: (p) => (
    <Icon {...p}>
      <circle cx="6" cy="5" r="2" />
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="12" r="2" />
      <path d="M6 7v10M6 12c0-3 3-5 6-5 3 0 4-1 4-3" />
    </Icon>
  ),
  AtSign: (p) => (
    <Icon {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
    </Icon>
  ),
  Slash: (p) => (
    <Icon {...p}>
      <path d="M16 4 8 20" />
    </Icon>
  ),
  Clock: (p) => (
    <Icon {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Icon>
  ),
  Coin: (p) => (
    <Icon {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9.5h4.5a1.5 1.5 0 0 1 0 3H10a1.5 1.5 0 0 0 0 3h4.5M12 7v2M12 15v2" />
    </Icon>
  ),
  Zap: (p) => (
    <Icon {...p}>
      <path d="m13 2-9 13h7l-1 7 9-13h-7l1-7z" />
    </Icon>
  ),
  Panel: (p) => (
    <Icon {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M14 4v16" />
    </Icon>
  ),
  Menu: (p) => (
    <Icon {...p}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icon>
  ),
  Filter: (p) => (
    <Icon {...p}>
      <path d="M3 5h18l-7 9v6l-4-2v-4z" />
    </Icon>
  ),
  Cmd: (p) => (
    <Icon {...p}>
      <path d="M9 9h6v6H9z" />
      <path d="M9 9V6a2 2 0 1 0-2 2h2zM15 9h3a2 2 0 1 0-2-2v2zM9 15v3a2 2 0 1 1-2-2h2zM15 15h3a2 2 0 1 1-2 2v-2z" />
    </Icon>
  ),
  Image2: (p) => (
    <Icon {...p}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 16l5-4 4 3 3-3 6 5" />
    </Icon>
  ),
};

window.I = I;
