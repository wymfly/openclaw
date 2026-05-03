// channels — Application shell.
// Page-transition layout (list ↔ detail), no split panel. Dialogs and the
// tweaks panel live above the active view.

const { useState: _appState, useEffect: _appEffect, useMemo: _appMemo } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/ {
  theme: "dark",
  density: "comfortable",
  view: "list",
  selectedChannel: "discord",
  activeTab: "overview",
  listState: "ready",
  detailState: "ready",
  throughputWindow: "1h",
  searchQuery: "",
  filter: "all",
  configDirty: false,
  testOpen: false,
  logoutOpen: false,
  createOpen: false,
} /*EDITMODE-END*/;

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [view, setView] = _appState(tweaks.view);
  const [selectedId, setSelectedId] = _appState(tweaks.selectedChannel);
  const [testOpen, setTestOpen] = _appState(false);
  const [logoutOpen, setLogoutOpen] = _appState(false);
  const [createOpen, setCreateOpen] = _appState(false);

  // Sync theme + density
  _appEffect(() => {
    document.documentElement.setAttribute("data-theme", tweaks.theme);
    document.documentElement.setAttribute("data-density", tweaks.density);
  }, [tweaks.theme, tweaks.density]);

  // Sync tweaks → local state
  _appEffect(() => {
    setView(tweaks.view);
  }, [tweaks.view]);
  _appEffect(() => {
    setSelectedId(tweaks.selectedChannel);
  }, [tweaks.selectedChannel]);
  _appEffect(() => {
    setTestOpen(tweaks.testOpen);
  }, [tweaks.testOpen]);
  _appEffect(() => {
    setLogoutOpen(tweaks.logoutOpen);
  }, [tweaks.logoutOpen]);
  _appEffect(() => {
    setCreateOpen(tweaks.createOpen);
  }, [tweaks.createOpen]);

  const status = window.MOCK.status;
  const channels = _appMemo(
    () =>
      (status.channelOrder || []).map((id) => ({
        id,
        label: status.channelLabels[id] || id,
        detailLabel: status.channelDetailLabels[id] || "",
        meta: (status.channelMeta || []).find((m) => m.id === id) || {},
        core: status.channels[id] || { enabled: false, healthy: false, accounts: [] },
        defaultAccountId: status.channelDefaultAccountId[id] || null,
      })),
    [status],
  );
  const selectedChannel = _appMemo(
    () => channels.find((c) => c.id === selectedId) || null,
    [channels, selectedId],
  );

  const goToDetail = (id) => {
    setView("detail");
    setSelectedId(id);
    setTweak({ view: "detail", selectedChannel: id, activeTab: "overview" });
  };
  const goToList = () => {
    setView("list");
    setTweak("view", "list");
  };

  // ⌘K to focus search, Esc to back, ⌘N to open new-channel wizard
  _appEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setCreateOpen(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const el = document.querySelector(".toolbar__search input");
        if (el) el.focus();
      } else if (
        e.key === "Escape" &&
        view === "detail" &&
        !testOpen &&
        !logoutOpen &&
        !createOpen
      ) {
        e.preventDefault();
        goToList();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [view, testOpen, logoutOpen, createOpen]);

  return (
    <div className="app">
      {view === "list" ? (
        <ListView
          channels={channels}
          listState={tweaks.listState}
          searchQuery={tweaks.searchQuery}
          filter={tweaks.filter}
          onSearch={(v) => setTweak("searchQuery", v)}
          onFilter={(v) => setTweak("filter", v)}
          onSelect={goToDetail}
          onCreateClick={() => setCreateOpen(true)}
        />
      ) : selectedChannel ? (
        <DetailView
          key={selectedChannel.id}
          channel={selectedChannel}
          tweaks={tweaks}
          setTweak={setTweak}
          onBack={goToList}
          onTest={() => setTestOpen(true)}
          onLogout={() => setLogoutOpen(true)}
        />
      ) : (
        <ListView
          channels={channels}
          listState={tweaks.listState}
          searchQuery={tweaks.searchQuery}
          filter={tweaks.filter}
          onSearch={(v) => setTweak("searchQuery", v)}
          onFilter={(v) => setTweak("filter", v)}
          onSelect={goToDetail}
          onCreateClick={() => setCreateOpen(true)}
        />
      )}

      <TestResultDialog
        open={testOpen}
        channel={selectedChannel}
        onClose={() => {
          setTestOpen(false);
          setTweak("testOpen", false);
        }}
      />
      <LogoutDialog
        open={logoutOpen}
        channel={selectedChannel}
        onCancel={() => {
          setLogoutOpen(false);
          setTweak("logoutOpen", false);
        }}
        onConfirm={() => {
          setLogoutOpen(false);
          setTweak("logoutOpen", false);
        }}
      />
      <CreateChannelDialog
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setTweak("createOpen", false);
        }}
        onCreated={(id) => {
          setCreateOpen(false);
          setTweak("createOpen", false);
          if (id) goToDetail(id);
        }}
      />

      <TweaksPanel title="Channels prototype">
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

        <TweakSection label="Selected channel" />
        <TweakSelect
          label="Channel"
          value={tweaks.selectedChannel}
          options={channels.map((c) => ({ value: c.id, label: c.label }))}
          onChange={(v) => setTweak("selectedChannel", v)}
        />
        <TweakSelect
          label="Tab"
          value={tweaks.activeTab}
          options={CHANNEL_TABS.map((t) => ({ value: t.id, label: t.label }))}
          onChange={(v) => setTweak("activeTab", v)}
        />
        <TweakRadio
          label="Detail state"
          value={tweaks.detailState}
          options={["ready", "loading", "error"]}
          onChange={(v) => setTweak("detailState", v)}
        />
        <TweakRadio
          label="Throughput window"
          value={tweaks.throughputWindow}
          options={["1h", "6h", "24h"]}
          onChange={(v) => setTweak("throughputWindow", v)}
        />
        <TweakToggle
          label="Settings dirty"
          value={tweaks.configDirty}
          onChange={(v) => setTweak("configDirty", v)}
        />

        <TweakSection label="Dialogs" />
        <TweakToggle
          label="Test result"
          value={tweaks.testOpen}
          onChange={(v) => setTweak("testOpen", v)}
        />
        <TweakToggle
          label="Logout confirm"
          value={tweaks.logoutOpen}
          onChange={(v) => setTweak("logoutOpen", v)}
        />
        <TweakToggle
          label="Create wizard"
          value={tweaks.createOpen}
          onChange={(v) => setTweak("createOpen", v)}
        />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
