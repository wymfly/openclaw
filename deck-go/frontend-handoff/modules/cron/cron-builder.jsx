// CronBuilder — modal for creating/editing DeckGoCronJobInput. 3-tab
// schedule builder (cron / every / at) with kind-specific inputs.

const KIND_TABS = [
  { id: "cron", label: "Cron expression" },
  { id: "every", label: "Every interval" },
  { id: "at", label: "One-shot" },
];

const WAKE_MODES = ["wake", "background"];
const PAYLOAD_KINDS = ["systemEvent", "agentTurn"];

const blankInput = () => ({
  name: "",
  description: "",
  schedule: { kind: "cron", expr: "", tz: "UTC" },
  sessionTarget: "session-default",
  wakeMode: "background",
  payload: { kind: "systemEvent", topic: "" },
  agentId: "",
  enabled: true,
  failureAlert: false,
});

const CronBuilder = ({ initial, onClose, onSave }) => {
  const [draft, setDraft] = React.useState(() => (initial ? cloneJob(initial) : blankInput()));
  const [phase, setPhase] = React.useState("idle"); // idle | saving | done
  const isEditing = Boolean(initial);

  const setField = (key, value) => setDraft((d) => ({ ...d, [key]: value }));
  const setSchedule = (next) => setDraft((d) => ({ ...d, schedule: next }));
  const setPayload = (next) => setDraft((d) => ({ ...d, payload: next }));
  const setKind = (kind) => {
    if (kind === "cron") setSchedule({ kind: "cron", expr: "0 6 * * *", tz: "UTC" });
    else if (kind === "every") setSchedule({ kind: "every", everyMs: 5 * 60_000 });
    else setSchedule({ kind: "at", at: new Date(Date.now() + 60 * 60_000).toISOString() });
  };

  const valid =
    draft.name &&
    draft.schedule &&
    (draft.schedule.kind === "cron"
      ? !!draft.schedule.expr
      : draft.schedule.kind === "every"
        ? !!draft.schedule.everyMs
        : draft.schedule.kind === "at"
          ? !!draft.schedule.at
          : false);

  const save = () => {
    if (!valid) return;
    setPhase("saving");
    setTimeout(() => {
      onSave(draft);
      setPhase("done");
      setTimeout(onClose, 600);
    }, 600);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal--xwide"
        role="dialog"
        aria-modal="true"
        aria-label={isEditing ? "Edit job" : "New job"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <h3 className="modal__title">
            {isEditing ? `Edit job · ${initial.name}` : "New scheduled job"}
          </h3>
          <button className="modal__close" onClick={onClose} aria-label="Close builder">
            <IconClose />
          </button>
        </div>
        <div className="modal__body builder-body">
          <section className="builder-section">
            <h4 className="builder-section__title">Identity</h4>
            <div className="builder-grid">
              <BuilderField
                label="Name"
                value={draft.name}
                onChange={(v) => setField("name", v)}
                placeholder="Daily rollup"
              />
              <BuilderField
                label="Description (optional)"
                value={draft.description}
                onChange={(v) => setField("description", v)}
                placeholder="Aggregates per-channel deliveries"
              />
            </div>
          </section>

          <section className="builder-section">
            <h4 className="builder-section__title">Schedule</h4>
            <div className="builder-tabs" role="tablist" aria-label="Schedule kind">
              {KIND_TABS.map((k) => (
                <button
                  key={k.id}
                  role="tab"
                  aria-selected={draft.schedule.kind === k.id}
                  className={`builder-tab ${draft.schedule.kind === k.id ? "builder-tab--on" : ""}`}
                  onClick={() => setKind(k.id)}
                >
                  {k.label}
                </button>
              ))}
            </div>
            {draft.schedule.kind === "cron" && (
              <div className="builder-grid">
                <BuilderField
                  label="Cron expression"
                  value={draft.schedule.expr || ""}
                  onChange={(v) => setSchedule({ ...draft.schedule, expr: v })}
                  placeholder="0 6 * * *"
                  mono
                />
                <BuilderField
                  label="Timezone"
                  value={draft.schedule.tz || "UTC"}
                  onChange={(v) => setSchedule({ ...draft.schedule, tz: v })}
                  placeholder="UTC"
                  mono
                />
              </div>
            )}
            {draft.schedule.kind === "every" && (
              <div className="builder-grid">
                <BuilderField
                  label="Interval (ms)"
                  value={String(draft.schedule.everyMs || 0)}
                  onChange={(v) => setSchedule({ ...draft.schedule, everyMs: Number(v) || 0 })}
                  type="number"
                  mono
                />
                <BuilderField
                  label="Stagger (ms, optional)"
                  value={String(draft.schedule.staggerMs || 0)}
                  onChange={(v) =>
                    setSchedule({ ...draft.schedule, staggerMs: Number(v) || undefined })
                  }
                  type="number"
                  mono
                />
                <div className="builder-helper">
                  <span className="muted small">
                    Common values: 1 min = 60_000 · 5 min = 300_000 · 1 h = 3_600_000 · 1 d =
                    86_400_000
                  </span>
                </div>
              </div>
            )}
            {draft.schedule.kind === "at" && (
              <div className="builder-grid">
                <BuilderField
                  label="ISO timestamp"
                  value={draft.schedule.at || ""}
                  onChange={(v) => setSchedule({ ...draft.schedule, at: v })}
                  placeholder="2026-05-04T16:00:00Z"
                  mono
                />
                <div className="builder-helper">
                  <span className="muted small">
                    One-shot. Pair with <code>deleteAfterRun</code> below to auto-clean.
                  </span>
                </div>
              </div>
            )}
          </section>

          <section className="builder-section">
            <h4 className="builder-section__title">Target & wake</h4>
            <div className="builder-grid">
              <BuilderField
                label="Session target"
                value={draft.sessionTarget}
                onChange={(v) => setField("sessionTarget", v)}
                placeholder="session-rollup"
                mono
              />
              <BuilderSelect
                label="Wake mode"
                value={draft.wakeMode}
                options={WAKE_MODES}
                onChange={(v) => setField("wakeMode", v)}
              />
              <BuilderField
                label="Agent (optional)"
                value={draft.agentId || ""}
                onChange={(v) => setField("agentId", v)}
                placeholder="agent-orca"
                mono
              />
            </div>
          </section>

          <section className="builder-section">
            <h4 className="builder-section__title">Payload</h4>
            <div className="builder-grid">
              <BuilderSelect
                label="Kind"
                value={draft.payload?.kind || "systemEvent"}
                options={PAYLOAD_KINDS}
                onChange={(v) => setPayload({ ...(draft.payload || {}), kind: v })}
              />
              {draft.payload?.kind === "systemEvent" ? (
                <BuilderField
                  label="Topic"
                  value={draft.payload.topic || ""}
                  onChange={(v) => setPayload({ ...draft.payload, topic: v })}
                  placeholder="quota.recheck"
                  mono
                />
              ) : (
                <BuilderField
                  label="Prompt"
                  value={draft.payload.prompt || ""}
                  onChange={(v) => setPayload({ ...draft.payload, prompt: v })}
                  placeholder="rollup yesterday's metrics"
                />
              )}
            </div>
          </section>

          <section className="builder-section">
            <h4 className="builder-section__title">Behavior</h4>
            <div className="builder-toggles">
              <ToggleRow
                label="Enabled"
                value={draft.enabled !== false}
                onChange={(v) => setField("enabled", v)}
                hint="Disabled jobs do not schedule next runs."
              />
              <ToggleRow
                label="Failure alerts"
                value={Boolean(draft.failureAlert)}
                onChange={(v) => setField("failureAlert", v)}
                hint="Emit alert event on consecutive errors."
              />
              <ToggleRow
                label="Delete after run"
                value={Boolean(draft.deleteAfterRun)}
                onChange={(v) => setField("deleteAfterRun", v)}
                hint="One-shot — job is removed after first successful run."
              />
            </div>
          </section>
        </div>
        <div className="modal__foot">
          {phase === "saving" && (
            <span className="modal__phase modal__phase--running" role="status">
              Saving…
            </span>
          )}
          {phase === "done" && (
            <span className="modal__phase modal__phase--done">
              <IconCheck />
              Saved.
            </span>
          )}
          {!valid && phase === "idle" && (
            <span className="muted small modal__phase">Required: name, schedule fields.</span>
          )}
          <button className="modal__btn" onClick={onClose} disabled={phase === "saving"}>
            Cancel
          </button>
          <button
            className="modal__btn modal__btn--primary"
            onClick={save}
            disabled={phase !== "idle" || !valid}
          >
            {isEditing ? "Save changes" : "Create job"}
          </button>
        </div>
      </div>
    </div>
  );
};

const BuilderField = ({ label, value, onChange, placeholder, type = "text", mono = false }) => (
  <label className={`builder-field ${mono ? "builder-field--mono" : ""}`}>
    <span className="builder-field__label">{label}</span>
    <input
      type={type}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="builder-field__input"
    />
  </label>
);

const BuilderSelect = ({ label, value, options, onChange }) => (
  <label className="builder-field">
    <span className="builder-field__label">{label}</span>
    <select
      className="builder-field__input"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  </label>
);

const ToggleRow = ({ label, value, onChange, hint }) => (
  <label className="toggle-row">
    <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
    <div className="toggle-row__text">
      <span className="toggle-row__label">{label}</span>
      {hint && <span className="muted small">{hint}</span>}
    </div>
  </label>
);

function cloneJob(j) {
  return JSON.parse(
    JSON.stringify({
      name: j.name,
      description: j.description || "",
      schedule: j.schedule,
      sessionTarget: j.sessionTarget,
      wakeMode: j.wakeMode,
      payload: j.payload,
      agentId: j.agentId,
      enabled: j.enabled,
      failureAlert: j.failureAlert,
      deleteAfterRun: j.deleteAfterRun,
    }),
  );
}

Object.assign(window, { CronBuilder });
