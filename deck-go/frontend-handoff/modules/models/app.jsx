// models — Application shell.
// Page-transition list↔detail; dialogs above active view.

const { useState: _appState, useEffect: _appEffect, useMemo: _appMemo } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/ {
  theme: "dark",
  density: "comfortable",
  view: "list",
  selectedModel: "claude-opus-4-7",
  activeTab: "overview",
  listState: "ready",
  detailState: "ready",
  searchQuery: "",
  filter: "all",
  rawConfigOpen: false,
  catalogOpen: false,
  authConfigOpen: false,
  probeOpen: false,
} /*EDITMODE-END*/;

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [view, setView] = _appState(tweaks.view);
  const [selectedId, setSelectedId] = _appState(tweaks.selectedModel);
  const [catalogOpen, setCatalogOpen] = _appState(false);
  const [authConfigOpen, setAuthConfigOpen] = _appState(false);
  const [probeOpen, setProbeOpen] = _appState(false);

  _appEffect(() => {
    document.documentElement.setAttribute("data-theme", tweaks.theme);
    document.documentElement.setAttribute("data-density", tweaks.density);
  }, [tweaks.theme, tweaks.density]);
  _appEffect(() => {
    setView(tweaks.view);
  }, [tweaks.view]);
  _appEffect(() => {
    setSelectedId(tweaks.selectedModel);
  }, [tweaks.selectedModel]);
  _appEffect(() => {
    setCatalogOpen(tweaks.catalogOpen);
  }, [tweaks.catalogOpen]);
  _appEffect(() => {
    setAuthConfigOpen(tweaks.authConfigOpen);
  }, [tweaks.authConfigOpen]);
  _appEffect(() => {
    setProbeOpen(tweaks.probeOpen);
  }, [tweaks.probeOpen]);

  const models = window.MOCK.runtimeModels;
  const selectedModel = _appMemo(
    () => models.find((m) => m.id === selectedId) || null,
    [models, selectedId],
  );

  const goToDetail = (id) => {
    setView("detail");
    setSelectedId(id);
    setTweak({ view: "detail", selectedModel: id, activeTab: "overview" });
  };
  const goToList = () => {
    setView("list");
    setTweak("view", "list");
  };

  _appEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setCatalogOpen(true);
        setTweak("catalogOpen", true);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const el = document.querySelector(".toolbar__search input");
        if (el) el.focus();
      } else if (
        e.key === "Escape" &&
        view === "detail" &&
        !catalogOpen &&
        !authConfigOpen &&
        !probeOpen
      ) {
        e.preventDefault();
        goToList();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [view, catalogOpen, authConfigOpen, probeOpen]);

  return (
    <div className="app">
      {view === "list" ? (
        <ListView
          models={models}
          listState={tweaks.listState}
          searchQuery={tweaks.searchQuery}
          filter={tweaks.filter}
          onSearch={(v) => setTweak("searchQuery", v)}
          onFilter={(v) => setTweak("filter", v)}
          onSelect={goToDetail}
          onCatalogClick={() => {
            setCatalogOpen(true);
            setTweak("catalogOpen", true);
          }}
        />
      ) : selectedModel ? (
        <DetailView
          key={selectedModel.id}
          model={selectedModel}
          tweaks={tweaks}
          setTweak={setTweak}
          onBack={goToList}
          onProbe={() => {
            setProbeOpen(true);
            setTweak("probeOpen", true);
          }}
          onAuthConfig={() => {
            setAuthConfigOpen(true);
            setTweak("authConfigOpen", true);
          }}
        />
      ) : (
        <ListView
          models={models}
          listState={tweaks.listState}
          searchQuery={tweaks.searchQuery}
          filter={tweaks.filter}
          onSearch={(v) => setTweak("searchQuery", v)}
          onFilter={(v) => setTweak("filter", v)}
          onSelect={goToDetail}
          onCatalogClick={() => {
            setCatalogOpen(true);
            setTweak("catalogOpen", true);
          }}
        />
      )}

      <CatalogDialog
        open={catalogOpen}
        onClose={() => {
          setCatalogOpen(false);
          setTweak("catalogOpen", false);
        }}
        onAdd={(modelId) => {
          setCatalogOpen(false);
          setTweak("catalogOpen", false);
          if (modelId) goToDetail(modelId);
        }}
      />
      <AuthConfigDialog
        open={authConfigOpen}
        provider={selectedModel?.provider}
        onClose={() => {
          setAuthConfigOpen(false);
          setTweak("authConfigOpen", false);
        }}
      />
      <ProbeResultDialog
        open={probeOpen}
        model={selectedModel}
        onClose={() => {
          setProbeOpen(false);
          setTweak("probeOpen", false);
        }}
      />

      <TweaksPanel title="Models prototype">
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

        <TweakSection label="Selected model" />
        <TweakSelect
          label="Model"
          value={tweaks.selectedModel}
          options={models.map((m) => ({ value: m.id, label: m.displayName }))}
          onChange={(v) => setTweak("selectedModel", v)}
        />
        <TweakSelect
          label="Tab"
          value={tweaks.activeTab}
          options={MODEL_TABS.map((t) => ({ value: t.id, label: t.label }))}
          onChange={(v) => setTweak("activeTab", v)}
        />
        <TweakRadio
          label="Detail state"
          value={tweaks.detailState}
          options={["ready", "loading", "error"]}
          onChange={(v) => setTweak("detailState", v)}
        />

        <TweakSection label="Dialogs" />
        <TweakToggle
          label="Catalog (add model)"
          value={tweaks.catalogOpen}
          onChange={(v) => setTweak("catalogOpen", v)}
        />
        <TweakToggle
          label="Auth config"
          value={tweaks.authConfigOpen}
          onChange={(v) => setTweak("authConfigOpen", v)}
        />
        <TweakToggle
          label="Probe result"
          value={tweaks.probeOpen}
          onChange={(v) => setTweak("probeOpen", v)}
        />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
