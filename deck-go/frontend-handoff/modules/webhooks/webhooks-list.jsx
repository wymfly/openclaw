// WebhooksList — left pane: filter + 6-col table (name+url / events count
// + first 2 chips / last fired / last status / health / chev).

const FILTERS = [
  { id: "all", label: "All" },
  { id: "enabled", label: "Enabled" },
  { id: "disabled", label: "Disabled" },
  { id: "failing", label: "Failing" },
];

const WebhooksList = ({
  webhooks,
  deliveries,
  selectedId,
  onSelect,
  query,
  onQuery,
  filter,
  onFilter,
}) => {
  const lastByWebhook = React.useMemo(() => {
    const map = new Map();
    for (const d of deliveries) {
      const cur = map.get(d.webhookId);
      if (!cur || new Date(d.createdAt).getTime() > new Date(cur.createdAt).getTime()) {
        map.set(d.webhookId, d);
      }
    }
    return map;
  }, [deliveries]);

  let filtered = webhooks;
  if (filter === "enabled") filtered = filtered.filter((w) => w.enabled);
  if (filter === "disabled") filtered = filtered.filter((w) => !w.enabled);
  if (filter === "failing") filtered = filtered.filter((w) => w.consecutiveFailures > 0);
  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.url.toLowerCase().includes(q) ||
        w.id.toLowerCase().includes(q) ||
        w.events.some((e) => e.toLowerCase().includes(q)),
    );
  }

  const counts = {
    all: webhooks.length,
    enabled: webhooks.filter((w) => w.enabled).length,
    disabled: webhooks.filter((w) => !w.enabled).length,
    failing: webhooks.filter((w) => w.consecutiveFailures > 0).length,
  };

  return (
    <div className="webhooks-list">
      <div className="webhooks-list__head">
        <h3 className="webhooks-list__title">Webhooks</h3>
        <span className="webhooks-list__count">
          {filtered.length} / {webhooks.length}
        </span>
      </div>
      <div className="webhooks-list__filters">
        <div className="seg-filter" role="tablist">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              className={`seg-filter__btn ${filter === f.id ? "seg-filter__btn--on" : ""}`}
              onClick={() => onFilter(f.id)}
            >
              {f.label}
              <span className="seg-filter__count">{counts[f.id]}</span>
            </button>
          ))}
        </div>
        <label className="search-input">
          <IconSearch />
          <input
            type="text"
            placeholder="Search name / url / events"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
          />
        </label>
      </div>
      <div className="webhooks-list__table" role="table">
        <div className="webhooks-list__table-head" role="row">
          <span role="columnheader">Webhook</span>
          <span role="columnheader">Events</span>
          <span role="columnheader">Last fired</span>
          <span role="columnheader">Last status</span>
          <span role="columnheader">Health</span>
          <span role="columnheader" />
        </div>
        {filtered.length === 0 ? (
          <div className="webhooks-list__empty">No webhooks match.</div>
        ) : (
          filtered.map((w) => {
            const last = lastByWebhook.get(w.id);
            return (
              <div
                key={w.id}
                role="row"
                tabIndex={0}
                aria-selected={selectedId === w.id}
                className={`webhook-row ${selectedId === w.id ? "webhook-row--on" : ""} ${!w.enabled ? "webhook-row--disabled" : ""}`}
                onClick={() => onSelect(w.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(w.id);
                  }
                }}
              >
                <div className="webhook-row__name" role="cell">
                  <strong>{w.name}</strong>
                  <code className="webhook-row__url">{truncateUrl(w.url, 52)}</code>
                </div>
                <div className="webhook-row__events" role="cell">
                  <span className="webhook-row__events-count">{w.events.length}</span>
                  <span className="webhook-row__events-preview">
                    {w.events.slice(0, 2).map((e) => (
                      <EventTag key={e} event={e} />
                    ))}
                    {w.events.length > 2 && (
                      <span className="muted small">+{w.events.length - 2}</span>
                    )}
                  </span>
                </div>
                <div className="webhook-row__last-fired" role="cell">
                  <span className="muted small">{formatRelative(w.lastFiredAt)}</span>
                </div>
                <div className="webhook-row__last-status" role="cell">
                  <StatusCodeBadge statusCode={w.lastStatus} />
                </div>
                <div className="webhook-row__health" role="cell">
                  <WebhookHealthBadge webhook={w} />
                </div>
                <div className="webhook-row__chev" role="cell">
                  <IconChevronR />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

Object.assign(window, { WebhooksList });
