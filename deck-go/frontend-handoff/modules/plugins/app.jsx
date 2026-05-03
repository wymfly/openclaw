// plugins — Application shell.
// Page-transition layout (list ↔ detail). Three dialogs above the active view:
// DiagnosticDetailDialog, ManifestPreviewDialog, RawJsonDialog.

const { useState: _appState, useEffect: _appEffect, useMemo: _appMemo } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/ {
  theme: "dark",
  density: "comfortable",
  view: "list",
  selectedPlugin: "discord-provider",
  activeTab: "overview",
  listState: "ready",
  detailState: "ready",
  scope: "all",
  filter: "all",
  origin: "all",
  searchQuery: "",
  diagnosticOpen: false,
  manifestOpen: false,
  rawOpen: false,
} /*EDITMODE-END*/;

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [view, setView] = _appState(tweaks.view);
  const [selectedId, setSelectedId] = _appState(tweaks.selectedPlugin);
  const [diagnosticOpen, setDiagnosticOpen] = _appState(false);
  const [activeDiagnostic, setActiveDiagnostic] = _appState(null);
  const [manifestOpen, setManifestOpen] = _appState(false);
  const [rawOpen, setRawOpen] = _appState(false);

  _appEffect(() => {
    document.documentElement.setAttribute("data-theme", tweaks.theme);
    document.documentElement.setAttribute("data-density", tweaks.density);
  }, [tweaks.theme, tweaks.density]);

  _appEffect(() => {
    setView(tweaks.view);
  }, [tweaks.view]);
  _appEffect(() => {
    setSelectedId(tweaks.selectedPlugin);
  }, [tweaks.selectedPlugin]);
  _appEffect(() => {
    setDiagnosticOpen(tweaks.diagnosticOpen);
  }, [tweaks.diagnosticOpen]);
  _appEffect(() => {
    setManifestOpen(tweaks.manifestOpen);
  }, [tweaks.manifestOpen]);
  _appEffect(() => {
    setRawOpen(tweaks.rawOpen);
  }, [tweaks.rawOpen]);

  const allPlugins = window.MOCK.inventoryAll.plugins;
  const channelPlugins = window.MOCK.inventoryChannel.plugins;

  const inScope = _appMemo(
    () => (tweaks.scope === "channel" ? channelPlugins : allPlugins),
    [tweaks.scope, allPlugins, channelPlugins],
  );

  const selectedPlugin = _appMemo(
    () => allPlugins.find((p) => p.id === selectedId) || null,
    [allPlugins, selectedId],
  );
  const selectedManifest = _appMemo(
    () => (selectedPlugin ? window.MOCK.manifests[selectedPlugin.id] || null : null),
    [selectedPlugin],
  );
  const selectedTimeline = _appMemo(
    () => (selectedPlugin ? window.MOCK.activationTimeline[selectedPlugin.id] || [] : []),
    [selectedPlugin],
  );

  const goToDetail = (id) => {
    setView("detail");
    setSelectedId(id);
    setTweak({ view: "detail", selectedPlugin: id, activeTab: "overview" });
  };
  const goToList = () => {
    setView("list");
    setTweak("view", "list");
  };
  const refresh = () => {
    setTweak("listState", "loading");
    setTimeout(() => setTweak("listState", "ready"), 320);
  };

  const openDiagnostic = (d) => {
    setActiveDiagnostic(d);
    setDiagnosticOpen(true);
    setTweak("diagnosticOpen", true);
  };

  // ⌘K focus search · ⌘R refresh · Esc back
  _appEffect(() => {
    const h = (e) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.querySelector(".toolbar__search input")?.focus();
      } else if (meta && e.key.toLowerCase() === "r") {
        e.preventDefault();
        refresh();
      } else if (
        e.key === "Escape" &&
        view === "detail" &&
        !diagnosticOpen &&
        !manifestOpen &&
        !rawOpen
      ) {
        e.preventDefault();
        goToList();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [view, diagnosticOpen, manifestOpen, rawOpen]);

  return (
    <div className="app">
      {view === "list" ? (
        <ListView
          plugins={inScope}
          selectedId={selectedId}
          listState={tweaks.listState}
          searchQuery={tweaks.searchQuery}
          filter={tweaks.filter}
          scope={tweaks.scope}
          origin={tweaks.origin}
          asOfMs={window.MOCK.kpis.asOfMs}
          runtimeId={window.MOCK.kpis.runtimeId}
          onSearch={(v) => setTweak("searchQuery", v)}
          onFilter={(v) => setTweak("filter", v)}
          onScope={(v) => setTweak("scope", v)}
          onOrigin={(v) => setTweak("origin", v)}
          onSelect={goToDetail}
          onRefresh={refresh}
        />
      ) : selectedPlugin ? (
        <DetailView
          key={selectedPlugin.id}
          plugin={selectedPlugin}
          manifest={selectedManifest}
          timeline={selectedTimeline}
          tweaks={tweaks}
          setTweak={setTweak}
          onBack={goToList}
          onViewRaw={() => {
            setRawOpen(true);
            setTweak("rawOpen", true);
          }}
          onViewManifest={() => {
            setManifestOpen(true);
            setTweak("manifestOpen", true);
          }}
          onOpenDiagnostic={openDiagnostic}
        />
      ) : (
        <ListView
          plugins={inScope}
          selectedId={selectedId}
          listState={tweaks.listState}
          searchQuery={tweaks.searchQuery}
          filter={tweaks.filter}
          scope={tweaks.scope}
          origin={tweaks.origin}
          asOfMs={window.MOCK.kpis.asOfMs}
          runtimeId={window.MOCK.kpis.runtimeId}
          onSearch={(v) => setTweak("searchQuery", v)}
          onFilter={(v) => setTweak("filter", v)}
          onScope={(v) => setTweak("scope", v)}
          onOrigin={(v) => setTweak("origin", v)}
          onSelect={goToDetail}
          onRefresh={refresh}
        />
      )}

      <DiagnosticDetailDialog
        open={diagnosticOpen}
        plugin={selectedPlugin}
        diagnostic={activeDiagnostic}
        onClose={() => {
          setDiagnosticOpen(false);
          setTweak("diagnosticOpen", false);
        }}
      />
      <ManifestPreviewDialog
        open={manifestOpen}
        plugin={selectedPlugin}
        manifest={selectedManifest}
        onClose={() => {
          setManifestOpen(false);
          setTweak("manifestOpen", false);
        }}
      />
      <RawJsonDialog
        open={rawOpen}
        plugin={selectedPlugin}
        onClose={() => {
          setRawOpen(false);
          setTweak("rawOpen", false);
        }}
      />

      <TweaksPanel title="Plugins prototype">
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
        <TweakRadio
          label="API scope"
          value={tweaks.scope}
          options={["all", "channel"]}
          onChange={(v) => setTweak("scope", v)}
        />
        <TweakRadio
          label="Origin filter"
          value={tweaks.origin}
          options={["all", "bundled", "extension"]}
          onChange={(v) => setTweak("origin", v)}
        />

        <TweakSection label="Selected plugin" />
        <TweakSelect
          label="Plugin"
          value={tweaks.selectedPlugin}
          options={allPlugins.map((p) => ({ value: p.id, label: p.name || p.id }))}
          onChange={(v) => setTweak("selectedPlugin", v)}
        />
        <TweakSelect
          label="Tab"
          value={tweaks.activeTab}
          options={PLUGIN_TABS.map((t) => ({ value: t.id, label: t.label }))}
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
          label="Diagnostic detail"
          value={tweaks.diagnosticOpen}
          onChange={(v) => {
            const first = selectedPlugin?.diagnostics?.[0] || null;
            if (v && first) setActiveDiagnostic(first);
            setTweak("diagnosticOpen", v);
          }}
        />
        <TweakToggle
          label="Manifest preview"
          value={tweaks.manifestOpen}
          onChange={(v) => setTweak("manifestOpen", v)}
        />
        <TweakToggle
          label="Raw JSON"
          value={tweaks.rawOpen}
          onChange={(v) => setTweak("rawOpen", v)}
        />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
