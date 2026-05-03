// subagents — dialogs
//
// The contract supports three mutations: kill, steer, and per-agent
// permission set. So we have:
//   - KillRunDialog       — confirms killing a running subagent
//   - SteerRunDialog      — composes a steering message; returns dedupKey + deduped/newRunId
//   - PermissionsDialog   — edits parent agent's allowAgents / allowAny / model
//   - RunOutcomeDialog    — read-only view of run.outcome JSON

const { useState: _dlgState, useEffect: _dlgEffect } = React;

// ── KillRunDialog ────────────────────────────────────────────────────────

function KillRunDialog({ open, run, onCancel, onConfirm }) {
  if (!open || !run) return null;
  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal modal--confirm"
        role="dialog"
        aria-modal="true"
        aria-label="Kill subagent run"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <div className="pill pill--err">
            <IconStop /> <span>KILL</span>
          </div>
          <h3>Kill {run.childAgentName || run.childAgentId}?</h3>
          <button className="icon-btn" type="button" aria-label="Close" onClick={onCancel}>
            <IconX />
          </button>
        </div>
        <div className="modal__body">
          <p>
            This terminates the child session <span className="kbd">{run.childSessionKey}</span>{" "}
            immediately. Any partial work in the child is lost.
          </p>
          <p className="muted small">
            Parent <strong>{run.requesterAgentName || run.requesterAgentId}</strong> will receive a
            kill outcome and decide whether to retry or stop. There is no undo.
          </p>
          <div className="diag-block">
            <div className="diag-block__label">Run</div>
            <div className="mono">{run.runId}</div>
          </div>
        </div>
        <div className="modal__foot">
          <button className="btn btn--ghost" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn--danger" type="button" onClick={onConfirm}>
            <IconStop /> Kill run
          </button>
        </div>
      </div>
    </div>
  );
}

// ── SteerRunDialog ───────────────────────────────────────────────────────

