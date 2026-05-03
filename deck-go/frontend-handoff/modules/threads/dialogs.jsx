/* deck-go threads prototype v2 — dialogs */

function ModalShell({ title, subtitle, onClose, children, size = "md" }) {
  React.useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div
        className={`modal modal--${size}`}
        onMouseDown={(e) => e.stopPropagation()}
        role="document"
      >
        <header className="modal__head">
          <div className="modal__title">
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
            <IconClose size={14} />
          </button>
        </header>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}

function UnbindDialog({ thread, channelKindFromId, onClose, onConfirm }) {
  const [phase, setPhase] = React.useState("idle");
  const [error] = React.useState(null);
  const channelKind = channelKindFromId(thread.channelId);
  const meta = CHANNEL_META[channelKind] ?? { label: channelKind };

  const onUnbind = () => {
    setPhase("running");
    window.setTimeout(() => {
      setPhase("done");
      window.setTimeout(() => {
        onConfirm();
      }, 600);
    }, 700);
  };

  return (
    <ModalShell
      title="Unbind thread"
      subtitle={`${meta.label} · ${thread.channelId}`}
      onClose={onClose}
    >
      {phase === "idle" && (
        <>
          <p>
            Unbinding releases <code>{thread.threadId}</code>. New inbound messages on{" "}
            <code>{thread.channelId}</code> from <strong>{thread.accountId}</strong> will route to
            the channel default agent until a new binding is created.
          </p>
          <p className="dim">
            The conversation transcript stays in the <code>Chat</code> panel under{" "}
            <code>{thread.targetSessionKey}</code>. Unbinding does <strong>not</strong> delete it.
          </p>
          <div className="modal__actions">
            <button type="button" className="modal__btn" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="modal__btn modal__btn--danger" onClick={onUnbind}>
              <IconUnlink size={12} /> Unbind
            </button>
          </div>
        </>
      )}
      {phase === "running" && <p className="phase phase--running">Unbinding…</p>}
      {phase === "done" && (
        <p className="phase phase--done">
          <IconCheck size={14} /> Unbound. Closing…
        </p>
      )}
      {error && <p className="phase phase--error">{error}</p>}
    </ModalShell>
  );
}

function RebindDialog({ thread, agents, onClose, onConfirm }) {
  const [agentId, setAgentId] = React.useState(thread.agentId);
  const [phase, setPhase] = React.useState("idle");

  const onRebind = () => {
    if (agentId === thread.agentId) {
      onClose();
      return;
    }
    setPhase("running");
    window.setTimeout(() => {
      setPhase("done");
      window.setTimeout(() => {
        onConfirm(agentId);
      }, 500);
    }, 700);
  };

  return (
    <ModalShell title="Re-bind to a different agent" subtitle={thread.threadId} onClose={onClose}>
      {phase === "idle" && (
        <>
          <p>
            New inbound messages on <code>{thread.channelId}</code> from{" "}
            <strong>{thread.accountId}</strong> will route to the new agent. Existing transcript
            stays under <code>{thread.targetSessionKey}</code>.
          </p>
          <label className="rebind-field">
            <span>Target agent</span>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="rebind-select"
            >
              {agents.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <div className="modal__actions">
            <button type="button" className="modal__btn" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="modal__btn modal__btn--primary" onClick={onRebind}>
              <IconLink size={12} /> Re-bind
            </button>
          </div>
        </>
      )}
      {phase === "running" && <p className="phase phase--running">Updating binding…</p>}
      {phase === "done" && (
        <p className="phase phase--done">
          <IconCheck size={14} /> Re-bound to {agentId}.
        </p>
      )}
    </ModalShell>
  );
}

function RenameDialog({ thread, onClose, onConfirm }) {
  const [label, setLabel] = React.useState(thread.label ?? "");
  const [phase, setPhase] = React.useState("idle");

  const onSave = () => {
    setPhase("running");
    window.setTimeout(() => {
      setPhase("done");
      window.setTimeout(() => {
        onConfirm(label.trim() || null);
      }, 400);
    }, 500);
  };

  return (
    <ModalShell title="Rename label" subtitle={thread.threadId} onClose={onClose}>
      {phase === "idle" && (
        <>
          <label className="rebind-field">
            <span>Display label (optional)</span>
            <input
              className="rebind-input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Discord ops alerts → main session"
              maxLength={120}
            />
          </label>
          <p className="dim">
            An empty label removes the override and falls back to the channel + agent display.
          </p>
          <div className="modal__actions">
            <button type="button" className="modal__btn" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="modal__btn modal__btn--primary" onClick={onSave}>
              Save
            </button>
          </div>
        </>
      )}
      {phase === "running" && <p className="phase phase--running">Saving…</p>}
      {phase === "done" && (
        <p className="phase phase--done">
          <IconCheck size={14} /> Saved.
        </p>
      )}
    </ModalShell>
  );
}

function RawEntryDialog({ thread, onClose }) {
  return (
    <ModalShell title="Raw DeckGoThreadEntry" subtitle={thread.threadId} onClose={onClose}>
      <pre className="modal__code">{JSON.stringify(thread, null, 2)}</pre>
      <div className="modal__actions">
        <button type="button" className="modal__btn" onClick={onClose}>
          Close
        </button>
      </div>
    </ModalShell>
  );
}

Object.assign(window, { ModalShell, UnbindDialog, RebindDialog, RenameDialog, RawEntryDialog });
