// Memory icons + local molecules: TierBadge, ScopeBadge, StatusDot,
// SizeChip, AgentDot, RelevanceBar, MarkdownView (in-house renderer).

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

const IconMemory = () => (
  <svg {...svgProps}>
    <rect x="4" y="6" width="16" height="12" rx="2" />
    <path d="M8 6v12M16 6v12M2 10h2M2 14h2M20 10h2M20 14h2" />
  </svg>
);
const IconFolder = () => (
  <svg {...svgProps}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
  </svg>
);
const IconFile = () => (
  <svg {...svgProps}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
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
const IconClose = () => <Icon d="M6 6l12 12M18 6L6 18" />;
const IconRefresh = () => (
  <svg {...svgProps}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);
const IconCheck = () => <Icon d="M5 12l5 5L20 7" />;
const IconAlert = () => (
  <svg {...svgProps}>
    <path d="M12 9v4M12 17h.01" />
    <path d="M10.3 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
  </svg>
);
const IconQuestion = () => (
  <svg {...svgProps}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
  </svg>
);
const IconHash = () => <Icon d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18" />;
const IconCopy = () => (
  <svg {...svgProps}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
);
const IconClock = () => (
  <svg {...svgProps}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
const IconBrain = () => (
  <svg {...svgProps}>
    <path d="M9.5 2A2.5 2.5 0 0 0 7 4.5v.5A4 4 0 0 0 4 9v.5A3.5 3.5 0 0 0 4 16v.5a3.5 3.5 0 0 0 5 3.16A3.5 3.5 0 0 0 14.5 22a3.5 3.5 0 0 0 3.5-3.5v-1.5a3.5 3.5 0 0 0 1-5.66A4 4 0 0 0 17 5v-.5A2.5 2.5 0 0 0 14.5 2h-5z" />
  </svg>
);
const IconTrash = () => (
  <svg {...svgProps}>
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1.5 14a2 2 0 0 1-2 1.85h-7a2 2 0 0 1-2-1.85L5 6" />
  </svg>
);
const IconShield = () => (
  <svg {...svgProps}>
    <path d="M12 2L4 5v7c0 5 3.5 9 8 10 4.5-1 8-5 8-10V5l-8-3z" />
  </svg>
);
const IconArrowRight = () => <Icon d="M5 12h14M13 6l6 6-6 6" />;

// -- TierBadge ------------------------------------------------------------

const TIER_STYLES = {
  core: { bg: "rgba(122, 162, 247, 0.16)", fg: "#7aa2f7", label: "core" },
  working: { bg: "rgba(158, 206, 106, 0.16)", fg: "#9ece6a", label: "working" },
  peripheral: { bg: "rgba(224, 175, 104, 0.16)", fg: "#e0af68", label: "peripheral" },
};

const TierBadge = ({ tier }) => {
  const s = TIER_STYLES[tier] || {
    bg: "var(--ds-bg-2)",
    fg: "var(--ds-text-muted)",
    label: tier || "—",
  };
  return (
    <span className="tier-badge" style={{ background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  );
};

// -- ScopeBadge -----------------------------------------------------------

const ScopeBadge = ({ scope }) => {
  if (!scope) return null;
  const isAgent = scope.startsWith("agent:");
  return (
    <span className={`scope-badge ${isAgent ? "scope-badge--agent" : "scope-badge--global"}`}>
      {isAgent ? scope.replace("agent:", "👤 ") : "🌐 global"}
    </span>
  );
};

// -- StatusDot (embedding) -----------------------------------------------

const StatusDot = ({ status }) => {
  const cls =
    status === "ok" ? "status-dot--ok" : status === "error" ? "status-dot--err" : "status-dot--unk";
  return <span className={`status-dot ${cls}`} title={status} />;
};

// -- SizeChip -------------------------------------------------------------

const formatSize = (b) => {
  if (b == null) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(2)} MB`;
};

const SizeChip = ({ bytes }) => <span className="size-chip muted small">{formatSize(bytes)}</span>;

// -- AgentDot -------------------------------------------------------------

const AgentDot = ({ agentId }) => {
  const a = AGENTS.find((a) => a.id === agentId);
  if (!a) return <span className="agent-dot agent-dot--unknown muted small">?</span>;
  return (
    <span className="agent-dot">
      <span className="agent-dot__bullet" style={{ background: a.color }} />
      <span>{a.name}</span>
    </span>
  );
};

// -- RelevanceBar ---------------------------------------------------------

const RelevanceBar = ({ value }) => {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <span className="relevance-bar" title={`${pct}% relevance`}>
      <span className="relevance-bar__track">
        <span className="relevance-bar__fill" style={{ width: `${pct}%` }} />
      </span>
      <span className="relevance-bar__label muted small">{pct}%</span>
    </span>
  );
};

// -- DecayBar -------------------------------------------------------------

const DecayBar = ({ value }) => {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const tone = pct < 20 ? "ok" : pct < 60 ? "warn" : "err";
  return (
    <span className={`decay-bar decay-bar--${tone}`} title={`${pct}% decayed`}>
      <span className="decay-bar__track">
        <span className="decay-bar__fill" style={{ width: `${pct}%` }} />
      </span>
    </span>
  );
};

// -- MarkdownView (in-house, lightweight) -------------------------------

function renderMarkdown(md) {
  const lines = md.split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({ kind: "code", lang, value: codeLines.join("\n") });
      continue;
    }

    if (line.startsWith("---")) {
      const fmLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("---")) {
        fmLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({ kind: "frontmatter", value: fmLines.join("\n") });
      continue;
    }

    if (line.startsWith("# ")) {
      blocks.push({ kind: "h1", value: line.slice(2) });
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push({ kind: "h2", value: line.slice(3) });
      i++;
      continue;
    }
    if (line.startsWith("### ")) {
      blocks.push({ kind: "h3", value: line.slice(4) });
      i++;
      continue;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      const items = [];
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
        items.push(lines[i].slice(2));
        i++;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("#") &&
      !lines[i].startsWith("```") &&
      !lines[i].startsWith("---") &&
      !lines[i].startsWith("- ") &&
      !lines[i].startsWith("* ")
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({ kind: "p", value: paraLines.join(" ") });
  }

  return blocks;
}

function renderInline(text) {
  const parts = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ kind: "text", value: text.slice(last, m.index) });
    const t = m[1];
    if (t.startsWith("`")) parts.push({ kind: "code", value: t.slice(1, -1) });
    else if (t.startsWith("**")) parts.push({ kind: "bold", value: t.slice(2, -2) });
    else if (t.startsWith("[")) {
      const linkMatch = t.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) parts.push({ kind: "link", value: linkMatch[1], href: linkMatch[2] });
    }
    last = m.index + t.length;
  }
  if (last < text.length) parts.push({ kind: "text", value: text.slice(last) });
  return parts;
}

