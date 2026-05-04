// ApprovalsApp — orchestrator: topbar (KPI + Refresh + Policy editor) +
// 2-pane (queue / detail) + recent decisions strip + policy editor modal.

const ApprovalsApp = () => {
  const [pendingExec, setPendingExec] = React.useState(window.PENDING_EXEC);
  const [pendingPlugin, setPendingPlugin] = React.useState(window.PENDING_PLUGIN);
  const [recentDecisions, setRecentDecisions] = React.useState(window.RECENT_DECISIONS);
  const [policy, setPolicy] = React.useState(window.POLICY_RESPONSE);
  const [selectedId, setSelectedId] = React.useState(window.PENDING_EXEC[0]?.id || null);
  const [kindFilter, setKindFilter] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const [policyOpen, setPolicyOpen] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const tweaks = window.useTweaks ? window.useTweaks() : { theme: "dark", density: "compact" };

  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", tweaks.theme);
    document.documentElement.setAttribute("data-density", tweaks.density);
  }, [tweaks.theme, tweaks.density]);

  const allEntries = React.useMemo(
    () => [
      ...pendingExec.map((p) => ({ ...p, __kind: "exec" })),
      ...pendingPlugin.map((p) => ({
        ...p,
        __kind: "plugin",
        expiresAtMs: p.createdAtMs + 5 * 60_000,
      })),
    ],
    [pendingExec, pendingPlugin],
  );
  const selected = allEntries.find((e) => e.id === selectedId) || null;

  const handleDecide = (id, decision, reason) => {
    const entry = allEntries.find((e) => e.id === id);
    if (!entry) return;
    setPendingExec((arr) => arr.filter((p) => p.id !== id));
    setPendingPlugin((arr) => arr.filter((p) => p.id !== id));
    setRecentDecisions((arr) => [
      {
        id,
        kind: entry.__kind,
        decision,
        actor: "operator-aria",
        command: entry.__kind === "exec" ? entry.command : entry.pluginName || entry.pluginId,
        agentId: entry.__kind === "exec" ? entry.agentId : null,
        decidedAtMs: Date.now(),
        reason: reason || null,
      },
      ...arr,
    ]);
    const remaining = allEntries.filter((e) => e.id !== id);
    setSelectedId(remaining[0]?.id || null);
  };

  const refresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 720);
  };

  const kpi = {
    pendingExec: pendingExec.length,
    pendingPlugin: pendingPlugin.length,
    resolvedLastHour: window.KPI_STATS.resolvedLastHour,
    deniedLastHour: window.KPI_STATS.deniedLastHour,
    expiredLastHour: window.KPI_STATS.expiredLastHour,
    avgResponseSec: window.KPI_STATS.avgResponseSec,
  };

  return (
    <div className="approvals-app">
      <header className="approvals-app__topbar">
        <div className="approvals-app__brand">
          <span className="approvals-app__eyebrow">Automate · Approvals</span>
          <h1 className="approvals-app__title">Approval queue</h1>
          <span className="approvals-app__subtitle">
            policy hash <code>{policy.hash || "—"}</code> · runtime v
            {window.BOOTSTRAP.runtimeVersion}
          </span>
        </div>
        <div className="approvals-app__kpis">
          <KpiCell
            label="Pending exec"
            value={kpi.pendingExec}
            tone={kpi.pendingExec > 0 ? "warn" : "ok"}
          />
          <KpiCell
            label="Pending plugin"
            value={kpi.pendingPlugin}
            tone={kpi.pendingPlugin > 0 ? "warn" : "ok"}
          />
          <KpiCell label="Resolved (1h)" value={kpi.resolvedLastHour} tone="neutral" />
          <KpiCell
            label="Denied (1h)"
            value={kpi.deniedLastHour}
            tone={kpi.deniedLastHour > 5 ? "warn" : "neutral"}
          />
          <KpiCell label="Avg response" value={`${kpi.avgResponseSec}s`} tone="neutral" />
        </div>
        <div className="approvals-app__actions">
          <button className="approvals-app__btn" onClick={() => setPolicyOpen(true)}>
            <IconSettings />
            Policy
          </button>
          <button
            className={`approvals-app__btn approvals-app__btn--primary ${refreshing ? "approvals-app__btn--spin" : ""}`}
            onClick={refresh}
            disabled={refreshing}
          >
            <IconRefresh />
            Refresh
          </button>
        </div>
      </header>

      <main className="approvals-app__main">
        <QueueList
          pendingExec={pendingExec}
          pendingPlugin={pendingPlugin}
          selectedId={selectedId}
          onSelect={setSelectedId}
          kindFilter={kindFilter}
          onKindFilter={setKindFilter}
          query={query}
          onQuery={setQuery}
        />
        <ApprovalDetail
          entry={selected}
          recentDecisions={recentDecisions}
          onDecide={handleDecide}
        />
      </main>

      <footer className="approvals-app__strip">
        <div className="approvals-app__strip-head">
          <h3 className="approvals-app__strip-title">
            <IconHistory />
            Recent decisions
          </h3>
          <span className="approvals-app__strip-meta">
            last {recentDecisions.length} actions · BFF projection over audit log
          </span>
        </div>
        <ul className="recent-decisions" role="list">
          {recentDecisions.slice(0, 12).map((d) => (
            <li key={d.id + d.decidedAtMs} className="recent-decisions__row">
              <DecisionBadge decision={d.decision} />
              <KindBadge kind={d.kind} />
              <CommandTag command={d.command} truncate={36} />
              <span className="recent-decisions__actor">{d.actor}</span>
              <span className="recent-decisions__when">{formatRelative(d.decidedAtMs)}</span>
              {d.reason && (
                <span className="recent-decisions__reason" title={d.reason}>
                  “{d.reason}”
                </span>
              )}
            </li>
          ))}
        </ul>
      </footer>

      {policyOpen && (
        <PolicyEditor
          policy={policy}
          onClose={() => setPolicyOpen(false)}
          onSave={(next) => setPolicy(next)}
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
root.render(<ApprovalsApp />);
