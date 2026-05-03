// Full-width detail view: identity hero + tab bar + section content (7 sections).
const { useState: _dvState, useEffect: _dvEffect, useMemo: _dvMemo } = React;

const TABS = [
  { id: "overview", label: "Overview", icon: IconUser },
  { id: "skills", label: "Skills", icon: IconBolt },
  { id: "subagents", label: "Subagents", icon: IconUsers },
  { id: "tool-policy", label: "Tool policy", icon: IconShield },
  { id: "system-prompt", label: "System prompt", icon: IconBook },
  { id: "files", label: "Files", icon: IconFile },
  { id: "event-streams", label: "Event streams", icon: IconRadio },
];

function DetailView({ agent, detail, tweaks, setTweak, onBack, onDelete }) {
  const tab = tweaks.activeSection || "overview";
  const setTab = (id) => setTweak("activeSection", id);

  // Per-section editable drafts (mock-managed)
  const skillsBase = window.MOCK.skills;
  const subBase = window.MOCK.subagentConfig;
  const streamBase = window.MOCK.eventStreams;

  const [overview, setOverview] = _dvState({
    name: agent.name || "",
    model: detail?.model || agent.model || "",
    workspace: detail?.workspace || agent.workspace || "",
    emoji: agent.emoji || "",
    avatar: agent.avatar || "",
  });
  const [skillMode, setSkillMode] = _dvState(skillsBase.mode);
  const [skillKeys, setSkillKeys] = _dvState(skillsBase.skills);
  const [subAllowed, setSubAllowed] = _dvState(subBase.allowAgents);
  const [subModel, setSubModel] = _dvState(subBase.model || "");
  const [streamSubs, setStreamSubs] = _dvState(streamBase.eventStreams);
  const [openFile, setOpenFile] = _dvState("");
  const [fileBody, setFileBody] = _dvState("");
  const [fileDirty, setFileDirty] = _dvState(false);

  // Reset drafts when agent changes
  _dvEffect(() => {
    setOverview({
      name: agent.name || "",
      model: detail?.model || agent.model || "",
      workspace: detail?.workspace || agent.workspace || "",
      emoji: agent.emoji || "",
      avatar: agent.avatar || "",
    });
    setOpenFile("");
    setFileBody("");
    setFileDirty(false);
  }, [agent.id]);

  // Dirty calculations
  const ovDirty =
    tweaks.overviewDirty ||
    overview.name !== (agent.name || "") ||
    overview.model !== (detail?.model || agent.model || "") ||
    overview.workspace !== (detail?.workspace || agent.workspace || "") ||
    overview.emoji !== (agent.emoji || "");
  const skillDirty =
    skillMode !== skillsBase.mode || skillKeys.join(",") !== skillsBase.skills.join(",");
  const subDirty =
    subAllowed.join(",") !== subBase.allowAgents.join(",") || subModel !== (subBase.model || "");
  const streamDirty =
    [...streamSubs].sort().join(",") !== [...streamBase.eventStreams].sort().join(",");

  const dirtyMap = {
    overview: ovDirty,
    skills: skillDirty || tweaks.skillsConflict,
    subagents: subDirty,
    "event-streams": streamDirty,
    files: fileDirty,
  };
  const anyDirty = Object.values(dirtyMap).some(Boolean);

  // Section keyboard nav (1-7, j/k, Cmd+S)
  _dvEffect(() => {
    const h = (e) => {
      const isText =
        e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        /* save current section in real impl */ return;
      }
      if (isText) return;
      if (/^[1-7]$/.test(e.key)) {
        e.preventDefault();
        setTab(TABS[Number(e.key) - 1].id);
      } else if (e.key === "j") {
        e.preventDefault();
        const i = TABS.findIndex((t) => t.id === tab);
        setTab(TABS[(i + 1) % TABS.length].id);
      } else if (e.key === "k") {
        e.preventDefault();
        const i = TABS.findIndex((t) => t.id === tab);
        setTab(TABS[(i - 1 + TABS.length) % TABS.length].id);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [tab]);

  return (
    <div className="view">
      {/* Back link */}
      <button className="detail-back" onClick={onBack}>
        <IconArrowL size={12} /> Agents
      </button>

      {/* Identity hero */}
      <header className="detail-header">
        <div className="detail-identity">
          <span
            className={`detail-identity__avatar${agent.isDefault ? " detail-identity__avatar--accent" : ""}`}
          >
            {agent.emoji || (agent.name || agent.id || "?").slice(0, 1).toUpperCase()}
          </span>
          <div className="detail-identity__main">
            <h1 className="detail-identity__name">
              {agent.name || agent.id}
              {agent.isDefault ? <span className="tag tag--accent">default</span> : null}
              <span className={`pill pill--${agent.status || "offline"}`}>
                <span className="pill__dot" />
                {agent.status || "unknown"}
              </span>
            </h1>
            <div className="detail-identity__attrs">
              <span>{agent.id}</span>
              <span className="sep">·</span>
              <span>{detail?.model || agent.model || "no model"}</span>
              <span className="sep">·</span>
              <span>{detail?.workspace || agent.workspace || "/"}</span>
            </div>
            <div className="detail-identity__counts">
              <span>
                <strong>{detail?.sessionCount ?? agent.sessionCount ?? "—"}</strong>sessions
              </span>
              <span>
                <strong>{detail?.bindingCount ?? agent.bindingCount ?? "—"}</strong>bindings
              </span>
              {detail ? (
                <span>
                  <strong>{detail.activeSubagentCount}</strong>active subagents
                </span>
              ) : null}
              {detail ? (
                <span>
                  <strong>
                    {detail.effectiveSkills.length}/{detail.totalAvailableSkills}
                  </strong>
                  skills
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="detail-actions">
          <button className="btn btn--danger" onClick={onDelete}>
            <IconTrash /> Delete
          </button>
        </div>
      </header>

      {/* Dirty banner */}
      {anyDirty ? (
        <div className="banner banner--info" style={{ marginBottom: 16 }}>
          <span
            style={{
              display: "inline-block",
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "var(--ds-warn)",
            }}
          />
          <span>
            <strong style={{ color: "var(--ds-text-1)" }}>Unsaved changes</strong> in{" "}
            {Object.entries(dirtyMap)
              .filter(([, v]) => v)
              .map(([k]) => TABS.find((t) => t.id === k)?.label)
              .join(", ")}
            .
          </span>
          <span className="banner__action mono">⌘S to save current section</span>
        </div>
      ) : null}

      {/* Tab bar */}
      <nav className="tabs" role="tablist" aria-label="Agent configuration">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`tab${tab === t.id ? " is-active" : ""}${dirtyMap[t.id] ? " has-dirty" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <span className="tab__num">{i + 1}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {/* Section content */}
      <div className="detail-body">
        {tweaks.detailState === "loading" ? (
          <SectionLoading />
        ) : tweaks.detailState === "error" ? (
          <SectionError />
        ) : tab === "overview" ? (
          <OverviewSection
            detail={detail}
            draft={overview}
            setDraft={setOverview}
            dirty={ovDirty}
          />
        ) : tab === "skills" ? (
          <SkillsSection
            data={skillsBase}
            mode={skillMode}
            setMode={setSkillMode}
            keys={skillKeys}
            setKeys={setSkillKeys}
            dirty={skillDirty}
            conflict={tweaks.skillsConflict}
          />
        ) : tab === "subagents" ? (
          <SubagentsSection
            data={subBase}
            allowed={subAllowed}
            setAllowed={setSubAllowed}
            model={subModel}
            setModel={setSubModel}
            dirty={subDirty}
          />
        ) : tab === "tool-policy" ? (
          <ToolPolicySection data={window.MOCK.toolPolicy} />
        ) : tab === "system-prompt" ? (
          <SystemPromptSection data={window.MOCK.systemPrompt} />
        ) : tab === "files" ? (
          <FilesSection
            files={window.MOCK.files.files}
            openName={openFile}
            setOpenName={(n) => {
              setOpenFile(n);
              setFileBody(window.MOCK.fileContent[n] || "");
              setFileDirty(false);
            }}
            body={fileBody}
            setBody={(b) => {
              setFileBody(b);
              setFileDirty(true);
            }}
            dirty={fileDirty}
          />
        ) : tab === "event-streams" ? (
          <StreamsSection
            data={streamBase}
            subs={streamSubs}
            setSubs={setStreamSubs}
            dirty={streamDirty}
          />
        ) : null}
      </div>
    </div>
  );
}

// ── Loading / error ───────────────────────────────────────────────────────

function SectionLoading() {
  return (
    <div className="list-loading">
      <div className="skeleton" style={{ height: 100 }} />
      <div className="skeleton" style={{ height: 60 }} />
    </div>
  );
}
function SectionError() {
  return (
    <div className="banner banner--error">
      <IconX />
      <div>
        <span className="banner__title">Could not load section data</span>
        <span className="mono" style={{ display: "block", marginTop: 2 }}>
          fetchAgentDetail / fetchAgentSkills timed out
        </span>
      </div>
      <button className="btn banner__action">Retry</button>
    </div>
  );
}

// ── Section: Overview ─────────────────────────────────────────────────────

function OverviewSection({ detail, draft, setDraft, dirty }) {
  const set = (patch) => setDraft({ ...draft, ...patch });
  return (
    <>
      <section className="detail-section">
        <div className="section-title">
          <h2>Identity</h2>
          <span className="section-title__hint">backend-supported fields</span>
        </div>
        <p className="section-help">
          Mirror of the Gateway{" "}
          <code style={{ fontFamily: "var(--ds-font-mono)" }}>AgentsUpdateParams</code> contract.
          Empty model means inherit from default.
        </p>

        <div className="field-grid">
          <div className="field">
            <label className="field__label">Name</label>
            <input
              className="input"
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="field__label">Model</label>
            <input
              className="input"
              value={draft.model}
              onChange={(e) => set({ model: e.target.value })}
              placeholder="e.g. gpt-5.4 / sonnet-4.6"
            />
          </div>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label className="field__label">Workspace</label>
            <input
              className="input"
              value={draft.workspace}
              onChange={(e) => set({ workspace: e.target.value })}
              placeholder="/workspace"
            />
            <span className="field__hint">
              Absolute path. Used to resolve AGENTS.md, CLAUDE.md, and bootstrap files.
            </span>
          </div>
          <div className="field">
            <label className="field__label">Emoji</label>
            <input
              className="input"
              value={draft.emoji}
              onChange={(e) => set({ emoji: e.target.value })}
              placeholder="optional"
            />
          </div>
          <div className="field">
            <label className="field__label">Avatar URL</label>
            <input
              className="input"
              value={draft.avatar}
              onChange={(e) => set({ avatar: e.target.value })}
              placeholder="optional https://…"
            />
          </div>
        </div>

        <div className="section-footer">
          <span className="section-footer__hash">
            {detail ? `identity ${detail.identityExists ? "exists" : "missing"}` : ""}
          </span>
          <div className="section-footer__actions">
            <button className="btn">Reset</button>
            <button className="btn btn--primary" disabled={!dirty}>
              Save changes
            </button>
          </div>
        </div>
      </section>

      <section className="detail-section">
        <div className="section-title">
          <h2>Runtime summary</h2>
          <span className="section-title__hint">read-only · derived</span>
        </div>
        <div className="summary-strip">
          {detail ? (
            <>
              <span className="tag">skill mode: {detail.skillMode}</span>
              <span className="tag">
                {detail.effectiveSkills.length}/{detail.totalAvailableSkills} skills
              </span>
              <span className="tag">{detail.subagents.allowAgents.length} allowed subagents</span>
              <span className="tag">spawn depth ≤ {detail.subagents.effectiveMaxSpawnDepth}</span>
              <span className="tag">
                ≤ {detail.subagents.effectiveMaxChildrenPerAgent} children/agent
              </span>
              {detail.subagents.model ? (
                <span className="tag tag--accent">subagent model: {detail.subagents.model}</span>
              ) : null}
              {detail.fallbackModels?.length ? (
                <span className="tag">fallbacks: {detail.fallbackModels.join(", ")}</span>
              ) : null}
            </>
          ) : (
            <span className="tag">no detail loaded</span>
          )}
        </div>
      </section>
    </>
  );
}

// ── Section: Skills ───────────────────────────────────────────────────────

function SkillsSection({ data, mode, setMode, keys, setKeys, dirty, conflict }) {
  const toggle = (key) =>
    setKeys(keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]);

  return (
    <>
      {conflict ? (
        <div className="banner banner--warn">
          <span className="banner__title">Hash conflict</span>
          <span>Backend returned 409 — config has changed since load. Reload to merge.</span>
          <button className="btn banner__action">Reload</button>
        </div>
      ) : null}

      <section className="detail-section">
        <div className="section-title">
          <h2>Skill mode</h2>
        </div>
        <p className="section-help">
          <strong style={{ color: "var(--ds-text-1)" }}>All</strong> grants every available skill;
          <strong style={{ color: "var(--ds-text-1)" }}> Whitelist</strong> restricts to the
          explicit list below.
        </p>
        <div className="segmented" style={{ alignSelf: "flex-start" }}>
          <button className={mode === "all" ? "is-active" : ""} onClick={() => setMode("all")}>
            All
          </button>
          <button
            className={mode === "whitelist" ? "is-active" : ""}
            onClick={() => setMode("whitelist")}
          >
            Whitelist
          </button>
        </div>
      </section>

      <section className="detail-section">
        <div className="section-title">
          <h2>
            Available skills{" "}
            <span className="section-title__hint">{data.available.length} total</span>
          </h2>
        </div>
        <div className="option-list">
          {data.available.map((skill) => {
            const enabled = keys.includes(skill.key);
            const disabled = !skill.eligible || mode !== "whitelist";
            return (
              <div
                key={skill.key}
                className={`option-row${disabled && !enabled ? " option-row--disabled" : ""}`}
              >
                <div className="option-row__main">
                  <div className="option-row__title">{skill.name}</div>
                  <div className="option-row__meta">
                    {skill.key}
                    {!skill.eligible ? " · not eligible for this agent" : ""}
                  </div>
                </div>
                <span className={`tag${enabled ? " tag--ok" : ""}`}>
                  {enabled ? "enabled" : "disabled"}
                </span>
                <Toggle
                  on={enabled}
                  disabled={disabled}
                  onClick={() => toggle(skill.key)}
                  label={`Toggle ${skill.name}`}
                />
              </div>
            );
          })}
        </div>

        <div className="section-footer">
          <span className="section-footer__hash">configHash: {data.configHash}</span>
          <div className="section-footer__actions">
            <button className="btn">Reload</button>
            <button className="btn btn--primary" disabled={!dirty}>
              Save changes
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

// ── Section: Subagents ────────────────────────────────────────────────────

function SubagentsSection({ data, allowed, setAllowed, model, setModel, dirty }) {
  const toggle = (id) =>
    setAllowed(allowed.includes(id) ? allowed.filter((a) => a !== id) : [...allowed, id]);

  return (
    <>
      <section className="detail-section">
        <div className="section-title">
          <h2>Delegation policy</h2>
          <span className="section-title__hint">
            spawn depth ≤ {data.effectiveMaxSpawnDepth} · ≤ {data.effectiveMaxChildrenPerAgent}{" "}
            children
          </span>
        </div>
        <div className="field-grid">
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label className="field__label">Subagent model</label>
            <input
              className="input"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="leave empty to inherit from parent"
            />
            <span className="field__hint">
              Model used when this agent spawns subagents. Empty = inherit.
            </span>
          </div>
        </div>
      </section>

      <section className="detail-section">
        <div className="section-title">
          <h2>
            Allow list{" "}
            <span className="section-title__hint">
              {allowed.length} of {data.allAgents.length} allowed
            </span>
          </h2>
        </div>
        <div className="option-list">
          {data.allAgents.map((id) => {
            const isAllowed = allowed.includes(id);
            return (
              <div key={id} className="option-row">
                <div className="option-row__main">
                  <div className="option-row__title">{id}</div>
                  <div className="option-row__meta">agent · can be spawned as subagent</div>
                </div>
                <span className={`tag${isAllowed ? " tag--ok" : ""}`}>
                  {isAllowed ? "allowed" : "denied"}
                </span>
                <Toggle on={isAllowed} onClick={() => toggle(id)} label={`Toggle ${id}`} />
              </div>
            );
          })}
        </div>

        <div className="section-footer">
          <span className="section-footer__hash">configHash: {data.configHash}</span>
          <div className="section-footer__actions">
            <button className="btn">Reload</button>
            <button className="btn btn--primary" disabled={!dirty}>
              Save changes
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

// ── Section: Tool policy (read-only) ──────────────────────────────────────

function ToolPolicySection({ data }) {
  return (
    <>
      <section className="detail-section">
        <div className="section-title">
          <h2>Policy layers</h2>
          <span className="section-title__hint">resolved bottom-up</span>
        </div>
        <p className="section-help">
          Each layer can override the previous. Tool decision uses the highest layer that touched
          the rule.
        </p>
        <div className="preview-list">
          {data.layers.map((layer, i) => (
            <div key={layer.label} className="preview-row">
              <div className="preview-row__main">
                <span className="preview-row__title">
                  <span
                    style={{
                      display: "inline-grid",
                      placeItems: "center",
                      width: 18,
                      height: 18,
                      marginRight: 8,
                      borderRadius: 4,
                      background: "var(--ds-bg-2)",
                      color: "var(--ds-text-3)",
                      fontFamily: "var(--ds-font-mono)",
                      fontSize: 10,
                      fontWeight: 600,
                      verticalAlign: "middle",
                    }}
                  >
                    {i + 1}
                  </span>
                  {layer.label}
                </span>
                <span className="preview-row__source">{layer.effect}</span>
              </div>
              <span className="preview-row__metric">
                {layer.ruleCount} rule{layer.ruleCount === 1 ? "" : "s"}
              </span>
            </div>
          ))}
        </div>
        <div className="section-footer">
          <span className="section-footer__hash">read-only · computed at runtime</span>
          <div className="section-footer__actions">
            <button className="btn">
              <IconRefresh /> Recompute
            </button>
          </div>
        </div>
      </section>

      <section className="detail-section">
        <div className="section-title">
          <h2>Effective tools</h2>
          <span className="section-title__hint">
            {data.tools.filter((t) => t.allowed).length}/{data.tools.length} allowed
          </span>
        </div>
        <div className="preview-list">
          {data.tools.map((tool) => (
            <div key={tool.name} className="preview-row">
              <div className="preview-row__main">
                <span className="preview-row__title">{tool.name}</span>
                {tool.decisiveLayer ? (
                  <span className="preview-row__source">decided by {tool.decisiveLayer}</span>
                ) : null}
              </div>
              <span className={`tag ${tool.allowed ? "tag--ok" : "tag--err"}`}>
                {tool.allowed ? "allowed" : "denied"}
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

// ── Section: System prompt (read-only) ────────────────────────────────────

function SystemPromptSection({ data }) {
  return (
    <>
      <section className="detail-section">
        <div className="section-title">
          <h2>Composition</h2>
          <span className="section-title__hint">
            {data.totalChars?.toLocaleString()} chars total
          </span>
        </div>
        <p className="section-help">
          Layers are concatenated into the system prompt sent to the model. Edit source files in the
          Files tab.
        </p>
        <div className="preview-list">
          {data.layers.map((layer, i) => (
            <div key={`${layer.label}-${layer.source}`} className="preview-row">
              <div className="preview-row__main">
                <span className="preview-row__title">
                  <span
                    style={{
                      display: "inline-grid",
                      placeItems: "center",
                      width: 18,
                      height: 18,
                      marginRight: 8,
                      borderRadius: 4,
                      background: "var(--ds-bg-2)",
                      color: "var(--ds-text-3)",
                      fontFamily: "var(--ds-font-mono)",
                      fontSize: 10,
                      fontWeight: 600,
                      verticalAlign: "middle",
                    }}
                  >
                    {i + 1}
                  </span>
                  {layer.label}
                </span>
                <span className="preview-row__source">{layer.source}</span>
              </div>
              <span className="preview-row__metric">
                {layer.charCount.toLocaleString()} chars
                {layer.fileCount > 0
                  ? ` · ${layer.fileCount} file${layer.fileCount === 1 ? "" : "s"}`
                  : ""}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="detail-section">
        <div className="section-title">
          <h2>Bootstrap files</h2>
          <span className="section-title__hint">discovered at startup</span>
        </div>
        <div className="preview-list">
          {data.bootstrapFiles.map((file) => (
            <div key={file.name} className="preview-row">
              <div className="preview-row__main">
                <span className="preview-row__title">
                  <IconFile
                    size={13}
                    style={{ verticalAlign: "middle", marginRight: 6, color: "var(--ds-text-4)" }}
                  />
                  {file.name}
                </span>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span className={`tag ${file.exists ? "tag--ok" : "tag--warn"}`}>
                  {file.exists ? "found" : "not found"}
                </span>
                <span className="preview-row__metric">
                  {file.charCount > 0 ? `${file.charCount.toLocaleString()} chars` : "—"}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="section-footer">
          <span className="section-footer__hash">configHash: {data.configHash}</span>
          <div className="section-footer__actions">
            <button className="btn">
              <IconRefresh /> Recompute
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

// ── Section: Files ────────────────────────────────────────────────────────

function FilesSection({ files, openName, setOpenName, body, setBody, dirty }) {
  const formatSize = (n) => (n ? (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`) : "—");

  return (
    <section className="detail-section">
      <div className="section-title">
        <h2>Workspace files</h2>
        <span className="section-title__hint">
          {files.length} file{files.length === 1 ? "" : "s"} · /workspace
        </span>
      </div>
      <p className="section-help">
        AGENTS.md, CLAUDE.md, and other bootstrap files in this agent's workspace. Editing here
        writes through to the filesystem on save.
      </p>

      <div className="files-layout">
        <div className="files-list">
          {files.length === 0 ? (
            <div className="list-empty" style={{ padding: "32px 16px" }}>
              <p>No files in workspace.</p>
            </div>
          ) : (
            files.map((f) => (
              <button
                key={f.name}
                className={`file-row${openName === f.name ? " is-active" : ""}`}
                onClick={() => setOpenName(f.name)}
              >
                <IconFile className="file-row__icon" />
                <span className="file-row__name">{f.name}</span>
                <span className="file-row__size">{formatSize(f.size)}</span>
              </button>
            ))
          )}
        </div>

        <div className="file-editor">
          {openName ? (
            <>
              <div className="file-editor__header">
                <span className="file-editor__name">{openName}</span>
                {dirty ? (
                  <span className="tag tag--warn">modified</span>
                ) : (
                  <span className="tag">saved</span>
                )}
              </div>
              <textarea
                className="file-editor__textarea"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                spellCheck={false}
              />
            </>
          ) : (
            <div className="file-editor__empty">
              <span>Select a file to view and edit.</span>
            </div>
          )}
        </div>
      </div>

      <div className="section-footer">
        <span className="section-footer__hash">
          {openName ? `editing ${openName}` : "no file open"}
        </span>
        <div className="section-footer__actions">
          <button className="btn">Reload</button>
          <button className="btn btn--primary" disabled={!dirty}>
            Save file
          </button>
        </div>
      </div>
    </section>
  );
}

// ── Section: Event streams ────────────────────────────────────────────────

function StreamsSection({ data, subs, setSubs, dirty }) {
  const allOptions = Array.from(
    new Set([...window.MOCK.streamOptions, ...subs, ...data.eventStreams]),
  );
  const toggle = (id) => setSubs(subs.includes(id) ? subs.filter((s) => s !== id) : [...subs, id]);

  return (
    <section className="detail-section">
      <div className="section-title">
        <h2>SSE subscriptions</h2>
        <span className="section-title__hint">
          {subs.length} of {allOptions.length} subscribed
        </span>
      </div>
      <p className="section-help">
        Declared event streams the runtime publishes for this agent. Unknown event names are
        accepted and forwarded as-is.
      </p>

      <div className="option-list">
        {allOptions.map((opt) => {
          const subscribed = subs.includes(opt);
          return (
            <div key={opt} className="option-row">
              <div className="option-row__main">
                <div className="option-row__title">{opt}</div>
                <div className="option-row__meta">SSE · activity / status</div>
              </div>
              <span className={`tag${subscribed ? " tag--ok" : ""}`}>
                {subscribed ? "subscribed" : "off"}
              </span>
              <Toggle on={subscribed} onClick={() => toggle(opt)} label={`Toggle ${opt}`} />
            </div>
          );
        })}
      </div>

      <div className="section-footer">
        <span className="section-footer__hash">configHash: {data.configHash}</span>
        <div className="section-footer__actions">
          <button className="btn">Reload</button>
          <button className="btn btn--primary" disabled={!dirty}>
            Save changes
          </button>
        </div>
      </div>
    </section>
  );
}

// ── Toggle primitive ──────────────────────────────────────────────────────

function Toggle({ on, disabled, onClick, label }) {
  return (
    <button
      className={`toggle${on ? " toggle--on" : ""}${disabled ? " toggle--disabled" : ""}`}
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="toggle__thumb" />
    </button>
  );
}

Object.assign(window, { DetailView, TABS, Toggle });
