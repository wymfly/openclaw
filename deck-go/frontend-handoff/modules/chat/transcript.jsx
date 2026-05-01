// Transcript view — top bands, messages, RunStatusBar, etc.
const { useState: useStateT } = React;

function SSEBanner({ status }) {
  if (status === "connected") {
    return null;
  }
  const txt = status === "reconnecting" ? "Reconnecting to gateway…" : "Disconnected from gateway";
  return (
    <div className={"sse-banner " + status}>
      <I.WifiOff size={12} /> {txt}
      {status === "reconnecting" && (
        <span className="dot streaming-dot" style={{ background: "currentColor", marginLeft: 8 }} />
      )}
      <span className="grow" />
      {status === "disconnected" && (
        <button className="btn-ghost">
          <I.Refresh size={11} /> Retry
        </button>
      )}
    </div>
  );
}

function ChatContextBar({ tweaks }) {
  const pct = tweaks.contextPct;
  const tone = pct >= 95 ? "error" : pct >= 80 ? "warn" : "ok";
  return (
    <div className="context-bar">
      <div className="ctx-cell">
        <span className="ctx-key">Model</span>
        <span className="ctx-val mono">{tweaks.model || "claude-sonnet-4.6"}</span>
      </div>
      <div className="ctx-cell ctx-bar-cell">
        <span className="ctx-key">Context</span>
        <div className={"ctx-bar tone-" + tone}>
          <div className="ctx-fill" style={{ width: pct + "%" }} />
        </div>
        <span className="ctx-val mono">{pct}%</span>
      </div>
      <div className="ctx-cell">
        <span className="ctx-key">Compactions</span>
        <span className="ctx-val mono">2</span>
      </div>
      <div className="ctx-cell">
        <span className="ctx-key">Reasoning</span>
        <span className="ctx-val mono">{tweaks.reasoning || "high"}</span>
      </div>
      {tweaks.fastMode && (
        <span className="chip chip-warn">
          <I.Zap size={10} /> fast
        </span>
      )}
      <span className="ctx-cell">
        <span className="ctx-key">Send</span>
        <span className="ctx-val mono">confirm</span>
      </span>
      <span className="grow" />
      <button className="btn-ghost">
        <I.Search size={11} /> <span className="kbd">⌘F</span>
      </button>
    </div>
  );
}

function TranscriptSearch({ open, onClose }) {
  const [q, setQ] = useStateT("kafka");
  if (!open) {
    return null;
  }
  const matches = q ? 7 : 0;
  return (
    <div className="t-search">
      <I.Search size={12} />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Find in transcript"
        autoFocus
      />
      <span className="t-search-count mono">{matches ? "1 / " + matches : "no matches"}</span>
      <button className="x-btn">
        <I.ChevronDown size={11} style={{ transform: "rotate(180deg)" }} />
      </button>
      <button className="x-btn">
        <I.ChevronDown size={11} />
      </button>
      <button className="x-btn" onClick={onClose}>
        <I.X size={11} />
      </button>
    </div>
  );
}

function BlockFilterBar({ prefs, setPrefs }) {
  const toggle = (k) => setPrefs({ ...prefs, [k]: !prefs[k] });
  return (
    <div className="block-filter-bar">
      <span className="bfb-label mono small">
        <I.Filter size={10} /> show
      </span>
      {[
        ["thinking", "thinking"],
        ["toolUse", "tool calls"],
        ["toolResult", "results"],
      ].map(([k, label]) => (
        <button
          key={k}
          className={"chip-toggle " + (prefs[k] ? "on" : "off")}
          onClick={() => toggle(k)}
        >
          {prefs[k] ? <I.Check size={10} /> : <I.X size={10} />} {label}
        </button>
      ))}
    </div>
  );
}

function ToolProgressBar({ running }) {
  if (!running.length) {
    return null;
  }
  return (
    <div className="tool-progress-bar">
      {running.map((t, i) => (
        <div key={i} className="tpb-item">
          <span className="spin" style={{ width: 9, height: 9, borderWidth: 1.2 }} />
          <span className="mono small">{t.tool}</span>
          <span className="tpb-summary mono small">{t.summary}</span>
        </div>
      ))}
    </div>
  );
}

function RunStatusBar({ meta, streaming }) {
  if (!meta) {
    return null;
  }
  const fmtMs = (ms) => (ms < 1000 ? ms + "ms" : (ms / 1000).toFixed(1) + "s");
  return (
    <div className="run-status-bar mono small">
      <span>
        <I.Sparkle size={10} /> {meta.model}
      </span>
      <span className="dot-sep">·</span>
      <span title="input / output">
        <I.Hash size={10} /> {meta.inTok.toLocaleString()} in / {meta.outTok.toLocaleString()} out
      </span>
      <span className="dot-sep">·</span>
      <span title="cache hit ratio">cache {Math.round(meta.cacheHit * 100)}%</span>
      <span className="dot-sep">·</span>
      <span>
        <I.Coin size={10} /> ${meta.cost.toFixed(3)}
      </span>
      <span className="dot-sep">·</span>
      <span>
        <I.Clock size={10} /> {fmtMs(meta.durationMs)}
      </span>
      {streaming && (
        <>
          <span className="dot-sep">·</span>
          <span className="streaming-dot" style={{ color: "var(--accent)" }}>
            streaming…
          </span>
        </>
      )}
    </div>
  );
}

