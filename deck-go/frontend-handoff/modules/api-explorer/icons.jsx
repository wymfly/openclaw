// API Explorer icons + local molecules: KindBadge (query/mutation/stream),
// ScopeBadge (read/write/admin), StatusCodeBadge (HTTP tone), JsonView
// (read-only highlighted body), HighlightedJson (prism-like inline).

const svgProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const Icon = ({ d, size = 16 }) => (
  <svg {...svgProps} width={size} height={size}>
    <path d={d} />
  </svg>
);

const IconRefresh = () => (
  <svg {...svgProps}>
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
    <path d="M21 3v5h-5M3 21v-5h5" />
  </svg>
);
const IconClose = () => <Icon d="M6 6l12 12M18 6L6 18" />;
const IconCheck = () => <Icon d="M5 12l4 4 10-10" />;
const IconAlert = () => (
  <svg {...svgProps}>
    <path d="M12 3l10 18H2L12 3z" />
    <path d="M12 10v5M12 18.5v.01" />
  </svg>
);
const IconPlay = () => <Icon d="M8 5v14l11-7z" />;
const IconBolt = () => <Icon d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />;
const IconCopy = () => (
  <svg {...svgProps}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
);
const IconChevronR = () => <Icon d="M9 6l6 6-6 6" />;
const IconChevronD = () => <Icon d="M6 9l6 6 6-6" />;
const IconSearch = () => (
  <svg {...svgProps}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.5-4.5" />
  </svg>
);
const IconClock = () => (
  <svg {...svgProps}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
const IconShield = () => <Icon d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" />;
const IconBookmark = () => <Icon d="M19 21l-7-5-7 5V3a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />;
const IconCode = () => (
  <svg {...svgProps}>
    <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" />
  </svg>
);
const IconHistory = () => (
  <svg {...svgProps}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 3v6h6" />
    <path d="M12 7v5l3 2" />
  </svg>
);
const IconNetwork = () => (
  <svg {...svgProps}>
    <circle cx="12" cy="5" r="2" />
    <circle cx="5" cy="19" r="2" />
    <circle cx="19" cy="19" r="2" />
    <path d="M12 7v5M7 17l4-4M17 17l-4-4" />
  </svg>
);
const IconPlus = () => <Icon d="M12 5v14M5 12h14" />;
const IconMinus = () => <Icon d="M5 12h14" />;
const IconTrash = () => (
  <svg {...svgProps}>
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14" />
  </svg>
);

// -- KindBadge ------------------------------------------------------------

const KIND_TONES = {
  query: "info",
  mutation: "warn",
  stream: "accent",
};

const KindBadge = ({ kind }) => {
  const tone = KIND_TONES[kind] || "neutral";
  return <span className={`kind-badge kind-badge--${tone}`}>{kind}</span>;
};

// -- ScopeBadge -----------------------------------------------------------

const SCOPE_TONES = {
  "operator.read": "ok",
  "operator.write": "warn",
  "operator.admin": "err",
};

const ScopeBadge = ({ scope }) => {
  const tone = SCOPE_TONES[scope] || "neutral";
  const short = scope.replace("operator.", "");
  return (
    <span className={`scope-badge scope-badge--${tone}`}>
      <IconShield />
      {short}
    </span>
  );
};

// -- StatusCodeBadge (HTTP) ----------------------------------------------

const StatusCodeBadge = ({ statusCode }) => {
  if (statusCode === null || statusCode === undefined) {
    return <span className="status-code-badge status-code-badge--none">—</span>;
  }
  let tone = "neutral";
  if (statusCode >= 200 && statusCode < 300) tone = "ok";
  else if (statusCode >= 300 && statusCode < 400) tone = "info";
  else if (statusCode >= 400 && statusCode < 500) tone = "warn";
  else if (statusCode >= 500) tone = "err";
  return <span className={`status-code-badge status-code-badge--${tone}`}>{statusCode}</span>;
};

// -- HighlightedJson (token-level CSS highlighting via inline spans) ------

function tokenize(json) {
  const tokens = [];
  const re =
    /(\s+)|("(?:\\.|[^"\\])*"\s*:)|("(?:\\.|[^"\\])*")|(-?\d+(?:\.\d+)?)|(true|false|null)|([{}[\],])/g;
  let m;
  while ((m = re.exec(json)) !== null) {
    if (m[1]) tokens.push({ kind: "ws", value: m[1] });
    else if (m[2]) tokens.push({ kind: "key", value: m[2] });
    else if (m[3]) tokens.push({ kind: "string", value: m[3] });
    else if (m[4]) tokens.push({ kind: "number", value: m[4] });
    else if (m[5]) tokens.push({ kind: "literal", value: m[5] });
    else if (m[6]) tokens.push({ kind: "punct", value: m[6] });
  }
  return tokens;
}

const HighlightedJson = ({ value, maxHeight = 360 }) => {
  let raw;
  try {
    raw = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  } catch {
    raw = String(value);
  }
  const tokens = React.useMemo(() => tokenize(raw), [raw]);
  return (
    <pre className="json-view" style={{ maxHeight }}>
      <code>
        {tokens.map((t, i) => {
          if (t.kind === "ws") return t.value;
          if (t.kind === "punct")
            return (
              <span key={i} className="json-token json-token--punct">
                {t.value}
              </span>
            );
          return (
            <span key={i} className={`json-token json-token--${t.kind}`}>
              {t.value}
            </span>
          );
        })}
      </code>
    </pre>
  );
};

// -- formatRelative -------------------------------------------------------

function formatRelative(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

// -- ParamRow (for required/optional indicator + type) -------------------

const ParamRow = ({ name, schema, required }) => (
  <div className="param-row">
    <code className="param-row__name">{name}</code>
    <code className="param-row__type">
      {schema.type}
      {schema.nullable ? "?" : ""}
    </code>
    {required && <span className="param-row__required">required</span>}
    {schema.description && <span className="param-row__desc">{schema.description}</span>}
  </div>
);

Object.assign(window, {
  IconRefresh,
  IconClose,
  IconCheck,
  IconAlert,
  IconPlay,
  IconBolt,
  IconCopy,
  IconChevronR,
  IconChevronD,
  IconSearch,
  IconClock,
  IconShield,
  IconBookmark,
  IconCode,
  IconHistory,
  IconNetwork,
  IconPlus,
  IconMinus,
  IconTrash,
  KindBadge,
  ScopeBadge,
  StatusCodeBadge,
  HighlightedJson,
  ParamRow,
  formatRelative,
  formatBytes,
});
