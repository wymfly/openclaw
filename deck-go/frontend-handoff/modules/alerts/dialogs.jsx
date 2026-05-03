// alerts — dialogs
//
// Three dialogs for the alerts panel:
//   - RuleEditDialog       — create/edit form (name + entity + condition + threshold + action + cooldown)
//   - DeleteRuleDialog     — confirm-and-delete
//   - TestFireDialog       — dry-run preview of what action firing the rule would do

const { useState: _dlgState, useEffect: _dlgEffect } = React;

const COOLDOWN_PRESETS = [
  { label: "1m", ms: 60_000 },
  { label: "5m", ms: 5 * 60_000 },
  { label: "10m", ms: 10 * 60_000 },
  { label: "30m", ms: 30 * 60_000 },
  { label: "1h", ms: 3600_000 },
  { label: "4h", ms: 4 * 3600_000 },
  { label: "24h", ms: 24 * 3600_000 },
];

function RuleEditDialog({ open, mode, rule, entityTypes, onClose, onSave }) {
  const [draft, setDraft] = _dlgState(null);
  const [saving, setSaving] = _dlgState(false);
  const [errors, setErrors] = _dlgState({});

  _dlgEffect(() => {
    if (!open) return;
    if (mode === "edit" && rule) {
      setDraft({ ...rule });
    } else {
      setDraft({
        id: "",
        name: "",
        entityType: "channel",
        condition: "",
        threshold: 1,
        action: "toast",
        cooldownMs: 5 * 60 * 1000,
        enabled: true,
      });
    }
    setSaving(false);
    setErrors({});
  }, [open, mode, rule]);

  if (!open || !draft) return null;

  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const validate = () => {
    const errs = {};
    if (!draft.name.trim()) errs.name = "Name is required";
    if (!draft.condition.trim()) errs.condition = "Condition is required";
    if (typeof draft.threshold !== "number" || Number.isNaN(draft.threshold)) {
      errs.threshold = "Threshold must be a number";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const save = () => {
    if (!validate()) return;
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      onSave?.(draft);
    }, 500);
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal modal--rule-edit"
        role="dialog"
        aria-modal="true"
        aria-label={mode === "edit" ? "Edit alert rule" : "Create alert rule"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <div className="pill pill--info">
            {mode === "edit" ? <IconBell /> : <IconPlus />}
            <span>{mode === "edit" ? "EDIT" : "CREATE"}</span>
          </div>
          <h3>{mode === "edit" ? draft.name || "Edit rule" : "New alert rule"}</h3>
          <button className="icon-btn" type="button" aria-label="Close" onClick={onClose}>
            <IconX />
          </button>
        </div>
        <div className="modal__body">
          <div className="install-section">
            <div className="install-section__label">Name</div>
            <input
              className={`input${errors.name ? " input--err" : ""}`}
              type="text"
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g., 'High API spend'"
              aria-label="Rule name"
            />
            {errors.name ? <div className="input-error">{errors.name}</div> : null}
          </div>

          <div className="install-section">
            <div className="install-section__label">Entity type</div>
            <div className="entity-grid">
              {entityTypes.map((t) => (
                <label
                  key={t}
                  className={`entity-tile${draft.entityType === t ? " is-active" : ""}`}
                >
                  <input
                    type="radio"
                    name="entityType"
                    checked={draft.entityType === t}
                    onChange={() => set("entityType", t)}
                  />
                  <EntityGlyph entityType={t} size={20} />
                  <span>{t}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="install-section">
            <div className="install-section__label">Condition (DSL)</div>
            <input
              className={`input input--mono${errors.condition ? " input--err" : ""}`}
              type="text"
              value={draft.condition}
              onChange={(e) => set("condition", e.target.value)}
              placeholder="e.g., 'spend_usd_1h > threshold'"
              aria-label="Condition"
            />
            <div className="muted small">
              Reference <span className="kbd">threshold</span> in the expression; backend
              substitutes the value below at evaluation time.
            </div>
            {errors.condition ? <div className="input-error">{errors.condition}</div> : null}
          </div>

          <div className="install-section">
            <div className="install-section__label">Threshold</div>
            <input
              className={`input input--mono${errors.threshold ? " input--err" : ""}`}
              type="number"
              value={draft.threshold}
              onChange={(e) => set("threshold", Number(e.target.value))}
              aria-label="Threshold"
            />
            {errors.threshold ? <div className="input-error">{errors.threshold}</div> : null}
          </div>

          <div className="install-section">
            <div className="install-section__label">Action</div>
            <div className="action-grid">
              {[
                { id: "toast", label: "Toast", desc: "Show transient banner in deck-go." },
                { id: "activity", label: "Activity", desc: "Append to activity feed only." },
                { id: "webhook", label: "Webhook", desc: "POST to a registered webhook target." },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`action-tile${draft.action === opt.id ? " is-active" : ""}`}
                >
                  <input
                    type="radio"
                    name="action"
                    checked={draft.action === opt.id}
                    onChange={() => set("action", opt.id)}
                  />
                  <ActionPill action={opt.id} />
                  <div className="action-tile__desc">{opt.desc}</div>
                </label>
              ))}
            </div>
          </div>

          <div className="install-section">
            <div className="install-section__label">Cooldown</div>
            <div className="seg seg--cooldown">
              {COOLDOWN_PRESETS.map((p) => (
                <button
                  key={p.label}
                  className={`seg__btn${draft.cooldownMs === p.ms ? " seg__btn--active" : ""}`}
                  type="button"
                  onClick={() => set("cooldownMs", p.ms)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="muted small">
              Backend suppresses repeat fires within this window per (rule × entityId).
            </div>
          </div>

          <div className="install-section">
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) => set("enabled", e.target.checked)}
              />
              <span>Enabled</span>
              <span className="muted small">— rule evaluates on every aligned activity event</span>
            </label>
          </div>
        </div>
        <div className="modal__foot">
          <button className="btn btn--ghost" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn--primary" type="button" disabled={saving} onClick={save}>
            {saving ? <IconRefresh className="spin" /> : <IconCheck />}{" "}
            {saving ? "Saving" : mode === "edit" ? "Save changes" : "Create rule"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteRuleDialog({ open, rule, onCancel, onConfirm }) {
  if (!open || !rule) return null;
  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal modal--confirm"
        role="dialog"
        aria-modal="true"
        aria-label="Delete alert rule"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <div className="pill pill--err">
            <IconTrash />
            <span>DELETE</span>
          </div>
          <h3>Delete &ldquo;{rule.name}&rdquo;?</h3>
          <button className="icon-btn" type="button" aria-label="Close" onClick={onCancel}>
            <IconX />
          </button>
        </div>
        <div className="modal__body">
          <p>
            The rule will stop evaluating immediately and its history will remain in the activity
            log. You can recreate it later from a copy of the JSON definition.
          </p>
          <p className="muted small">No undo.</p>
        </div>
        <div className="modal__foot">
          <button className="btn btn--ghost" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn--danger" type="button" onClick={onConfirm}>
            <IconTrash /> Delete rule
          </button>
        </div>
      </div>
    </div>
  );
}

function TestFireDialog({ open, rule, onClose }) {
  if (!open || !rule) return null;
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal modal--test-fire"
        role="dialog"
        aria-modal="true"
        aria-label="Test fire"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <div className="pill pill--warn">
            <IconBell />
            <span>TEST</span>
          </div>
          <h3>Test fire — {rule.name}</h3>
          <button className="icon-btn" type="button" aria-label="Close" onClick={onClose}>
            <IconX />
          </button>
        </div>
        <div className="modal__body">
          <p className="muted small">
            Synthetic dry run. The actual rule won't be marked as fired and the cooldown window
            doesn't reset.
          </p>
          <div className="diag-block">
            <div className="diag-block__label">Action preview</div>
            <ActionPill action={rule.action} />
            <div className="muted small">
              {rule.action === "toast"
                ? "A toast banner would appear in deck-go."
                : rule.action === "activity"
                  ? "An alert.fire event would be appended to the activity feed."
                  : "A POST request would be sent to the registered webhook URL."}
            </div>
          </div>
          <div className="diag-block">
            <div className="diag-block__label">Sample payload</div>
            <pre className="code-block code-block--inline">
              <code>
                {JSON.stringify(
                  {
                    ruleId: rule.id,
                    ruleName: rule.name,
                    entityType: rule.entityType,
                    entityId: `<example-${rule.entityType}>`,
                    condition: rule.condition,
                    threshold: rule.threshold,
                    observedValue: rule.threshold + 1,
                    firedAt: new Date().toISOString(),
                    testFire: true,
                  },
                  null,
                  2,
                )}
              </code>
            </pre>
          </div>
        </div>
        <div className="modal__foot">
          <button className="btn btn--primary" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { RuleEditDialog, DeleteRuleDialog, TestFireDialog, COOLDOWN_PRESETS });
