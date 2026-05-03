// SVG icon set — minimal, consistent stroke weight (1.5px), 14px size.
// Production: move repeated icons to @/design-system/icons/.

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
const IconArrowR = (p) => (
  <_Icon {...p}>
    <path d="M6 3l5 5-5 5" />
  </_Icon>
);
const IconTrash = (p) => (
  <_Icon {...p}>
    <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" />
  </_Icon>
);
const IconFile = (p) => (
  <_Icon {...p}>
    <path d="M4 2h5l4 4v8a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" />
    <path d="M9 2v4h4" />
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
const IconLayers = (p) => (
  <_Icon {...p}>
    <path d="M8 1L1 5l7 4 7-4-7-4z" />
    <path d="M1 11l7 4 7-4M1 8l7 4 7-4" />
  </_Icon>
);
const IconBolt = (p) => (
  <_Icon {...p}>
    <path d="M9 1L2 9h5l-1 6 7-8H8z" />
  </_Icon>
);
const IconUsers = (p) => (
  <_Icon {...p}>
    <circle cx="6" cy="6" r="3" />
    <path d="M1 14a5 5 0 0110 0M11 4a3 3 0 010 6M15 14a4.5 4.5 0 00-3-4" />
  </_Icon>
);
const IconShield = (p) => (
  <_Icon {...p}>
    <path d="M8 1l6 2v5a7 7 0 01-6 7 7 7 0 01-6-7V3l6-2z" />
  </_Icon>
);
const IconBook = (p) => (
  <_Icon {...p}>
    <path d="M2 3h5a3 3 0 013 3v8a2 2 0 00-2-2H2V3zM14 3H9a3 3 0 00-3 3v8a2 2 0 012-2h5V3z" />
  </_Icon>
);
const IconRadio = (p) => (
  <_Icon {...p}>
    <circle cx="8" cy="8" r="2" />
    <path d="M5 5a4.2 4.2 0 000 6M11 5a4.2 4.2 0 010 6M3 3a7 7 0 000 10M13 3a7 7 0 010 10" />
  </_Icon>
);
const IconUser = (p) => (
  <_Icon {...p}>
    <circle cx="8" cy="6" r="3" />
    <path d="M2 14a6 6 0 0112 0" />
  </_Icon>
);
const IconEmpty = (p) => (
  <_Icon {...p} size={20}>
    <path d="M3 3h14v14H3z" strokeDasharray="2 2" />
    <path d="M7 10h6" />
  </_Icon>
);

Object.assign(window, {
  IconSearch,
  IconPlus,
  IconArrowL,
  IconArrowR,
  IconTrash,
  IconFile,
  IconRefresh,
  IconCheck,
  IconX,
  IconLayers,
  IconBolt,
  IconUsers,
  IconShield,
  IconBook,
  IconRadio,
  IconUser,
  IconEmpty,
});
