// skills — dialogs
//
// Skills contract supports mutation, so the panel has real wizards:
//   - InstallFromHubDialog   — picks an install option, runs install, shows progress
//   - ConfigureSkillDialog   — edits per-skill key/value config (DeckGoSkillUpdateResponse)
//   - DisableConfirmDialog   — confirms disabling a skill (or removing managed)
//   - SkillReadmeDialog      — quick view of SKILL.md preview (BFF projection)

const { useState: _dlgState, useEffect: _dlgEffect } = React;

// ── InstallFromHubDialog ─────────────────────────────────────────────────

function InstallFromHubDialog({ open, hubResult, hubDetail, hubBins, onClose, onInstalled }) {
  const [phase, setPhase] = _dlgState("idle"); // idle → running → done | error
  const [errorMsg, setErrorMsg] = _dlgState("");
  const [optionId, setOptionId] = _dlgState("managed");

  _dlgEffect(() => {
    if (!open) {
      setPhase("idle");
      setErrorMsg("");
      setOptionId("managed");
    }
  }, [open]);

  if (!open || !hubResult) return null;

  const bins = hubBins?.bins || [];

  const runInstall = () => {
    setPhase("running");
    setTimeout(() => {
      // Simulate occasional failure for the prototype.
      if (hubResult.slug === "schedule-cron") {
        setPhase("error");
        setErrorMsg("Hub returned 502: registry temporarily unavailable. Retry in a few moments.");
        return;
      }
      setPhase("done");
    }, 900);
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal modal--install"
        role="dialog"
        aria-modal="true"
        aria-label="Install skill from hub"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <div className="pill pill--info">
            <IconDownload /> <span>INSTALL</span>
          </div>
          <h3>{hubDetail?.skill?.displayName || hubResult.displayName}</h3>
          <button className="icon-btn" type="button" aria-label="Close" onClick={onClose}>
            <IconX />
          </button>
        </div>
        <div className="modal__body">
          <div className="install-summary">
            <p className="muted">{hubDetail?.skill?.summary || hubResult.summary}</p>
            <div className="meta-row">
              <span className="kbd">{hubResult.slug}</span>
              <span className="muted">·</span>
              <span>v{hubDetail?.latestVersion?.version || hubResult.version}</span>
              {hubDetail?.owner ? (
                <>
                  <span className="muted">·</span>
                  <span>
                    by <strong>{hubDetail.owner.handle}</strong>
                  </span>
                </>
              ) : null}
            </div>
          </div>

          <div className="install-section">
            <div className="install-section__label">Install option</div>
            <div className="install-options">
              <label className={`install-option${optionId === "managed" ? " is-active" : ""}`}>
                <input
                  type="radio"
                  name="installOption"
                  checked={optionId === "managed"}
                  onChange={() => setOptionId("managed")}
                />
                <div className="install-option__main">
                  <div className="install-option__title">
                    <IconCloud /> Hub (managed)
                  </div>
                  <div className="install-option__sub">
                    Hub-pinned version with auto-update notifications. Recommended.
                  </div>
                </div>
              </label>
              <label className={`install-option${optionId === "local" ? " is-active" : ""}`}>
                <input
                  type="radio"
                  name="installOption"
                  checked={optionId === "local"}
                  onChange={() => setOptionId("local")}
                />
                <div className="install-option__main">
                  <div className="install-option__title">
                    <IconBox /> Local (vendored)
                  </div>
                  <div className="install-option__sub">
                    Snapshot copied into the workspace. No auto-update.
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div className="install-section">
            <div className="install-section__label">Will expose bins</div>
            {bins.length === 0 ? (
              <span className="muted small">No bins. Skill is invoked via SKILL.md trigger.</span>
            ) : (
              <div className="chip-list">
                {bins.map((b) => (
                  <span key={b} className="chip-item chip-item--bin">
                    <IconTerminal /> {b}
                  </span>
                ))}
              </div>
            )}
          </div>

          {hubDetail?.metadata?.systems?.length ? (
            <div className="install-section">
              <div className="install-section__label">Requires</div>
              <div className="chip-list">
                {hubDetail.metadata.systems.map((s) => (
                  <span key={s} className="chip-item chip-item--req">
                    <IconKey /> {s}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {phase === "running" ? (
            <div className="install-progress">
              <IconRefresh className="spin" />
              <div>
                Resolving manifest, fetching bins, validating signature…
                <div className="muted small">Hub mirror: hub.openclaw.io</div>
              </div>
            </div>
          ) : null}

          {phase === "error" ? (
            <div className="install-error">
              <IconAlert />
              <div>
                <strong>Install failed.</strong>
                <p>{errorMsg}</p>
              </div>
            </div>
          ) : null}

          {phase === "done" ? (
            <div className="install-done">
              <IconCheck />
              <div>
                <strong>Installed.</strong>
                <p>
                  {hubResult.displayName} v{hubDetail?.latestVersion?.version || hubResult.version}{" "}
                  is now available. Open the inventory to configure.
                </p>
              </div>
            </div>
          ) : null}
        </div>
        <div className="modal__foot">
          {phase === "done" ? (
            <button
              className="btn btn--primary"
              type="button"
              onClick={() => onInstalled(hubResult.slug)}
            >
              Open in inventory
            </button>
          ) : (
            <>
              <button className="btn btn--ghost" type="button" onClick={onClose}>
                {phase === "running" ? "Run in background" : "Cancel"}
              </button>
              <button
                className="btn btn--primary"
                type="button"
                disabled={phase === "running"}
                onClick={runInstall}
              >
                <IconDownload /> {phase === "error" ? "Retry install" : "Install"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── ConfigureSkillDialog ─────────────────────────────────────────────────

function ConfigureSkillDialog({ open, skill, onClose, onSave }) {
  const [draft, setDraft] = _dlgState({});
  const [saving, setSaving] = _dlgState(false);

  _dlgEffect(() => {
    if (open && skill) setDraft({ ...(skill.config || {}) });
  }, [open, skill]);

  if (!open || !skill) return null;

  const entries = Object.entries(draft);

  const setField = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const removeField = (k) => {
    setDraft((d) => {
      const next = { ...d };
      delete next[k];
      return next;
    });
  };
  const addField = () => {
    let i = 1;
    while (`newField${i}` in draft) i++;
    setField(`newField${i}`, "");
  };

  const save = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      onSave(draft);
    }, 600);
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal modal--configure"
        role="dialog"
        aria-modal="true"
        aria-label="Configure skill"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <div className="pill pill--info">
            <IconSettings /> <span>CONFIGURE</span>
          </div>
          <h3>{skill.name}</h3>
          <button className="icon-btn" type="button" aria-label="Close" onClick={onClose}>
            <IconX />
          </button>
        </div>
        <div className="modal__body">
          <p className="muted small">
            Edit per-skill configuration. Saved values land in the skill's config slice via{" "}
            <span className="kbd">PATCH /api/deck/skills/{skill.key}</span> →{" "}
            <span className="kbd">DeckGoSkillUpdateResponse</span>.
          </p>
          {entries.length === 0 ? (
            <div className="empty-block">No config entries yet. Add one below.</div>
          ) : (
            <div className="config-list">
              {entries.map(([k, v]) => (
                <div key={k} className="config-row">
                  <input
                    className="input input--mono"
                    type="text"
                    value={k}
                    onChange={(e) => {
                      const next = { ...draft };
                      delete next[k];
                      next[e.target.value] = v;
                      setDraft(next);
                    }}
                    aria-label="Key"
                  />
                  <input
                    className="input input--mono"
                    type="text"
                    value={typeof v === "object" ? JSON.stringify(v) : String(v)}
                    onChange={(e) => setField(k, e.target.value)}
                    aria-label="Value"
                  />
                  <button
                    className="icon-btn"
                    type="button"
                    aria-label={`Remove ${k}`}
                    onClick={() => removeField(k)}
                  >
                    <IconTrash />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button className="btn btn--ghost" type="button" onClick={addField}>
            + Add field
          </button>
        </div>
        <div className="modal__foot">
          <button className="btn btn--ghost" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn--primary" type="button" disabled={saving} onClick={save}>
            {saving ? <IconRefresh className="spin" /> : <IconCheck />} {saving ? "Saving" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DisableConfirmDialog ─────────────────────────────────────────────────

function DisableConfirmDialog({ open, skill, onCancel, onConfirm }) {
  if (!open || !skill) return null;
  const isManaged = skill.source === "managed";
  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal modal--confirm"
        role="dialog"
        aria-modal="true"
        aria-label="Disable skill"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <div className="pill pill--warn">
            <IconAlert /> <span>CONFIRM</span>
          </div>
          <h3>Disable {skill.name}?</h3>
          <button className="icon-btn" type="button" aria-label="Close" onClick={onCancel}>
            <IconX />
          </button>
        </div>
        <div className="modal__body">
          <p>
            {isManaged
              ? "Disable this skill in the inventory. Hub-managed bins will be removed from PATH on next session start."
              : "Disable this skill. Bundled or plugin-provided skills are not deleted, just toggled off."}
          </p>
          <p className="muted small">You can re-enable any skill from the inventory at any time.</p>
        </div>
        <div className="modal__foot">
          <button className="btn btn--ghost" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn--danger" type="button" onClick={onConfirm}>
            <IconX /> Disable
          </button>
        </div>
      </div>
    </div>
  );
}

// ── SkillReadmeDialog ────────────────────────────────────────────────────

function SkillReadmeDialog({ open, skill, files, onClose }) {
  if (!open || !skill) return null;
  const skillMd = files?.find((f) => f.path === "SKILL.md");
  const refs = (files || []).filter((f) => f.path !== "SKILL.md");
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal modal--readme"
        role="dialog"
        aria-modal="true"
        aria-label="Skill files"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <div className="pill pill--info">
            <IconBookOpen /> <span>FILES</span>
          </div>
          <h3>{skill.name}</h3>
          <button className="icon-btn" type="button" aria-label="Close" onClick={onClose}>
            <IconX />
          </button>
        </div>
        <div className="modal__body">
          <div className="files-table">
            {skillMd ? (
              <div className="files-row files-row--primary">
                <IconFile />
                <span className="mono">{skillMd.path}</span>
                <span className="muted small">{skillMd.bytes.toLocaleString()} bytes</span>
                <button className="icon-btn" type="button" aria-label="Open">
                  <IconExternal />
                </button>
              </div>
            ) : (
              <div className="empty-block">
                BFF projection of file inventory is unavailable for this skill.
              </div>
            )}
            {refs.map((f) => (
              <div key={f.path} className="files-row">
                <IconFile />
                <span className="mono">{f.path}</span>
                <span className="muted small">{f.bytes.toLocaleString()} bytes</span>
                <button className="icon-btn" type="button" aria-label="Open">
                  <IconExternal />
                </button>
              </div>
            ))}
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

Object.assign(window, {
  InstallFromHubDialog,
  ConfigureSkillDialog,
  DisableConfirmDialog,
  SkillReadmeDialog,
});
