// subagents — Detail view
//
// Hero (child agent glyph + name + parent + status + actions: Steer, Kill, Outcome) + 6 tabs:
//   1. Overview  — runId, parent + child identity, model, depth, spawnMode, timestamps
//   2. Lineage   — tree view of root sessionKey → all descendants (this run highlighted)
//   3. Outcome   — final outcome JSON, formatted
//   4. Permissions — read-only view of parent agent's allowAgents config (with link to edit)
//   5. Audit     — kill / steer / spawn / status events (BFF projection)
//   6. Raw       — entire DeckGoSubagentRun JSON

const { useMemo: _dvMemo } = React;

const SUBAGENT_TABS = [
  { id: "overview", label: "Overview" },
  { id: "lineage", label: "Lineage" },
  { id: "outcome", label: "Outcome" },
  { id: "permissions", label: "Permissions" },
  { id: "audit", label: "Audit" },
  { id: "raw", label: "Raw" },
];

function fmtClock(ms) {
  return ms ? new Date(ms).toLocaleTimeString() : "—";
}
function fmtDate(ms) {
  return ms ? new Date(ms).toLocaleDateString() : "—";
}

function DetailHero({ run, onBack, onSteer, onKill, onViewOutcome }) {
  const live = run.status === "running" || run.status === "stalled";
  return (
    <div className="hero">
      <button className="back-btn" type="button" onClick={onBack} aria-label="Back to list">
        <IconChevronLeft /> <span>Subagents</span>
      </button>
      <div className="hero__main">
        <AgentGlyph agentId={run.childAgentId} agentName={run.childAgentName} size={56} />
        <div className="hero__title-stack">
          <div className="hero__title-row">
            <h1>{run.childAgentName || run.childAgentId}</h1>
            <span className={`pill pill--${runStatusPillClass(run.status)}`}>
              {run.status === "succeeded" ? <IconCheck /> : null}
              {run.status === "failed" ? <IconX /> : null}
              {run.status === "killed" ? <IconStop /> : null}
              {run.status === "running" ? <IconActivity /> : null}
              {run.status === "stalled" ? <IconAlert /> : null}
              <span>{run.status}</span>
            </span>
            <span className={`mode-pill mode-pill--${run.spawnMode}`}>{run.spawnMode}</span>
            {run.depth > 1 ? (
              <span className="meta-pill meta-pill--depth">depth {run.depth}</span>
            ) : null}
          </div>
          <div className="hero__meta">
            <span className="kbd">{run.runId}</span>
            <span className="muted">·</span>
            <span className="parent-row">
              <AgentGlyph
                agentId={run.requesterAgentId}
                agentName={run.requesterAgentName}
                size={18}
              />
              <span>spawned by {run.requesterAgentName || run.requesterAgentId}</span>
            </span>
            {run.task ? (
              <>
                <span className="muted">·</span>
                <span className="hero__task" title={run.task}>
                  {run.task}
                </span>
              </>
            ) : null}
          </div>
        </div>
      </div>
      <div className="hero__actions">
        {live ? (
          <button className="btn btn--ghost" type="button" onClick={onSteer}>
            <IconTarget /> Steer
          </button>
        ) : null}
        {live ? (
          <button className="btn btn--danger-ghost" type="button" onClick={onKill}>
            <IconStop /> Kill
          </button>
        ) : null}
        <button className="btn btn--ghost" type="button" onClick={onViewOutcome}>
          <IconCode /> Raw
        </button>
      </div>
    </div>
  );
}

