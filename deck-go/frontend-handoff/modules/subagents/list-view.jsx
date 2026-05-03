// subagents — List view
//
// Two list modes:
//   - "runs"        → DeckGoSubagentsListResponse (operational live view, default)
//   - "permissions" → per-parent-agent allow-list configuration matrix
//
// Runs mode renders 8-col rows: glyph, child agent + task, parent agent,
// model, depth, spawnMode, duration/started, status pill, chev.

const { useMemo: _lvMemo } = React;

function fmtDuration(ms) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600_000) return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  return `${Math.round(ms / 3600_000)}h`;
}

function fmtRelative(ms, nowMs) {
  if (!ms) return "—";
  const now = nowMs || Date.now();
  const dt = (now - ms) / 1000;
  if (dt < 60) return `${Math.round(dt)}s ago`;
  if (dt < 3600) return `${Math.round(dt / 60)}m ago`;
  if (dt < 86400) return `${Math.round(dt / 3600)}h ago`;
  return `${Math.round(dt / 86400)}d ago`;
}

function runStatusPillClass(s) {
  if (s === "running") return "info";
  if (s === "succeeded") return "ok";
  if (s === "failed") return "err";
  if (s === "killed") return "warn";
  if (s === "stalled") return "warn";
  return "muted";
}

function RunRow({ run, selected, onSelect }) {
  return (
    <div
      className={`row${selected ? " row--selected" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(run.runId)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(run.runId);
        }
      }}
    >
      <div className="row__glyph">
        <AgentGlyph agentId={run.childAgentId} agentName={run.childAgentName} size={32} />
      </div>
      <div className="row__id">
        <div className="row__id-name">
          <span className="row__id-title">{run.childAgentName || run.childAgentId}</span>
          {run.depth > 1 ? <span className="meta-pill meta-pill--depth">d{run.depth}</span> : null}
        </div>
        <div className="row__id-task" title={run.task}>
          {run.task || run.label || run.runId}
        </div>
      </div>
      <div className="row__parent">
        <div className="parent-row">
          <AgentGlyph agentId={run.requesterAgentId} agentName={run.requesterAgentName} size={20} />
          <span>{run.requesterAgentName || run.requesterAgentId}</span>
        </div>
      </div>
      <div className="row__model">
        <span className="kbd kbd--small mono">{run.model || "inherited"}</span>
      </div>
      <div className="row__mode">
        <span className={`mode-pill mode-pill--${run.spawnMode}`}>{run.spawnMode}</span>
      </div>
      <div className="row__time">
        {run.status === "running" || run.status === "stalled" ? (
          <span className="time-mono">
            <IconActivity /> live · {fmtRelative(run.startedAt)}
          </span>
        ) : (
          <span className="time-mono">
            <IconClock /> {fmtDuration(run.durationMs)}
          </span>
        )}
      </div>
      <div className="row__status">
        <span className={`pill pill--${runStatusPillClass(run.status)}`}>
          {run.status === "succeeded" ? <IconCheck /> : null}
          {run.status === "failed" ? <IconX /> : null}
          {run.status === "killed" ? <IconStop /> : null}
          {run.status === "running" ? <IconActivity /> : null}
          {run.status === "stalled" ? <IconAlert /> : null}
          <span>{run.status}</span>
        </span>
      </div>
      <div className="row__chev">
        <IconChevronRight />
      </div>
    </div>
  );
}

function PermissionRow({ agentId, config, allAgentsCount, onEdit }) {
  const allowed = config?.allowAgents?.length || 0;
  const allowAny = !!config?.allowAny;
  return (
    <div className="row row--permission">
      <div className="row__glyph">
        <AgentGlyph agentId={agentId} agentName={agentId} size={32} />
      </div>
      <div className="row__id">
        <div className="row__id-name">
          <span className="row__id-title">{agentId}</span>
        </div>
        <div className="row__id-meta">
          <span className="kbd kbd--small">model: {config?.model || "inherited"}</span>
        </div>
      </div>
      <div className="row__perm-policy">
        {allowAny ? (
          <span className="pill pill--info">
            <IconSparkle /> any subagent
          </span>
        ) : (
          <span className="pill pill--muted">
            <IconShield /> allow-list ({allowed}/{allAgentsCount})
          </span>
        )}
      </div>
      <div className="row__perm-caps">
        <span className="cap-num">
          <IconLayers /> max depth {config?.effectiveMaxSpawnDepth ?? "—"}
        </span>
        <span className="cap-num">
          <IconBranch /> max children {config?.effectiveMaxChildrenPerAgent ?? "—"}
        </span>
      </div>
      <div className="row__perm-thinking">
        {config?.effectiveThinking ? (
          <span className="kbd kbd--small mono">
            <IconBrain /> {String(config.effectiveThinking.mode || "auto")} ·{" "}
            {config.effectiveThinking.maxBudget ?? "—"}
          </span>
        ) : (
          <span className="muted small">—</span>
        )}
      </div>
      <div className="row__actions">
        <button className="btn btn--ghost" type="button" onClick={() => onEdit(agentId)}>
          <IconShield /> Edit
        </button>
      </div>
    </div>
  );
}

function SubagentsKpiStrip({ runs, asOfMs, runtimeId }) {
  const total = runs.length;
  const running = runs.filter((r) => r.status === "running").length;
  const stalled = runs.filter((r) => r.status === "stalled").length;
  const failed = runs.filter((r) => r.status === "failed" || r.status === "killed").length;
  const maxDepth = runs.reduce((m, r) => Math.max(m, r.depth), 0);
  const sinceLabel = new Date(asOfMs || Date.now()).toLocaleTimeString();
  return (
    <div className="kpi-strip">
      <div className="kpi">
        <div className="kpi__label">Recent runs</div>
        <div className="kpi__value">{total}</div>
        <div className="kpi__sub">{runtimeId || "deck-runtime"}</div>
      </div>
      <div className="kpi">
        <div className="kpi__label">Running</div>
        <div className={`kpi__value${running > 0 ? " kpi__value--info" : ""}`}>{running}</div>
        <div className="kpi__sub">live now</div>
      </div>
      <div className="kpi">
        <div className="kpi__label">Stalled</div>
        <div className={`kpi__value${stalled > 0 ? " kpi__value--warn" : ""}`}>{stalled}</div>
        <div className="kpi__sub">no progress &gt; 60s</div>
      </div>
      <div className="kpi">
        <div className="kpi__label">Failed / killed</div>
        <div className={`kpi__value${failed > 0 ? " kpi__value--err" : ""}`}>{failed}</div>
        <div className="kpi__sub">end states</div>
      </div>
      <div className="kpi">
        <div className="kpi__label">Max depth</div>
        <div className="kpi__value">{maxDepth}</div>
        <div className="kpi__sub">spawn nesting</div>
      </div>
      <div className="kpi kpi--ts">
        <div className="kpi__label">As of</div>
        <div className="kpi__value-mono">{sinceLabel}</div>
        <div className="kpi__sub">last sync</div>
      </div>
    </div>
  );
}

function SubagentsToolbar({
  mode,
  searchQuery,
  filter,
  spawnMode,
  onMode,
  onSearch,
  onFilter,
  onSpawnMode,
  onRefresh,
}) {
  return (
    <div className="toolbar">
      <div className="toolbar__search">
        <IconSearch />
        <input
          type="search"
          placeholder={
            mode === "runs"
              ? "Search runs by child agent, task, parent, runId…"
              : "Search permissions by agent id…"
          }
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          aria-label="Search subagents"
        />
        <span className="kbd-hint">⌘K</span>
      </div>
      <div className="toolbar__group">
        <div className="seg" role="tablist" aria-label="Mode">
          {[
            { id: "runs", label: "Runs", icon: IconActivity },
            { id: "permissions", label: "Permissions", icon: IconShield },
          ].map((o) => {
            const Icon = o.icon;
            return (
              <button
                key={o.id}
                className={`seg__btn${mode === o.id ? " seg__btn--active" : ""}`}
                type="button"
                role="tab"
                aria-selected={mode === o.id}
                onClick={() => onMode(o.id)}
              >
                <Icon />
                <span>{o.label}</span>
              </button>
            );
          })}
        </div>
        {mode === "runs" ? (
          <>
            <div className="seg" role="tablist" aria-label="Status filter">
              {[
                { id: "all", label: "All" },
                { id: "running", label: "Running" },
                { id: "succeeded", label: "Succeeded" },
                { id: "failed", label: "Failed" },
                { id: "killed", label: "Killed" },
                { id: "stalled", label: "Stalled" },
              ].map((o) => (
                <button
                  key={o.id}
                  className={`seg__btn${filter === o.id ? " seg__btn--active" : ""}`}
                  type="button"
                  onClick={() => onFilter(o.id)}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div className="seg" role="tablist" aria-label="Spawn mode">
              {[
                { id: "all", label: "Any spawn" },
                { id: "blocking", label: "Blocking" },
                { id: "background", label: "Background" },
              ].map((o) => (
                <button
                  key={o.id}
                  className={`seg__btn${spawnMode === o.id ? " seg__btn--active" : ""}`}
                  type="button"
                  onClick={() => onSpawnMode(o.id)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>
      <div className="toolbar__actions">
        <button className="btn btn--ghost" type="button" onClick={onRefresh}>
          <IconRefresh /> Refresh
        </button>
      </div>
    </div>
  );
}

function ListView({
  mode,
  runs,
  agentConfigs,
  allAgents,
  selectedRunId,
  listState,
  searchQuery,
  filter,
  spawnMode,
  asOfMs,
  runtimeId,
  onMode,
  onSearch,
  onFilter,
  onSpawnMode,
  onSelect,
  onEditPermissions,
  onRefresh,
}) {
  const filtered = _lvMemo(() => {
    if (mode !== "runs") return [];
    let xs = runs;
    if (filter && filter !== "all") xs = xs.filter((r) => r.status === filter);
    if (spawnMode && spawnMode !== "all") xs = xs.filter((r) => r.spawnMode === spawnMode);
    const q = (searchQuery || "").trim().toLowerCase();
    if (q) {
      xs = xs.filter((r) =>
        [
          r.runId,
          r.childAgentId,
          r.childAgentName,
          r.requesterAgentId,
          r.requesterAgentName,
          r.task,
          r.label,
          r.model,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }
    // Sort: running first, then most recent createdAt.
    return [...xs].sort((a, b) => {
      const aLive = a.status === "running" || a.status === "stalled" ? 1 : 0;
      const bLive = b.status === "running" || b.status === "stalled" ? 1 : 0;
      if (aLive !== bLive) return bLive - aLive;
      return b.createdAt - a.createdAt;
    });
  }, [runs, mode, filter, spawnMode, searchQuery]);

  const filteredAgents = _lvMemo(() => {
    if (mode !== "permissions") return [];
    const q = (searchQuery || "").trim().toLowerCase();
    const ids = Object.keys(agentConfigs);
    if (!q) return ids;
    return ids.filter((id) => id.toLowerCase().includes(q));
  }, [agentConfigs, mode, searchQuery]);

  return (
    <div className="list-view">
      <header className="page-header">
        <div className="page-header__title">
          <h1>Subagents</h1>
          <p>
            Operational live view of subagent runs — kill, steer, inspect lineage. Switch to
            <strong> Permissions</strong> to manage per-agent allow-lists. Source-of-truth
            contracts: <span className="kbd">DeckGoSubagentsListResponse</span> +{" "}
            <span className="kbd">DeckGoAgentSubagentConfigResponse</span>.
          </p>
        </div>
        <div className="page-header__hint">
          <IconKbd /> <span>⌘K</span> search · <span>⌘P</span> permissions · <span>⌘R</span> refresh
        </div>
      </header>

      <SubagentsKpiStrip runs={runs} asOfMs={asOfMs} runtimeId={runtimeId} />

      <SubagentsToolbar
        mode={mode}
        searchQuery={searchQuery}
        filter={filter}
        spawnMode={spawnMode}
        onMode={onMode}
        onSearch={onSearch}
        onFilter={onFilter}
        onSpawnMode={onSpawnMode}
        onRefresh={onRefresh}
      />

      {mode === "runs" ? (
        <>
          <div className="row-head" role="row" aria-hidden="true">
            <div className="row-head__col row-head__col--glyph"></div>
            <div className="row-head__col">Child + task</div>
            <div className="row-head__col">Parent</div>
            <div className="row-head__col">Model</div>
            <div className="row-head__col">Spawn</div>
            <div className="row-head__col">Duration</div>
            <div className="row-head__col row-head__col--right">Status</div>
            <div className="row-head__col row-head__col--chev"></div>
          </div>
          {listState === "loading" ? (
            <div className="list-state list-state--loading">
              <IconRefresh className="spin" />
              <div>Loading subagent runs…</div>
            </div>
          ) : listState === "error" ? (
            <div className="list-state list-state--error">
              <IconAlert />
              <div>
                <strong>Failed to load.</strong>
                <p>BFF returned 5xx. Retry or check Gateway logs.</p>
                <button className="btn btn--primary" type="button" onClick={onRefresh}>
                  <IconRefresh /> Retry
                </button>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="list-state list-state--empty">
              <IconActivity />
              <div>
                <strong>No runs match this filter.</strong>
                <p>Try clearing search or switching to a wider status filter.</p>
              </div>
            </div>
          ) : (
            <div className="list">
              {filtered.map((r) => (
                <RunRow
                  key={r.runId}
                  run={r}
                  selected={r.runId === selectedRunId}
                  onSelect={onSelect}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="row-head row-head--perm" role="row" aria-hidden="true">
            <div className="row-head__col row-head__col--glyph"></div>
            <div className="row-head__col">Agent</div>
            <div className="row-head__col">Policy</div>
            <div className="row-head__col">Caps</div>
            <div className="row-head__col">Thinking</div>
            <div className="row-head__col"></div>
          </div>
          {filteredAgents.length === 0 ? (
            <div className="list-state list-state--empty">
              <IconShield />
              <div>
                <strong>No permission rows match.</strong>
                <p>Try clearing search or check the agents catalog directly.</p>
              </div>
            </div>
          ) : (
            <div className="list">
              {filteredAgents.map((id) => (
                <PermissionRow
                  key={id}
                  agentId={id}
                  config={agentConfigs[id]}
                  allAgentsCount={allAgents.length}
                  onEdit={onEditPermissions}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

Object.assign(window, {
  ListView,
  SubagentsKpiStrip,
  SubagentsToolbar,
  RunRow,
  PermissionRow,
  fmtDuration,
  fmtRelative,
  runStatusPillClass,
});
