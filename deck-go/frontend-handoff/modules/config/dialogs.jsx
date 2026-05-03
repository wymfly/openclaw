// dialogs.jsx — ApplyConfirmDialog + ResetDialog + RawSnapshotDialog + ModalShell.

const { useEffect, useState } = React;

function ModalShell({ title, onClose, children, tone = "default", footer }) {
  useEffect(() => {
    const onEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className={`modal modal--${tone}`} onClick={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <h2 className="modal__title">{title}</h2>
          <button type="button" className="modal__close" aria-label="Close" onClick={onClose}>
            <window.IconClose size={14} />
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {footer ? <footer className="modal__foot">{footer}</footer> : null}
      </div>
    </div>
  );
}

function ApplyConfirmDialog({ baseHash, draftHash, diff, onClose, onConfirm }) {
  const [phase, setPhase] = useState("idle");

  const submit = () => {
    setPhase("running");
    setTimeout(() => {
      // 1-in-8 simulated rejection to exercise the error path
      if (Math.random() < 0.12) {
        setPhase("error");
        return;
      }
      setPhase("done");
      setTimeout(() => {
        onConfirm();
      }, 480);
    }, 720);
  };

  return (
    <ModalShell
      title="Apply config changes"
      onClose={phase === "running" ? () => {} : onClose}
      tone="primary"
      footer={
        phase === "idle" ? (
          <>
            <button className="ds-btn" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="ds-btn ds-btn--primary" type="button" onClick={submit}>
              Apply ({diff.length})
            </button>
          </>
        ) : phase === "error" ? (
          <>
            <button className="ds-btn" type="button" onClick={onClose}>
              Dismiss
            </button>
            <button className="ds-btn ds-btn--primary" type="button" onClick={submit}>
              Retry
            </button>
          </>
        ) : null
      }
    >
      <p className="modal__hint">
        Apply will POST <code>/api/config/apply</code> with the new draft. Optimistic concurrency is
        enforced via <code>baseHash</code> — if anyone else applied changes since you fetched, the
        call rejects.
      </p>
      <div className="modal__hashes">
        <window.HashChip kind="base" hash={baseHash} />
        <window.IconArrowOut size={11} />
        <window.HashChip kind="draft" hash={draftHash} />
      </div>
      <ul className="modal__diff">
        {diff.slice(0, 8).map((row) => (
          <li key={row.path} className={`modal__diff-row modal__diff-row--${row.kind}`}>
            <code>{row.path}</code>
            <span>{row.kind}</span>
          </li>
        ))}
        {diff.length > 8 ? <li className="modal__diff-more">+{diff.length - 8} more</li> : null}
      </ul>
      {phase === "running" ? <p className="phase phase--running">Applying…</p> : null}
      {phase === "done" ? (
        <p className="phase phase--done">
          <window.IconCheck size={12} /> Applied. Closing…
        </p>
      ) : null}
      {phase === "error" ? (
        <p className="phase phase--error">
          <window.IconAlert size={12} /> Apply rejected — base hash mismatch. Refresh and retry.
        </p>
      ) : null}
    </ModalShell>
  );
}

function ResetDialog({ dirtyPaths, onClose, onConfirm }) {
  return (
    <ModalShell
      title="Reset draft to last applied snapshot?"
      onClose={onClose}
      tone="warn"
      footer={
        <>
          <button className="ds-btn" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="ds-btn ds-btn--warn" type="button" onClick={onConfirm}>
            <window.IconUndo size={12} />
            <span>
              Reset {dirtyPaths.length} change{dirtyPaths.length === 1 ? "" : "s"}
            </span>
          </button>
        </>
      }
    >
      <p className="modal__hint">
        This drops {dirtyPaths.length} unsaved edit{dirtyPaths.length === 1 ? "" : "s"}. The applied
        snapshot is unchanged. There's no undo for this discard.
      </p>
      <ul className="modal__path-list">
        {dirtyPaths.slice(0, 12).map((p) => (
          <li key={p}>
            <code>{p}</code>
          </li>
        ))}
        {dirtyPaths.length > 12 ? <li>+{dirtyPaths.length - 12} more</li> : null}
      </ul>
    </ModalShell>
  );
}

function RawSnapshotDialog({ snapshot, onClose }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1100);
    });
  };
  return (
    <ModalShell
      title="DeckGoConfigSnapshotResponse"
      onClose={onClose}
      tone="default"
      footer={
        <>
          <button className="ds-btn" type="button" onClick={copy}>
            <window.IconCopy size={12} />
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
          <button className="ds-btn ds-btn--primary" type="button" onClick={onClose}>
            Done
          </button>
        </>
      }
    >
      <p className="modal__hint">
        Last successful response from <code>GET /api/config</code>. Used as the baseline for diff +
        the <code>baseHash</code> sent to apply.
      </p>
      <pre className="modal__pre">{JSON.stringify(snapshot, null, 2)}</pre>
    </ModalShell>
  );
}

Object.assign(window, { ModalShell, ApplyConfirmDialog, ResetDialog, RawSnapshotDialog });
