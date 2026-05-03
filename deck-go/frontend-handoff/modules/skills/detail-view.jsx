// skills — Detail view
//
// Hero (skill emoji glyph + name + status + source + actions) + 6 tabs:
//   1. Overview  — identity, description, primary env, homepage
//   2. Setup     — missingRequirements with pre-flight checklist
//   3. Triggers  — BFF-projected keyword triggers
//   4. Bins      — install-option bins (terminal commands exposed)
//   5. Files     — SKILL.md + reference files (BFF projection)
//   6. Audit     — install / update / disable timeline (BFF projection)

const { useMemo: _dvMemo } = React;

const SKILL_TABS = [
  { id: "overview", label: "Overview" },
  { id: "setup", label: "Setup" },
  { id: "triggers", label: "Triggers" },
  { id: "bins", label: "Bins" },
  { id: "files", label: "Files" },
  { id: "audit", label: "Audit" },
];

function fmtClock(ms) {
  return ms ? new Date(ms).toLocaleTimeString() : "—";
}
function fmtDate(ms) {
  return ms ? new Date(ms).toLocaleDateString() : "—";
}

function DetailHero({ skill, onBack, onConfigure, onDisable, onEnable, onOpenFiles }) {
  return (
    <div className="hero">
      <button className="back-btn" type="button" onClick={onBack} aria-label="Back to list">
        <IconChevronLeft /> <span>Skills</span>
      </button>
      <div className="hero__main">
        <SkillGlyph skill={skill} size={56} />
        <div className="hero__title-stack">
          <div className="hero__title-row">
            <h1>{skill.name}</h1>
            <span className={`pill pill--${skillStatusPillClass(skill)}`}>
              {skill.status === "ready" ? <IconCheck /> : null}
              {skill.status === "needs-setup" ? <IconAlert /> : null}
              {skill.status === "disabled" ? <IconX /> : null}
              <span>{skillStatusLabel(skill)}</span>
            </span>
            <SkillSourcePill source={skill.source} />
          </div>
          <div className="hero__meta">
            <span className="kbd">{skill.key}</span>
            {skill.primaryEnv ? (
              <>
                <span className="muted">·</span>
                <span className="env-tag">
                  <IconKey /> {skill.primaryEnv}
                </span>
              </>
            ) : null}
            {skill.homepage ? (
              <>
                <span className="muted">·</span>
                <a className="ext-link" href={skill.homepage} target="_blank" rel="noreferrer">
                  <IconExternal /> homepage
                </a>
              </>
            ) : null}
          </div>
        </div>
      </div>
      <div className="hero__actions">
        <button className="btn btn--ghost" type="button" onClick={onOpenFiles}>
          <IconFile /> Files
        </button>
        <button className="btn btn--ghost" type="button" onClick={onConfigure}>
          <IconSettings /> Configure
        </button>
        {skill.enabled ? (
          <button className="btn btn--danger-ghost" type="button" onClick={onDisable}>
            <IconX /> Disable
          </button>
        ) : (
          <button className="btn btn--primary" type="button" onClick={onEnable}>
            <IconCheck /> Enable
          </button>
        )}
      </div>
    </div>
  );
}

