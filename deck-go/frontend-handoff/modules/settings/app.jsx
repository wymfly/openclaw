// app.jsx — SettingsApp orchestrator (left section nav + right group renderer + bootstrap topbar).

const { useEffect, useMemo, useState, useCallback } = React;

function SettingsApp() {
  const data = window.SettingsData;

  const [tweaks] = useState({
    theme: "dark",
    density: "compact",
    runtimeMode: "bundled", // bundled | remote — Tweaks toggles between sample fixtures
  });

  const [activeSection, setActiveSection] = useState("identity");
  const [navQuery, setNavQuery] = useState("");
  const [draftSettings, setDraftSettings] = useState(data.settings);
  const [draftEndpoint, setDraftEndpoint] = useState(data.remoteEndpoint);
  const [endpointDirty, setEndpointDirty] = useState(false);
  const [bootstrap, setBootstrap] = useState(data.initialBootstrap);
  const [recentSaves, setRecentSaves] = useState(data.recentSaves);
  const [dialog, setDialog] = useState(null);
  const [now, setNow] = useState(Date.now());

  // Tweaks toggle bundled ↔ remote — swaps the runtime fixture.
  useEffect(() => {
    const fixture = tweaks.runtimeMode === "bundled" ? data.bundledRuntime : data.remoteRuntime;
    setBootstrap((b) => ({ ...b, runtime: fixture }));
  }, [tweaks.runtimeMode]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", tweaks.theme);
    document.documentElement.setAttribute("data-density", tweaks.density);
  }, [tweaks.theme, tweaks.density]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // ⌘K → focus the section nav search input.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const el = document.querySelector(".settings-nav__search input");
        if (el) el.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Diff draft vs initial settings to compute per-section dirty counts.
  const dirtyBySection = useMemo(() => {
    const out = {};
    const initial = data.settings;
    if (draftSettings.appearance) {
      let n = 0;
      for (const k of Object.keys(draftSettings.appearance)) {
        if (draftSettings.appearance[k] !== initial.appearance[k]) n++;
      }
      if (n) out.appearance = n;
    }
    if (draftSettings.notifications) {
      let n = 0;
      for (const k of Object.keys(draftSettings.notifications)) {
        if (draftSettings.notifications[k] !== initial.notifications[k]) n++;
      }
      if (n) out.notifications = n;
    }
    if (endpointDirty) out.runtime = (out.runtime || 0) + 1;
    return out;
  }, [draftSettings, endpointDirty]);

  const isBundled = bootstrap.runtime?.mode === "bundled";

  const onChangeSetting = useCallback((edit) => {
    if (edit.kind === "appearance") {
      setDraftSettings((s) => ({
        ...s,
        appearance: { ...s.appearance, [edit.path]: edit.value },
      }));
    } else if (edit.kind === "notifications") {
      setDraftSettings((s) => ({
        ...s,
        notifications: { ...s.notifications, [edit.path]: edit.value },
      }));
    } else if (edit.kind === "rotate-token") {
      setDialog({ kind: "rotate-token" });
    }
  }, []);

  const onChangeEndpoint = useCallback(
    (path, value) => {
      if (isBundled) return;
      setDraftEndpoint((e) => ({ ...e, [path]: value }));
      setEndpointDirty(true);
    },
    [isBundled],
  );

  const onUnpair = useCallback(
    (id) => {
      const device = draftSettings.pairedDevices.find((d) => d.id === id);
      setDialog({ kind: "unpair", device });
    },
    [draftSettings.pairedDevices],
  );

  const onUnpairConfirmed = useCallback(() => {
    if (!dialog?.device) return;
    setDraftSettings((s) => ({
      ...s,
      pairedDevices: s.pairedDevices.filter((d) => d.id !== dialog.device.id),
    }));
    setDialog(null);
  }, [dialog]);

  const onRotateConfirmed = useCallback(() => {
    setDialog(null);
    setRecentSaves((rs) =>
      [
        {
          ts: Date.now(),
          actor: "operator:owner@openclaw",
          section: "identity",
          paths: ["accessToken"],
          ok: true,
        },
        ...rs,
      ].slice(0, 8),
    );
  }, []);

  const onSaveOpen = useCallback(() => {
    if (Object.keys(dirtyBySection).length === 0) return;
    setDialog({ kind: "save" });
  }, [dirtyBySection]);

  const onSaveConfirmed = useCallback(() => {
    setRecentSaves((rs) =>
      [
        {
          ts: Date.now(),
          actor: "operator:owner@openclaw",
          section: Object.keys(dirtyBySection).join("+"),
          paths: Object.values(dirtyBySection).map(
            (n, i) => `${Object.keys(dirtyBySection)[i]}.×${n}`,
          ),
          ok: true,
        },
        ...rs,
      ].slice(0, 8),
    );
    setEndpointDirty(false);
    setDialog(null);
    // Persist the draft as the new initial baseline (in production, refetch).
    data.settings = JSON.parse(JSON.stringify(draftSettings));
    data.remoteEndpoint = JSON.parse(JSON.stringify(draftEndpoint));
  }, [dirtyBySection, draftSettings, draftEndpoint]);

  const onResetDraft = useCallback(() => {
    setDraftSettings(JSON.parse(JSON.stringify(data.settings)));
    setDraftEndpoint(JSON.parse(JSON.stringify(data.remoteEndpoint)));
    setEndpointDirty(false);
  }, []);

  const onTestEndpoint = useCallback(() => {
    setDialog({ kind: "test-connection" });
  }, []);

  const dirtyTotal = Object.values(dirtyBySection).reduce((s, n) => s + n, 0);

  return (
    <div className={`settings-app ds-density-${tweaks.density} ds-theme-${tweaks.theme}`}>
      <header className="settings-app__topbar">
        <div className="settings-app__topbar-lead">
          <p className="settings-app__eyebrow">Control / app preferences</p>
          <h1>Settings</h1>
          <p className="settings-app__subtitle">
            Operator preferences for this Deck-go instance. Bundled runtime mode is read-only;
            remote runtime mode allows endpoint edits. <code>{bootstrap.settings.path}</code>
          </p>
        </div>
        <div className="settings-app__topbar-trail">
          {dirtyTotal > 0 ? (
            <window.StatusPill tone="warn" icon={window.IconAlert}>
              {dirtyTotal} unsaved
            </window.StatusPill>
          ) : (
            <window.StatusPill tone="success" icon={window.IconCheck}>
              All saved
            </window.StatusPill>
          )}
          <span className="settings-app__kbd">
            <kbd>⌘</kbd>
            <kbd>K</kbd>
            <span>Search settings</span>
          </span>
        </div>
      </header>

      <main className="settings-app__layout">
        <window.SettingsNav
          sections={data.sections}
          activeSection={activeSection}
          onSelect={setActiveSection}
          dirtyBySection={dirtyBySection}
          query={navQuery}
          onQueryChange={setNavQuery}
        />

        <section className="settings-app__main">
          {activeSection === "identity" ? (
            <window.IdentityGroup
              settings={draftSettings}
              onChange={onChangeSetting}
              locked={false}
            />
          ) : null}
          {activeSection === "runtime" ? (
            <window.RuntimeGroup
              runtime={bootstrap.runtime}
              endpoint={draftEndpoint}
              onTestEndpoint={onTestEndpoint}
              onChangeEndpoint={onChangeEndpoint}
              dirty={endpointDirty}
              locked={false}
            />
          ) : null}
          {activeSection === "appearance" ? (
            <window.AppearanceGroup
              settings={draftSettings}
              onChange={onChangeSetting}
              locked={false}
            />
          ) : null}
          {activeSection === "notifications" ? (
            <window.NotificationsGroup
              settings={draftSettings}
              onChange={onChangeSetting}
              locked={false}
            />
          ) : null}
          {activeSection === "devices" ? (
            <window.DevicesGroup
              settings={draftSettings}
              now={now}
              onUnpair={onUnpair}
              locked={false}
            />
          ) : null}
          {activeSection === "version" ? (
            <window.VersionGroup
              version={data.version}
              gatewayVersion={bootstrap.runtime?.gatewayVersion}
              capabilitySnapshotAvailable={bootstrap.gateway.capabilitySnapshotAvailable}
              schemaVersion={bootstrap.gateway.schemaVersion}
            />
          ) : null}

          <footer className="settings-app__footer">
            <div className="settings-app__footer-info">
              {recentSaves[0] ? (
                <span>
                  Last saved{" "}
                  <strong>{Math.max(0, Math.round((now - recentSaves[0].ts) / 60000))}m ago</strong>{" "}
                  · {recentSaves[0].section}
                </span>
              ) : null}
            </div>
            <div className="settings-app__footer-actions">
              <button
                type="button"
                className="ds-btn"
                onClick={onResetDraft}
                disabled={dirtyTotal === 0}
              >
                <window.IconUndo size={12} />
                <span>Reset</span>
              </button>
              <button
                type="button"
                className="ds-btn ds-btn--primary"
                onClick={onSaveOpen}
                disabled={dirtyTotal === 0}
              >
                <window.IconSave size={12} />
                <span>Save ({dirtyTotal})</span>
              </button>
            </div>
          </footer>
        </section>
      </main>

      {dialog?.kind === "test-connection" ? (
        <window.TestConnectionDialog endpoint={draftEndpoint} onClose={() => setDialog(null)} />
      ) : null}
      {dialog?.kind === "rotate-token" ? (
        <window.RotateTokenDialog onClose={() => setDialog(null)} onConfirm={onRotateConfirmed} />
      ) : null}
      {dialog?.kind === "unpair" ? (
        <window.UnpairDeviceDialog
          device={dialog.device}
          onClose={() => setDialog(null)}
          onConfirm={onUnpairConfirmed}
        />
      ) : null}
      {dialog?.kind === "save" ? (
        <window.SaveDialog
          dirtyBySection={dirtyBySection}
          onClose={() => setDialog(null)}
          onConfirm={onSaveConfirmed}
        />
      ) : null}
    </div>
  );
}

Object.assign(window, { SettingsApp });
