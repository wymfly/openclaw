// MemoryApp — orchestrator: topbar (brand + tab nav + KPI counts) +
// 4 tab views (Browse / Search / Health / Dreams).

const TABS = [
  { id: "browse", label: "Browse", icon: IconFolder },
  { id: "search", label: "Search", icon: IconSearch },
  { id: "health", label: "Health", icon: IconShield },
  { id: "dreams", label: "Dreams", icon: IconBrain },
];

const MemoryApp = () => {
  const [activeTab, setActiveTab] = React.useState(() => {
    const hash = window.location.hash.replace("#/", "");
    return TABS.find((t) => t.id === hash)?.id || "browse";
  });

  React.useEffect(() => {
    window.history.replaceState(null, "", `#/${activeTab}`);
  }, [activeTab]);

  const totalFiles = Object.values(BROWSE_TREE)
    .flat()
    .filter((n) => n.type === "file").length;

  const errCount = HEALTH.entries.filter((e) => e.embeddingStatus === "error").length;

  return (
    <div className="memory-shell">
      <header className="memory-topbar">
        <div className="memory-topbar__brand">
          <IconMemory />
          <span>Memory</span>
          <span className="muted small">/ embedding-backed memory store</span>
        </div>

        <nav className="memory-topbar__tabs" role="tablist">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={active}
                className={`memory-topbar__tab ${active ? "memory-topbar__tab--on" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon />
                <span>{tab.label}</span>
                {tab.id === "health" && errCount > 0 && (
                  <span className="memory-topbar__tab-badge">{errCount}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="memory-topbar__actions">
          <span className="memory-topbar__kpi muted small">
            <strong>{totalFiles}</strong> files
          </span>
          <span className="memory-topbar__kpi muted small">
            <strong>{HEALTH.entries.length}</strong> agents
          </span>
          <span className={`memory-topbar__kpi ${errCount > 0 ? "memory-topbar__kpi--err" : ""}`}>
            <strong>{errCount}</strong> errors
          </span>
        </div>
      </header>

      <main className="memory-workspace">
        {activeTab === "browse" && <MemoryBrowser />}
        {activeTab === "search" && <MemorySearch />}
        {activeTab === "health" && <MemoryHealth />}
        {activeTab === "dreams" && <MemoryDreams />}
      </main>

      <TweaksPanel />
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<MemoryApp />);
