/* global React, IconClose, IconCheck, IconAlert, IconEdit, IconTrash, IconPlus, IconPower,
   DimensionPill, ScopeChip, PeriodChip */
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
  if (phase === "running")
    return (
      <div className="phase phase--running" role="status">
        <span className="phase__spinner" aria-hidden="true" />
        <span>{runningLabel}</span>
      </div>
    );
  if (phase === "done")
    return (
      <div className="phase phase--done" role="status">
        <IconCheck size={14} />
        <span>{doneLabel}</span>
      </div>
    );
  return (
    <div className="phase phase--error" role="alert">
      <IconAlert size={14} />
      <span>
        {errorLabel || "Failed"}: {error}
      </span>
    </div>
  );
};

const DIMENSION_OPTIONS = [
  { id: "cost", label: "USD cost" },
  { id: "tokensIn", label: "Tokens in" },
  { id: "tokensOut", label: "Tokens out" },
  { id: "totalTokens", label: "Total tokens" },
];

const PERIOD_OPTIONS = ["minute", "hour", "day", "week", "month", "task"];
const SCOPE_OPTIONS = ["global", "workspace", "agent", "task", "channel"];

const RuleForm = ({ value, onChange, agentDirectory, busy }) => {
  const set = (k, v) => onChange({ ...value, [k]: v });
  return (
    <>
      <label className="modal__field">
        <span className="modal__field-label">Name</span>
        <input
          type="text"
          value={value.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Daily cost cap (all agents)"
          disabled={busy}
        />
      </label>

      <div className="modal__field-row">
        <label className="modal__field">
          <span className="modal__field-label">Scope</span>
          <select
            value={value.scope}
            onChange={(e) => set("scope", e.target.value)}
            disabled={busy}
          >
            {SCOPE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="modal__field">
          <span className="modal__field-label">Period</span>
          <select
            value={value.period}
            onChange={(e) => set("period", e.target.value)}
            disabled={busy}
          >
            {PERIOD_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      </div>

      {value.scope === "agent" ? (
        <label className="modal__field">
          <span className="modal__field-label">Agent</span>
          <select
            value={value.agentId || ""}
            onChange={(e) => set("agentId", e.target.value || null)}
            disabled={busy}
          >
            <option value="">— pick an agent —</option>
            {agentDirectory.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {value.scope === "task" ? (
        <label className="modal__field">
          <span className="modal__field-label">Task pattern</span>
          <input
            type="text"
            value={value.taskId || ""}
            onChange={(e) => set("taskId", e.target.value || null)}
            placeholder="e.g. review-pool/* or task-12345"
            disabled={busy}
          />
        </label>
      ) : null}

      <label className="modal__field">
        <span className="modal__field-label">Dimension</span>
        <select
          value={value.dimension}
          onChange={(e) => set("dimension", e.target.value)}
          disabled={busy}
        >
          {DIMENSION_OPTIONS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
      </label>

      <div className="modal__field-row">
        <label className="modal__field">
          <span className="modal__field-label">Warn threshold</span>
          <input
            type="number"
            value={value.warnThreshold ?? ""}
            onChange={(e) =>
              set("warnThreshold", e.target.value === "" ? null : Number(e.target.value))
            }
            disabled={busy}
            min="0"
            step="any"
          />
        </label>
        <label className="modal__field">
          <span className="modal__field-label">Over threshold</span>
          <input
            type="number"
            value={value.overThreshold ?? ""}
            onChange={(e) =>
              set("overThreshold", e.target.value === "" ? null : Number(e.target.value))
            }
            disabled={busy}
            min="0"
            step="any"
          />
        </label>
      </div>

      <label className="modal__field modal__field--check">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => set("enabled", e.target.checked)}
          disabled={busy}
        />
        <span>Enabled</span>
      </label>
    </>
  );
};

const EditRuleDialog = ({ rule, agentDirectory, onClose, onCommit }) => {
  const [draft, setDraft] = useState(rule);
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState(null);
  const submit = () => {
    if (!draft.name.trim()) return;
    setPhase("running");
    setError(null);
    setTimeout(() => {
      const drift = Math.random() < 0.1;
      if (drift) {
        setPhase("error");
        setError("validation: warn must be < over");
        return;
      }
      setPhase("done");
      setTimeout(() => {
        onCommit(draft);
        onClose();
      }, 480);
    }, 720);
  };
  const busy = phase === "running" || phase === "done";
  return (
    <ModalShell
      title="Edit budget rule"
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
              disabled={busy || !draft.name.trim()}
            >
              <IconEdit size={12} /> Save
            </button>
          </>
        )
      }
    >
      <p className="modal__hint">
        Rule definition mutates via PATCH. Server returns the updated rule and re-evaluates against
        the latest usage snapshot.
      </p>
      <RuleForm value={draft} onChange={setDraft} agentDirectory={agentDirectory} busy={busy} />
      <PhaseStrip
        phase={phase}
        runningLabel="Saving rule…"
        doneLabel="Saved. Closing…"
        errorLabel="Save failed"
        error={error}
      />
    </ModalShell>
  );
};

const CreateRuleDialog = ({ existingNames, agentDirectory, onClose, onCommit }) => {
  const [draft, setDraft] = useState({
    name: "",
    scope: "global",
    agentId: null,
    taskId: null,
    dimension: "cost",
    period: "day",
    warnThreshold: null,
    overThreshold: null,
    enabled: true,
  });
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState(null);
  const collision = draft.name.trim() && existingNames.includes(draft.name.trim());
  const submit = () => {
    if (!draft.name.trim() || collision) return;
    setPhase("running");
    setError(null);
    setTimeout(() => {
      setPhase("done");
      setTimeout(() => {
        onCommit({ ...draft, id: `rule-${Date.now()}` });
        onClose();
      }, 480);
    }, 720);
  };
  const busy = phase === "running" || phase === "done";
  return (
    <ModalShell
      title="New budget rule"
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
              disabled={busy || !draft.name.trim() || collision}
            >
              <IconPlus size={12} /> Create
            </button>
          </>
        )
      }
    >
      <p className="modal__hint">
        Create a budget rule. Once persisted, the BFF immediately evaluates it against current usage
        and surfaces a status (ok / warn / over).
      </p>
      <RuleForm value={draft} onChange={setDraft} agentDirectory={agentDirectory} busy={busy} />
      {collision ? (
        <span className="modal__field-error">A rule with this name already exists.</span>
      ) : null}
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

const ToggleRuleDialog = ({ rule, onClose, onCommit }) => {
  const [phase, setPhase] = useState("idle");
  const submit = () => {
    setPhase("running");
    setTimeout(() => {
      setPhase("done");
      setTimeout(() => {
        onCommit(!rule.enabled);
        onClose();
      }, 360);
    }, 480);
  };
  const busy = phase === "running" || phase === "done";
  return (
    <ModalShell
      title={rule.enabled ? "Disable rule" : "Enable rule"}
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
              className={`ds-btn ${rule.enabled ? "ds-btn--warn" : "ds-btn--primary"}`}
              onClick={submit}
              disabled={busy}
            >
              <IconPower size={12} /> {rule.enabled ? "Disable" : "Enable"}
            </button>
          </>
        )
      }
    >
      <p className={`modal__hint ${rule.enabled ? "modal__hint--warn" : ""}`}>
        {rule.enabled
          ? "Disabling stops the BFF from evaluating this rule. Existing alerts keep history but no new ones fire."
          : "Enabling re-arms evaluation against current usage. The next /api/deck/budget/evaluations response will include this rule."}
      </p>
      <div className="modal__kv-grid">
        <div className="modal__kv-row">
          <span className="modal__kv-label">Rule</span>
          <strong>{rule.name}</strong>
        </div>
        <div className="modal__kv-row">
          <span className="modal__kv-label">Currently</span>
          <code>{rule.enabled ? "enabled" : "disabled"}</code>
        </div>
      </div>
      <PhaseStrip
        phase={phase}
        runningLabel="Toggling…"
        doneLabel="Done. Closing…"
        errorLabel="Toggle failed"
      />
    </ModalShell>
  );
};

const DeleteRuleDialog = ({ rule, onClose, onCommit }) => {
  const [phase, setPhase] = useState("idle");
  const submit = () => {
    setPhase("running");
    setTimeout(() => {
      setPhase("done");
      setTimeout(() => {
        onCommit();
        onClose();
      }, 360);
    }, 480);
  };
  const busy = phase === "running" || phase === "done";
  return (
    <ModalShell
      title="Delete budget rule"
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
        Delete <strong>{rule.name}</strong>? This removes the rule from the registry. Past alerts
        keep their audit trail but no new ones fire.
      </p>
      <div className="modal__kv-grid">
        <div className="modal__kv-row">
          <span className="modal__kv-label">id</span>
          <code>{rule.id}</code>
        </div>
        <div className="modal__kv-row">
          <span className="modal__kv-label">scope</span>
          <code>{rule.scope}</code>
        </div>
        <div className="modal__kv-row">
          <span className="modal__kv-label">dimension</span>
          <code>{rule.dimension}</code>
        </div>
      </div>
      <PhaseStrip
        phase={phase}
        runningLabel="Deleting…"
        doneLabel="Deleted. Closing…"
        errorLabel="Delete failed"
      />
    </ModalShell>
  );
};

Object.assign(window, {
  ModalShell,
  PhaseStrip,
  EditRuleDialog,
  CreateRuleDialog,
  ToggleRuleDialog,
  DeleteRuleDialog,
});
