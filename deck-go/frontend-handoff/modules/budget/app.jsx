/* global React, ReactDOM, BUDGET_FIXTURE, TweaksPanel,
   RuleNav, RuleDetail,
   EditRuleDialog, CreateRuleDialog, ToggleRuleDialog, DeleteRuleDialog,
   IconRefresh, IconAlert, IconCheck, IconShield, IconBolt */
const { useEffect, useMemo, useState } = React;

const BudgetApp = () => {
  const [tweaks] = useState({ theme: "dark", density: "compact" });
  const [fixture, setFixture] = useState(BUDGET_FIXTURE);
  const [selectedId, setSelectedId] = useState(BUDGET_FIXTURE.rules[0]?.id || null);
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dialog, setDialog] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const el = document.querySelector(".rule-nav__search input");
        if (el) el.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const selected = useMemo(
    () => fixture.rules.find((r) => r.id === selectedId) || null,
    [fixture, selectedId],
  );
  const evaluation = useMemo(
    () => fixture.evaluations.find((e) => e.ruleId === selectedId) || null,
    [fixture, selectedId],
  );

  const counts = useMemo(() => {
    const c = { ok: 0, warn: 0, over: 0 };
    fixture.evaluations.forEach((e) => {
      c[e.status] = (c[e.status] || 0) + 1;
    });
    return c;
  }, [fixture]);

  const refresh = () => {
    setFixture((prev) => ({ ...prev, fetchedAt: Date.now() }));
  };

  const recordChange = (entry) => {
    setFixture((prev) => ({
      ...prev,
      recentChanges: [
        { ts: Date.now(), actor: "operator:daisy@deck.local", ok: true, ...entry },
        ...prev.recentChanges,
      ].slice(0, 32),
    }));
  };

  const onCommitEdit = (next) => {
    setFixture((prev) => ({
      ...prev,
      rules: prev.rules.map((r) =>
        r.id === next.id ? { ...next, updatedAt: new Date().toISOString() } : r,
      ),
    }));
    recordChange({ ruleId: next.id, kind: "update", note: `edited rule "${next.name}"` });
  };

  const onCommitCreate = (rule) => {
    setFixture((prev) => ({
      ...prev,
      rules: [
        ...prev.rules,
        {
          ...rule,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      evaluations: [
        ...prev.evaluations,
        {
          ruleId: rule.id,
          ruleName: rule.name,
          status: "ok",
          current: 0,
          warnThreshold: rule.warnThreshold,
          overThreshold: rule.overThreshold,
          dimension: rule.dimension,
        },
      ],
    }));
    recordChange({ ruleId: rule.id, kind: "create", note: `created rule "${rule.name}"` });
    setSelectedId(rule.id);
  };

  const onCommitToggle = (nextEnabled) => {
    if (!selected) return;
    const id = selected.id;
    setFixture((prev) => ({
      ...prev,
      rules: prev.rules.map((r) =>
        r.id === id ? { ...r, enabled: nextEnabled, updatedAt: new Date().toISOString() } : r,
      ),
    }));
    recordChange({
      ruleId: id,
      kind: nextEnabled ? "enable" : "disable",
      note: nextEnabled ? "rule re-enabled" : "rule disabled",
    });
  };

  const onCommitDelete = () => {
    if (!selected) return;
    const id = selected.id;
    setFixture((prev) => ({
      ...prev,
      rules: prev.rules.filter((r) => r.id !== id),
      evaluations: prev.evaluations.filter((e) => e.ruleId !== id),
    }));
    recordChange({ ruleId: id, kind: "delete", note: `deleted rule "${selected.name}"` });
    const remaining = fixture.rules.filter((r) => r.id !== id);
    setSelectedId(remaining[0]?.id || null);
  };

  const existingNames = useMemo(() => fixture.rules.map((r) => r.name), [fixture]);

  return (
    <div className="budget-app" data-theme={tweaks.theme} data-density={tweaks.density}>
      <header className="budget-app__topbar">
        <div className="budget-app__brand">
          <p className="budget-app__eyebrow">deck-go</p>
          <h1>Budget</h1>
          <p className="budget-app__subtitle">
            Rule-driven thresholds + evaluation status · <code>GET /api/deck/budget/rules</code>
          </p>
        </div>

        <div className="budget-app__kpis">
          <div className="budget-app__kpi budget-app__kpi--success">
            <IconCheck size={12} />
            <span className="budget-app__kpi-label">ok</span>
            <strong>{counts.ok || 0}</strong>
          </div>
          <div className="budget-app__kpi budget-app__kpi--warn">
            <IconAlert size={12} />
            <span className="budget-app__kpi-label">warn</span>
            <strong>{counts.warn || 0}</strong>
          </div>
          <div className="budget-app__kpi budget-app__kpi--error">
            <IconAlert size={12} />
            <span className="budget-app__kpi-label">over</span>
            <strong>{counts.over || 0}</strong>
          </div>
          <div className="budget-app__kpi budget-app__kpi--iron">
            <IconBolt size={12} />
            <span className="budget-app__kpi-label">rules</span>
            <strong>{fixture.rules.length}</strong>
          </div>
        </div>

        <div className="budget-app__topbar-meta">
          <span className="budget-app__bootstrap" title="Bootstrap status">
            <IconShield size={11} />
            <span>
              {fixture.bootstrap.ok
                ? `${fixture.bootstrap.runtime?.mode} · ${fixture.bootstrap.runtime?.health}`
                : "bootstrap not ready"}
            </span>
          </span>
          <kbd className="budget-app__kbd">⌘K</kbd>
          <button type="button" className="ds-btn ds-btn--ghost ds-btn--sm" onClick={refresh}>
            <IconRefresh size={12} /> Refresh
          </button>
        </div>
      </header>

      <div className="budget-app__layout">
        <RuleNav
          rules={fixture.rules}
          evaluations={fixture.evaluations}
          selectedId={selectedId}
          onSelect={setSelectedId}
          query={query}
          onQueryChange={setQuery}
          onCreate={() => setDialog({ kind: "create" })}
          fetchedAt={fixture.fetchedAt}
          onRefresh={refresh}
          filterStatus={filterStatus}
          onFilterStatusChange={setFilterStatus}
        />
        <main className="budget-app__main">
          <RuleDetail
            rule={selected}
            evaluation={evaluation}
            now={now}
            recentChanges={fixture.recentChanges}
            bootstrap={fixture.bootstrap}
            onEdit={() => setDialog({ kind: "edit" })}
            onToggle={() => setDialog({ kind: "toggle" })}
            onDelete={() => setDialog({ kind: "delete" })}
          />
        </main>
      </div>

      {dialog?.kind === "edit" && selected ? (
        <EditRuleDialog
          rule={selected}
          agentDirectory={fixture.agentDirectory}
          onClose={() => setDialog(null)}
          onCommit={onCommitEdit}
        />
      ) : null}

      {dialog?.kind === "create" ? (
        <CreateRuleDialog
          existingNames={existingNames}
          agentDirectory={fixture.agentDirectory}
          onClose={() => setDialog(null)}
          onCommit={onCommitCreate}
        />
      ) : null}

      {dialog?.kind === "toggle" && selected ? (
        <ToggleRuleDialog
          rule={selected}
          onClose={() => setDialog(null)}
          onCommit={onCommitToggle}
        />
      ) : null}

      {dialog?.kind === "delete" && selected ? (
        <DeleteRuleDialog
          rule={selected}
          onClose={() => setDialog(null)}
          onCommit={onCommitDelete}
        />
      ) : null}

      <TweaksPanel />
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<BudgetApp />);
