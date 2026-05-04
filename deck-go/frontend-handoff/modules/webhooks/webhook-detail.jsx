// WebhookDetail — right pane: hero + actions + 4 tabs (Overview /
// Deliveries / Settings / Audit) + delete confirm modal.

const TABS = ["overview", "deliveries", "settings", "audit"];

const WebhookDetail = ({ webhook, deliveries, onAction, onEdit }) => {
  const [tab, setTab] = React.useState("overview");
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [testPhase, setTestPhase] = React.useState("idle"); // idle | running | done | error

  React.useEffect(() => {
    setTab("overview");
    setConfirmDelete(false);
    setTestPhase("idle");
  }, [webhook?.id]);

  if (!webhook) {
    return (
      <div className="webhook-detail webhook-detail--empty">
        <div className="webhook-detail__empty-card">
          <IconLink />
          <p>Pick a webhook from the list.</p>
          <p className="muted">Or use New webhook to create one.</p>
        </div>
      </div>
    );
  }

  const wDeliveries = deliveries
    .filter((d) => d.webhookId === webhook.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const successCount = wDeliveries.filter((d) => d.success).length;
  const failureCount = wDeliveries.filter((d) => !d.success).length;
  const successRate = wDeliveries.length > 0 ? successCount / wDeliveries.length : null;
  const avgDuration =
    wDeliveries.length > 0
      ? Math.round(wDeliveries.reduce((s, d) => s + (d.durationMs || 0), 0) / wDeliveries.length)
      : null;

  const handleTest = () => {
    setTestPhase("running");
    setTimeout(() => {
      const ok = Math.random() < 0.85;
      setTestPhase(ok ? "done" : "error");
      onAction(webhook.id, ok ? "test_ok" : "test_err");
      setTimeout(() => setTestPhase("idle"), 1200);
    }, 920);
  };

  return (
    <div className="webhook-detail">
      <div className="webhook-detail__hero">
        <div className="webhook-detail__hero-head">
          <code className="webhook-detail__id">{webhook.id}</code>
          <EnabledToggle enabled={webhook.enabled} />
          <WebhookHealthBadge webhook={webhook} />
        </div>
        <h2 className="webhook-detail__title">{webhook.name}</h2>
        <code className="webhook-detail__url" title={webhook.url}>
          <IconLink />
          {webhook.url}
        </code>
        <div className="webhook-detail__hero-meta">
          <span className="webhook-detail__meta-cell">
            <IconBolt />
            {webhook.events.length} events
          </span>
          <span className="webhook-detail__meta-cell">
            <IconClock />
            Last fired {formatRelative(webhook.lastFiredAt)}
          </span>
          <span className="webhook-detail__meta-cell">
            <IconShield />
            Secret {webhook.secret ? "set" : "none"}
          </span>
          <span className="webhook-detail__meta-cell">
            <IconActivity />
            {webhook.consecutiveFailures} consecutive failures
          </span>
        </div>
      </div>

      <div className="webhook-detail__actions">
        <button
          className={`webhook-detail__btn webhook-detail__btn--primary ${testPhase === "running" ? "webhook-detail__btn--spin" : ""}`}
          onClick={handleTest}
          disabled={testPhase !== "idle" || !webhook.enabled}
        >
          <IconSend />
          Test delivery
        </button>
        <button
          className="webhook-detail__btn"
          onClick={() => onAction(webhook.id, webhook.enabled ? "disable" : "enable")}
        >
          {webhook.enabled ? "Disable" : "Enable"}
        </button>
        <button className="webhook-detail__btn" onClick={() => onEdit(webhook)}>
          <IconEdit />
          Edit
        </button>
        <button
          className="webhook-detail__btn webhook-detail__btn--danger"
          onClick={() => setConfirmDelete(true)}
        >
          <IconTrash />
          Delete
        </button>
        {testPhase === "running" && (
          <span className="webhook-detail__action-phase" role="status">
            testing…
          </span>
        )}
        {testPhase === "done" && (
          <span className="webhook-detail__action-phase webhook-detail__action-phase--done">
            <IconCheck />
            200 ok
          </span>
        )}
        {testPhase === "error" && (
          <span className="webhook-detail__action-phase webhook-detail__action-phase--err">
            <IconAlert />
            502 upstream
          </span>
        )}
      </div>

      <div className="webhook-detail__tabs" role="tablist" aria-label="Webhook detail tabs">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`webhook-detail__tab ${tab === t ? "webhook-detail__tab--on" : ""}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="webhook-detail__body">
        {tab === "overview" && (
          <OverviewTab
            webhook={webhook}
            stats={{
              success: successCount,
              failure: failureCount,
              rate: successRate,
              avg: avgDuration,
              last: wDeliveries[0],
            }}
          />
        )}
        {tab === "deliveries" && <DeliveriesTab deliveries={wDeliveries} onAction={onAction} />}
        {tab === "settings" && <SettingsTab webhook={webhook} />}
        {tab === "audit" && <AuditTab webhook={webhook} />}
      </div>

      {confirmDelete && (
        <div className="modal-backdrop" onClick={() => setConfirmDelete(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Delete webhook confirm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal__head">
              <h3 className="modal__title">Delete webhook?</h3>
              <button
                className="modal__close"
                onClick={() => setConfirmDelete(false)}
                aria-label="Close confirm"
              >
                <IconClose />
              </button>
            </div>
            <div className="modal__body">
              <p>
                This will permanently delete <strong>{webhook.name}</strong>. Pending retries will
                be cancelled.
              </p>
              <p className="muted small">
                Webhook id: <code>{webhook.id}</code>
              </p>
            </div>
            <div className="modal__foot">
              <button className="modal__btn" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
              <button
                className="modal__btn modal__btn--danger"
                onClick={() => {
                  onAction(webhook.id, "delete");
                  setConfirmDelete(false);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const OverviewTab = ({ webhook, stats }) => (
  <div className="detail-section">
    <h4 className="detail-section__title">Recent delivery stats</h4>
    <div className="overview-grid">
      <OverviewCell label="Success" value={stats.success} tone="ok" />
      <OverviewCell
        label="Failure"
        value={stats.failure}
        tone={stats.failure > 0 ? "err" : "neutral"}
      />
      <OverviewCell
        label="Success rate"
        value={stats.rate !== null ? `${Math.round(stats.rate * 100)}%` : "—"}
        tone={stats.rate >= 0.95 ? "ok" : stats.rate >= 0.8 ? "warn" : "err"}
      />
      <OverviewCell
        label="Avg duration"
        value={stats.avg !== null ? formatDuration(stats.avg) : "—"}
        tone="neutral"
      />
    </div>
    <h4 className="detail-section__title">Last delivery</h4>
    {stats.last ? (
      <div className="last-delivery-card">
        <div className="last-delivery-card__head">
          <DeliveryStatusBadge delivery={stats.last} />
          <StatusCodeBadge statusCode={stats.last.statusCode} />
          <code className="muted small">{stats.last.eventType}</code>
          <span className="muted small">{formatRelative(stats.last.createdAt)}</span>
        </div>
        {stats.last.error && <p className="last-delivery-card__err">{stats.last.error}</p>}
      </div>
    ) : (
      <p className="muted">No deliveries yet.</p>
    )}
    <h4 className="detail-section__title">Subscribed events</h4>
    <div className="event-tag-row">
      {webhook.events.map((e) => (
        <EventTag key={e} event={e} />
      ))}
    </div>
  </div>
);

const OverviewCell = ({ label, value, tone }) => (
  <div className={`overview-cell overview-cell--${tone}`}>
    <span className="overview-cell__value">{value}</span>
    <span className="overview-cell__label">{label}</span>
  </div>
);

const DeliveriesTab = ({ deliveries, onAction }) => {
  const [expanded, setExpanded] = React.useState(null);
  if (deliveries.length === 0) {
    return <p className="muted">No deliveries recorded yet.</p>;
  }
  return (
    <div className="detail-section">
      <h4 className="detail-section__title">Last {Math.min(20, deliveries.length)} deliveries</h4>
      <ul className="delivery-list" role="list">
        {deliveries.slice(0, 20).map((d) => {
          const isOpen = expanded === d.id;
          return (
            <li
              key={d.id}
              className={`delivery-item ${d.success ? "" : "delivery-item--err"} ${isOpen ? "delivery-item--open" : ""}`}
            >
              <button
                className="delivery-item__head"
                onClick={() => setExpanded(isOpen ? null : d.id)}
                aria-expanded={isOpen}
              >
                {isOpen ? <IconChevronD /> : <IconChevronR />}
                <DeliveryStatusBadge delivery={d} />
                <StatusCodeBadge statusCode={d.statusCode} />
                <code className="delivery-item__event">{d.eventType}</code>
                {d.isRetry && <span className="delivery-item__retry-chip">retry #{d.attempt}</span>}
                <span className="muted small delivery-item__when">
                  {formatRelative(d.createdAt)}
                </span>
                <span className="muted small delivery-item__duration">
                  {formatDuration(d.durationMs)}
                </span>
              </button>
              {isOpen && (
                <div className="delivery-item__body">
                  <div className="delivery-item__columns">
                    <div className="delivery-item__col">
                      <h5>Request payload</h5>
                      <pre className="json-block">{prettyJson(d.payload)}</pre>
                    </div>
                    <div className="delivery-item__col">
                      <h5>Response</h5>
                      {d.error ? (
                        <p className="delivery-item__err">{d.error}</p>
                      ) : d.responseBody ? (
                        <pre className="json-block">{tryPrettyJson(d.responseBody)}</pre>
                      ) : (
                        <p className="muted small">No response body recorded.</p>
                      )}
                    </div>
                  </div>
                  <div className="delivery-item__foot">
                    <span className="muted small">
                      id: <code>{d.id}</code>
                    </span>
                    {d.parentDeliveryId && (
                      <span className="muted small">
                        retry of <code>{d.parentDeliveryId}</code>
                      </span>
                    )}
                    {d.nextRetryAt && (
                      <span className="muted small">
                        next retry: <CountdownTimer targetMs={d.nextRetryAt} prefix="in " />
                      </span>
                    )}
                    <button
                      className="delivery-item__retry-btn"
                      onClick={() => onAction(d.id, "retry")}
                    >
                      <IconRetry />
                      Retry
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const SettingsTab = ({ webhook }) => (
  <div className="detail-section">
    <h4 className="detail-section__title">Endpoint</h4>
    <code className="detail-mono">{webhook.url}</code>
    <h4 className="detail-section__title">Secret</h4>
    <SecretReveal value={webhook.secret} />
    <h4 className="detail-section__title">Events ({webhook.events.length})</h4>
    <div className="event-tag-row">
      {webhook.events.map((e) => (
        <EventTag key={e} event={e} />
      ))}
    </div>
    <h4 className="detail-section__title">Lifecycle</h4>
    <ul className="detail-list">
      <li>
        Created: <code>{webhook.createdAt}</code> ({formatRelative(webhook.createdAt)})
      </li>
      <li>
        Updated: <code>{webhook.updatedAt}</code> ({formatRelative(webhook.updatedAt)})
      </li>
      <li>
        Last fired: <code>{webhook.lastFiredAt || "never"}</code>
      </li>
      <li>
        Last status: <StatusCodeBadge statusCode={webhook.lastStatus} />
      </li>
    </ul>
  </div>
);

const AuditTab = ({ webhook }) => (
  <div className="detail-section">
    <h4 className="detail-section__title">Audit (BFF projection)</h4>
    <p className="muted small">Webhook lifecycle events from the audit log.</p>
    <ul className="audit-list">
      <li>
        <span className="muted small">{formatRelative(webhook.createdAt)}</span> ·{" "}
        <strong>created</strong> by operator-aria
      </li>
      <li>
        <span className="muted small">{formatRelative(webhook.updatedAt)}</span> ·{" "}
        <strong>updated</strong> events list (added <code>monitor.snapshot</code>)
      </li>
      {webhook.consecutiveFailures > 0 && (
        <li>
          <span className="muted small">{formatRelative(webhook.lastFiredAt)}</span> ·{" "}
          <strong>failure threshold</strong> consecutive failures: {webhook.consecutiveFailures}
        </li>
      )}
    </ul>
    <p className="muted small">
      Audit projection draws from <code>webhook.*</code> events; not yet a typed contract endpoint.
    </p>
  </div>
);

function prettyJson(payload) {
  if (!payload) return "—";
  try {
    return JSON.stringify(JSON.parse(payload), null, 2);
  } catch {
    return payload;
  }
}

function tryPrettyJson(s) {
  if (!s) return "";
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

Object.assign(window, { WebhookDetail });
