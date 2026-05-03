// app.jsx — ConfigApp orchestrator (left section nav + middle form + right diff/raw/history).

const { useEffect, useMemo, useState, useCallback } = React;

function ConfigApp() {
  const data = window.ConfigData;

  const [tweaks, setTweaks] = useState({
    theme: "dark",
    density: "compact",
    paneMode: "diff",
  });

  const [activeSection, setActiveSection] = useState("agents");
  const [navQuery, setNavQuery] = useState("");
  const [draft, setDraft] = useState(data.initialSnapshot.config);
  const [draftRaw, setDraftRaw] = useState(data.initialSnapshot.raw);
  const [draftValid, setDraftValid] = useState(true);
  const [paneMode, setPaneMode] = useState("diff");
  const [dialog, setDialog] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [snapshot, setSnapshot] = useState(data.initialSnapshot);
  const [recentApplies, setRecentApplies] = useState(data.recentApplies);

  // Apply tweak attributes onto root for theme + density token swaps.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", tweaks.theme);
    document.documentElement.setAttribute("data-density", tweaks.density);
  }, [tweaks.theme, tweaks.density]);

  // Keep the in-tweaks paneMode in sync with the user's pane button.
  useEffect(() => {
    if (paneMode !== tweaks.paneMode) setTweaks((t) => ({ ...t, paneMode }));
  }, [paneMode, tweaks.paneMode]);

  // Tick the relative-time clock — keeps history rows fresh during demo.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // ⌘K → focus the section nav search input.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const el = document.querySelector(".section-nav__search input");
        if (el) el.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Compute dirty paths by deep-diffing draft vs snapshot.config.
  const dirtyPaths = useMemo(() => {
    const diff = window.computeDiff(snapshot.config, draft);
    return diff.map((d) => d.path);
  }, [draft, snapshot]);

  const draftHash = useMemo(() => {
    if (dirtyPaths.length === 0) return snapshot.hash;
    const hex = (JSON.stringify(draft).length * 31 + dirtyPaths.length).toString(16);
    return `draft-${hex.padStart(8, "0").slice(0, 12)}`;
  }, [draft, dirtyPaths, snapshot.hash]);

  const onChangeField = useCallback((path, value) => {
    setDraft((prev) => {
      const next = window.setAtPath(prev, path, value);
      try {
        setDraftRaw(JSON.stringify(next, null, 2));
        setDraftValid(true);
      } catch {
        setDraftValid(false);
      }
      return next;
    });
  }, []);

  const onChangeRaw = useCallback((text) => {
    setDraftRaw(text);
    try {
      const parsed = JSON.parse(text);
      setDraft(parsed);
      setDraftValid(true);
    } catch {
      setDraftValid(false);
    }
  }, []);

  const onRefresh = useCallback(() => {
    setNow(Date.now());
  }, []);

  const onApplyConfirmed = useCallback(() => {
    const newHash = draftHash;
    const newApply = {
      ts: Date.now(),
      actor: "operator:owner@openclaw",
      paths: dirtyPaths,
      previousHash: snapshot.hash,
      newHash,
      ok: true,
    };
    setSnapshot({
      ...snapshot,
      raw: draftRaw,
      config: draft,
      hash: newHash,
      baseHash: newHash,
    });
    setRecentApplies([newApply, ...recentApplies].slice(0, 8));
    setDialog(null);
  }, [draft, draftHash, draftRaw, dirtyPaths, recentApplies, snapshot]);

  const onResetConfirmed = useCallback(() => {
    setDraft(snapshot.config);
    setDraftRaw(snapshot.raw);
    setDraftValid(true);
    setDialog(null);
  }, [snapshot]);

  const onSelectPathFromDiff = useCallback((path) => {
    const top = path.split(".")[0];
    setActiveSection(top);
  }, []);

  const togglePreviewMode = useCallback(() => {
    setPaneMode((m) => (m === "diff" ? "raw" : "diff"));
  }, []);

  const sectionPath = data.sections.find((s) => s.id === activeSection)?.path || activeSection;
  const dirtyTotal = dirtyPaths.length;

  return (
    <div className={`config-app ds-density-${tweaks.density} ds-theme-${tweaks.theme}`}>
      <header className="config-app__topbar">
        <div className="config-app__topbar-lead">
          <p className="config-app__eyebrow">Control / config governance</p>
          <h1>Configuration</h1>
          <p className="config-app__subtitle">
            Schema-guided <code>openclaw.json</code> editing with diff preview, optimistic
            concurrency, and apply history.
          </p>
        </div>
        <div className="config-app__topbar-trail">
          {dirtyTotal > 0 ? (
            <window.StatusPill tone="warn" icon={window.IconAlert}>
              {dirtyTotal} unsaved
            </window.StatusPill>
          ) : (
            <window.StatusPill tone="success" icon={window.IconCheck}>
              Snapshot in sync
            </window.StatusPill>
          )}
          <span className="config-app__kbd">
            <kbd>⌘</kbd>
            <kbd>K</kbd>
            <span>Focus section search</span>
          </span>
        </div>
      </header>

      <main className="config-app__layout">
        <window.SectionNav
          sections={data.sections}
          activeSection={activeSection}
          onSelect={setActiveSection}
          dirtyPaths={dirtyPaths}
          query={navQuery}
          onQueryChange={setNavQuery}
        />

        <window.FormSection
          draft={draft}
          schemaLookups={data.schemaLookups}
          activeSectionPath={sectionPath}
          dirtyPaths={dirtyPaths}
          onChange={onChangeField}
          onApplyOpen={() => setDialog({ kind: "apply" })}
          onResetOpen={() => setDialog({ kind: "reset" })}
          onRefresh={onRefresh}
          onTogglePreview={togglePreviewMode}
          previewMode={paneMode === "diff"}
          baseHash={snapshot.hash}
          draftHash={draftHash}
        />

        <window.DiffPane
          baseConfig={snapshot.config}
          draftConfig={draft}
          draftRaw={draftRaw}
          draftValid={draftValid}
          onDraftRaw={onChangeRaw}
          recentApplies={recentApplies}
          now={now}
          mode={paneMode}
          onModeChange={setPaneMode}
          onOpenSnapshot={() => setDialog({ kind: "snapshot" })}
          onSelectPath={onSelectPathFromDiff}
        />
      </main>

      {dialog?.kind === "apply" ? (
        <window.ApplyConfirmDialog
          baseHash={snapshot.hash}
          draftHash={draftHash}
          diff={window.computeDiff(snapshot.config, draft)}
          onClose={() => setDialog(null)}
          onConfirm={onApplyConfirmed}
        />
      ) : null}
      {dialog?.kind === "reset" ? (
        <window.ResetDialog
          dirtyPaths={dirtyPaths}
          onClose={() => setDialog(null)}
          onConfirm={onResetConfirmed}
        />
      ) : null}
      {dialog?.kind === "snapshot" ? (
        <window.RawSnapshotDialog snapshot={snapshot} onClose={() => setDialog(null)} />
      ) : null}
    </div>
  );
}

Object.assign(window, { ConfigApp });
