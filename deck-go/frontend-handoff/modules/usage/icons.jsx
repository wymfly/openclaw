// icons.jsx — usage panel SVG icons + per-provider/agent chips + chart primitives
//
// Chart-lib stack decision (PROTOTYPE-ONLY):
//   This prototype renders all charts via hand-rolled SVG (no recharts / d3 /
//   visx / chart.js). PRODUCTION SHOULD LOCK recharts in stack-decisions.md
//   and use it for: cost-trend area, daily-aggregate bars, session-timeseries
//   stacked area, model-distribution pie/bar. Hand-rolled SVG is fine for
//   24-panel reflowback validation but is not extensible (no axis labels,
//   no tooltips, no responsive container, no legend interaction).

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
const IconCoin = () =>
  I(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9 9h4.5a1.5 1.5 0 0 1 0 3H9m0 0h4.5a1.5 1.5 0 0 1 0 3H9" />
    </>,
  );
const IconArrowDown = () =>
  I(
    <>
      <path d="M12 5v14" />
      <polyline points="19 12 12 19 5 12" />
    </>,
  );
const IconArrowUp = () =>
  I(
    <>
      <path d="M12 19V5" />
      <polyline points="5 12 12 5 19 12" />
    </>,
  );
const IconSigma = () =>
  I(
    <>
      <polyline points="18 5 6 5 14 12 6 19 18 19" />
    </>,
  );
const IconUser = () =>
  I(
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M3 21c0-4 4-7 9-7s9 3 9 7" />
    </>,
  );
