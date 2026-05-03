// skills — Application shell.
// Page-transition layout (list ↔ detail) with two list modes (installed | hub).
// Dialogs above active view: install wizard / configure / disable confirm / files.

const { useState: _appState, useEffect: _appEffect, useMemo: _appMemo } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/ {
  theme: "dark",
  density: "comfortable",
  view: "list",
  mode: "installed",
  selectedSkill: "ralph-loop",
  hubSelectedSlug: "release-orchestrator",
  activeTab: "overview",
  listState: "ready",
  detailState: "ready",
  filter: "all",
  source: "all",
  searchQuery: "",
  installOpen: false,
  configureOpen: false,
  disableOpen: false,
  filesOpen: false,
} /*EDITMODE-END*/;

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [view, setView] = _appState(tweaks.view);
  const [mode, setMode] = _appState(tweaks.mode);
  const [selectedKey, setSelectedKey] = _appState(tweaks.selectedSkill);
  const [hubSlug, setHubSlug] = _appState(tweaks.hubSelectedSlug);
  const [installOpen, setInstallOpen] = _appState(false);
  const [configureOpen, setConfigureOpen] = _appState(false);
  const [disableOpen, setDisableOpen] = _appState(false);
  const [filesOpen, setFilesOpen] = _appState(false);
  // Local "after install" override so the prototype can show the new entry inline.
  const [installedOverlay, setInstalledOverlay] = _appState(null);

  _appEffect(() => {
    document.documentElement.setAttribute("data-theme", tweaks.theme);
    document.documentElement.setAttribute("data-density", tweaks.density);
  }, [tweaks.theme, tweaks.density]);

  _appEffect(() => setView(tweaks.view), [tweaks.view]);
  _appEffect(() => setMode(tweaks.mode), [tweaks.mode]);
  _appEffect(() => setSelectedKey(tweaks.selectedSkill), [tweaks.selectedSkill]);
  _appEffect(() => setHubSlug(tweaks.hubSelectedSlug), [tweaks.hubSelectedSlug]);
  _appEffect(() => setInstallOpen(tweaks.installOpen), [tweaks.installOpen]);
  _appEffect(() => setConfigureOpen(tweaks.configureOpen), [tweaks.configureOpen]);
  _appEffect(() => setDisableOpen(tweaks.disableOpen), [tweaks.disableOpen]);
  _appEffect(() => setFilesOpen(tweaks.filesOpen), [tweaks.filesOpen]);

  const installed = window.MOCK.installed.skills;
  const hub = window.MOCK.hubSearch.results;

  const selectedSkill = _appMemo(
    () => installed.find((s) => s.key === selectedKey) || null,
    [installed, selectedKey],
  );
  const selectedTriggers = _appMemo(
    () => (selectedSkill ? window.MOCK.triggers[selectedSkill.key] || [] : []),
    [selectedSkill],
  );
  const selectedFiles = _appMemo(
    () => (selectedSkill ? window.MOCK.files[selectedSkill.key] || [] : []),
    [selectedSkill],
  );
  const selectedAudit = _appMemo(
    () => (selectedSkill ? window.MOCK.audit[selectedSkill.key] || [] : []),
    [selectedSkill],
  );

  const hubResult = _appMemo(() => hub.find((r) => r.slug === hubSlug) || null, [hub, hubSlug]);
  const hubDetail = _appMemo(
    () => (hubSlug ? window.MOCK.hubDetail[hubSlug] || null : null),
    [hubSlug],
  );
  const hubBins = _appMemo(
    () => (hubSlug ? window.MOCK.hubBins[hubSlug] || { bins: [] } : { bins: [] }),
    [hubSlug],
  );

  const goToDetail = (key) => {
    setView("detail");
    setSelectedKey(key);
    setTweak({ view: "detail", selectedSkill: key, activeTab: "overview" });
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

  const onHubInstall = (slug) => {
    setHubSlug(slug);
    setInstallOpen(true);
    setTweak({ hubSelectedSlug: slug, installOpen: true });
  };
  const onHubPreview = (slug) => {
    setHubSlug(slug);
    setInstallOpen(true);
    setTweak({ hubSelectedSlug: slug, installOpen: true });
  };

  const onInstalled = (slug) => {
    setInstalledOverlay({ slug, ts: Date.now() });
    setInstallOpen(false);
    setTweak("installOpen", false);
    switchMode("installed");
  };

  // ⌘K focus search · ⌘N hub · ⌘R refresh · Esc back
  _appEffect(() => {
    const h = (e) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.querySelector(".toolbar__search input")?.focus();
      } else if (meta && e.key.toLowerCase() === "n") {
        e.preventDefault();
        switchMode("hub");
      } else if (meta && e.key.toLowerCase() === "r") {
        e.preventDefault();
        refresh();
      } else if (
        e.key === "Escape" &&
        view === "detail" &&
        !installOpen &&
        !configureOpen &&
        !disableOpen &&
        !filesOpen
      ) {
        e.preventDefault();
        goToList();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [view, installOpen, configureOpen, disableOpen, filesOpen]);

  const showInstalledBanner = installedOverlay !== null;

  return (
    <div className="app">
      {showInstalledBanner ? (
        <div className="banner banner--success banner--global">
          <IconCheck />
          <div>
            <strong>Skill installed.</strong>
            <p>
              <span className="kbd">{installedOverlay.slug}</span> is now in the inventory.
            </p>
          </div>
          <button
            className="icon-btn"
            type="button"
            aria-label="Dismiss"
            onClick={() => setInstalledOverlay(null)}
          >
            <IconX />
          </button>
        </div>
      ) : null}

      {view === "list" ? (
        <ListView
          mode={mode}
          installed={installed}
          hub={hub}
          selectedKey={selectedKey}
          listState={tweaks.listState}
          searchQuery={tweaks.searchQuery}
          filter={tweaks.filter}
          source={tweaks.source}
          asOfMs={window.MOCK.kpis.asOfMs}
          runtimeId={window.MOCK.kpis.runtimeId}
          onMode={switchMode}
          onSearch={(v) => setTweak("searchQuery", v)}
          onFilter={(v) => setTweak("filter", v)}
          onSource={(v) => setTweak("source", v)}
          onSelect={goToDetail}
          onRefresh={refresh}
          onHubInstall={onHubInstall}
          onHubPreview={onHubPreview}
        />
      ) : selectedSkill ? (
        <DetailView
          key={selectedSkill.key}
          skill={selectedSkill}
          triggers={selectedTriggers}
          files={selectedFiles}
          audit={selectedAudit}
          tweaks={tweaks}
          setTweak={setTweak}
          onBack={goToList}
          onConfigure={() => {
            setConfigureOpen(true);
            setTweak("configureOpen", true);
          }}
          onDisable={() => {
            setDisableOpen(true);
            setTweak("disableOpen", true);
          }}
          onEnable={() => {
            // prototype: enabling a disabled skill — flip and toast
            setInstalledOverlay({ slug: selectedSkill.key, ts: Date.now() });
          }}
          onOpenFiles={() => {
            setFilesOpen(true);
            setTweak("filesOpen", true);
          }}
        />
      ) : (
        <ListView
          mode={mode}
          installed={installed}
          hub={hub}
          selectedKey={selectedKey}
          listState={tweaks.listState}
          searchQuery={tweaks.searchQuery}
          filter={tweaks.filter}
          source={tweaks.source}
          asOfMs={window.MOCK.kpis.asOfMs}
          runtimeId={window.MOCK.kpis.runtimeId}
          onMode={switchMode}
          onSearch={(v) => setTweak("searchQuery", v)}
          onFilter={(v) => setTweak("filter", v)}
          onSource={(v) => setTweak("source", v)}
          onSelect={goToDetail}
          onRefresh={refresh}
          onHubInstall={onHubInstall}
          onHubPreview={onHubPreview}
        />
      )}

      <InstallFromHubDialog
        open={installOpen}
        hubResult={hubResult}
        hubDetail={hubDetail}
        hubBins={hubBins}
        onClose={() => {
          setInstallOpen(false);
          setTweak("installOpen", false);
        }}
        onInstalled={onInstalled}
      />
      <ConfigureSkillDialog
        open={configureOpen}
        skill={selectedSkill}
        onClose={() => {
          setConfigureOpen(false);
          setTweak("configureOpen", false);
        }}
        onSave={() => {
          setConfigureOpen(false);
          setTweak("configureOpen", false);
        }}
      />
      <DisableConfirmDialog
        open={disableOpen}
        skill={selectedSkill}
        onCancel={() => {
          setDisableOpen(false);
          setTweak("disableOpen", false);
        }}
        onConfirm={() => {
          setDisableOpen(false);
          setTweak("disableOpen", false);
        }}
      />
      <SkillReadmeDialog
        open={filesOpen}
        skill={selectedSkill}
        files={selectedFiles}
        onClose={() => {
          setFilesOpen(false);
          setTweak("filesOpen", false);
        }}
      />

      <TweaksPanel title="Skills prototype">
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
          options={["installed", "hub"]}
          onChange={(v) => setTweak("mode", v)}
        />
        <TweakRadio
          label="List state"
          value={tweaks.listState}
          options={["ready", "loading", "error", "empty"]}
          onChange={(v) => setTweak("listState", v)}
        />

        <TweakSection label="Selected skill" />
        <TweakSelect
          label="Skill"
          value={tweaks.selectedSkill}
          options={installed.map((s) => ({ value: s.key, label: s.name }))}
          onChange={(v) => setTweak("selectedSkill", v)}
        />
        <TweakSelect
          label="Tab"
          value={tweaks.activeTab}
          options={SKILL_TABS.map((t) => ({ value: t.id, label: t.label }))}
          onChange={(v) => setTweak("activeTab", v)}
        />
        <TweakRadio
          label="Detail state"
          value={tweaks.detailState}
          options={["ready", "loading", "error"]}
          onChange={(v) => setTweak("detailState", v)}
        />

        <TweakSection label="Hub" />
        <TweakSelect
          label="Hub result"
          value={tweaks.hubSelectedSlug}
          options={hub.map((r) => ({ value: r.slug, label: r.displayName }))}
          onChange={(v) => setTweak("hubSelectedSlug", v)}
        />

        <TweakSection label="Dialogs" />
        <TweakToggle
          label="Install wizard"
          value={tweaks.installOpen}
          onChange={(v) => setTweak("installOpen", v)}
        />
        <TweakToggle
          label="Configure"
          value={tweaks.configureOpen}
          onChange={(v) => setTweak("configureOpen", v)}
        />
        <TweakToggle
          label="Disable confirm"
          value={tweaks.disableOpen}
          onChange={(v) => setTweak("disableOpen", v)}
        />
        <TweakToggle
          label="Files preview"
          value={tweaks.filesOpen}
          onChange={(v) => setTweak("filesOpen", v)}
        />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
