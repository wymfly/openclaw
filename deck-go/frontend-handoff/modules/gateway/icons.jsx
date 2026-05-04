// icons.jsx — gateway panel icons + chips + spark + format helpers.

const I = (paths, opts = {}) =>
  React.createElement(
    "svg",
    {
      width: opts.size || 14,
      height: opts.size || 14,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.6,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
    paths,
  );

const IconRefresh = () =>
  I(
    <>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 4v5h-5" />
    </>,
  );
const IconClose = () =>
  I(
    <>
      <path d="M18 6L6 18M6 6l18 12" />
    </>,
  );
const IconAlert = () =>
  I(
    <>
      <path d="M12 9v4m0 4h.01" />
      <path d="M10.3 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0z" />
    </>,
  );
const IconCheck = () =>
  I(
    <>
      <polyline points="20 6 9 17 4 12" />
    </>,
  );
const IconBolt = () =>
  I(
    <>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </>,
  );
const IconActivity = () =>
  I(
    <>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </>,
  );
const IconSearch = () =>
  I(
    <>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </>,
  );
const IconClock = () =>
  I(
    <>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 16 14" />
    </>,
  );
const IconHash = () =>
  I(
    <>
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="20" y2="15" />
      <line x1="10" y1="3" x2="8" y2="21" />
      <line x1="16" y1="3" x2="14" y2="21" />
    </>,
  );
const IconShield = () =>
  I(
    <>
      <path d="M12 2l9 4v6c0 5-4 9-9 10-5-1-9-5-9-10V6l9-4z" />
    </>,
  );
const IconChevronR = () =>
  I(
    <>
      <polyline points="9 18 15 12 9 6" />
    </>,
  );
const IconChevronD = () =>
  I(
    <>
      <polyline points="6 9 12 15 18 9" />
    </>,
  );
const IconLayers = () =>
  I(
    <>
      <polygon points="12 2 22 7 12 12 2 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </>,
  );
const IconChannel = () =>
  I(
    <>
      <path d="M5 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 4z" />
    </>,
  );
const IconWrench = () =>
  I(
    <>
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-2.4 2.6-2.6z" />
    </>,
  );
const IconHeart = () =>
  I(
    <>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </>,
  );
const IconPlay = () =>
  I(
    <>
      <polygon points="5 3 19 12 5 21 5 3" />
    </>,
  );
const IconCopy = () =>
  I(
    <>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>,
  );
const IconExternal = () =>
  I(
    <>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </>,
  );
const IconBook = () =>
  I(
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" />
    </>,
  );

// ScopePill — color-coded by scope authority.
const ScopePill = ({ scope }) => {
  const tone = !scope
    ? "unknown"
    : scope === "operator.read"
      ? "ok"
      : scope === "operator.write"
        ? "warn"
        : scope === "system"
          ? "system"
          : "unknown";
  return <span className={`scope-pill scope-pill--${tone}`}>{scope || "—"}</span>;
};

const SinceTag = ({ since }) => {
  if (!since) return null;
  return <span className="since-tag">v{since}</span>;
};

// Channel connection dot — green/red based on connected.
const ConnDot = ({ connected }) => (
  <span className={`conn-dot conn-dot--${connected ? "on" : "off"}`} aria-hidden="true" />
);

// SparkBar — tiny bar sparkline for the throughput card.
const SparkBar = ({ values, width = 240, height = 36, tone = "accent" }) => {
  if (!values || values.length === 0) return null;
  const max = Math.max(...values, 1);
  const w = (width - (values.length - 1) * 1) / values.length;
  return (
    <svg width={width} height={height} className={`spark-bar spark-bar--${tone}`}>
      {values.map((v, i) => {
        const h = Math.max(1, (v / max) * (height - 4));
        const x = i * (w + 1);
        const y = height - h - 2;
        return (
          <rect
            key={i}
            x={x.toFixed(1)}
            y={y.toFixed(1)}
            width={w.toFixed(1)}
            height={h.toFixed(1)}
            className="spark-bar__bar"
          />
        );
      })}
    </svg>
  );
};

// SparkLine — tiny line sparkline for latency.
const SparkLine = ({ values, width = 240, height = 36, tone = "accent" }) => {
  if (!values || values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(1, max - min);
  const path = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * (width - 4) + 2;
      const y = height - 2 - ((v - min) / range) * (height - 4);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} className={`spark-line spark-line--${tone}`}>
      <path d={path} className="spark-line__stroke" />
    </svg>
  );
};

const formatMs = (n) => {
  if (n == null) return "—";
  if (n < 1000) return `${Math.round(n)}ms`;
  return `${(n / 1000).toFixed(2)}s`;
};
const formatRelative = (ts) => {
  if (!ts) return "—";
  const now = Date.now();
  const diff = ts - now;
  const abs = Math.abs(diff);
  if (abs < 60_000) return diff < 0 ? "just now" : "in <1m";
  if (abs < 3600_000) {
    const m = Math.round(abs / 60_000);
    return diff < 0 ? `${m}m ago` : `in ${m}m`;
  }
  if (abs < 86_400_000) {
    const h = Math.round(abs / 3600_000);
    return diff < 0 ? `${h}h ago` : `in ${h}h`;
  }
  const d = Math.round(abs / 86_400_000);
  return diff < 0 ? `${d}d ago` : `in ${d}d`;
};
const formatTime = (ts) => {
  if (!ts) return "—";
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
};

Object.assign(window, {
  IconRefresh,
  IconClose,
  IconAlert,
  IconCheck,
  IconBolt,
  IconActivity,
  IconSearch,
  IconClock,
  IconHash,
  IconShield,
  IconChevronR,
  IconChevronD,
  IconLayers,
  IconChannel,
  IconWrench,
  IconHeart,
  IconPlay,
  IconCopy,
  IconExternal,
  IconBook,
  ScopePill,
  SinceTag,
  ConnDot,
  SparkBar,
  SparkLine,
  formatMs,
  formatRelative,
  formatTime,
});