const InlineParts = ({ text }) => {
  const parts = renderInline(text);
  return (
    <>
      {parts.map((p, i) => {
        if (p.kind === "code")
          return (
            <code key={i} className="md-code">
              {p.value}
            </code>
          );
        if (p.kind === "bold") return <strong key={i}>{p.value}</strong>;
        if (p.kind === "link")
          return (
            <a key={i} href={p.href} target="_blank" rel="noopener noreferrer">
              {p.value}
            </a>
          );
        return p.value;
      })}
    </>
  );
};

const MarkdownView = ({ source }) => {
  const blocks = React.useMemo(() => renderMarkdown(source || ""), [source]);
  return (
    <div className="markdown-view">
      {blocks.map((b, i) => {
        if (b.kind === "frontmatter")
          return (
            <pre key={i} className="md-frontmatter">
              <code>{b.value}</code>
            </pre>
          );
        if (b.kind === "h1")
          return (
            <h1 key={i} className="md-h1">
              {b.value}
            </h1>
          );
        if (b.kind === "h2")
          return (
            <h2 key={i} className="md-h2">
              {b.value}
            </h2>
          );
        if (b.kind === "h3")
          return (
            <h3 key={i} className="md-h3">
              {b.value}
            </h3>
          );
        if (b.kind === "p")
          return (
            <p key={i} className="md-p">
              <InlineParts text={b.value} />
            </p>
          );
        if (b.kind === "code")
          return (
            <pre key={i} className="md-pre">
              <code className={`md-codeblock md-codeblock--${b.lang || "txt"}`}>{b.value}</code>
            </pre>
          );
        if (b.kind === "ul")
          return (
            <ul key={i} className="md-ul">
              {b.items.map((it, j) => (
                <li key={j}>
                  <InlineParts text={it} />
                </li>
              ))}
            </ul>
          );
        return null;
      })}
    </div>
  );
};

const formatRelative = (input) => {
  if (input == null) return "—";
  const t = typeof input === "number" ? input : new Date(input).getTime();
  const diff = Date.now() - t;
  if (diff < 0) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 30 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(t).toLocaleDateString();
};

Object.assign(window, {
  IconMemory,
  IconFolder,
  IconFile,
  IconChevronR,
  IconChevronD,
  IconSearch,
  IconClose,
  IconRefresh,
  IconCheck,
  IconAlert,
  IconQuestion,
  IconHash,
  IconCopy,
  IconClock,
  IconBrain,
  IconTrash,
  IconShield,
  IconArrowRight,
  TierBadge,
  ScopeBadge,
  StatusDot,
  SizeChip,
  AgentDot,
  RelevanceBar,
  DecayBar,
  MarkdownView,
  formatSize,
  formatRelative,
});