const IconUsers = () =>
  I(
    <>
      <circle cx="9" cy="8" r="4" />
      <path d="M3 20c0-3 3-6 6-6s6 3 6 6" />
      <path d="M16 14c2.4 0 5 2 5 6" />
      <circle cx="17" cy="8" r="3" />
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
const IconClock = () =>
  I(
    <>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 16 14" />
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
const IconChart = () =>
  I(
    <>
      <line x1="3" y1="20" x2="21" y2="20" />
      <polyline points="5 16 9 11 13 14 19 7" />
    </>,
  );
const IconBars = () =>
  I(
    <>
      <rect x="3" y="13" width="3" height="8" />
      <rect x="9" y="9" width="3" height="12" />
      <rect x="15" y="5" width="3" height="16" />
    </>,
  );
const IconLayer = () =>
  I(
    <>
      <polygon points="12 2 22 7 12 12 2 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </>,
  );
const IconChevronDown = () =>
  I(
    <>
      <polyline points="6 9 12 15 18 9" />
    </>,
  );
const IconChevronRight = () =>
  I(
    <>
      <polyline points="9 18 15 12 9 6" />
    </>,
  );
const IconSearch = () =>
  I(
    <>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
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
const IconShield = () =>
  I(
    <>
      <path d="M12 2l9 4v6c0 5-4 9-9 10-5-1-9-5-9-10V6l9-4z" />
    </>,
  );
const IconBrain = () =>
  I(
    <>
      <path d="M9 4a3 3 0 0 0-3 3v0a3 3 0 0 0-3 3v2a3 3 0 0 0 1.5 2.6V17a3 3 0 0 0 3 3 3 3 0 0 0 3-3v0M15 4a3 3 0 0 1 3 3v0a3 3 0 0 1 3 3v2a3 3 0 0 1-1.5 2.6V17a3 3 0 0 1-3 3 3 3 0 0 1-3-3" />
    </>,
  );
const IconWrench = () =>
  I(
    <>
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-2.4 2.6-2.6z" />
    </>,
  );
const IconWindow = () =>
  I(
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </>,
  );

// PROVIDER icons
const IconAnthropic = () =>
  I(
    <>
      <path d="M5 19l5-14h2l5 14M8 14h6" />
    </>,
  );
const IconOpenAI = () =>
  I(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9h6v6H9z" />
    </>,
  );
const IconGoogle = () =>
  I(
    <>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 12h-9" />
    </>,
  );
const IconLocal = () =>
  I(
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 18v3M17 18v3M9 12l2 2 4-4" />
    </>,
  );

const PROVIDER_ICON = {
  anthropic: IconAnthropic,
  openai: IconOpenAI,
  google: IconGoogle,
  local: IconLocal,
};

const ProviderIcon = ({ provider, size }) => {
  const Cmp = PROVIDER_ICON[provider] || IconShield;
  return <Cmp size={size} />;
};

const ProviderPill = ({ provider, label }) => (
  <span className={`provider-pill provider-pill--${provider || "unknown"}`}>
    <ProviderIcon provider={provider} size={11} />
    <span>{label || provider || "—"}</span>
  </span>
);

// AGENT chip — color-coded by id prefix.
const AgentChip = ({ agentId, label }) => {
  if (!agentId) return <span className="agent-chip agent-chip--unknown">—</span>;
  return (
    <span className={`agent-chip agent-chip--${agentId === "system" ? "system" : "operator"}`}>
      <IconUser size={11} />
      <span>{label || agentId}</span>
    </span>
  );
};

// CHANNEL chip — terse mono badge.
const ChannelChip = ({ channel, label }) => (
  <span className={`channel-chip channel-chip--${channel || "unknown"}`}>
    {label || channel || "—"}
  </span>
);

// Status pill for provider quota windows.
const QuotaPill = ({ percent }) => {
  const tone = percent >= 90 ? "error" : percent >= 60 ? "warn" : "ok";
  const label = percent >= 90 ? "HOT" : percent >= 60 ? "WARM" : "OK";
  return (
    <span className={`quota-pill quota-pill--${tone}`}>
      {label} {percent}%
    </span>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// CHART PRIMITIVES
// All hand-rolled SVG. Production should swap to recharts.
// ────────────────────────────────────────────────────────────────────────────

// AreaTrend — single-series filled area chart.
// Used by: cost trend (large) + provider rail mini.
const AreaTrend = ({
  points,
  width = 720,
  height = 200,
  padX = 12,
  padY = 16,
  tone = "accent",
  labelFmt,
}) => {
  if (!points || points.length < 2) {
    return <div className="chart-empty">No data.</div>;
  }
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMax = Math.max(...ys, 1);
  const xScale = (x) => padX + ((x - xMin) / Math.max(1, xMax - xMin)) * (width - 2 * padX);
  const yScale = (y) => height - padY - (y / yMax) * (height - 2 * padY);
  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.x).toFixed(1)} ${yScale(p.y).toFixed(1)}`)
    .join(" ");
  const areaPath =
    `M ${xScale(points[0].x).toFixed(1)} ${(height - padY).toFixed(1)} ` +
    points.map((p) => `L ${xScale(p.x).toFixed(1)} ${yScale(p.y).toFixed(1)}`).join(" ") +
    ` L ${xScale(points[points.length - 1].x).toFixed(1)} ${(height - padY).toFixed(1)} Z`;
  // 4 horizontal grid lines.
  const grid = [0, 0.25, 0.5, 0.75, 1].map((t, i) => (
    <line
      key={i}
      x1={padX}
      x2={width - padX}
      y1={padY + t * (height - 2 * padY)}
      y2={padY + t * (height - 2 * padY)}
      className="chart-grid"
    />
  ));
  // x-axis ticks (4 evenly spaced).
  const tickCount = Math.min(7, points.length);
  const tickStep = Math.max(1, Math.floor(points.length / (tickCount - 1)) || 1);
  const ticks = [];
  for (let i = 0; i < points.length; i += tickStep) ticks.push(points[i]);
  if (ticks[ticks.length - 1] !== points[points.length - 1]) ticks.push(points[points.length - 1]);
  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      className={`area-trend area-trend--${tone}`}
      preserveAspectRatio="none"
    >
      {grid}
      <path d={areaPath} className="area-trend__fill" />
      <path d={linePath} className="area-trend__stroke" />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={xScale(p.x).toFixed(1)}
          cy={yScale(p.y).toFixed(1)}
          r="2.6"
          className="area-trend__dot"
        >
          <title>{labelFmt ? labelFmt(p) : `${p.x}: ${p.y}`}</title>
        </circle>
      ))}
      {ticks.map((p, i) => (
        <text key={`t${i}`} x={xScale(p.x).toFixed(1)} y={height - 2} className="chart-tick">
          {p.label || ""}
        </text>
      ))}
    </svg>
  );
};

// LineSpark — small inline sparkline for table rows.
const LineSpark = ({ values, width = 88, height = 28, tone = "accent" }) => {
  if (!values || values.length < 2) return <span className="spark-empty">—</span>;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(1, max - min);
  const path = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} className={`line-spark line-spark--${tone}`}>
      <path d={path} className="line-spark__stroke" />
    </svg>
  );
};

// BarMini — daily aggregate bar list.
const BarMini = ({ entries, width = 360, height = 80, tone = "accent" }) => {
  if (!entries || entries.length === 0) return <div className="chart-empty">No data.</div>;
  const max = Math.max(...entries.map((e) => e.value), 1);
  const barWidth = (width - 16) / entries.length - 4;
  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      className={`bar-mini bar-mini--${tone}`}
      preserveAspectRatio="none"
    >
      {entries.map((e, i) => {
        const h = (e.value / max) * (height - 18);
        const x = 8 + i * ((width - 16) / entries.length);
        const y = height - h - 14;
        return (
          <g key={i}>
            <rect
              x={x.toFixed(1)}
              y={y.toFixed(1)}
              width={barWidth.toFixed(1)}
              height={h.toFixed(1)}
              className="bar-mini__bar"
            >
              <title>
                {e.label}: {e.value}
              </title>
            </rect>
            {i % 2 === 0 ? (
              <text x={x.toFixed(1)} y={height - 2} className="chart-tick">
                {e.shortLabel || e.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
};

// QuotaBar — horizontal progress bar with reset countdown.
const QuotaBar = ({ percent, label, resetAt }) => {
  const tone = percent >= 90 ? "error" : percent >= 60 ? "warn" : "ok";
  return (
    <div className="quota-bar">
      <div className="quota-bar__head">
        <span className="quota-bar__label">{label}</span>
        <QuotaPill percent={percent} />
      </div>
      <div className={`quota-bar__track quota-bar__track--${tone}`}>
        <div className="quota-bar__fill" style={{ width: `${Math.min(100, percent)}%` }} />
      </div>
      <div className="quota-bar__foot">
        {resetAt ? `resets ${formatRelative(resetAt)}` : "no reset window known"}
      </div>
    </div>
  );
};

// StackedAreaTimeseries — per-session input/output/cache token stack.
const StackedAreaTimeseries = ({ points, width = 640, height = 200, padX = 16, padY = 18 }) => {
  if (!points || points.length < 2) return <div className="chart-empty">No timeseries.</div>;
  const xs = points.map((p) => p.timestamp);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const stacks = points.map((p) => ({
    t: p.timestamp,
    a: p.input || 0,
    b: (p.input || 0) + (p.output || 0),
    c: (p.input || 0) + (p.output || 0) + (p.cacheRead || 0),
  }));
  const yMax = Math.max(...stacks.map((s) => s.c), 1);
  const xScale = (x) => padX + ((x - xMin) / Math.max(1, xMax - xMin)) * (width - 2 * padX);
  const yScale = (y) => height - padY - (y / yMax) * (height - 2 * padY);
  const layer = (key) => {
    const top = stacks
      .map(
        (s, i) => `${i === 0 ? "M" : "L"} ${xScale(s.t).toFixed(1)} ${yScale(s[key]).toFixed(1)}`,
      )
      .join(" ");
    const bottom = stacks
      .slice()
      .reverse()
      .map((s) => {
        const prev = key === "a" ? 0 : key === "b" ? s.a : s.b;
        return `L ${xScale(s.t).toFixed(1)} ${yScale(prev).toFixed(1)}`;
      })
      .join(" ");
    return `${top} ${bottom} Z`;
  };
  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      className="stacked-area"
      preserveAspectRatio="none"
    >
      <path d={layer("c")} className="stacked-area__layer stacked-area__layer--cache" />
      <path d={layer("b")} className="stacked-area__layer stacked-area__layer--output" />
      <path d={layer("a")} className="stacked-area__layer stacked-area__layer--input" />
    </svg>
  );
};

// ContextWeightBar — proportional bar showing system/skills/tools/files context split.
const ContextWeightBar = ({ report }) => {
  if (!report) return <div className="ctx-empty">No context-weight report.</div>;
  const sys = report.systemPrompt?.chars || 0;
  const skills = report.skills?.promptChars || 0;
  const tools = (report.tools?.listChars || 0) + (report.tools?.schemaChars || 0);
  const files = (report.injectedWorkspaceFiles || []).reduce(
    (sum, f) => sum + (f.injectedChars || 0),
    0,
  );
  const total = sys + skills + tools + files;
  if (!total) return <div className="ctx-empty">Empty report.</div>;
  const pct = (n) => ((n / total) * 100).toFixed(1);
  return (
    <div className="ctx-bar">
      <div
        className="ctx-bar__track"
        role="img"
        aria-label={`Context split: system ${pct(sys)}% skills ${pct(skills)}% tools ${pct(tools)}% files ${pct(files)}%`}
      >
        <span className="ctx-bar__seg ctx-bar__seg--system" style={{ width: `${pct(sys)}%` }} />
        <span className="ctx-bar__seg ctx-bar__seg--skills" style={{ width: `${pct(skills)}%` }} />
        <span className="ctx-bar__seg ctx-bar__seg--tools" style={{ width: `${pct(tools)}%` }} />
        <span className="ctx-bar__seg ctx-bar__seg--files" style={{ width: `${pct(files)}%` }} />
      </div>
      <ul className="ctx-bar__legend">
        <li>
          <span className="ctx-bar__sw ctx-bar__sw--system" /> system <strong>{pct(sys)}%</strong>
        </li>
        <li>
          <span className="ctx-bar__sw ctx-bar__sw--skills" /> skills{" "}
          <strong>{pct(skills)}%</strong>
        </li>
        <li>
          <span className="ctx-bar__sw ctx-bar__sw--tools" /> tools <strong>{pct(tools)}%</strong>
        </li>
        <li>
          <span className="ctx-bar__sw ctx-bar__sw--files" /> files <strong>{pct(files)}%</strong>
        </li>
      </ul>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Formatters
// ────────────────────────────────────────────────────────────────────────────
const formatCost = (cost) => {
  if (cost == null) return "—";
  if (cost === 0) return "$0";
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
};
const formatTokens = (n) => {
  if (n == null) return "—";
  if (n === 0) return "0";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return n.toLocaleString();
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
const formatDateShort = (date) => {
  if (!date) return "—";
  // YYYY-MM-DD → MM-DD
  return date.slice(5);
};

Object.assign(window, {
  IconRefresh,
  IconClose,
  IconAlert,
  IconCheck,
  IconCoin,
  IconArrowDown,
  IconArrowUp,
  IconSigma,
  IconUser,
  IconUsers,
  IconHash,
  IconClock,
  IconBolt,
  IconActivity,
  IconChart,
  IconBars,
  IconLayer,
  IconChevronDown,
  IconChevronRight,
  IconSearch,
  IconExternal,
  IconShield,
  IconBrain,
  IconWrench,
  IconWindow,
  ProviderIcon,
  ProviderPill,
  AgentChip,
  ChannelChip,
  QuotaPill,
  AreaTrend,
  LineSpark,
  BarMini,
  QuotaBar,
  StackedAreaTimeseries,
  ContextWeightBar,
  formatCost,
  formatTokens,
  formatRelative,
  formatTime,
  formatDateShort,
});
