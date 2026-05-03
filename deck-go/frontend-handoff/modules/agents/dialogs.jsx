// Dialogs: create wizard + delete confirm.
const { useState: _dlgState, useEffect: _dlgEffect } = React;

// ── Create wizard (3 steps: identity → runtime note → review) ─────────────

function CreateDialog({ open, onClose, onCreated }) {
  const [step, setStep] = _dlgState(0);
  const [draft, setDraft] = _dlgState({ name: "", emoji: "", avatar: "", workspace: "" });
  const [error, setError] = _dlgState(null);
  const [submitting, setSubmitting] = _dlgState(false);

  _dlgEffect(() => {
    if (!open) {
      setStep(0);
      setDraft({ name: "", emoji: "", avatar: "", workspace: "" });
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  if (!open) return null;

  const update = (patch) => setDraft({ ...draft, ...patch });
  const validate = () => {
    if (step === 0 && !draft.name.trim()) {
      setError("Name is required.");
      return false;
    }
    setError(null);
    return true;
  };
  const next = () => {
    if (validate()) setStep(Math.min(2, step + 1));
  };
  const back = () => {
    setError(null);
    setStep(Math.max(0, step - 1));
  };

  const submit = () => {
    if (!validate()) return;
    setSubmitting(true);
    setTimeout(() => {
      const id = draft.name.trim().toLowerCase().replace(/\s+/g, "-");
      onCreated(id);
      onClose();
    }, 700);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-title"
      >
        <header className="modal__header">
          <div>
            <h2 id="create-title">New agent</h2>
            <p>Create identity first. Model, skills, and subagents configure after creation.</p>
          </div>
          <button className="btn btn--icon btn--ghost" onClick={onClose} aria-label="Close">
            <IconX />
          </button>
        </header>

        <div className="modal__body">
          <div className="wizard-steps" role="tablist">
            {["Identity", "Runtime", "Review"].map((label, i) => (
              <React.Fragment key={label}>
                <span
                  className={`wizard-step${step === i ? " is-active" : step > i ? " is-done" : ""}`}
                >
                  <span className="wizard-step__num">
                    {step > i ? <IconCheck size={11} /> : i + 1}
                  </span>
                  {label}
                </span>
                {i < 2 ? <span className="wizard-step__connector" /> : null}
              </React.Fragment>
            ))}
          </div>

          {error ? <div className="banner banner--error">{error}</div> : null}

          {step === 0 ? (
            <div className="field-grid">
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label className="field__label">Name</label>
                <input
                  className="input"
                  value={draft.name}
                  autoFocus
                  placeholder="e.g. Research"
                  onChange={(e) => update({ name: e.target.value })}
                />
              </div>
              <div className="field">
                <label className="field__label">Emoji</label>
                <input
                  className="input"
                  value={draft.emoji}
                  placeholder="e.g. R or 🔬"
                  onChange={(e) => update({ emoji: e.target.value })}
                />
              </div>
              <div className="field">
                <label className="field__label">Avatar URL</label>
                <input
                  className="input"
                  value={draft.avatar}
                  placeholder="optional"
                  onChange={(e) => update({ avatar: e.target.value })}
                />
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="field-grid">
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label className="field__label">Workspace</label>
                <input
                  className="input"
                  value={draft.workspace}
                  placeholder="/workspace/research"
                  onChange={(e) => update({ workspace: e.target.value })}
                />
                <span className="field__hint">
                  Absolute path. Leave empty to inherit from default agent.
                </span>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div className="banner banner--info">
                  <span>
                    <strong>Note:</strong> Backend POST /api/agents accepts only name, workspace,
                    emoji, avatar. Model, skills, subagents, and event streams configure after the
                    agent exists.
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="review-card">
              <div className="review-row">
                <span className="review-row__label">Name</span>
                <span className="review-row__value">{draft.name || "—"}</span>
              </div>
              <div className="review-row">
                <span className="review-row__label">Emoji</span>
                <span className={`review-row__value${draft.emoji ? "" : " is-muted"}`}>
                  {draft.emoji || "none"}
                </span>
              </div>
              <div className="review-row">
                <span className="review-row__label">Avatar</span>
                <span className={`review-row__value${draft.avatar ? "" : " is-muted"}`}>
                  {draft.avatar || "none"}
                </span>
              </div>
              <div className="review-row">
                <span className="review-row__label">Workspace</span>
                <span className={`review-row__value${draft.workspace ? "" : " is-muted"}`}>
                  {draft.workspace || "inherit"}
                </span>
              </div>
              <div className="review-row">
                <span className="review-row__label">Model</span>
                <span className="review-row__value is-muted">configure after create</span>
              </div>
            </div>
          ) : null}
        </div>

        <footer className="modal__footer">
          <button className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <span className="modal__footer-spacer" />
          {step > 0 ? (
            <button className="btn" onClick={back}>
              Back
            </button>
          ) : null}
          {step < 2 ? (
            <button className="btn btn--primary" onClick={next}>
              Next <IconArrowR />
            </button>
          ) : (
            <button className="btn btn--primary" disabled={submitting} onClick={submit}>
              {submitting ? "Creating…" : "Create agent"}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

// ── Delete confirm ────────────────────────────────────────────────────────

function DeleteDialog({ agent, onCancel, onDeleted }) {
  const [deleting, setDeleting] = _dlgState(false);

  _dlgEffect(() => {
    if (!agent) setDeleting(false);
  }, [agent]);

  if (!agent) return null;

  const confirm = () => {
    setDeleting(true);
    setTimeout(() => onDeleted(agent.id), 600);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal modal--sm"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="del-title"
      >
        <header className="modal__header">
          <div>
            <h2 id="del-title">Delete agent?</h2>
            <p>
              <strong style={{ color: "var(--ds-text-1)" }}>{agent.name || agent.id}</strong> will
              be removed, along with its identity, skills, subagent configuration, and stream
              subscriptions. Sessions are preserved.
            </p>
          </div>
        </header>
        <footer className="modal__footer">
          <button className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn--danger-solid" disabled={deleting} onClick={confirm}>
            {deleting ? (
              "Deleting…"
            ) : (
              <>
                <IconTrash /> Delete agent
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}

Object.assign(window, { CreateDialog, DeleteDialog });
