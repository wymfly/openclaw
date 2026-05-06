// dialogs.jsx — TestConnectionDialog + RotateTokenDialog + UnpairDeviceDialog + ResetDialog + ModalShell.

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

function TestConnectionDialog({ endpoint, onClose }) {
  const [phase, setPhase] = useState("idle");
  const [result, setResult] = useState(null);

  const runTest = () => {
    setPhase("running");
    setResult(null);
    setTimeout(() => {
      // Simulate occasional failure for variety
      if (Math.random() < 0.18) {
        setPhase("error");
        setResult({
          ok: false,
          error: "TLS verification failed: self-signed certificate",
          tlsVerified: false,
        });
        return;
      }
      setPhase("done");
      setResult({
        ok: true,
        latencyMs: 42 + Math.floor(Math.random() * 30),
        gatewayVersion: "0.7.1",
        tlsVerified: endpoint.tlsVerify,
      });
    }, 820);
  };

  return (
    <ModalShell
      title="Test Gateway connection"
      onClose={phase === "running" ? () => {} : onClose}
      tone="primary"
      footer={
        phase === "idle" ? (
          <>
            <button className="ds-btn" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="ds-btn ds-btn--primary" type="button" onClick={runTest}>
              Run test
            </button>
          </>
        ) : phase === "done" || phase === "error" ? (
          <>
            <button className="ds-btn" type="button" onClick={runTest}>
              Test again
            </button>
            <button className="ds-btn ds-btn--primary" type="button" onClick={onClose}>
              Done
            </button>
          </>
        ) : null
      }
    >
      <p className="modal__hint">
        POSTs <code>/api/runtime/endpoint:test</code> with the current draft. Verifies TCP
        reachability, TLS handshake, and Gateway version response.
      </p>
      <dl className="modal__kv">
        <div>
          <dt>URL</dt>
          <dd>
            <code>{endpoint.url}</code>
          </dd>
        </div>
        <div>
          <dt>TLS verify</dt>
          <dd>{endpoint.tlsVerify ? "enabled" : "disabled"}</dd>
        </div>
        <div>
          <dt>Token</dt>
          <dd>{endpoint.tokenConfigured ? "configured" : "missing"}</dd>
        </div>
      </dl>
      {phase === "running" ? <p className="phase phase--running">Connecting…</p> : null}
      {phase === "done" && result ? (
        <div className="phase phase--done">
          <window.IconCheck size={12} />
          <span>{`OK · ${result.latencyMs}ms · gateway ${result.gatewayVersion} · tls ${result.tlsVerified ? "verified" : "skipped"}`}</span>
        </div>
      ) : null}
      {phase === "error" && result ? (
        <div className="phase phase--error">
          <window.IconAlert size={12} />
          <span>{result.error}</span>
        </div>
      ) : null}
    </ModalShell>
  );
}

function RotateTokenDialog({ onClose, onConfirm }) {
  const [phase, setPhase] = useState("idle");
  const [newToken] = useState(
    "openclaw_at_" + Math.random().toString(36).slice(2, 10) + "_rotated",
  );

  const submit = () => {
    setPhase("running");
    setTimeout(() => {
      setPhase("done");
      setTimeout(onConfirm, 600);
    }, 720);
  };

  return (
    <ModalShell
      title="Rotate access token?"
      onClose={phase === "running" ? () => {} : onClose}
      tone="warn"
      footer={
        phase === "idle" ? (
          <>
            <button className="ds-btn" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="ds-btn ds-btn--warn" type="button" onClick={submit}>
              <window.IconWand size={12} />
              <span>Rotate</span>
            </button>
          </>
        ) : null
      }
    >
      <p className="modal__hint">
        A new token will be generated and written to <code>deck-go-settings.json</code>. All paired
        devices will be disconnected and need to re-auth using the new token.
      </p>
      <div className="token-preview">
        <p className="token-preview__label">New token (preview)</p>
        <code className="token-preview__value">{newToken}</code>
      </div>
      {phase === "running" ? <p className="phase phase--running">Rotating…</p> : null}
      {phase === "done" ? (
        <p className="phase phase--done">
          <window.IconCheck size={12} /> Token rotated. Closing…
        </p>
      ) : null}
    </ModalShell>
  );
}

function UnpairDeviceDialog({ device, onClose, onConfirm }) {
  return (
    <ModalShell
      title={`Unpair ${device.name}?`}
      onClose={onClose}
      tone="warn"
      footer={
        <>
          <button className="ds-btn" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="ds-btn ds-btn--warn" type="button" onClick={onConfirm}>
            <window.IconUnlink size={12} />
            <span>Unpair</span>
          </button>
        </>
      }
    >
      <p className="modal__hint">
        This device will be revoked and cannot reconnect with its current credentials. Re-pair from
        the device by re-entering the token.
      </p>
      <dl className="modal__kv">
        <div>
          <dt>IP</dt>
          <dd>
            <code>{device.ip}</code>
          </dd>
        </div>
        <div>
          <dt>Platform</dt>
          <dd>{device.platform}</dd>
        </div>
        <div>
          <dt>Version</dt>
          <dd>{device.version}</dd>
        </div>
      </dl>
    </ModalShell>
  );
}

function SaveDialog({ dirtyBySection, onClose, onConfirm }) {
  const [phase, setPhase] = useState("idle");
  const submit = () => {
    setPhase("running");
    setTimeout(() => {
      setPhase("done");
      setTimeout(onConfirm, 480);
    }, 720);
  };

  const total = Object.values(dirtyBySection).reduce((s, n) => s + n, 0);

  return (
    <ModalShell
      title="Save settings"
      onClose={phase === "running" ? () => {} : onClose}
      tone="primary"
      footer={
        phase === "idle" ? (
          <>
            <button className="ds-btn" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="ds-btn ds-btn--primary" type="button" onClick={submit}>
              <window.IconSave size={12} />
              <span>Save ({total})</span>
            </button>
          </>
        ) : null
      }
    >
      <p className="modal__hint">
        POST <code>/api/settings</code> with the new draft. Edits to runtime endpoint also write to{" "}
        <code>/api/runtime/endpoint</code>.
      </p>
      <ul className="modal__diff">
        {Object.entries(dirtyBySection).map(([section, count]) => (
          <li key={section} className="modal__diff-row modal__diff-row--modified">
            <code>{section}</code>
            <span>
              {count} edit{count === 1 ? "" : "s"}
            </span>
          </li>
        ))}
      </ul>
      {phase === "running" ? <p className="phase phase--running">Saving…</p> : null}
      {phase === "done" ? (
        <p className="phase phase--done">
          <window.IconCheck size={12} /> Saved. Closing…
        </p>
      ) : null}
    </ModalShell>
  );
}

Object.assign(window, {
  ModalShell,
  TestConnectionDialog,
  RotateTokenDialog,
  UnpairDeviceDialog,
  SaveDialog,
});