function SteerRunDialog({ open, run, onClose, onSteered }) {
  const [draft, setDraft] = _dlgState("");
  const [phase, setPhase] = _dlgState("idle");
  const [outcome, setOutcome] = _dlgState(null);

  _dlgEffect(() => {
    if (!open) {
      setDraft("");
      setPhase("idle");
      setOutcome(null);
    }
  }, [open]);

  if (!open || !run) return null;

  const send = () => {
    if (!draft.trim()) return;
    setPhase("running");
    setTimeout(() => {
      // Simulate dedup logic: same message twice → deduped=true.
      const dedupKey = `dk_${draft.length.toString(36)}_${run.runId.slice(-4)}`;
      const result = {
        success: true,
        dedupKey,
        deduped: draft.toLowerCase().startsWith("dup:"),
        newRunId: draft.toLowerCase().startsWith("dup:") ? undefined : `run_steer_${Date.now()}`,
      };
      setOutcome(result);
      setPhase("done");
      onSteered?.(result);
    }, 600);
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal modal--steer"
        role="dialog"
        aria-modal="true"
        aria-label="Steer subagent run"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <div className="pill pill--info">
            <IconTarget /> <span>STEER</span>
          </div>
          <h3>Steer {run.childAgentName || run.childAgentId}</h3>
          <button className="icon-btn" type="button" aria-label="Close" onClick={onClose}>
            <IconX />
          </button>
        </div>
        <div className="modal__body">
          <p className="muted small">
            Inject a steering hint into the child's next iteration. The runtime deduplicates
            identical messages within a short window, so back-to-back duplicates are harmless.
          </p>
          <div className="meta-row">
            <span className="kbd">{run.runId}</span>
            <span className="muted">·</span>
            <span>depth {run.depth}</span>
            <span className="muted">·</span>
            <span>{run.spawnMode}</span>
          </div>
          <div className="install-section">
            <div className="install-section__label">Steering message</div>
            <textarea
              className="input input--mono input--multi"
              rows={4}
              placeholder="e.g., 'use bounded retry, not infinite loop'"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label="Steering message"
            />
          </div>
          {phase === "running" ? (
            <div className="install-progress">
              <IconRefresh className="spin" />
              <div>Routing message to child session…</div>
            </div>
          ) : null}
          {phase === "done" && outcome ? (
            <div className={`install-${outcome.deduped ? "info" : "done"}`}>
              {outcome.deduped ? <IconInfo /> : <IconCheck />}
              <div>
                <strong>{outcome.deduped ? "Deduplicated." : "Steered."}</strong>
                <p>
                  {outcome.deduped
                    ? "An identical hint was already in flight; runtime collapsed both."
                    : `New run id: ${outcome.newRunId}`}
                  <br />
                  <span className="muted">dedupKey: {outcome.dedupKey}</span>
                </p>
              </div>
            </div>
          ) : null}
        </div>
        <div className="modal__foot">
          {phase === "done" ? (
            <button className="btn btn--primary" type="button" onClick={onClose}>
              Close
            </button>
          ) : (
            <>
              <button className="btn btn--ghost" type="button" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn btn--primary"
                type="button"
                disabled={phase === "running" || !draft.trim()}
                onClick={send}
              >
                <IconArrowRight /> Send hint
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── PermissionsDialog ────────────────────────────────────────────────────

function PermissionsDialog({ open, agentId, config, allAgents, onClose, onSave }) {
  const [draft, setDraft] = _dlgState({ allowAgents: [], allowAny: false, model: "" });
  const [saving, setSaving] = _dlgState(false);

  _dlgEffect(() => {
    if (!open) return;
    setDraft({
      allowAgents: config?.allowAgents ? [...config.allowAgents] : [],
      allowAny: !!config?.allowAny,
      model: config?.model || "",
    });
  }, [open, config]);

  if (!open) return null;

  const togglePeer = (id) => {
    setDraft((d) => {
      const has = d.allowAgents.includes(id);
      return {
        ...d,
        allowAgents: has ? d.allowAgents.filter((x) => x !== id) : [...d.allowAgents, id],
      };
    });
  };

  const save = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      onSave?.(draft);
    }, 500);
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal modal--permissions"
        role="dialog"
        aria-modal="true"
        aria-label="Edit subagent permissions"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <div className="pill pill--info">
            <IconShield /> <span>PERMISSIONS</span>
          </div>
          <h3>{agentId} → subagents</h3>
          <button className="icon-btn" type="button" aria-label="Close" onClick={onClose}>
            <IconX />
          </button>
        </div>
        <div className="modal__body">
          <p className="muted small">
            Choose which agents <strong>{agentId}</strong> can spawn as subagents. Per-agent policy
            overrides workspace defaults. Bypass via <span className="kbd">allowAny</span>.
          </p>
          <div className="install-section">
            <div className="install-section__label">Allow any agent</div>
            <label className={`install-option${draft.allowAny ? " is-active" : ""}`}>
              <input
                type="checkbox"
                checked={draft.allowAny}
                onChange={(e) => setDraft((d) => ({ ...d, allowAny: e.target.checked }))}
              />
              <div className="install-option__main">
                <div className="install-option__title">
                  <IconSparkle /> {draft.allowAny ? "Any subagent allowed" : "Allow-list only"}
                </div>
                <div className="install-option__sub">
                  When on, every agent below is implicitly permitted regardless of the checkboxes.
                </div>
              </div>
            </label>
          </div>
          <div className="install-section">
            <div className="install-section__label">Allowed peers</div>
            <div className="permission-grid">
              {allAgents.map((peer) => {
                const checked = draft.allowAgents.includes(peer.id);
                const disabledByAny = draft.allowAny;
                return (
                  <label
                    key={peer.id}
                    className={`perm-row${checked ? " is-active" : ""}${disabledByAny ? " is-dimmed" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabledByAny}
                      onChange={() => togglePeer(peer.id)}
                    />
                    <span className="perm-row__name">{peer.name || peer.id}</span>
                    <span className="perm-row__id">{peer.id}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="install-section">
            <div className="install-section__label">Default model for spawns</div>
            <input
              className="input input--mono"
              type="text"
              value={draft.model}
              onChange={(e) => setDraft((d) => ({ ...d, model: e.target.value }))}
              placeholder="claude-sonnet-4-6"
              aria-label="Default model"
            />
            <div className="muted small">Inherited if blank.</div>
          </div>
        </div>
        <div className="modal__foot">
          <button className="btn btn--ghost" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn--primary" type="button" disabled={saving} onClick={save}>
            {saving ? <IconRefresh className="spin" /> : <IconCheck />}{" "}
            {saving ? "Saving" : "Save permissions"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── RunOutcomeDialog ─────────────────────────────────────────────────────

function RunOutcomeDialog({ open, run, onClose }) {
  const [copied, setCopied] = _dlgState(false);
  _dlgEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(t);
  }, [copied]);

  if (!open || !run) return null;
  const json = JSON.stringify(run, null, 2);
  const onCopy = () => {
    navigator.clipboard?.writeText(json).catch(() => {});
    setCopied(true);
  };
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal modal--raw"
        role="dialog"
        aria-modal="true"
        aria-label="Run outcome"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <div className="pill pill--muted">
            <IconCode /> <span>RUN</span>
          </div>
          <h3>{run.runId}</h3>
          <button className="icon-btn" type="button" aria-label="Close" onClick={onClose}>
            <IconX />
          </button>
        </div>
        <div className="modal__body modal__body--code">
          <pre className="code-block">
            <code>{json}</code>
          </pre>
        </div>
        <div className="modal__foot">
          <button className="btn btn--ghost" type="button" onClick={onCopy}>
            <IconCopy /> {copied ? "Copied" : "Copy JSON"}
          </button>
          <button className="btn btn--primary" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  KillRunDialog,
  SteerRunDialog,
  PermissionsDialog,
  RunOutcomeDialog,
});
