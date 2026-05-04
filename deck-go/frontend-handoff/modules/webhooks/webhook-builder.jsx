// WebhookBuilder — modal: name + url + secret + events multi-select +
// enabled. Modeled after cron-builder.jsx; events picker is a pill grid
// drawing from AVAILABLE_EVENTS.

const URL_PATTERN = /^https?:\/\/[^\s]+$/i;

const WebhookBuilder = ({ open, draft, isEdit, onChange, onClose, onSave }) => {
  const [phase, setPhase] = React.useState("idle");
  const [secretShown, setSecretShown] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setPhase("idle");
    setSecretShown(false);
    const onKey = (e) => {
      if (e.key === "Escape" && phase === "idle") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, phase, onClose]);

  if (!open || !draft) return null;

  const valid =
    draft.name.trim().length > 0 && URL_PATTERN.test(draft.url.trim()) && draft.events.length > 0;

  const urlValid = !draft.url || URL_PATTERN.test(draft.url.trim());

  const handleSave = () => {
    if (!valid || phase !== "idle") return;
    setPhase("saving");
    setTimeout(() => {
      setPhase("done");
      setTimeout(() => {
        onSave();
      }, 600);
    }, 700);
  };

  const toggleEvent = (event) => {
    if (phase !== "idle") return;
    const has = draft.events.includes(event);
    onChange({
      ...draft,
      events: has ? draft.events.filter((e) => e !== event) : [...draft.events, event],
    });
  };

  const grouped = React.useMemo(() => {
    const groups = new Map();
    for (const event of AVAILABLE_EVENTS) {
      const prefix = event.split(".")[0];
      if (!groups.has(prefix)) groups.set(prefix, []);
      groups.get(prefix).push(event);
    }
    return [...groups.entries()];
  }, []);

  return (
    <div className="modal-backdrop" onClick={() => phase === "idle" && onClose()}>
      <div
        className="modal webhook-builder"
        role="dialog"
        aria-modal
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal__head">
          <h3>{isEdit ? "Edit webhook" : "New webhook"}</h3>
          <button
            className="modal__close"
            onClick={onClose}
            disabled={phase !== "idle"}
            aria-label="Close"
          >
            <IconClose />
          </button>
        </header>

        <div className="modal__body">
          <section className="builder-section">
            <h4 className="builder-section__title">Identity</h4>
            <label className="builder-field">
              <span className="builder-field__label">Name</span>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => onChange({ ...draft, name: e.target.value })}
                placeholder="e.g. Ops Slack alerts"
                disabled={phase !== "idle"}
              />
            </label>
            <label className="builder-field">
              <span className="builder-field__label">
                <IconLink />
                Endpoint URL
              </span>
              <input
                type="text"
                value={draft.url}
                onChange={(e) => onChange({ ...draft, url: e.target.value })}
                placeholder="https://hooks.example.com/services/..."
                className={!urlValid ? "input--invalid" : ""}
                disabled={phase !== "idle"}
              />
              {!urlValid && (
                <span className="builder-field__hint err">Must be a valid http(s) URL</span>
              )}
            </label>
          </section>

          <section className="builder-section">
            <h4 className="builder-section__title">
              <IconKey />
              Secret
            </h4>
            <p className="builder-section__hint">
              Used to compute the <code>X-Deck-Signature</code> HMAC-SHA256 header. Leave blank for
              unsigned deliveries.
            </p>
            <div className="builder-secret">
              <input
                type={secretShown ? "text" : "password"}
                value={draft.secret || ""}
                onChange={(e) => onChange({ ...draft, secret: e.target.value })}
                placeholder="Optional shared secret"
                disabled={phase !== "idle"}
              />
              <button
                className="builder-secret__toggle"
                onClick={() => setSecretShown(!secretShown)}
                aria-label={secretShown ? "Hide secret" : "Show secret"}
                disabled={phase !== "idle"}
              >
                {secretShown ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
          </section>

          <section className="builder-section">
            <h4 className="builder-section__title">
              Events <span className="muted small">({draft.events.length} selected)</span>
            </h4>
            <p className="builder-section__hint">
              Select which event types fire this webhook. Each delivery includes the event name in
              the JSON payload.
            </p>
            <div className="builder-events">
              {grouped.map(([prefix, events]) => (
                <div key={prefix} className="builder-events__group">
                  <h5 className="builder-events__group-title">{prefix}</h5>
                  <div className="builder-events__chips">
                    {events.map((event) => {
                      const on = draft.events.includes(event);
                      return (
                        <button
                          key={event}
                          type="button"
                          className={`builder-chip ${on ? "builder-chip--on" : ""}`}
                          onClick={() => toggleEvent(event)}
                          disabled={phase !== "idle"}
                        >
                          {on && <IconCheck />}
                          <code>{event}</code>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {draft.events.length === 0 && (
              <span className="builder-field__hint err">
                Select at least one event to subscribe to
              </span>
            )}
          </section>

          <section className="builder-section">
            <h4 className="builder-section__title">Behavior</h4>
            <div className="builder-toggle-row">
              <label className="builder-toggle-row__label">
                <span>Enabled at launch</span>
                <span className="muted small">
                  When off, the webhook is created but no deliveries are made until enabled.
                </span>
              </label>
              <button
                type="button"
                role="switch"
                aria-checked={draft.enabled}
                className={`enabled-toggle enabled-toggle--lg ${draft.enabled ? "enabled-toggle--on" : "enabled-toggle--off"}`}
                onClick={() => onChange({ ...draft, enabled: !draft.enabled })}
                disabled={phase !== "idle"}
              >
                <span className="enabled-toggle__dot" />
                {draft.enabled ? "enabled" : "disabled"}
              </button>
            </div>
          </section>
        </div>

        <footer className="modal__foot">
          <button className="btn btn--ghost" onClick={onClose} disabled={phase !== "idle"}>
            Cancel
          </button>
          <button
            className="btn btn--primary"
            disabled={!valid || phase !== "idle"}
            onClick={handleSave}
          >
            {phase === "saving" ? (
              "Saving…"
            ) : phase === "done" ? (
              <>
                <IconCheck />
                Saved
              </>
            ) : isEdit ? (
              "Save changes"
            ) : (
              "Create webhook"
            )}
          </button>
        </footer>
      </div>
    </div>
  );
};

Object.assign(window, { WebhookBuilder });
