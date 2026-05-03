// Application shell — page routing between list and detail views, plus
// dialogs and the tweaks panel. No split-panel: views own the full width.

const { useState: _appState, useEffect: _appEffect, useMemo: _appMemo } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/ {
  theme: "dark",
  density: "comfortable",
  view: "list",
  selectedAgent: "main",
  activeSection: "overview",
  listState: "ready",
  detailState: "ready",
  streamStatus: "connected",
  overviewDirty: false,
  skillsConflict: false,
  createOpen: false,
  deleteOpen: false,
} /*EDITMODE-END*/;

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [view, setView] = _appState(tweaks.view);
  const [selectedId, setSelectedId] = _appState(tweaks.selectedAgent);
  const [createOpen, setCreateOpen] = _appState(false);
  const [deleteAgent, setDeleteAgent] = _appState(null);

  // Sync theme & density to <html>
  _appEffect(() => {
    document.documentElement.setAttribute("data-theme", tweaks.theme);
    document.documentElement.setAttribute("data-density", tweaks.density);
  }, [tweaks.theme, tweaks.density]);

  // Sync from tweaks → local state
  _appEffect(() => {
    setView(tweaks.view);
  }, [tweaks.view]);
  _appEffect(() => {
    setSelectedId(tweaks.selectedAgent);
  }, [tweaks.selectedAgent]);
  _appEffect(() => {
    setCreateOpen(tweaks.createOpen);
  }, [tweaks.createOpen]);
  _appEffect(() => {
    if (tweaks.deleteOpen && selectedAgent) setDeleteAgent(selectedAgent);
    else if (!tweaks.deleteOpen) setDeleteAgent(null);
  }, [tweaks.deleteOpen]);

  const agents = window.MOCK.agentsList.agents;
  const selectedAgent = _appMemo(
    () => agents.find((a) => a.id === selectedId) || null,
    [agents, selectedId],
  );
  const detail = selectedAgent ? window.MOCK.detail[selectedAgent.id] || null : null;

  const goToDetail = (id) => {
    setView("detail");
    setSelectedId(id);
    setTweak({ view: "detail", selectedAgent: id });
  };
  const goToList = () => {
    setView("list");
    setTweak("view", "list");
  };

  // Global ⌘N for new agent, Esc to go back
  _appEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setCreateOpen(true);
      } else if (e.key === "Escape" && view === "detail" && !createOpen && !deleteAgent) {
        e.preventDefault();
        goToList();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [view, createOpen, deleteAgent]);

  return (
    <div className="app">
      {view === "list" ? (
        <ListView
          agents={agents}
          listState={tweaks.listState}
          streamStatus={tweaks.streamStatus}
          onSelect={goToDetail}
          onCreateClick={() => setCreateOpen(true)}
        />
      ) : selectedAgent ? (
        <DetailView
          key={selectedAgent.id}
          agent={selectedAgent}
          detail={detail}
          tweaks={tweaks}
          setTweak={setTweak}
          onBack={goToList}
          onDelete={() => setDeleteAgent(selectedAgent)}
        />
      ) : (
        <ListView
          agents={agents}
          listState={tweaks.listState}
          streamStatus={tweaks.streamStatus}
          onSelect={goToDetail}
          onCreateClick={() => setCreateOpen(true)}
        />
      )}

      <CreateDialog
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setTweak("createOpen", false);
        }}
        onCreated={(id) => {
          goToDetail(id);
          setCreateOpen(false);
        }}
      />
      <DeleteDialog
        agent={deleteAgent}
        onCancel={() => {
          setDeleteAgent(null);
          setTweak("deleteOpen", false);
        }}
        onDeleted={() => {
          setDeleteAgent(null);
          setTweak("deleteOpen", false);
          goToList();
        }}
      />

      {/* Tweaks panel — host integration via tweaks-panel.jsx */}
      <TweaksPanel title="Agents prototype">
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
          label="List state"
          value={tweaks.listState}
          options={["ready", "loading", "error"]}
          onChange={(v) => setTweak("listState", v)}
        />
        <TweakRadio
          label="Stream"
          value={tweaks.streamStatus}
          options={["connected", "reconnecting", "error"]}
          onChange={(v) => setTweak("streamStatus", v)}
        />

        <TweakSection label="Selected agent" />
        <TweakSelect
          label="Agent"
          value={tweaks.selectedAgent}
          options={agents.map((a) => ({ value: a.id, label: a.name || a.id }))}
          onChange={(v) => setTweak("selectedAgent", v)}
        />
        <TweakSelect
          label="Section"
          value={tweaks.activeSection}
          options={TABS.map((t) => ({ value: t.id, label: t.label }))}
          onChange={(v) => setTweak("activeSection", v)}
        />
        <TweakRadio
          label="Detail state"
          value={tweaks.detailState}
          options={["ready", "loading", "error"]}
          onChange={(v) => setTweak("detailState", v)}
        />
        <TweakToggle
          label="Overview dirty"
          value={tweaks.overviewDirty}
          onChange={(v) => setTweak("overviewDirty", v)}
        />
        <TweakToggle
          label="Skills conflict"
          value={tweaks.skillsConflict}
          onChange={(v) => setTweak("skillsConflict", v)}
        />

        <TweakSection label="Dialogs" />
        <TweakToggle
          label="Create dialog"
          value={tweaks.createOpen}
          onChange={(v) => setTweak("createOpen", v)}
        />
        <TweakToggle
          label="Delete dialog"
          value={tweaks.deleteOpen}
          onChange={(v) => setTweak("deleteOpen", v)}
        />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
