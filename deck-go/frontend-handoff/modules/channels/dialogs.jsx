// channels — Dialogs: TestResult, LogoutConfirm, CreateChannel (3-step wizard).

const { useState: _dlgState, useEffect: _dlgEffect } = React;

function ModalShell({ open, title, onClose, foot, children }) {
  _dlgEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (e.key === "Escape") onClose && onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open]);
  if (!open) return null;
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <h2 className="modal__title">{title}</h2>
          <button className="btn btn--ghost btn--sm" onClick={onClose} aria-label="Close">
            <IconX />
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {foot && <footer className="modal__foot">{foot}</footer>}
      </div>
    </div>
  );
}

/* ── Test result ───────────────────────────────────────────────── */
function TestResultDialog({ open, channel, onClose }) {
  if (!channel) return null;
  const probe = window.MOCK.probe[channel.id];
  return (
    <ModalShell
      open={open}
      title={`Test ${channel.label}`}
      onClose={onClose}
      foot={
        <button className="btn btn--primary" onClick={onClose}>
          Done
        </button>
      }
    >
      {!probe ? (
        <div className="banner">
          Channel is disabled — no probe runs while disabled. Re-enable the channel to test.
        </div>
      ) : (
        <div className={"probe-card " + (probe.ok ? "is-ok" : "is-fail")}>
          <span className="probe-card__icon">{probe.ok ? <IconCheck /> : <IconX />}</span>
          <div className="probe-card__main">
            <strong>
              {probe.ok ? "Probe success" : "Probe failed"} — {probe.latencyMs}ms
            </strong>
            <small>
              check {probe.check} · checked{" "}
              {probe.checkedAt ? new Date(probe.checkedAt).toLocaleTimeString() : "—"}
              {probe.error && <> · {probe.error}</>}
            </small>
          </div>
          <span className={"pill " + (probe.ok ? "pill--ok" : "pill--err")}>
            {probe.ok ? "ok" : "error"}
          </span>
        </div>
      )}
      <p className="form__hint">
        POST /channels/{channel.id}/test runs a single check. Latency is round-trip from gateway to
        provider and back.
      </p>
    </ModalShell>
  );
}

/* ── Logout confirm ────────────────────────────────────────────── */
function LogoutDialog({ open, channel, onCancel, onConfirm }) {
  if (!channel) return null;
  return (
    <ModalShell
      open={open}
      title={`Log out ${channel.label}?`}
      onClose={onCancel}
      foot={
        <>
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn--danger" onClick={onConfirm}>
            <IconLogout /> Log out
          </button>
        </>
      }
    >
      <div className="banner banner--warn">
        Logging out clears the active provider session for <strong>{channel.label}</strong>. Inbound
        traffic will pause until the channel reconnects.
      </div>
      <p className="form__hint">
        POST /channels/{channel.id}/logout. Channel status will refresh after success.
      </p>
    </ModalShell>
  );
}

/* ── Create channel wizard (3 steps) ───────────────────────────── */
function CreateChannelDialog({ open, onClose, onCreated }) {
  const [step, setStep] = _dlgState(1);
  const [provider, setProvider] = _dlgState("telegram");
  const [accountId, setAccountId] = _dlgState("");
  const [enable, setEnable] = _dlgState(true);

  _dlgEffect(() => {
    if (open) {
      setStep(1);
      setProvider("telegram");
      setAccountId("");
      setEnable(true);
    }
  }, [open]);

  const providers = [
    { id: "telegram", label: "Telegram", desc: "Bot API, long-poll or webhook" },
    { id: "discord", label: "Discord", desc: "Gateway WebSocket + slash commands" },
    { id: "wecom", label: "WeCom", desc: "Enterprise tenant with allow-from routing" },
    { id: "slack", label: "Slack", desc: "Events API + Web API" },
    { id: "qq", label: "QQ", desc: "Third-party plugin · npm install" },
  ];

  const back = () => setStep((s) => Math.max(1, s - 1));
  const next = () => setStep((s) => Math.min(3, s + 1));
  const create = () => onCreated && onCreated(provider);

  return (
    <ModalShell
      open={open}
      title="New channel"
      onClose={onClose}
      foot={
        <>
          {step > 1 && (
            <button className="btn" onClick={back}>
              Back
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          {step < 3 ? (
            <button className="btn btn--primary" onClick={next} disabled={step === 2 && !accountId}>
              Continue
            </button>
          ) : (
            <button className="btn btn--primary" onClick={create}>
              <IconPlus /> Create channel
            </button>
          )}
        </>
      }
    >
      <div className="wizard-steps">
        <span className={step >= 1 ? "is-active" : ""}>
          <span className="kbd">1</span> Provider
        </span>
        <i />
        <span className={step >= 2 ? "is-active" : ""}>
          <span className="kbd">2</span> Account
        </span>
        <i />
        <span className={step >= 3 ? "is-active" : ""}>
          <span className="kbd">3</span> Review
        </span>
      </div>

      {step === 1 && (
        <div style={{ display: "grid", gap: 8 }}>
          {providers.map((p) => (
            <button
              key={p.id}
              type="button"
              className={"row " + (provider === p.id ? "is-selected" : "")}
              style={{
                borderRadius: 8,
                border: "1px solid var(--ds-border)",
                padding: "10px 12px",
                display: "flex",
                alignItems: "center",
                gap: 12,
                cursor: "pointer",
              }}
              onClick={() => setProvider(p.id)}
            >
              <ChannelGlyph id={p.id} size={24} />
              <div style={{ flex: 1 }}>
                <strong style={{ display: "block", color: "var(--ds-text-1)" }}>{p.label}</strong>
                <small style={{ color: "var(--ds-text-3)", fontFamily: "var(--ds-font-mono)" }}>
                  {p.desc}
                </small>
              </div>
              {provider === p.id && <IconCheck />}
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="form" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
          <div className="form__row">
            <label className="form__label" htmlFor="acct-id">
              Account id
            </label>
            <input
              id="acct-id"
              className="input"
              placeholder={`acct_${provider}_${Math.random().toString(36).slice(2, 6)}`}
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              autoFocus
            />
            <span className="form__hint">Stable id under deck-go. Lowercase, snake_case.</span>
          </div>
          <div className="form__row">
            <label className="form__label">Enable on create</label>
            <button
              type="button"
              className={"toggle " + (enable ? "is-on" : "")}
              onClick={() => setEnable(!enable)}
            >
              <span className="toggle__switch" />
              {enable ? "Enabled" : "Disabled"}
            </button>
            <span className="form__hint">
              Disabled channels skip probe and routing until enabled.
            </span>
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ display: "grid", gap: 10 }}>
          <p className="form__hint">
            Review before creating. You can edit settings on the channel detail page after creation.
          </p>
          <div className="binding-list">
            <div className="binding">
              <span className="binding__tier">provider</span>
              <span className="binding__match">
                {providers.find((p) => p.id === provider)?.label}
              </span>
              <span className="binding__agent">{provider}</span>
            </div>
            <div className="binding">
              <span className="binding__tier">account</span>
              <span className="binding__match">{accountId || "—"}</span>
              <span className="binding__agent">{enable ? "enable" : "disable"}</span>
            </div>
          </div>
        </div>
      )}
    </ModalShell>
  );
}

Object.assign(window, { TestResultDialog, LogoutDialog, CreateChannelDialog });
