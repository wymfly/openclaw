// Block renderers for transcript content.
// Each block type has multiple visual states (collapsed/expanded/streaming/error).

const { useState, useMemo } = React;

// ---------------- TEXT ----------------
function TextBlock({ text, streaming, isUser }) {
  if (!text) {
    return null;
  }
  // Tiny markdown: **bold**, `code`, lists, paragraphs.
  const html = useMemo(() => renderMd(text), [text]);
  return (
    <div
      className={"md " + (isUser ? "md-user" : "")}
      dangerouslySetInnerHTML={{ __html: html }}
    ></div>
  );
}

function renderMd(t) {
  // Very small subset.
  let s = t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  s = s.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // Lists
  s = s.replace(/^(?:- |\* )(.*)$/gm, "<li>$1</li>");
  s = s.replace(/(?:<li>.*<\/li>\n?)+/g, (m) => "<ul>" + m + "</ul>");
  // Paragraphs
  s = s
    .split(/\n\n+/)
    .map((p) => (p.match(/^<(ul|pre|code|h\d)/) ? p : `<p>${p.replace(/\n/g, "<br/>")}</p>`))
    .join("");
  return s;
}

// ---------------- THINKING ----------------
function ThinkingBlock({ text, streaming, defaultExpanded = false }) {
  const [open, setOpen] = useState(defaultExpanded || streaming);
  return (
    <div className="block thinking">
      <button className="block-head" onClick={() => setOpen(!open)}>
        <I.Brain size={12} />
        <span className="block-head-label">Thinking</span>
        {streaming && (
          <span
            className="streaming-dot"
            style={{ marginLeft: 6, color: "var(--text-3)", fontSize: 11 }}
          >
            writing…
          </span>
        )}
        <span className="chev">
          {open ? <I.ChevronDown size={12} /> : <I.ChevronRight size={12} />}
        </span>
      </button>
      {open && (
        <div className="block-body thinking-body">
          {text}
          {streaming && <span className="cursor-blink"></span>}
        </div>
      )}
    </div>
  );
}

