// Composer — textarea, slash palette, mention popover, file attach, approval dialog.
const { useState: useStateC, useRef: useRefC, useEffect: useEffectC } = React;

function Composer({ tweaks, onSend }) {
  const [text, setText] = useStateC("");
  const [files, setFiles] = useStateC(
    tweaks.demoAttach ? [{ name: "logs.txt", size: "12 KB" }] : [],
  );
  const [showSlash, setShowSlash] = useStateC(false);
  const [slashFilter, setSlashFilter] = useStateC("");
  const [slashMode, setSlashMode] = useStateC("filter"); // filter | argOptions | tag
  const [activeTag, setActiveTag] = useStateC(null);
  const [showMention, setShowMention] = useStateC(false);
  const [showTemplate, setShowTemplate] = useStateC(false);
  const [showApproval, setShowApproval] = useStateC(tweaks.showApproval);
  const [approvalCountdown, setApprovalCountdown] = useStateC(83);
  const [dragOver, setDragOver] = useStateC(false);
  const taRef = useRefC(null);

  useEffectC(() => {
    setShowApproval(tweaks.showApproval);
  }, [tweaks.showApproval]);

  useEffectC(() => {
    if (!showApproval) {
      return;
    }
    const t = setInterval(() => setApprovalCountdown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [showApproval]);

  const onChange = (v) => {
    setText(v);
    if (v.startsWith("/")) {
      setShowSlash(true);
      setSlashFilter(v.slice(1));
      setSlashMode("filter");
    } else {
      setShowSlash(false);
    }
    if (v.includes("@")) {
      setShowMention(true);
    } else {
      setShowMention(false);
    }
  };

  const insertCmdTag = (cmd) => {
    setActiveTag(cmd);
    setText("");
    setShowSlash(false);
    taRef.current?.focus();
  };

  const isStreaming = tweaks.streamingState === "streaming";
  const sendDisabled = (!text && files.length === 0 && !activeTag) || isStreaming;
  const ghostHint =
    showSlash && slashFilter && slashFilter.length > 0 ? findGhostHint(slashFilter) : null;

  return (
    <div className={"composer-frame" + (dragOver ? " drag-over" : "")}>
      {showApproval && (
        <ApprovalDialog
          tool="shell_command"
          command="rm -rf node_modules && pnpm install --frozen-lockfile"
          cwd="/workspace/deck-go/frontend"
          agent="main"
          countdown={approvalCountdown}
          pending={3}
          onResolve={() => setShowApproval(false)}
        />
      )}
      {tweaks.contextPct >= 95 && (
        <div className="ctx-warn">
          <I.Zap size={11} />
          <span className="mono small">
            Context at {tweaks.contextPct}% — older turns may be compacted on send
          </span>
        </div>
      )}
      {files.length > 0 && (
        <div className="attach-bar">
          {files.map((f, i) => (
            <span key={i} className="attach-chip">
              <I.File size={11} />
              <span className="mono small">{f.name}</span>
              <span className="small">{f.size}</span>
              <button onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                <I.X size={10} />
              </button>
            </span>
          ))}
          <button className="btn-ghost small">
            <I.Plus size={11} /> add
          </button>
        </div>
      )}

      <div
        className="composer-field"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
      >
        {showSlash && (
          <SlashPalette
            filter={slashFilter}
            mode={slashMode}
            setMode={setSlashMode}
            onPickImmediate={() => {
              setShowSlash(false);
              setText("");
            }}
            onPickTag={insertCmdTag}
            onPickArg={() => setSlashMode("argOptions")}
          />
        )}
        {showMention && <MentionPopover />}
        {showTemplate && (
          <TemplateMenu
            onClose={() => setShowTemplate(false)}
            onPick={(t) => {
              setText(t);
              setShowTemplate(false);
            }}
          />
        )}

        <button className="composer-attach">
          <I.Paperclip size={14} />
        </button>
        {activeTag && (
          <span className="cmd-tag">
            <I.Slash size={10} />
            <span className="mono">{activeTag}</span>
            <button onClick={() => setActiveTag(null)}>
              <I.X size={9} />
            </button>
          </span>
        )}
        <div className="ta-wrap">
          {ghostHint && (
            <div className="ghost-hint mono">
              /{slashFilter}
              <span className="ghost-rest">{ghostHint.slice(slashFilter.length)}</span>
            </div>
          )}
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => onChange(e.target.value)}
            placeholder={
              activeTag
                ? "Args for /" + activeTag + "…"
                : "Message main · ⌘↵ to send · / for commands · @ to mention"
            }
            rows={1}
          />
        </div>
        <button
          className={"composer-icon-btn" + (showTemplate ? " active" : "")}
          onClick={() => setShowTemplate(!showTemplate)}
          title="Templates"
        >
          <I.Wand size={13} />
        </button>
      </div>

      <div className="composer-toolbar">
        <button className={"chip-toggle " + (tweaks.canvasOn ? "on" : "off")}>
          <I.Canvas size={11} /> canvas
        </button>
        <button className={"chip-toggle " + (tweaks.artifactOn ? "on" : "off")}>
          <I.Artifact size={11} /> artifact
        </button>
        <span className="grow" />
        <span className="composer-hint mono small">{text.length} ch · ⌘↵ send</span>
        {isStreaming ? (
          <button className="btn-stop" onClick={() => onSend?.("stop")}>
            <I.Stop size={12} /> Stop
          </button>
        ) : (
          <button
            className={"btn-send" + (sendDisabled ? " disabled" : "")}
            disabled={sendDisabled}
            onClick={() => onSend?.("send")}
          >
            <I.Send size={12} /> Send
          </button>
        )}
      </div>
    </div>
  );
}

function findGhostHint(filter) {
  const cmds = window.MOCK.slashCommands.map((c) => c.cmd.slice(1));
  return cmds.find((c) => c.toLowerCase().startsWith(filter.toLowerCase())) || null;
}

function SlashPalette({ filter, mode, setMode, onPickImmediate, onPickTag, onPickArg }) {
  const items = window.MOCK.slashCommands.filter((c) =>
    c.cmd.slice(1).toLowerCase().startsWith(filter.toLowerCase()),
  );
  const [sel, setSel] = useStateC(0);

  if (mode === "argOptions") {
    const args = ["claude-sonnet-4.6", "claude-opus-4.5", "gpt-5.4", "gemini-3-pro"];
    return (
      <div className="popover slash-pop">
        <div className="pop-head mono small">/model · pick a model</div>
        {args.map((a, i) => (
          <div key={i} className={"pop-row" + (i === 0 ? " active" : "")}>
            <I.Sparkle size={11} />
            <span className="mono">{a}</span>
            {i === 0 && (
              <span className="kbd" style={{ marginLeft: "auto" }}>
                ↵
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="popover slash-pop">
      <div className="pop-head mono small">
        /{filter || "…"} · {items.length} command{items.length === 1 ? "" : "s"}
      </div>
      {items.length === 0 && (
        <div className="pop-empty mono small">No commands match "/{filter}"</div>
      )}
      {items.map((c, i) => (
        <div
          key={c.cmd}
          className={"pop-row" + (i === sel ? " active" : "")}
          onClick={() => {
            if (c.mode === "tag") {
              onPickTag(c.cmd.slice(1));
            } else if (c.mode === "argOptions") {
              onPickArg();
            } else {
              onPickImmediate();
            }
          }}
        >
          <I.Slash size={11} />
          <span className="mono">{c.cmd}</span>
          <span className="pop-desc">{c.desc}</span>
          <span className="pop-mode-tag mono small">{c.mode}</span>
        </div>
      ))}
    </div>
  );
}

function MentionPopover() {
  return (
    <div className="popover mention-pop">
      <div className="pop-head mono small">
        <I.AtSign size={10} /> mention an agent
      </div>
      {window.MOCK.mentionAgents.map((a, i) => (
        <div key={a.id} className={"pop-row" + (i === 0 ? " active" : "")}>
          <I.Bot size={11} />
          <span className="mono">@{a.name}</span>
          <span className="pop-desc">{a.desc}</span>
        </div>
      ))}
    </div>
  );
}

function TemplateMenu({ onClose, onPick }) {
  const items = [
    {
      t: "Diagnose failing test",
      body: "Run the test and tell me why it's failing. Include relevant file paths.",
    },
    {
      t: "Refactor for readability",
      body: "Refactor the file I attached for readability. Keep behavior identical.",
    },
    {
      t: "Write unit tests",
      body: "Write unit tests for this module covering happy + edge paths.",
    },
    { t: "Code review", body: "Do a code review pass. Flag bugs, design issues, perf problems." },
  ];
  return (
    <div className="popover template-pop">
      <div className="pop-head mono small">Templates · {items.length}</div>
      {items.map((it, i) => (
        <div key={i} className="pop-row" onClick={() => onPick(it.body)}>
          <I.Wand size={11} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span>{it.t}</span>
            <span className="pop-desc small">{it.body.slice(0, 60)}…</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ApprovalDialog({ tool, command, cwd, agent, countdown, pending, onResolve }) {
  const danger = countdown < 30;
  return (
    <div className="approval-dlg">
      <div className="approval-head">
        <I.Shield size={13} />
        <span className="approval-title">Tool approval</span>
        <span className="grow" />
        {pending > 1 && <span className="badge badge-warn">{pending} pending</span>}
        <span className={"approval-countdown mono" + (danger ? " danger" : "")}>
          <I.Clock size={11} /> {Math.floor(countdown / 60)}:
          {String(countdown % 60).padStart(2, "0")}
        </span>
      </div>
      <div className="approval-tool mono">{tool}</div>
      <pre className="approval-cmd">
        <code>{command}</code>
      </pre>
      <div className="approval-meta mono small">
        <span>
          agent: <span className="approval-meta-v">{agent}</span>
        </span>
        <span className="dot-sep">·</span>
        <span>
          cwd: <span className="approval-meta-v">{cwd}</span>
        </span>
      </div>
      <div className="approval-actions">
        <button className="btn-success" onClick={onResolve}>
          <I.Check size={12} /> Allow once
        </button>
        <button className="btn-secondary" onClick={onResolve}>
          <I.Shield size={12} /> Allow always
        </button>
        <button className="btn-danger-out" onClick={onResolve}>
          <I.X size={12} /> Deny
        </button>
      </div>
    </div>
  );
}

window.Composer = Composer;
window.ApprovalDialog = ApprovalDialog;
