/* global React, IconClose, IconCheck, IconAlert, IconLink, IconUnlink, IconEdit, IconTrash, IconPlus, IconHash, ChannelPill, HashChip */
const { useEffect, useRef, useState } = React;

const ModalShell = ({ title, onClose, children, footer, busy }) => {
  const dialogRef = useRef(null);
  useEffect(() => {
    if (busy) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, busy]);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (busy) return;
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal__head">
          <h2>{title}</h2>
          <button
            type="button"
            className="modal__close"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            <IconClose size={14} />
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {footer ? <footer className="modal__foot">{footer}</footer> : null}
      </div>
    </div>
  );
};

const PhaseStrip = ({ phase, runningLabel, doneLabel, errorLabel, error }) => {
  if (phase === "idle") return null;
  if (phase === "running") {
    return (
      <div className="phase phase--running" role="status">
        <span className="phase__spinner" aria-hidden="true" />
        <span>{runningLabel}</span>
      </div>
    );
  }
  if (phase === "done") {
    return (
      <div className="phase phase--done" role="status">
        <IconCheck size={14} />
        <span>{doneLabel}</span>
      </div>
    );
  }
  return (
    <div className="phase phase--error" role="alert">
      <IconAlert size={14} />
      <span>
        {errorLabel || "Failed"}: {error}
      </span>
    </div>
  );
};