function TabsBar({ activeTab, onTab }) {
  return (
    <div className="tabs" role="tablist" aria-label="Run sections">
      {SUBAGENT_TABS.map((t) => (
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

function TabOverview({ run }) {
  return (
    <div className="section">
      <div className="section__head">
        <h2>Identity</h2>
      </div>
      <div className="field-grid">
        <FieldRow label="Run id" value={run.runId} mono />
        <FieldRow label="Child session" value={run.childSessionKey} mono />
        <FieldRow label="Child agent" value={run.childAgentName || run.childAgentId} />
        <FieldRow label="Requester session" value={run.requesterSessionKey} mono />
        <FieldRow label="Requester agent" value={run.requesterAgentName || run.requesterAgentId} />
        <FieldRow label="Label" value={run.label} />
      </div>
      <div className="section__head">
        <h2>Runtime</h2>
      </div>
      <div className="field-grid">
        <FieldRow label="Model" value={run.model} mono />
        <FieldRow label="Spawn mode" value={run.spawnMode} />
        <FieldRow label="Depth" value={String(run.depth)} mono />
        <FieldRow
          label="Status"
          value={
            <span className={`pill pill--${runStatusPillClass(run.status)}`}>
              {run.status === "succeeded" ? <IconCheck /> : null}
              {run.status === "failed" ? <IconX /> : null}
              {run.status === "killed" ? <IconStop /> : null}
              {run.status === "running" ? <IconActivity /> : null}
              <span>{run.status}</span>
            </span>
          }
        />
      </div>
      <div className="section__head">
        <h2>Timestamps</h2>
      </div>
      <div className="field-grid">
        <FieldRow
          label="Created"
          value={`${fmtClock(run.createdAt)} · ${fmtDate(run.createdAt)}`}
        />
        <FieldRow
          label="Started"
          value={run.startedAt ? `${fmtClock(run.startedAt)} · ${fmtDate(run.startedAt)}` : null}
        />
        <FieldRow
          label="Ended"
          value={run.endedAt ? `${fmtClock(run.endedAt)} · ${fmtDate(run.endedAt)}` : null}
        />
        <FieldRow label="Duration" value={fmtDuration(run.durationMs)} mono />
      </div>
      <div className="section__head">
        <h2>Task</h2>
      </div>
      <p className="prose">{run.task || "(no task description recorded)"}</p>
    </div>
  );
}

function LineageNode({ node, isSelected, isRoot, hasChildren, onSelect }) {
  return (
    <div
      className={`tree-node${isSelected ? " tree-node--selected" : ""}${isRoot ? " tree-node--root" : ""}`}
      onClick={() => onSelect?.(node.runId)}
    >
      <div className="tree-node__main">
        <AgentGlyph agentId={node.agentId} agentName={node.agentName} size={28} />
        <div className="tree-node__body">
          <div className="tree-node__title">
            <span className="tree-node__name">{node.agentName || node.agentId}</span>
            {!isRoot ? (
              <span className={`pill pill--${runStatusPillClass(node.status)}`}>
                <span>{node.status}</span>
              </span>
            ) : (
              <span className="pill pill--info">root</span>
            )}
            {!isRoot ? (
              <span className="muted small">
                <IconClock /> {fmtDuration(node.durationMs)}
              </span>
            ) : null}
          </div>
          {node.task ? <div className="tree-node__task">{node.task}</div> : null}
        </div>
      </div>
      {hasChildren ? <span className="tree-node__hint">has children →</span> : null}
    </div>
  );
}

function TabLineage({ lineage, run, onSelect }) {
  const tree = _dvMemo(() => {
    if (!lineage) return null;
    const byParent = new Map();
    for (const n of lineage.nodes || []) {
      const key = n.parentRunId || "__root__";
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(n);
    }
    return byParent;
  }, [lineage]);

  if (!lineage || !tree) {
    return (
      <div className="section">
        <div className="empty-block">
          <IconBranch /> No lineage projection available yet.
        </div>
      </div>
    );
  }

  const renderChildren = (parentRunId, depth) => {
    const children = tree.get(parentRunId) || [];
    if (children.length === 0) return null;
    return (
      <div className="tree-children" style={{ marginLeft: depth * 24 }}>
        {children.map((node) => (
          <React.Fragment key={node.runId}>
            <LineageNode
              node={node}
              isSelected={node.runId === run.runId}
              isRoot={false}
              hasChildren={(tree.get(node.runId) || []).length > 0}
              onSelect={onSelect}
            />
            {renderChildren(node.runId, depth + 1)}
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <div className="section">
      <div className="section__head">
        <h2>Spawn tree</h2>
        <span className="muted small">{lineage.nodes?.length || 0} nodes</span>
      </div>
      <div className="tree">
        <LineageNode
          node={{ ...lineage.root, runId: "__root__" }}
          isSelected={false}
          isRoot
          hasChildren={(tree.get("") || []).length > 0}
        />
        {renderChildren("", 1)}
      </div>
    </div>
  );
}

function TabOutcome({ run }) {
  if (run.status === "running" || run.status === "stalled") {
    return (
      <div className="section">
        <div className="banner banner--info">
          <IconActivity />
          <div>
            <strong>Run is still in progress.</strong>
            <p>
              Final outcome will appear here when the child session ends. Steer or kill the run from
              the hero if you need to intervene.
            </p>
          </div>
        </div>
      </div>
    );
  }
  if (!run.outcome) {
    return (
      <div className="section">
        <div className="empty-block">No outcome payload recorded for this run.</div>
      </div>
    );
  }
  const json = JSON.stringify(run.outcome, null, 2);
  return (
    <div className="section">
      <div className="section__head">
        <h2>Outcome payload</h2>
      </div>
      <pre className="code-block code-block--inline">
        <code>{json}</code>
      </pre>
    </div>
  );
}

function TabPermissions({ run, parentConfig, allAgents, onEdit }) {
  const parentId = run.requesterAgentId;
  if (!parentConfig) {
    return (
      <div className="section">
        <div className="empty-block">
          <IconShield /> No permission projection for <span className="kbd">{parentId}</span> yet.
          Edit via the Permissions list mode.
        </div>
      </div>
    );
  }
  return (
    <div className="section">
      <div className="section__head">
        <h2>Parent agent: {parentId}</h2>
        <button className="btn btn--ghost" type="button" onClick={() => onEdit(parentId)}>
          <IconShield /> Edit permissions
        </button>
      </div>
      <div className="field-grid">
        <FieldRow
          label="Policy"
          value={
            parentConfig.allowAny ? (
              <span className="pill pill--info">
                <IconSparkle /> any subagent
              </span>
            ) : (
              <span className="pill pill--muted">
                <IconShield /> allow-list ({parentConfig.allowAgents?.length || 0}/
                {allAgents.length})
              </span>
            )
          }
        />
        <FieldRow label="Default model" value={parentConfig.model} mono />
        <FieldRow
          label="Max spawn depth"
          value={String(parentConfig.effectiveMaxSpawnDepth ?? "—")}
        />
        <FieldRow
          label="Max children per agent"
          value={String(parentConfig.effectiveMaxChildrenPerAgent ?? "—")}
        />
        <FieldRow
          label="Thinking"
          value={
            parentConfig.effectiveThinking ? (
              <span className="kbd kbd--small mono">
                <IconBrain /> {String(parentConfig.effectiveThinking.mode)} ·{" "}
                {parentConfig.effectiveThinking.maxBudget}
              </span>
            ) : null
          }
        />
        <FieldRow label="Config hash" value={parentConfig.configHash} mono />
      </div>
      <div className="section__head">
        <h2>Allowed peers</h2>
      </div>
      {parentConfig.allowAny ? (
        <div className="banner banner--info">
          <IconSparkle />
          <div>
            <strong>Any subagent is permitted.</strong>
            <p>The allow-list below is informational only; nothing is currently blocked.</p>
          </div>
        </div>
      ) : null}
      <div className="permission-grid permission-grid--readonly">
        {allAgents.map((peer) => {
          const allowed = parentConfig.allowAgents?.includes(peer.id) || parentConfig.allowAny;
          return (
            <div
              key={peer.id}
              className={`perm-row${allowed ? " is-active" : " is-blocked"} is-readonly`}
            >
              {allowed ? <IconCheck /> : <IconX />}
              <span className="perm-row__name">{peer.name || peer.id}</span>
              <span className="perm-row__id">{peer.id}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TabAudit({ audit }) {
  if (!audit || audit.length === 0) {
    return (
      <div className="section">
        <div className="empty-block">
          <IconClock /> No audit projected for this run yet.
        </div>
      </div>
    );
  }
  const sorted = [...audit].sort((a, b) => b.ts - a.ts);
  return (
    <div className="section">
      <div className="section__head">
        <h2>Run audit</h2>
        <span className="muted small">{audit.length} events · BFF projection</span>
      </div>
      <div className="timeline">
        {sorted.map((ev, i) => (
          <div key={i} className={`timeline__row timeline__row--${ev.event}`}>
            <div className="timeline__dot" />
            <div className="timeline__main">
              <div className="timeline__title">
                <span className={`event-pill event-pill--${ev.event}`}>{ev.event}</span>
                <span className="muted small">{ev.actor}</span>
              </div>
              <div className="timeline__note">{ev.note}</div>
            </div>
            <div className="timeline__ts">
              <div className="mono">{fmtClock(ev.ts)}</div>
              <div className="muted small">{fmtRelative(ev.ts)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TabRaw({ run }) {
  const json = JSON.stringify(run, null, 2);
  return (
    <div className="section">
      <div className="section__head">
        <h2>Raw DeckGoSubagentRun</h2>
      </div>
      <pre className="code-block code-block--inline">
        <code>{json}</code>
      </pre>
    </div>
  );
}

function DetailView({
  run,
  lineage,
  parentConfig,
  audit,
  allAgents,
  tweaks,
  setTweak,
  onBack,
  onSteer,
  onKill,
  onViewOutcome,
  onSelectInLineage,
  onEditPermissions,
}) {
  if (tweaks.detailState === "loading") {
    return (
      <div className="detail">
        <DetailHero
          run={run}
          onBack={onBack}
          onSteer={onSteer}
          onKill={onKill}
          onViewOutcome={onViewOutcome}
        />
        <div className="list-state list-state--loading">
          <IconRefresh className="spin" />
          <div>Loading run detail…</div>
        </div>
      </div>
    );
  }
  if (tweaks.detailState === "error") {
    return (
      <div className="detail">
        <DetailHero
          run={run}
          onBack={onBack}
          onSteer={onSteer}
          onKill={onKill}
          onViewOutcome={onViewOutcome}
        />
        <div className="list-state list-state--error">
          <IconAlert />
          <div>
            <strong>Failed to load detail.</strong>
            <p>BFF projection unavailable. Run row still cached.</p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="detail">
      <DetailHero
        run={run}
        onBack={onBack}
        onSteer={onSteer}
        onKill={onKill}
        onViewOutcome={onViewOutcome}
      />
      <TabsBar activeTab={tweaks.activeTab} onTab={(v) => setTweak("activeTab", v)} />
      <div className="detail__body">
        {tweaks.activeTab === "overview" ? <TabOverview run={run} /> : null}
        {tweaks.activeTab === "lineage" ? (
          <TabLineage lineage={lineage} run={run} onSelect={onSelectInLineage} />
        ) : null}
        {tweaks.activeTab === "outcome" ? <TabOutcome run={run} /> : null}
        {tweaks.activeTab === "permissions" ? (
          <TabPermissions
            run={run}
            parentConfig={parentConfig}
            allAgents={allAgents}
            onEdit={onEditPermissions}
          />
        ) : null}
        {tweaks.activeTab === "audit" ? <TabAudit audit={audit} /> : null}
        {tweaks.activeTab === "raw" ? <TabRaw run={run} /> : null}
      </div>
    </div>
  );
}

Object.assign(window, {
  DetailView,
  DetailHero,
  TabsBar,
  TabOverview,
  TabLineage,
  TabOutcome,
  TabPermissions,
  TabAudit,
  TabRaw,
  LineageNode,
  SUBAGENT_TABS,
});
