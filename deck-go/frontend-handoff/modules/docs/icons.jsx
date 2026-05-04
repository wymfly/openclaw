// Docs icons + local molecules: TagChip, MarkdownView (lightweight in-house
// renderer; production: react-markdown). Markdown grammar covered: headings,
// paragraphs, code blocks (```), inline code, bold, lists, tables, links.

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

const IconBook = () => (
  <svg {...svgProps}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);
const IconSearch = () => (
  <svg {...svgProps}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.5-4.5" />
  </svg>
);
const IconClose = () => <Icon d="M6 6l12 12M18 6L6 18" />;
const IconChevronR = () => <Icon d="M9 6l6 6-6 6" />;
const IconChevronD = () => <Icon d="M6 9l6 6 6-6" />;
const IconLink = () => (
  <svg {...svgProps}>
    <path d="M10 14a5 5 0 0 1 0-7l3-3a5 5 0 1 1 7 7l-1.5 1.5" />
    <path d="M14 10a5 5 0 0 1 0 7l-3 3a5 5 0 1 1-7-7l1.5-1.5" />
  </svg>
);
const IconTag = () => (
  <Icon d="M20.6 13.4L13.4 20.6a2 2 0 0 1-2.8 0l-7.4-7.4a2 2 0 0 1-.6-1.4V4a1 1 0 0 1 1-1h7.8a2 2 0 0 1 1.4.6l7.4 7.4a2 2 0 0 1 0 2.8z" />
);
const IconClock = () => (
  <svg {...svgProps}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
const IconCopy = () => (
  <svg {...svgProps}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
);
const IconHash = () => <Icon d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18" />;
const IconArrowRight = () => <Icon d="M5 12h14M13 6l6 6-6 6" />;

// -- TagChip --------------------------------------------------------------

const TagChip = ({ tag, active, onClick }) => (
  <button type="button" className={`tag-chip ${active ? "tag-chip--on" : ""}`} onClick={onClick}>
    <IconTag />
    <code>{tag}</code>
  </button>
);

// -- MarkdownView (in-house lightweight renderer) ------------------------

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

    if (/^\d+\.\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }

    if (line.startsWith("|") && i + 1 < lines.length && lines[i + 1].includes("---")) {
      const headerCells = line
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        rows.push(
          lines[i]
            .split("|")
            .slice(1, -1)
            .map((c) => c.trim()),
        );
        i++;
      }
      blocks.push({ kind: "table", headers: headerCells, rows });
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
      !lines[i].startsWith("- ") &&
      !lines[i].startsWith("* ") &&
      !/^\d+\.\s/.test(lines[i]) &&
      !lines[i].startsWith("|")
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
  const blocks = React.useMemo(() => renderMarkdown(source), [source]);
  return (
    <div className="markdown-view">
      {blocks.map((b, i) => {
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
        if (b.kind === "ol")
          return (
            <ol key={i} className="md-ol">
              {b.items.map((it, j) => (
                <li key={j}>
                  <InlineParts text={it} />
                </li>
              ))}
            </ol>
          );
        if (b.kind === "table") {
          return (
            <table key={i} className="md-table">
              <thead>
                <tr>
                  {b.headers.map((h, j) => (
                    <th key={j}>
                      <InlineParts text={h} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((r, j) => (
                  <tr key={j}>
                    {r.map((c, k) => (
                      <td key={k}>
                        <InlineParts text={c} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          );
        }
        return null;
      })}
    </div>
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
  if (diff < 30 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString();
}

Object.assign(window, {
  IconBook,
  IconSearch,
  IconClose,
  IconChevronR,
  IconChevronD,
  IconLink,
  IconTag,
  IconClock,
  IconCopy,
  IconHash,
  IconArrowRight,
  TagChip,
  MarkdownView,
  formatRelative,
});