const LinkPeerDialog = ({ canonical, channels, configHash, onClose, onCommit }) => {
  const [channel, setChannel] = useState(channels[0]?.id || "telegram");
  const [peerId, setPeerId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState(null);

  const submit = () => {
    if (!peerId.trim()) return;
    setPhase("running");
    setError(null);
    setTimeout(() => {
      // 12% simulated baseHash drift
      const drift = Math.random() < 0.12;
      if (drift) {
        setPhase("error");
        setError("baseHash drift — refresh and retry");
        return;
      }
      setPhase("done");
      setTimeout(() => {
        onCommit({ channel, peerId: peerId.trim(), displayName: displayName.trim() || null });
        onClose();
      }, 480);
    }, 720);
  };

  const busy = phase === "running" || phase === "done";

  return (
    <ModalShell
      title={`Link peer to "${canonical}"`}
      onClose={onClose}
      busy={busy}
      footer={
        phase === "done" ? null : (
          <>
            <button
              type="button"
              className="ds-btn ds-btn--ghost"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="ds-btn ds-btn--primary"
              onClick={submit}
              disabled={busy || !peerId.trim()}
            >
              <IconLink size={12} /> Link peer
            </button>
          </>
        )
      }
    >
      <p className="modal__hint">
        Bind a channel peer to <strong>{canonical}</strong>. Mutation submits the current baseHash;
        conflicts surface as 409.
      </p>

      <label className="modal__field">
        <span className="modal__field-label">Channel</span>
        <select value={channel} onChange={(e) => setChannel(e.target.value)} disabled={busy}>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <label className="modal__field">
        <span className="modal__field-label">Peer ID</span>
        <input
          type="text"
          value={peerId}
          onChange={(e) => setPeerId(e.target.value)}
          placeholder="tg-daisy / disc-918273 / slack-U-XXX"
          autoFocus
          disabled={busy}
        />
        <span className="modal__field-hint">
          Channel-specific peer identifier (Discord snowflake, Slack U-id, Telegram chat id, etc.)
        </span>
      </label>

      <label className="modal__field">
        <span className="modal__field-label">Display name (optional)</span>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Daisy Wong"
          disabled={busy}
        />
      </label>

      <div className="modal__kv-grid">
        <div className="modal__kv-row">
          <span className="modal__kv-label">baseHash</span>
          <HashChip value={configHash} tone="accent" />
        </div>
        <div className="modal__kv-row">
          <span className="modal__kv-label">After link</span>
          <span>
            <ChannelPill channel={channel} />
            <code>{peerId || "—"}</code> → <strong>{canonical}</strong>
          </span>
        </div>
      </div>

      <PhaseStrip
        phase={phase}
        runningLabel="Linking peer…"
        doneLabel="Linked. Closing…"
        errorLabel="Link failed"
        error={error}
      />
    </ModalShell>
  );
};

const UnlinkPeerDialog = ({ canonical, peer, configHash, onClose, onCommit }) => {
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState(null);
  const submit = () => {
    setPhase("running");
    setError(null);
    setTimeout(() => {
      const drift = Math.random() < 0.12;
      if (drift) {
        setPhase("error");
        setError("baseHash drift — refresh and retry");
        return;
      }
      setPhase("done");
      setTimeout(() => {
        onCommit();
        onClose();
      }, 480);
    }, 720);
  };
  const busy = phase === "running" || phase === "done";
  return (
    <ModalShell
      title="Unlink peer"
      onClose={onClose}
      busy={busy}
      footer={
        phase === "done" ? null : (
          <>
            <button
              type="button"
              className="ds-btn ds-btn--ghost"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button type="button" className="ds-btn ds-btn--warn" onClick={submit} disabled={busy}>
              <IconUnlink size={12} /> Unlink
            </button>
          </>
        )
      }
    >
      <p className="modal__hint modal__hint--warn">
        Unlink peer from <strong>{canonical}</strong>. The peer will be unmapped — incoming events
        from this peer will fall back to channel default.
      </p>

      <div className="modal__kv-grid">
        <div className="modal__kv-row">
          <span className="modal__kv-label">Channel</span>
          <ChannelPill channel={peer.channel} />
        </div>
        <div className="modal__kv-row">
          <span className="modal__kv-label">Peer ID</span>
          <code>{peer.peerId}</code>
        </div>
        {peer.displayName ? (
          <div className="modal__kv-row">
            <span className="modal__kv-label">Display name</span>
            <span>{peer.displayName}</span>
          </div>
        ) : null}
        <div className="modal__kv-row">
          <span className="modal__kv-label">baseHash</span>
          <HashChip value={configHash} tone="accent" />
        </div>
      </div>

      <PhaseStrip
        phase={phase}
        runningLabel="Unlinking peer…"
        doneLabel="Unlinked. Closing…"
        errorLabel="Unlink failed"
        error={error}
      />
    </ModalShell>
  );
};

const RenameCanonicalDialog = ({ canonical, configHash, onClose, onCommit }) => {
  const [next, setNext] = useState(canonical);
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState(null);
  const submit = () => {
    if (!next.trim() || next === canonical) return;
    setPhase("running");
    setError(null);
    setTimeout(() => {
      const drift = Math.random() < 0.12;
      if (drift) {
        setPhase("error");
        setError("baseHash drift — refresh and retry");
        return;
      }
      setPhase("done");
      setTimeout(() => {
        onCommit(next.trim());
        onClose();
      }, 480);
    }, 720);
  };
  const busy = phase === "running" || phase === "done";
  return (
    <ModalShell
      title="Rename canonical"
      onClose={onClose}
      busy={busy}
      footer={
        phase === "done" ? null : (
          <>
            <button
              type="button"
              className="ds-btn ds-btn--ghost"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="ds-btn ds-btn--primary"
              onClick={submit}
              disabled={busy || !next.trim() || next === canonical}
            >
              <IconEdit size={12} /> Rename
            </button>
          </>
        )
      }
    >
      <p className="modal__hint">
        Rename the canonical identifier. Peers stay attached. Routing/permissions referring to the
        old name will need updating separately.
      </p>

      <label className="modal__field">
        <span className="modal__field-label">Canonical name</span>
        <input
          type="text"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoFocus
          disabled={busy}
        />
      </label>

      <div className="modal__kv-grid">
        <div className="modal__kv-row">
          <span className="modal__kv-label">From</span>
          <code>{canonical}</code>
        </div>
        <div className="modal__kv-row">
          <span className="modal__kv-label">To</span>
          <code>{next || "—"}</code>
        </div>
        <div className="modal__kv-row">
          <span className="modal__kv-label">baseHash</span>
          <HashChip value={configHash} tone="accent" />
        </div>
      </div>

      <PhaseStrip
        phase={phase}
        runningLabel="Renaming…"
        doneLabel="Renamed. Closing…"
        errorLabel="Rename failed"
        error={error}
      />
    </ModalShell>
  );
};

const CreateCanonicalDialog = ({ existingNames, configHash, onClose, onCommit }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState(null);
  const collision = name.trim() && existingNames.includes(name.trim());
  const submit = () => {
    if (!name.trim() || collision) return;
    setPhase("running");
    setError(null);
    setTimeout(() => {
      setPhase("done");
      setTimeout(() => {
        onCommit({ canonical: name.trim(), description: description.trim() });
        onClose();
      }, 480);
    }, 720);
  };
  const busy = phase === "running" || phase === "done";
  return (
    <ModalShell
      title="New canonical"
      onClose={onClose}
      busy={busy}
      footer={
        phase === "done" ? null : (
          <>
            <button
              type="button"
              className="ds-btn ds-btn--ghost"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="ds-btn ds-btn--primary"
              onClick={submit}
              disabled={busy || !name.trim() || collision}
            >
              <IconPlus size={12} /> Create
            </button>
          </>
        )
      }
    >
      <p className="modal__hint">
        Create an empty canonical. Peers can be linked once it exists. The canonical name is the
        routing-stable identifier.
      </p>

      <label className="modal__field">
        <span className="modal__field-label">Canonical name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. team-builder, review-pool, oncall-rotation"
          autoFocus
          disabled={busy}
        />
        {collision ? (
          <span className="modal__field-error">A canonical with this name already exists.</span>
        ) : (
          <span className="modal__field-hint">
            Use kebab-case. Avoid changing later — routing/permissions reference this name.
          </span>
        )}
      </label>

      <label className="modal__field">
        <span className="modal__field-label">Description (optional)</span>
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this canonical represents…"
          disabled={busy}
        />
      </label>

      <div className="modal__kv-grid">
        <div className="modal__kv-row">
          <span className="modal__kv-label">baseHash</span>
          <HashChip value={configHash} tone="accent" />
        </div>
      </div>

      <PhaseStrip
        phase={phase}
        runningLabel="Creating…"
        doneLabel="Created. Closing…"
        errorLabel="Create failed"
        error={error}
      />
    </ModalShell>
  );
};

const DeleteCanonicalDialog = ({ canonical, configHash, onClose, onCommit }) => {
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState(null);
  const submit = () => {
    setPhase("running");
    setError(null);
    setTimeout(() => {
      const drift = Math.random() < 0.12;
      if (drift) {
        setPhase("error");
        setError("baseHash drift — refresh and retry");
        return;
      }
      setPhase("done");
      setTimeout(() => {
        onCommit();
        onClose();
      }, 480);
    }, 720);
  };
  const busy = phase === "running" || phase === "done";
  return (
    <ModalShell
      title="Delete canonical"
      onClose={onClose}
      busy={busy}
      footer={
        phase === "done" ? null : (
          <>
            <button
              type="button"
              className="ds-btn ds-btn--ghost"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button type="button" className="ds-btn ds-btn--warn" onClick={submit} disabled={busy}>
              <IconTrash size={12} /> Delete
            </button>
          </>
        )
      }
    >
      <p className="modal__hint modal__hint--warn">
        Delete <strong>{canonical}</strong>? Only empty canonicals can be deleted. This removes the
        canonical from the registry.
      </p>

      <div className="modal__kv-grid">
        <div className="modal__kv-row">
          <span className="modal__kv-label">Canonical</span>
          <code>{canonical}</code>
        </div>
        <div className="modal__kv-row">
          <span className="modal__kv-label">baseHash</span>
          <HashChip value={configHash} tone="accent" />
        </div>
      </div>

      <PhaseStrip
        phase={phase}
        runningLabel="Deleting…"
        doneLabel="Deleted. Closing…"
        errorLabel="Delete failed"
        error={error}
      />
    </ModalShell>
  );
};

Object.assign(window, {
  ModalShell,
  PhaseStrip,
  LinkPeerDialog,
  UnlinkPeerDialog,
  RenameCanonicalDialog,
  CreateCanonicalDialog,
  DeleteCanonicalDialog,
});