// ---------------- TOOL USE ----------------
function ToolUseCard({ block, paired, embedded }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const running = block.status === "running";
  const summary = formatToolSummary(block);

  const copy = () => {
    navigator.clipboard?.writeText(JSON.stringify(block.input, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className={
        "block tool-use" + (paired ? " is-paired-top" : "") + (embedded ? " is-embedded" : "")
      }
      data-running={running}
    >
      <button className="block-head" onClick={() => setOpen(!open)}>
        {running ? (
          <span className="spin" style={{ width: 11, height: 11, borderWidth: 1.5 }} />
        ) : (
          <I.Tool size={12} />
        )}
        <span className="block-head-label mono">{block.tool}</span>
        <span className="block-head-summary mono">{summary}</span>
        <span className="block-head-actions">
          {!running && <span className="badge badge-ok">ok</span>}
          {running && <span className="badge badge-running">running</span>}
        </span>
        <span className="chev">
          {open ? <I.ChevronDown size={12} /> : <I.ChevronRight size={12} />}
        </span>
      </button>
      {open && (
        <div className="block-body">
          <div className="param-grid">
            {Object.entries(block.input || {}).map(([k, v]) => (
              <React.Fragment key={k}>
                <div className="param-key mono">{k}</div>
                <div className="param-val mono">
                  {typeof v === "string" ? v : JSON.stringify(v)}
                </div>
              </React.Fragment>
            ))}
          </div>
          <div className="block-toolbar">
            <button
              className="btn-ghost"
              onClick={(e) => {
                e.stopPropagation();
                copy();
              }}
            >
              {copied ? (
                <>
                  <I.Check size={11} /> Copied
                </>
              ) : (
                <>
                  <I.Copy size={11} /> Copy JSON
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatToolSummary(block) {
  const inp = block.input || {};
  if (inp.command) {
    return inp.command.length > 80 ? inp.command.slice(0, 80) + "…" : inp.command;
  }
  if (inp.path) {
    return inp.path;
  }
  return JSON.stringify(inp).slice(0, 80);
}

// ---------------- TOOL RESULT ----------------
function ToolResultCard({ block, paired }) {
  const [showRaw, setShowRaw] = useState(false);
  const [view, setView] = useState(block.viewType || "raw");
  const isError = block.isError;

  return (
    <div
      className={
        "block tool-result" + (paired ? " is-paired-bot" : "") + (isError ? " is-error" : "")
      }
    >
      <div className="block-head static">
        <I.Terminal size={12} />
        <span className="block-head-label">{isError ? "Tool error" : "Tool result"}</span>
        <span className="result-tabs" role="tablist">
          {["raw", "bash", "read", "diff"].map((v) => {
            const has =
              v === "raw" ||
              (v === "bash" && block.bash) ||
              (v === "read" && block.read) ||
              (v === "diff" && block.diff);
            const enabled = has;
            const active = view === v && !showRaw;
            return (
              <button
                key={v}
                disabled={!enabled}
                onClick={() => {
                  setView(v);
                  setShowRaw(false);
                }}
                className={"tab" + (active ? " active" : "")}
                aria-selected={active}
              >
                {v}
              </button>
            );
          })}
        </span>
        <span className="block-head-actions">
          <button className="btn-ghost" onClick={() => setShowRaw(!showRaw)}>
            <I.Eye size={11} /> {showRaw ? "Rich" : "Raw"}
          </button>
        </span>
      </div>
      <div className="block-body no-pad">
        {showRaw ? (
          <RawView block={block} />
        ) : view === "bash" && block.bash ? (
          <BashView b={block.bash} />
        ) : view === "read" && block.read ? (
          block.read.error ? (
            <ReadError r={block.read} />
          ) : (
            <ReadView r={block.read} />
          )
        ) : view === "diff" && block.diff ? (
          <DiffView d={block.diff} />
        ) : block.image ? (
          <ImageResultView img={block.image} />
        ) : (
          <RawView block={block} />
        )}
      </div>
    </div>
  );
}

function BashView({ b }) {
  const ok = b.exit === 0;
  return (
    <div className="bash">
      <div className="bash-meta">
        <span className={"badge " + (ok ? "badge-ok" : "badge-err")}>exit {b.exit}</span>
        {b.stderr && <span className="badge badge-warn">stderr</span>}
      </div>
      {b.stdout && (
        <pre className="bash-stream stdout">
          <span className="stream-label">stdout</span>
          {b.stdout}
        </pre>
      )}
      {b.stderr && (
        <pre className="bash-stream stderr">
          <span className="stream-label">stderr</span>
          {b.stderr}
        </pre>
      )}
    </div>
  );
}

function ReadView({ r }) {
  return (
    <div className="read">
      <div className="read-bar mono">
        <I.File size={11} /> {r.path}
      </div>
      <pre className="read-code">
        {r.lines.map((l, i) => (
          <div key={i} className="code-line">
            <span className="ln">{i + 1}</span>
            <code>{l || " "}</code>
          </div>
        ))}
      </pre>
    </div>
  );
}

function ReadError({ r }) {
  return (
    <div className="read err">
      <div className="read-bar err mono">
        <I.File size={11} /> {r.path}
      </div>
      <div className="err-msg mono">! {r.error}</div>
    </div>
  );
}

function DiffView({ d }) {
  return (
    <div className="diff">
      <div className="diff-bar mono">
        <I.Diff size={11} /> {d.path}
        <span className="diff-stat add">+{d.added}</span>
        <span className="diff-stat del">−{d.removed}</span>
      </div>
      <pre className="diff-body">
        {d.hunks.map((h, i) => (
          <div key={i} className={"diff-line " + h.kind}>
            <span className="sym">{h.kind === "add" ? "+" : h.kind === "del" ? "−" : " "}</span>
            <code>{h.line || " "}</code>
          </div>
        ))}
      </pre>
    </div>
  );
}

function ImageResultView({ img }) {
  return (
    <div className="img-result">
      <div className="img-bar mono">
        <I.Image size={11} /> {img.path} · {img.w}×{img.h}
      </div>
      <div className="img-stub" style={{ aspectRatio: `${img.w}/${img.h}` }}>
        <span className="mono small">[ image preview ]</span>
      </div>
    </div>
  );
}

function RawView({ block }) {
  const text = JSON.stringify(block, null, 2);
  return <pre className="raw-pre">{text}</pre>;
}

// ---------------- IMAGE / FILE / CANVAS / UNKNOWN ----------------
function FileBlock({ name, size }) {
  return (
    <div className="block file-block">
      <I.File size={14} />
      <span className="file-name mono">{name}</span>
      <span className="file-size">{size}</span>
      <button className="btn-ghost">
        <I.Download size={11} /> Download
      </button>
    </div>
  );
}

function CanvasInline({ title }) {
  return (
    <div className="block canvas-inline">
      <div className="canvas-inline-bar">
        <I.Canvas size={12} /> {title}
        <span className="grow" />
        <button className="btn-ghost">
          Open in panel <I.ChevronRight size={11} />
        </button>
      </div>
      <div className="canvas-inline-stub">
        <span className="mono small">[ inline canvas iframe ]</span>
      </div>
    </div>
  );
}

function UnknownBlock({ raw }) {
  return (
    <div className="block unknown-block">
      <I.Hash size={12} />
      <span className="mono">unknown block: {raw}</span>
    </div>
  );
}

// ---------------- PAIRED ----------------
function ToolPair({ use, result }) {
  const isError = result?.isError;
  return (
    <div className={"tool-pair" + (isError ? " is-error" : "")}>
      <ToolUseCard block={use} paired />
      <ToolResultCard block={result} paired />
    </div>
  );
}

Object.assign(window, {
  TextBlock,
  ThinkingBlock,
  ToolUseCard,
  ToolResultCard,
  FileBlock,
  CanvasInline,
  UnknownBlock,
  ToolPair,
});