function TabsBar({ activeTab, onTab }) {
  return (
    <div className="tabs" role="tablist" aria-label="Skill sections">
      {SKILL_TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={activeTab === t.id}
          className={`tab${activeTab === t.id ? " tab--active" : ""}`}
          onClick={() => onTab(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function FieldRow({ label, value, mono, muted }) {
  return (
    <div className="field-row">
      <div className="field-row__label">{label}</div>
      <div className={`field-row__value${mono ? " mono" : ""}${muted ? " muted" : ""}`}>
        {value == null || value === "" ? <span className="muted">—</span> : value}
      </div>
    </div>
  );
}

function TabOverview({ skill }) {
  return (
    <div className="section">
      <div className="section__head">
        <h2>Identity</h2>
      </div>
      <div className="field-grid">
        <FieldRow label="Key" value={skill.key} mono />
        <FieldRow label="Name" value={skill.name} />
        <FieldRow label="Source" value={<SkillSourcePill source={skill.source} />} />
        <FieldRow label="Status" value={skillStatusLabel(skill)} />
        <FieldRow
          label="Enabled"
          value={
            <span className={`pill pill--${skill.enabled ? "ok" : "muted"}`}>
              {skill.enabled ? <IconCheck /> : <IconX />}
              <span>{skill.enabled ? "Yes" : "No"}</span>
            </span>
          }
        />
      </div>
      <div className="section__head">
        <h2>Description</h2>
      </div>
      <p className="prose">{skill.description || "(no description)"}</p>
      <div className="section__head">
        <h2>Links &amp; environment</h2>
      </div>
      <div className="field-grid">
        <FieldRow
          label="Homepage"
          value={
            skill.homepage ? (
              <a className="ext-link" href={skill.homepage} target="_blank" rel="noreferrer">
                <IconExternal /> {skill.homepage}
              </a>
            ) : null
          }
        />
        <FieldRow
          label="Primary env"
          value={skill.primaryEnv ? <code className="mono">{skill.primaryEnv}</code> : null}
        />
        <FieldRow
          label="Config keys"
          value={
            Object.keys(skill.config || {}).length === 0 ? null : (
              <div className="chip-list">
                {Object.keys(skill.config).map((k) => (
                  <span key={k} className="chip-item chip-item--cfg">
                    <IconSettings /> {k}
                  </span>
                ))}
              </div>
            )
          }
        />
      </div>
    </div>
  );
}

function TabSetup({ skill, onConfigure }) {
  const reqs = skill.missingRequirements || [];
  if (reqs.length === 0 && skill.status === "ready") {
    return (
      <div className="section">
        <div className="empty-block empty-block--ok">
          <IconCheck /> <strong>Setup complete.</strong>
          <p>All requirements are satisfied. Skill is ready to use.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="section">
      <div className="section__head">
        <h2>Pre-flight requirements</h2>
        <span className="muted small">{reqs.length} unmet</span>
      </div>
      {reqs.length === 0 ? (
        <div className="banner banner--muted">
          <IconInfo />
          <div>
            <strong>No specific requirements reported.</strong>
            <p>Skill is currently disabled but no missing dependencies were flagged.</p>
          </div>
        </div>
      ) : (
        <div className="checklist">
          {reqs.map((req, i) => (
            <div key={i} className="checklist__row checklist__row--unmet">
              <span className="checklist__bullet">
                <IconAlert />
              </span>
              <div className="checklist__main">
                <div className="checklist__msg">{req}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {skill.primaryEnv ? (
        <div className="banner banner--info">
          <IconKey />
          <div>
            <strong>
              Primary env: <code className="mono">{skill.primaryEnv}</code>
            </strong>
            <p>
              Set this environment variable, then re-run setup. The skill will rescan and flip to{" "}
              <span className="kbd">ready</span> on next sync.
            </p>
          </div>
        </div>
      ) : null}
      <div className="setup-actions">
        <button className="btn btn--primary" type="button" onClick={onConfigure}>
          <IconSettings /> Configure now
        </button>
      </div>
    </div>
  );
}

function TabTriggers({ skill, triggers }) {
  if (!triggers || triggers.length === 0) {
    return (
      <div className="section">
        <div className="empty-block">
          <IconHash /> No trigger projection available for this skill yet.
        </div>
      </div>
    );
  }
  return (
    <div className="section">
      <div className="section__head">
        <h2>Trigger keywords</h2>
        <span className="muted small">BFF projection from SKILL.md frontmatter</span>
      </div>
      <p className="muted small">
        These are matched (case-insensitive, substring) against user input to auto-invoke{" "}
        <span className="kbd">{skill.name}</span>.
      </p>
      <div className="trigger-grid">
        {triggers.map((t) => (
          <span key={t} className="trigger-chip">
            <IconHash /> {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function TabBins({ skill }) {
  const opts = skill.installOptions || [];
  if (opts.length === 0) {
    return (
      <div className="section">
        <div className="empty-block">
          <IconTerminal /> This skill exposes no bins. It is invoked via SKILL.md trigger only.
        </div>
      </div>
    );
  }
  return (
    <div className="section">
      <div className="section__head">
        <h2>Install options &amp; bins</h2>
        <span className="muted small">
          {opts.length} option{opts.length === 1 ? "" : "s"}
        </span>
      </div>
      {opts.map((opt) => (
        <div key={opt.id} className="install-option-card">
          <div className="install-option-card__head">
            <div className="install-option-card__title">
              {opt.id === "managed" ? <IconCloud /> : <IconBox />}
              <span>{opt.label}</span>
            </div>
            <span className="kbd">{opt.id}</span>
          </div>
          {opt.bins.length === 0 ? (
            <div className="muted small">No bins for this option.</div>
          ) : (
            <div className="chip-list">
              {opt.bins.map((b) => (
                <span key={b} className="chip-item chip-item--bin">
                  <IconTerminal /> {b}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TabFiles({ files, onOpen }) {
  if (!files || files.length === 0) {
    return (
      <div className="section">
        <div className="empty-block">
          <IconFile /> File inventory projection is unavailable for this skill yet.
        </div>
      </div>
    );
  }
  const skillMd = files.find((f) => f.path === "SKILL.md");
  const refs = files.filter((f) => f.path !== "SKILL.md");
  return (
    <div className="section">
      <div className="section__head">
        <h2>Files</h2>
        <button className="btn btn--ghost" type="button" onClick={onOpen}>
          <IconExternal /> Open all
        </button>
      </div>
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
        ) : null}
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
  );
}

function TabAudit({ audit }) {
  if (!audit || audit.length === 0) {
    return (
      <div className="section">
        <div className="empty-block">
          <IconClock /> No audit projected for this skill yet.
        </div>
      </div>
    );
  }
  const sorted = [...audit].sort((a, b) => b.ts - a.ts);
  return (
    <div className="section">
      <div className="section__head">
        <h2>Audit timeline</h2>
        <span className="muted small">
          {audit.length} event{audit.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="timeline">
        {sorted.map((ev, i) => (
          <div key={i} className={`timeline__row timeline__row--${ev.action}`}>
            <div className="timeline__dot" />
            <div className="timeline__main">
              <div className="timeline__title">
                <span className={`event-pill event-pill--${ev.action}`}>{ev.action}</span>
                <span className="muted small">{ev.actor}</span>
              </div>
              <div className="timeline__note">{ev.note}</div>
            </div>
            <div className="timeline__ts">
              <div className="mono">{fmtClock(ev.ts)}</div>
              <div className="muted small">{fmtDate(ev.ts)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailView({
  skill,
  triggers,
  files,
  audit,
  tweaks,
  setTweak,
  onBack,
  onConfigure,
  onDisable,
  onEnable,
  onOpenFiles,
}) {
  if (tweaks.detailState === "loading") {
    return (
      <div className="detail">
        <DetailHero
          skill={skill}
          onBack={onBack}
          onConfigure={onConfigure}
          onDisable={onDisable}
          onEnable={onEnable}
          onOpenFiles={onOpenFiles}
        />
        <div className="list-state list-state--loading">
          <IconRefresh className="spin" />
          <div>Loading skill detail…</div>
        </div>
      </div>
    );
  }
  if (tweaks.detailState === "error") {
    return (
      <div className="detail">
        <DetailHero
          skill={skill}
          onBack={onBack}
          onConfigure={onConfigure}
          onDisable={onDisable}
          onEnable={onEnable}
          onOpenFiles={onOpenFiles}
        />
        <div className="list-state list-state--error">
          <IconAlert />
          <div>
            <strong>Failed to load detail.</strong>
            <p>BFF projection unavailable. Inventory row still cached.</p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="detail">
      <DetailHero
        skill={skill}
        onBack={onBack}
        onConfigure={onConfigure}
        onDisable={onDisable}
        onEnable={onEnable}
        onOpenFiles={onOpenFiles}
      />
      <TabsBar activeTab={tweaks.activeTab} onTab={(v) => setTweak("activeTab", v)} />
      <div className="detail__body">
        {tweaks.activeTab === "overview" ? <TabOverview skill={skill} /> : null}
        {tweaks.activeTab === "setup" ? <TabSetup skill={skill} onConfigure={onConfigure} /> : null}
        {tweaks.activeTab === "triggers" ? <TabTriggers skill={skill} triggers={triggers} /> : null}
        {tweaks.activeTab === "bins" ? <TabBins skill={skill} /> : null}
        {tweaks.activeTab === "files" ? <TabFiles files={files} onOpen={onOpenFiles} /> : null}
        {tweaks.activeTab === "audit" ? <TabAudit audit={audit} /> : null}
      </div>
    </div>
  );
}

Object.assign(window, {
  DetailView,
  DetailHero,
  TabsBar,
  TabOverview,
  TabSetup,
  TabTriggers,
  TabBins,
  TabFiles,
  TabAudit,
  SKILL_TABS,
});