function MessageActions() {
  const [copied, setCopied] = useStateT(false);
  return (
    <div className="message-actions">
      <button
        className="btn-ghost"
        onClick={() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
      >
        {copied ? (
          <>
            <I.Check size={11} /> Copied
          </>
        ) : (
          <>
            <I.Copy size={11} /> Copy
          </>
        )}
      </button>
      <button className="btn-ghost">
        <I.Refresh size={11} /> Retry
      </button>
      <button className="btn-ghost">👍</button>
      <button className="btn-ghost">👎</button>
    </div>
  );
}

function CompactionNotice({ before, after }) {
  return (
    <div className="compaction-notice">
      <I.Layers size={11} />
      <span className="mono small">
        Compacted {before.toLocaleString()} → {after.toLocaleString()} tokens
      </span>
      <button className="btn-ghost small">view summary</button>
    </div>
  );
}

function SubagentTree({ tree }) {
  return (
    <div className="subagent-tree">
      <div className="sat-head">
        <I.Branch size={11} /> Subagent lineage
      </div>
      <SubagentNode node={tree} depth={0} />
    </div>
  );
}
function SubagentNode({ node, depth }) {
  return (
    <div className="sat-node" style={{ paddingLeft: depth * 14 }}>
      <span className={"sat-dot " + node.status} />
      <span className="mono">{node.name}</span>
      <span className="sat-status mono small">{node.status}</span>
      {node.children?.map((c, i) => (
        <SubagentNode key={i} node={c} depth={depth + 1} />
      ))}
    </div>
  );
}

// ----- Message bubble -----
function MessageBubble({ m, alignment, prefs, toolStyle }) {
  const isUser = m.role === "user";
  const isCompact = m.role === "system-compact";

  if (isCompact) {
    return <CompactionNotice before={12840} after={3210} />;
  }

  // Resolve paired tool_use+tool_result
  const items = [];
  for (let i = 0; i < m.blocks.length; i++) {
    const b = m.blocks[i];
    const next = m.blocks[i + 1];
    if (b.type === "tool_use" && next && next.type === "tool_result") {
      if (toolStyle === "paired") {
        items.push({ type: "tool_pair", use: b, result: next });
      } else {
        items.push(b);
        items.push(next);
      }
      i++;
    } else {
      items.push(b);
    }
  }

  return (
    <div className={"msg-row align-" + alignment + (isUser ? " is-user" : " is-assistant")}>
      <div className="msg-avatar">{isUser ? <I.User size={14} /> : <I.Bot size={14} />}</div>
      <div className="msg-body">
        <div className="msg-meta-line mono small">
          <span>{isUser ? "you" : "main"}</span>
          <span className="dot-sep">·</span>
          <span>{m.time}</span>
          {m.streaming && (
            <>
              <span className="dot-sep">·</span>
              <span className="streaming-dot" style={{ color: "var(--accent)" }}>
                streaming
              </span>
            </>
          )}
        </div>
        <div className="msg-blocks">
          {items.map((b, i) => renderBlock(b, i, prefs, m.streaming))}
        </div>
        {!isUser && <RunStatusBar meta={m.meta} streaming={m.streaming} />}
        {!isUser && !m.streaming && <MessageActions />}
      </div>
    </div>
  );
}

function renderBlock(b, i, prefs, msgStreaming) {
  switch (b.type) {
    case "text":
      return (
        <TextBlock key={i} text={b.text} streaming={msgStreaming && i === 99} isUser={false} />
      );
    case "thinking":
      if (!prefs.thinking) {
        return null;
      }
      return (
        <ThinkingBlock key={i} text={b.text} streaming={b.streaming} defaultExpanded={b.expanded} />
      );
    case "tool_use":
      if (!prefs.toolUse) {
        return null;
      }
      return <ToolUseCard key={i} block={b} />;
    case "tool_result":
      if (!prefs.toolResult) {
        return null;
      }
      return <ToolResultCard key={i} block={b} />;
    case "tool_pair":
      return <ToolPair key={i} use={b.use} result={b.result} />;
    case "file":
      return <FileBlock key={i} name={b.name} size={b.size} />;
    case "image":
      return <FileBlock key={i} name={b.name || "image"} size={b.size || ""} />;
    case "canvas_inline":
      return <CanvasInline key={i} title={b.title} />;
    case "unknown":
      return <UnknownBlock key={i} raw={b.raw} />;
    default:
      return null;
  }
}

function WaitingPlaceholder() {
  return (
    <div className="msg-row align-left is-assistant waiting">
      <div className="msg-avatar">
        <I.Bot size={14} />
      </div>
      <div className="msg-body">
        <div className="waiting-dots">
          <span />
          <span />
          <span />
        </div>
        <span className="mono small" style={{ color: "var(--text-3)" }}>
          thinking…
        </span>
      </div>
    </div>
  );
}

Object.assign(window, {
  SSEBanner,
  ChatContextBar,
  TranscriptSearch,
  BlockFilterBar,
  ToolProgressBar,
  RunStatusBar,
  MessageActions,
  CompactionNotice,
  SubagentTree,
  MessageBubble,
  WaitingPlaceholder,
});
