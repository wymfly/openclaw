// CronApp — orchestrator: topbar (KPI + scheduler state + New + Refresh) +
// 2-pane (jobs list + job detail) + CronBuilder modal.

const CronApp = () => {
  const [jobs, setJobs] = React.useState(window.CRON_JOBS);
  const [runs, setRuns] = React.useState(window.CRON_RUNS);
  const [status, setStatus] = React.useState(window.CRON_STATUS);
  const [selectedId, setSelectedId] = React.useState(window.CRON_JOBS[0]?.id || null);
  const [enabledFilter, setEnabledFilter] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const [sortBy, setSortBy] = React.useState("nextRunAtMs");
  const [builder, setBuilder] = React.useState({ open: false, initial: null });
  const [refreshing, setRefreshing] = React.useState(false);
  const tweaks = window.useTweaks ? window.useTweaks() : { theme: "dark", density: "compact" };

  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", tweaks.theme);
    document.documentElement.setAttribute("data-density", tweaks.density);
  }, [tweaks.theme, tweaks.density]);

  const selected = jobs.find((j) => j.id === selectedId) || null;

  const handleAction = (id, action) => {
    if (action === "delete") {
      setJobs((arr) => arr.filter((j) => j.id !== id));
      const remaining = jobs.filter((j) => j.id !== id);
      setSelectedId(remaining[0]?.id || null);
    } else if (action === "enable" || action === "disable") {
      setJobs((arr) =>
        arr.map((j) =>
          j.id === id ? { ...j, enabled: action === "enable", updatedAtMs: Date.now() } : j,
        ),
      );
    } else if (action === "run") {
      const job = jobs.find((j) => j.id === id);
      if (!job) return;
      const newRun = {
        id: `run-${id}-${Date.now()}`,
        jobId: id,
        status: Math.random() < 0.92 ? "ok" : "error",
        ts: Date.now(),
        runAtMs: Date.now() - 320,
        durationMs: 320 + Math.floor(Math.random() * 800),
        delivery: { manualTrigger: true },
        error: null,
      };
      if (newRun.status === "error") newRun.error = "manual trigger: simulated failure";
      setRuns((arr) => [newRun, ...arr]);
    }
  };

  const handleSave = (input) => {
    if (builder.initial) {
      setJobs((arr) =>
        arr.map((j) =>
          j.id === builder.initial.id ? { ...j, ...input, updatedAtMs: Date.now() } : j,
        ),
      );
    } else {
      const newJob = {
        id: `job-${Math.random().toString(36).slice(2, 9)}`,
        ...input,
        nextRunAtMs: Date.now() + 30_000,
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
      };
      setJobs((arr) => [newJob, ...arr]);
      setSelectedId(newJob.id);
    }
  };

  const refresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 720);
  };

  const kpi = {
    scheduler: status.running ? "running" : "stopped",
    totalJobs: jobs.length,
    enabledJobs: jobs.filter((j) => j.enabled).length,
    runs1h: runs.filter((r) => Date.now() - r.ts < 3_600_000).length,
    err1h: runs.filter((r) => Date.now() - r.ts < 3_600_000 && r.status === "error").length,
  };

  return (
    <div className="cron-app">
      <header className="cron-app__topbar">
        <div className="cron-app__brand">
          <span className="cron-app__eyebrow">Automate · Cron</span>
          <h1 className="cron-app__title">Scheduled jobs</h1>
          <span className="cron-app__subtitle">
            scheduler <code>{kpi.scheduler}</code> · runtime v{window.BOOTSTRAP.runtimeVersion} ·
            next: <CountdownTimer targetMs={status.nextRunAtMs} prefix="" />
          </span>
        </div>
        <div className="cron-app__kpis">
          <KpiCell label="Total jobs" value={kpi.totalJobs} tone="neutral" />
          <KpiCell
            label="Enabled"
            value={`${kpi.enabledJobs}/${kpi.totalJobs}`}
            tone={kpi.enabledJobs > 0 ? "ok" : "warn"}
          />
          <KpiCell label="Runs (1h)" value={kpi.runs1h} tone="neutral" />
          <KpiCell label="Errors (1h)" value={kpi.err1h} tone={kpi.err1h > 0 ? "warn" : "ok"} />
        </div>
        <div className="cron-app__actions">
          <button
            className="cron-app__btn cron-app__btn--primary"
            onClick={() => setBuilder({ open: true, initial: null })}
          >
            <IconPlus />
            New job
          </button>
          <button
            className={`cron-app__btn ${refreshing ? "cron-app__btn--spin" : ""}`}
            onClick={refresh}
            disabled={refreshing}
          >
            <IconRefresh />
            Refresh
          </button>
        </div>
      </header>

      <main className="cron-app__main">
        <JobsList
          jobs={jobs}
          runs={runs}
          selectedId={selectedId}
          onSelect={setSelectedId}
          query={query}
          onQuery={setQuery}
          enabledFilter={enabledFilter}
          onEnabledFilter={setEnabledFilter}
          sortBy={sortBy}
          onSortBy={setSortBy}
        />
        <JobDetail
          job={selected}
          runs={runs}
          onAction={handleAction}
          onEdit={(j) => setBuilder({ open: true, initial: j })}
        />
      </main>

      {builder.open && (
        <CronBuilder
          initial={builder.initial}
          onClose={() => setBuilder({ open: false, initial: null })}
          onSave={handleSave}
        />
      )}

      {window.TweaksPanel ? <window.TweaksPanel /> : null}
    </div>
  );
};

const KpiCell = ({ label, value, tone = "neutral" }) => (
  <div className={`kpi-cell kpi-cell--${tone}`}>
    <span className="kpi-cell__value">{value}</span>
    <span className="kpi-cell__label">{label}</span>
  </div>
);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<CronApp />);
