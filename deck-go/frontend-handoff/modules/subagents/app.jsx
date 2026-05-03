// subagents — Application shell.
// Page-transition layout (list ↔ detail) with two list modes (runs | permissions).
// Dialogs above active view: kill / steer / permissions / outcome (raw run JSON).

const { useState: _appState, useEffect: _appEffect, useMemo: _appMemo } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/ {
  theme: "dark",
  density: "comfortable",
  view: "list",
  mode: "runs",
  selectedRun: "run_aa3201",
  selectedPermissionAgent: "main",
  activeTab: "overview",
  listState: "ready",
  detailState: "ready",
  filter: "all",
  spawnMode: "all",
  searchQuery: "",
  killOpen: false,
  steerOpen: false,
  permissionsOpen: false,
  outcomeOpen: false,
} /*EDITMODE-END*/;

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [view, setView] = _appState(tweaks.view);
  const [mode, setMode] = _appState(tweaks.mode);
  const [selectedRunId, setSelectedRunId] = _appState(tweaks.selectedRun);
  const [permAgentId, setPermAgentId] = _appState(tweaks.selectedPermissionAgent);
  const [killOpen, setKillOpen] = _appState(false);
  const [steerOpen, setSteerOpen] = _appState(false);
  const [permissionsOpen, setPermissionsOpen] = _appState(false);
  const [outcomeOpen, setOutcomeOpen] = _appState(false);

  _appEffect(() => {
    document.documentElement.setAttribute("data-theme", tweaks.theme);
    document.documentElement.setAttribute("data-density", tweaks.density);
  }, [tweaks.theme, tweaks.density]);

  _appEffect(() => setView(tweaks.view), [tweaks.view]);
  _appEffect(() => setMode(tweaks.mode), [tweaks.mode]);
  _appEffect(() => setSelectedRunId(tweaks.selectedRun), [tweaks.selectedRun]);
  _appEffect(
    () => setPermAgentId(tweaks.selectedPermissionAgent),
    [tweaks.selectedPermissionAgent],
  );
  _appEffect(() => setKillOpen(tweaks.killOpen), [tweaks.killOpen]);
  _appEffect(() => setSteerOpen(tweaks.steerOpen), [tweaks.steerOpen]);
  _appEffect(() => setPermissionsOpen(tweaks.permissionsOpen), [tweaks.permissionsOpen]);
  _appEffect(() => setOutcomeOpen(tweaks.outcomeOpen), [tweaks.outcomeOpen]);

  const runs = window.MOCK.runs.runs;
  const allAgents = window.MOCK.allAgents;
  const agentConfigs = window.MOCK.agentConfig;
  const lineageMap = window.MOCK.lineage;
  const auditMap = window.MOCK.audit;

  const selectedRun = _appMemo(
    () => runs.find((r) => r.runId === selectedRunId) || null,
    [runs, selectedRunId],
  );
  const selectedLineage = _appMemo(
    () => (selectedRun ? lineageMap[selectedRun.requesterSessionKey] || null : null),
    [selectedRun],
  );
  const parentConfig = _appMemo(
    () => (selectedRun ? agentConfigs[selectedRun.requesterAgentId] || null : null),
    [selectedRun],
  );
  const selectedAudit = _appMemo(
    () => (selectedRun ? auditMap[selectedRun.runId] || [] : []),
    [selectedRun],
  );

  const goToDetail = (runId) => {
    setView("detail");
    setSelectedRunId(runId);
    setTweak({ view: "detail", selectedRun: runId, activeTab: "overview" });
  };
  const goToList = () => {
    setView("list");
    setTweak("view", "list");
  };
  const switchMode = (m) => {
    setMode(m);
    setTweak("mode", m);
  };
  const refresh = () => {
    setTweak("listState", "loading");
    setTimeout(() => setTweak("listState", "ready"), 320);
  };
  const onEditPermissions = (agentId) => {
    setPermAgentId(agentId);
    setPermissionsOpen(true);
    setTweak({ selectedPermissionAgent: agentId, permissionsOpen: true });
  };

  // ⌘K focus search · ⌘P permissions · ⌘R refresh · Esc back
  _appEffect(() => {
    const h = (e) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.querySelector(".toolbar__search input")?.focus();
      } else if (meta && e.key.toLowerCase() === "p") {
        e.preventDefault();
        switchMode("permissions");
      } else if (meta && e.key.toLowerCase() === "r") {
        e.preventDefault();
        refresh();
      } else if (
        e.key === "Escape" &&
        view === "detail" &&
        !killOpen &&
        !steerOpen &&
        !permissionsOpen &&
        !outcomeOpen
      ) {
        e.preventDefault();
        goToList();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [view, killOpen, steerOpen, permissionsOpen, outcomeOpen]);

  const editingAgentConfig = agentConfigs[permAgentId] || null;

  return (
    <div className="app">
      {view === "list" ? (
        <ListView
          mode={mode}
          runs={runs}
          agentConfigs={agentConfigs}
          allAgents={allAgents}
          selectedRunId={selectedRunId}
          listState={tweaks.listState}
          searchQuery={tweaks.searchQuery}
          filter={tweaks.filter}
          spawnMode={tweaks.spawnMode}
          asOfMs={window.MOCK.kpis.asOfMs}
          runtimeId={window.MOCK.kpis.runtimeId}
          onMode={switchMode}
          onSearch={(v) => setTweak("searchQuery", v)}
          onFilter={(v) => setTweak("filter", v)}
          onSpawnMode={(v) => setTweak("spawnMode", v)}
          onSelect={goToDetail}
          onEditPermissions={onEditPermissions}
          onRefresh={refresh}
        />
      ) : selectedRun ? (
        <DetailView
          key={selectedRun.runId}
          run={selectedRun}
          lineage={selectedLineage}
          parentConfig={parentConfig}
          audit={selectedAudit}
          allAgents={allAgents}
          tweaks={tweaks}
          setTweak={setTweak}
          onBack={goToList}
          onSteer={() => {
            setSteerOpen(true);
            setTweak("steerOpen", true);
          }}
          onKill={() => {
            setKillOpen(true);
            setTweak("killOpen", true);
          }}
          onViewOutcome={() => {
            setOutcomeOpen(true);
            setTweak("outcomeOpen", true);
          }}
          onSelectInLineage={(rid) => {
            const real = runs.find((r) => r.runId === rid);
            if (real) goToDetail(rid);
          }}
          onEditPermissions={onEditPermissions}
        />
      ) : (
        <ListView
          mode={mode}
          runs={runs}
          agentConfigs={agentConfigs}
          allAgents={allAgents}
          selectedRunId={selectedRunId}
          listState={tweaks.listState}
          searchQuery={tweaks.searchQuery}
          filter={tweaks.filter}
          spawnMode={tweaks.spawnMode}
          asOfMs={window.MOCK.kpis.asOfMs}
          runtimeId={window.MOCK.kpis.runtimeId}
          onMode={switchMode}
          onSearch={(v) => setTweak("searchQuery", v)}
          onFilter={(v) => setTweak("filter", v)}
          onSpawnMode={(v) => setTweak("spawnMode", v)}
          onSelect={goToDetail}
          onEditPermissions={onEditPermissions}
          onRefresh={refresh}
        />
      )}

      <KillRunDialog
        open={killOpen}
        run={selectedRun}
        onCancel={() => {
          setKillOpen(false);
          setTweak("killOpen", false);
        }}
        onConfirm={() => {
          setKillOpen(false);
          setTweak("killOpen", false);
        }}
      />
      <SteerRunDialog
        open={steerOpen}
        run={selectedRun}
        onClose={() => {
          setSteerOpen(false);
          setTweak("steerOpen", false);
        }}
        onSteered={() => {}}
      />
      <PermissionsDialog
        open={permissionsOpen}
        agentId={permAgentId}
        config={editingAgentConfig}
        allAgents={allAgents}
        onClose={() => {
          setPermissionsOpen(false);
          setTweak("permissionsOpen", false);
        }}
        onSave={() => {
          setPermissionsOpen(false);
          setTweak("permissionsOpen", false);
        }}
      />
      <RunOutcomeDialog
        open={outcomeOpen}
        run={selectedRun}
        onClose={() => {
          setOutcomeOpen(false);
          setTweak("outcomeOpen", false);
        }}
      />

      <TweaksPanel title="Subagents prototype">
        <TweakSection label="Surface" />
        <TweakRadio
          label="Theme"
          value={tweaks.theme}
          options={["dark", "light"]}
          onChange={(v) => setTweak("theme", v)}
        />
        <TweakRadio
          label="Density"
          value={tweaks.density}
          options={["comfortable", "compact"]}
          onChange={(v) => setTweak("density", v)}
        />

        <TweakSection label="View" />
        <TweakRadio
          label="Active view"
          value={tweaks.view}
          options={["list", "detail"]}
          onChange={(v) => setTweak("view", v)}
        />
        <TweakRadio
          label="List mode"
          value={tweaks.mode}
          options={["runs", "permissions"]}
          onChange={(v) => setTweak("mode", v)}
        />
        <TweakRadio
          label="List state"
          value={tweaks.listState}
          options={["ready", "loading", "error", "empty"]}
          onChange={(v) => setTweak("listState", v)}
        />

        <TweakSection label="Selected run" />
        <TweakSelect
          label="Run"
          value={tweaks.selectedRun}
          options={runs.map((r) => ({
            value: r.runId,
            label: `${r.childAgentName || r.childAgentId} · ${r.runId.slice(-6)}`,
          }))}
          onChange={(v) => setTweak("selectedRun", v)}
        />
        <TweakSelect
          label="Tab"
          value={tweaks.activeTab}
          options={SUBAGENT_TABS.map((t) => ({ value: t.id, label: t.label }))}
          onChange={(v) => setTweak("activeTab", v)}
        />
        <TweakRadio
          label="Detail state"
          value={tweaks.detailState}
          options={["ready", "loading", "error"]}
          onChange={(v) => setTweak("detailState", v)}
        />

        <TweakSection label="Permissions agent" />
        <TweakSelect
          label="Edit target"
          value={tweaks.selectedPermissionAgent}
          options={Object.keys(agentConfigs).map((id) => ({ value: id, label: id }))}
          onChange={(v) => setTweak("selectedPermissionAgent", v)}
        />

        <TweakSection label="Dialogs" />
        <TweakToggle
          label="Kill confirm"
          value={tweaks.killOpen}
          onChange={(v) => setTweak("killOpen", v)}
        />
        <TweakToggle
          label="Steer hint"
          value={tweaks.steerOpen}
          onChange={(v) => setTweak("steerOpen", v)}
        />
        <TweakToggle
          label="Permissions editor"
          value={tweaks.permissionsOpen}
          onChange={(v) => setTweak("permissionsOpen", v)}
        />
        <TweakToggle
          label="Run outcome (raw)"
          value={tweaks.outcomeOpen}
          onChange={(v) => setTweak("outcomeOpen", v)}
        />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
