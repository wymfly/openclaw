// alerts — Application shell.
// Page-transition layout (list ↔ detail). Three dialogs above the active view.

const { useState: _appState, useEffect: _appEffect, useMemo: _appMemo } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/ {
  theme: "dark",
  density: "comfortable",
  view: "list",
  selectedRule: "rule_ws_reconnect",
  activeTab: "overview",
  listState: "ready",
  detailState: "ready",
  filterAction: "all",
  filterEntity: "all",
  filterEnabled: "all",
  searchQuery: "",
  editOpen: false,
  editMode: "create",
  deleteOpen: false,
  testFireOpen: false,
} /*EDITMODE-END*/;

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [view, setView] = _appState(tweaks.view);
  const [selectedId, setSelectedId] = _appState(tweaks.selectedRule);
  const [editOpen, setEditOpen] = _appState(false);
  const [editMode, setEditMode] = _appState("create");
  const [deleteOpen, setDeleteOpen] = _appState(false);
  const [testFireOpen, setTestFireOpen] = _appState(false);

  _appEffect(() => {
    document.documentElement.setAttribute("data-theme", tweaks.theme);
    document.documentElement.setAttribute("data-density", tweaks.density);
  }, [tweaks.theme, tweaks.density]);

  _appEffect(() => setView(tweaks.view), [tweaks.view]);
  _appEffect(() => setSelectedId(tweaks.selectedRule), [tweaks.selectedRule]);
  _appEffect(() => setEditOpen(tweaks.editOpen), [tweaks.editOpen]);
  _appEffect(() => setEditMode(tweaks.editMode), [tweaks.editMode]);
  _appEffect(() => setDeleteOpen(tweaks.deleteOpen), [tweaks.deleteOpen]);
  _appEffect(() => setTestFireOpen(tweaks.testFireOpen), [tweaks.testFireOpen]);

  const rules = window.MOCK.rules.rules;
  const entityTypes = window.MOCK.entityTypes;
  const firesMap = window.MOCK.recentFires;
  const auditMap = window.MOCK.audit;

  const selectedRule = _appMemo(
    () => rules.find((r) => r.id === selectedId) || null,
    [rules, selectedId],
  );
  const selectedFires = _appMemo(
    () => (selectedRule ? firesMap[selectedRule.id] || [] : []),
    [selectedRule],
  );
  const selectedAudit = _appMemo(
    () => (selectedRule ? auditMap[selectedRule.id] || [] : []),
    [selectedRule],
  );

  const goToDetail = (id) => {
    setView("detail");
    setSelectedId(id);
    setTweak({ view: "detail", selectedRule: id, activeTab: "overview" });
  };
  const goToList = () => {
    setView("list");
    setTweak("view", "list");
  };
  const refresh = () => {
    setTweak("listState", "loading");
    setTimeout(() => setTweak("listState", "ready"), 320);
  };

  const openCreate = () => {
    setEditMode("create");
    setEditOpen(true);
    setTweak({ editMode: "create", editOpen: true });
  };
  const openEdit = () => {
    setEditMode("edit");
    setEditOpen(true);
    setTweak({ editMode: "edit", editOpen: true });
  };
  const openDelete = () => {
    setDeleteOpen(true);
    setTweak("deleteOpen", true);
  };
  const openTestFire = (id) => {
    if (id) {
      setSelectedId(id);
      setTweak("selectedRule", id);
    }
    setTestFireOpen(true);
    setTweak("testFireOpen", true);
  };
  const toggleEnabled = (id) => {
    // prototype: toast banner only
    console.log("[prototype] toggle enabled for", id);
  };

  // ⌘K focus search · ⌘N new · ⌘R refresh · Esc back
  _appEffect(() => {
    const h = (e) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.querySelector(".toolbar__search input")?.focus();
      } else if (meta && e.key.toLowerCase() === "n") {
        e.preventDefault();
        openCreate();
      } else if (meta && e.key.toLowerCase() === "r") {
        e.preventDefault();
        refresh();
      } else if (
        e.key === "Escape" &&
        view === "detail" &&
        !editOpen &&
        !deleteOpen &&
        !testFireOpen
      ) {
        e.preventDefault();
        goToList();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [view, editOpen, deleteOpen, testFireOpen]);

  return (
    <div className="app">
      {view === "list" ? (
        <ListView
          rules={rules}
          selectedId={selectedId}
          listState={tweaks.listState}
          searchQuery={tweaks.searchQuery}
          filterAction={tweaks.filterAction}
          filterEntity={tweaks.filterEntity}
          filterEnabled={tweaks.filterEnabled}
          entityTypes={entityTypes}
          asOfMs={window.MOCK.kpis.asOfMs}
          runtimeId={window.MOCK.kpis.runtimeId}
          onSearch={(v) => setTweak("searchQuery", v)}
          onFilterAction={(v) => setTweak("filterAction", v)}
          onFilterEntity={(v) => setTweak("filterEntity", v)}
          onFilterEnabled={(v) => setTweak("filterEnabled", v)}
          onSelect={goToDetail}
          onCreate={openCreate}
          onRefresh={refresh}
          onToggleEnabled={toggleEnabled}
          onTestFire={openTestFire}
        />
      ) : selectedRule ? (
        <DetailView
          key={selectedRule.id}
          rule={selectedRule}
          fires={selectedFires}
          audit={selectedAudit}
          tweaks={tweaks}
          setTweak={setTweak}
          onBack={goToList}
          onEdit={openEdit}
          onDelete={openDelete}
          onTestFire={() => openTestFire()}
          onToggleEnabled={() => toggleEnabled(selectedRule.id)}
        />
      ) : (
        <ListView
          rules={rules}
          selectedId={selectedId}
          listState={tweaks.listState}
          searchQuery={tweaks.searchQuery}
          filterAction={tweaks.filterAction}
          filterEntity={tweaks.filterEntity}
          filterEnabled={tweaks.filterEnabled}
          entityTypes={entityTypes}
          asOfMs={window.MOCK.kpis.asOfMs}
          runtimeId={window.MOCK.kpis.runtimeId}
          onSearch={(v) => setTweak("searchQuery", v)}
          onFilterAction={(v) => setTweak("filterAction", v)}
          onFilterEntity={(v) => setTweak("filterEntity", v)}
          onFilterEnabled={(v) => setTweak("filterEnabled", v)}
          onSelect={goToDetail}
          onCreate={openCreate}
          onRefresh={refresh}
          onToggleEnabled={toggleEnabled}
          onTestFire={openTestFire}
        />
      )}

      <RuleEditDialog
        open={editOpen}
        mode={editMode}
        rule={editMode === "edit" ? selectedRule : null}
        entityTypes={entityTypes}
        onClose={() => {
          setEditOpen(false);
          setTweak("editOpen", false);
        }}
        onSave={() => {
          setEditOpen(false);
          setTweak("editOpen", false);
        }}
      />
      <DeleteRuleDialog
        open={deleteOpen}
        rule={selectedRule}
        onCancel={() => {
          setDeleteOpen(false);
          setTweak("deleteOpen", false);
        }}
        onConfirm={() => {
          setDeleteOpen(false);
          setTweak("deleteOpen", false);
        }}
      />
      <TestFireDialog
        open={testFireOpen}
        rule={selectedRule}
        onClose={() => {
          setTestFireOpen(false);
          setTweak("testFireOpen", false);
        }}
      />

      <TweaksPanel title="Alerts prototype">
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
          options={["ready", "loading", "error", "empty"]}
          onChange={(v) => setTweak("listState", v)}
        />

        <TweakSection label="Selected rule" />
        <TweakSelect
          label="Rule"
          value={tweaks.selectedRule}
          options={rules.map((r) => ({ value: r.id, label: r.name }))}
          onChange={(v) => setTweak("selectedRule", v)}
        />
        <TweakSelect
          label="Tab"
          value={tweaks.activeTab}
          options={ALERT_TABS.map((t) => ({ value: t.id, label: t.label }))}
          onChange={(v) => setTweak("activeTab", v)}
        />
        <TweakRadio
          label="Detail state"
          value={tweaks.detailState}
          options={["ready", "loading", "error"]}
          onChange={(v) => setTweak("detailState", v)}
        />

        <TweakSection label="Dialogs" />
        <TweakRadio
          label="Edit mode"
          value={tweaks.editMode}
          options={["create", "edit"]}
          onChange={(v) => setTweak("editMode", v)}
        />
        <TweakToggle
          label="Edit dialog"
          value={tweaks.editOpen}
          onChange={(v) => setTweak("editOpen", v)}
        />
        <TweakToggle
          label="Delete confirm"
          value={tweaks.deleteOpen}
          onChange={(v) => setTweak("deleteOpen", v)}
        />
        <TweakToggle
          label="Test fire"
          value={tweaks.testFireOpen}
          onChange={(v) => setTweak("testFireOpen", v)}
        />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
