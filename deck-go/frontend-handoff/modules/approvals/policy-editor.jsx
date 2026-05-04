// PolicyEditor — modal for DeckGoApprovalPolicy editing: defaults, per-agent
// overrides, allowlist. Maps to PUT /api/approvals/policy.

const SECURITY_OPTIONS = ["deny", "allowlist", "full"];
const ASK_OPTIONS = ["off", "on-miss", "always"];
const ASK_FALLBACK_OPTIONS = ["deny", "allowlist", "full"];

const PolicyEditor = ({ policy, onClose, onSave }) => {
  const [draft, setDraft] = React.useState(() => JSON.parse(JSON.stringify(policy.file || {})));
  const [allowlistInput, setAllowlistInput] = React.useState("");
  const [phase, setPhase] = React.useState("idle"); // idle | saving | done

  const updateDefault = (key, value) => {
    setDraft((d) => ({ ...d, defaults: { ...(d.defaults || {}), [key]: value } }));
  };
  const updateAgent = (agentId, key, value) => {
    setDraft((d) => ({
      ...d,
      agents: {
        ...(d.agents || {}),
        [agentId]: { ...((d.agents || {})[agentId] || {}), [key]: value },
      },
    }));
  };
  const removeAgent = (agentId) => {
    setDraft((d) => {
      const next = { ...(d.agents || {}) };
      delete next[agentId];
      return { ...d, agents: next };
    });
  };
  const addAllowlist = () => {
    const v = allowlistInput.trim();
    if (!v) return;
    setDraft((d) => ({ ...d, allowlist: [...(d.allowlist || []), v] }));
    setAllowlistInput("");
  };
  const removeAllowlist = (idx) => {
    setDraft((d) => ({ ...d, allowlist: (d.allowlist || []).filter((_, i) => i !== idx) }));
  };

  const save = () => {
    setPhase("saving");
    setTimeout(() => {
      onSave({ file: draft, hash: "sha256:" + Math.random().toString(16).slice(2, 10) });
      setPhase("done");
      setTimeout(onClose, 600);
    }, 600);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal--wide"
        role="dialog"
        aria-modal="true"
        aria-label="Approval policy editor"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <h3 className="modal__title">Approval policy</h3>
          <button className="modal__close" onClick={onClose} aria-label="Close policy editor">
            <IconClose />
          </button>
        </div>
        <div className="modal__body">
          <section className="policy-section">
            <h4 className="policy-section__title">Defaults</h4>
            <div className="policy-grid">
              <PolicyField
                label="Security"
                value={draft.defaults?.security}
                options={SECURITY_OPTIONS}
                onChange={(v) => updateDefault("security", v)}
              />
              <PolicyField
                label="Ask mode"
                value={draft.defaults?.ask}
                options={ASK_OPTIONS}
                onChange={(v) => updateDefault("ask", v)}
              />
              <PolicyField
                label="Ask fallback"
                value={draft.defaults?.askFallback}
                options={ASK_FALLBACK_OPTIONS}
                onChange={(v) => updateDefault("askFallback", v)}
              />
              <PolicyField
                label="Auto-allow skills"
                value={String(draft.defaults?.autoAllowSkills ?? false)}
                options={["true", "false"]}
                onChange={(v) => updateDefault("autoAllowSkills", v === "true")}
              />
            </div>
          </section>

          <section className="policy-section">
            <h4 className="policy-section__title">Per-agent overrides</h4>
            {Object.keys(draft.agents || {}).length === 0 ? (
              <p className="muted small">No per-agent overrides configured.</p>
            ) : (
              <div className="policy-agents">
                {Object.entries(draft.agents || {}).map(([agentId, def]) => (
                  <div key={agentId} className="policy-agent-row">
                    <div className="policy-agent-row__head">
                      <code>{agentId}</code>
                      <button
                        className="policy-agent-row__remove"
                        onClick={() => removeAgent(agentId)}
                        aria-label={`Remove ${agentId} override`}
                      >
                        <IconClose />
                      </button>
                    </div>
                    <div className="policy-grid">
                      <PolicyField
                        label="Security"
                        value={def.security}
                        options={SECURITY_OPTIONS}
                        onChange={(v) => updateAgent(agentId, "security", v)}
                      />
                      <PolicyField
                        label="Ask"
                        value={def.ask}
                        options={ASK_OPTIONS}
                        onChange={(v) => updateAgent(agentId, "ask", v)}
                      />
                      <PolicyField
                        label="Fallback"
                        value={def.askFallback}
                        options={ASK_FALLBACK_OPTIONS}
                        onChange={(v) => updateAgent(agentId, "askFallback", v)}
                      />
                      <PolicyField
                        label="Auto-allow"
                        value={String(def.autoAllowSkills ?? false)}
                        options={["true", "false"]}
                        onChange={(v) => updateAgent(agentId, "autoAllowSkills", v === "true")}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="policy-section">
            <h4 className="policy-section__title">
              Allowlist ({(draft.allowlist || []).length} paths)
            </h4>
            <ul className="policy-allowlist">
              {(draft.allowlist || []).map((path, idx) => (
                <li key={idx} className="policy-allowlist__row">
                  <code>{path}</code>
                  <button
                    className="policy-allowlist__remove"
                    onClick={() => removeAllowlist(idx)}
                    aria-label={`Remove ${path}`}
                  >
                    <IconClose />
                  </button>
                </li>
              ))}
            </ul>
            <div className="policy-allowlist__add">
              <input
                type="text"
                placeholder="/path/to/binary or 'cmd args'"
                value={allowlistInput}
                onChange={(e) => setAllowlistInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addAllowlist();
                }}
              />
              <button onClick={addAllowlist}>Add</button>
            </div>
          </section>
        </div>
        <div className="modal__foot">
          {phase === "saving" && (
            <span className="modal__phase modal__phase--running" role="status">
              Saving policy…
            </span>
          )}
          {phase === "done" && (
            <span className="modal__phase modal__phase--done">
              <IconCheck />
              Policy saved.
            </span>
          )}
          <button className="modal__btn" onClick={onClose} disabled={phase === "saving"}>
            Cancel
          </button>
          <button
            className="modal__btn modal__btn--primary"
            onClick={save}
            disabled={phase !== "idle"}
          >
            Save policy
          </button>
        </div>
      </div>
    </div>
  );
};

const PolicyField = ({ label, value, options, onChange }) => (
  <label className="policy-field">
    <span className="policy-field__label">{label}</span>
    <select
      className="policy-field__input"
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

Object.assign(window, { PolicyEditor });
