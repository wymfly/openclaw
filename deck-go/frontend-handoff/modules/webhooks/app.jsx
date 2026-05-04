// WebhooksApp — orchestrator: topbar 4-cell KPI + 2-pane workspace +
// builder modal. Selected webhook id stays in URL hash for refresh-safe
// deep links.

const EMPTY_DRAFT = {
  id: null,
  name: "",
  url: "",
  secret: "",
  events: [],
  enabled: true,
};

const WebhooksApp = () => {
  const [webhooks, setWebhooks] = React.useState(WEBHOOKS);
  const [deliveries] = React.useState(DELIVERIES);
  const [selectedId, setSelectedId] = React.useState(() => {
    const hash = window.location.hash.replace("#/", "");
    return hash || webhooks[0]?.id || null;
  });
  const [filter, setFilter] = React.useState("all");
  const [query, setQuery] = React.useState("");

  const [builderOpen, setBuilderOpen] = React.useState(false);
  const [builderDraft, setBuilderDraft] = React.useState(null);
  const [builderIsEdit, setBuilderIsEdit] = React.useState(false);

  React.useEffect(() => {
    if (selectedId) {
      window.history.replaceState(null, "", `#/${selectedId}`);
    }
  }, [selectedId]);

  const selected = webhooks.find((w) => w.id === selectedId) || null;

  const openCreate = () => {
    setBuilderDraft({ ...EMPTY_DRAFT });
    setBuilderIsEdit(false);
    setBuilderOpen(true);
  };

  const openEdit = (webhook) => {
    setBuilderDraft({
      id: webhook.id,
      name: webhook.name,
      url: webhook.url,
      secret: webhook.secret || "",
      events: [...webhook.events],
      enabled: webhook.enabled,
    });
    setBuilderIsEdit(true);
    setBuilderOpen(true);
  };

  const closeBuilder = () => {
    setBuilderOpen(false);
    setBuilderDraft(null);
  };

  const saveBuilder = () => {
    if (!builderDraft) return;
    if (builderIsEdit) {
      setWebhooks((curr) =>
        curr.map((w) =>
          w.id === builderDraft.id
            ? {
                ...w,
                name: builderDraft.name,
                url: builderDraft.url,
                secret: builderDraft.secret || null,
                events: builderDraft.events,
                enabled: builderDraft.enabled,
                updatedAt: new Date().toISOString(),
              }
            : w,
        ),
      );
    } else {
      const id = `wh-new-${Date.now().toString(36)}`;
      const now = new Date().toISOString();
      const nw = {
        id,
        name: builderDraft.name,
        url: builderDraft.url,
        secret: builderDraft.secret || null,
        events: builderDraft.events,
        enabled: builderDraft.enabled,
        consecutiveFailures: 0,
        lastFiredAt: null,
        lastStatus: null,
        createdAt: now,
        updatedAt: now,
      };
      setWebhooks((curr) => [nw, ...curr]);
      setSelectedId(id);
    }
    closeBuilder();
  };

  const toggleEnabled = (id) => {
    setWebhooks((curr) =>
      curr.map((w) =>
        w.id === id ? { ...w, enabled: !w.enabled, updatedAt: new Date().toISOString() } : w,
      ),
    );
  };

  const deleteWebhook = (id) => {
    setWebhooks((curr) => curr.filter((w) => w.id !== id));
    if (selectedId === id) {
      setSelectedId(webhooks.find((w) => w.id !== id)?.id || null);
    }
  };

  const stats = React.useMemo(
    () => ({
      total: webhooks.length,
      enabled: webhooks.filter((w) => w.enabled).length,
      failing: webhooks.filter((w) => w.consecutiveFailures >= 3).length,
      deliveries24h: KPI_STATS.deliveries24h,
      successRate24h: KPI_STATS.successRate24h,
      avgDurationMs: KPI_STATS.avgDurationMs,
    }),
    [webhooks],
  );

  return (
    <div className="webhooks-shell">
      <header className="webhooks-topbar">
        <div className="webhooks-topbar__brand">
          <IconBolt />
          <span>Webhooks</span>
          <span className="muted small">/ deliver events to external systems</span>
        </div>
        <div className="webhooks-topbar__kpis">
          <KpiCell label="webhooks" value={stats.total} hint={`${stats.enabled} enabled`} />
          <KpiCell
            label="failing"
            value={stats.failing}
            hint={stats.failing === 0 ? "all healthy" : "≥3 consecutive"}
            tone={stats.failing > 0 ? "warn" : "ok"}
          />
          <KpiCell
            label="deliveries 24h"
            value={stats.deliveries24h.toLocaleString()}
            hint={`${(stats.successRate24h * 100).toFixed(1)}% success`}
          />
          <KpiCell label="avg latency" value={`${stats.avgDurationMs}ms`} hint="p50 over 24h" />
        </div>
        <div className="webhooks-topbar__actions">
          <button className="btn btn--ghost" title="Refresh">
            <IconRefresh />
          </button>
          <button className="btn btn--primary" onClick={openCreate}>
            <IconPlus />
            New webhook
          </button>
        </div>
      </header>

      <main className="webhooks-workspace">
        <div className="webhooks-workspace__list">
          <WebhooksList
            webhooks={webhooks}
            deliveries={deliveries}
            selectedId={selectedId}
            onSelect={setSelectedId}
            query={query}
            onQuery={setQuery}
            filter={filter}
            onFilter={setFilter}
          />
        </div>
        <div className="webhooks-workspace__detail">
          {selected ? (
            <WebhookDetail
              webhook={selected}
              deliveries={deliveries.filter((d) => d.webhookId === selected.id)}
              onEdit={() => openEdit(selected)}
              onToggleEnabled={() => toggleEnabled(selected.id)}
              onDelete={() => deleteWebhook(selected.id)}
            />
          ) : (
            <div className="webhooks-empty">
              <div className="webhooks-empty__icon">
                <IconBolt />
              </div>
              <h2>No webhook selected</h2>
              <p className="muted">
                Pick a webhook from the list, or create a new one to start receiving events.
              </p>
              <button className="btn btn--primary" onClick={openCreate}>
                <IconPlus />
                New webhook
              </button>
            </div>
          )}
        </div>
      </main>

      <WebhookBuilder
        open={builderOpen}
        draft={builderDraft}
        isEdit={builderIsEdit}
        onChange={setBuilderDraft}
        onClose={closeBuilder}
        onSave={saveBuilder}
      />

      <TweaksPanel />
    </div>
  );
};

const KpiCell = ({ label, value, hint, tone = "neutral" }) => (
  <div className={`kpi-cell kpi-cell--${tone}`}>
    <span className="kpi-cell__value">{value}</span>
    <span className="kpi-cell__label">{label}</span>
    {hint && <span className="kpi-cell__hint">{hint}</span>}
  </div>
);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<WebhooksApp />);
