// alerts — List view
//
// KPI strip + toolbar (search + action filter + entity filter + enabled filter)
// + 7-col rule rows.

const { useMemo: _lvMemo } = React;

function fmtCooldown(ms) {
  if (!ms || ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600_000) return `${Math.round(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${Math.round(ms / 3600_000)}h`;
  return `${Math.round(ms / 86_400_000)}d`;
}

function fmtRel(isoOrMs) {
  if (!isoOrMs) return "—";
  const ms = typeof isoOrMs === "string" ? Date.parse(isoOrMs) : isoOrMs;
  if (Number.isNaN(ms)) return "—";
  const dt = (Date.now() - ms) / 1000;
  if (dt < 60) return `${Math.round(dt)}s ago`;
  if (dt < 3600) return `${Math.round(dt / 60)}m ago`;
  if (dt < 86400) return `${Math.round(dt / 3600)}h ago`;
  return `${Math.round(dt / 86400)}d ago`;
}

function RuleRow({ rule, selected, onSelect, onToggleEnabled, onTestFire }) {
  return (
    <div
      className={`row${selected ? " row--selected" : ""}${rule.enabled ? "" : " row--muted"}`}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(rule.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(rule.id);
        }
      }}
    >
      <div className="row__glyph">
        <EntityGlyph entityType={rule.entityType} size={32} />
      </div>
      <div className="row__id">
        <div className="row__id-name">
          <span className="row__id-title">{rule.name}</span>
          {!rule.enabled ? <span className="meta-pill meta-pill--off">disabled</span> : null}
        </div>
        <div className="row__id-meta">
          <span className="kbd kbd--small">{rule.id}</span>
          <span className="muted">·</span>
          <span>{rule.entityType}</span>
        </div>
      </div>
      <div className="row__condition">
        <code className="mono">{rule.condition}</code>
      </div>
      <div className="row__threshold">
        <span className="threshold-tag">
          <IconThreshold /> {rule.threshold}
        </span>
      </div>
      <div className="row__action">
        <ActionPill action={rule.action} />
      </div>
      <div className="row__cooldown">
        <span className="time-mono">
          <IconClock /> {fmtCooldown(rule.cooldownMs)}
        </span>
      </div>
      <div className="row__last-fired">
        {rule.lastFiredAt ? (
          <span className="time-mono">{fmtRel(rule.lastFiredAt)}</span>
        ) : (
          <span className="muted small">never</span>
        )}
      </div>
      <div className="row__actions" onClick={(e) => e.stopPropagation()}>
        <button
          className="icon-btn"
          type="button"
          aria-label="Test fire"
          title="Test fire"
          onClick={(e) => {
            e.stopPropagation();
            onTestFire(rule.id);
          }}
        >
          <IconBell />
        </button>
        <button
          className={`icon-btn${rule.enabled ? " icon-btn--on" : ""}`}
          type="button"
          aria-label={rule.enabled ? "Disable" : "Enable"}
          title={rule.enabled ? "Disable" : "Enable"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleEnabled(rule.id);
          }}
        >
          <IconPower />
        </button>
      </div>
    </div>
  );
}

function AlertsKpiStrip({ rules, asOfMs, runtimeId }) {
  const total = rules.length;
  const enabled = rules.filter((r) => r.enabled).length;
  const recentlyFired = rules.filter(
    (r) => r.lastFiredAt && Date.now() - Date.parse(r.lastFiredAt) < 24 * 3600 * 1000,
  ).length;
  const byAction = rules.reduce((acc, r) => {
    acc[r.action] = (acc[r.action] || 0) + 1;
    return acc;
  }, {});
  const sinceLabel = new Date(asOfMs || Date.now()).toLocaleTimeString();
  return (
    <div className="kpi-strip">
      <div className="kpi">
        <div className="kpi__label">Rules</div>
        <div className="kpi__value">{total}</div>
        <div className="kpi__sub">{runtimeId || "deck-runtime"}</div>
      </div>
      <div className="kpi">
        <div className="kpi__label">Enabled</div>
        <div className="kpi__value">
          {enabled}
          <span className="kpi__suffix">/ {total}</span>
        </div>
        <div className="kpi__sub">evaluating now</div>
      </div>
      <div className="kpi">
        <div className="kpi__label">Fired (24h)</div>
        <div className={`kpi__value${recentlyFired > 0 ? " kpi__value--warn" : ""}`}>
          {recentlyFired}
        </div>
        <div className="kpi__sub">at least 1 fire</div>
      </div>
      <div className="kpi">
        <div className="kpi__label">Toast / Activity / Webhook</div>
        <div className="kpi__value-mono">
          {byAction.toast || 0} · {byAction.activity || 0} · {byAction.webhook || 0}
        </div>
        <div className="kpi__sub">action distribution</div>
      </div>
      <div className="kpi kpi--ts">
        <div className="kpi__label">As of</div>
        <div className="kpi__value-mono">{sinceLabel}</div>
        <div className="kpi__sub">last sync</div>
      </div>
    </div>
  );
}

function AlertsToolbar({
  searchQuery,
  filterAction,
  filterEntity,
  filterEnabled,
  entityTypes,
  onSearch,
  onFilterAction,
  onFilterEntity,
  onFilterEnabled,
  onCreate,
  onRefresh,
}) {
  return (
    <div className="toolbar">
      <div className="toolbar__search">
        <IconSearch />
        <input
          type="search"
          placeholder="Search rules: name, id, condition, entityType…"
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          aria-label="Search alert rules"
        />
        <span className="kbd-hint">⌘K</span>
      </div>
      <div className="toolbar__group">
        <div className="seg" role="tablist" aria-label="Action filter">
          {[
            { id: "all", label: "All" },
            { id: "toast", label: "Toast" },
            { id: "activity", label: "Activity" },
            { id: "webhook", label: "Webhook" },
          ].map((o) => (
            <button
              key={o.id}
              className={`seg__btn${filterAction === o.id ? " seg__btn--active" : ""}`}
              type="button"
              onClick={() => onFilterAction(o.id)}
            >
              {o.label}
            </button>
          ))}
        </div>
        <select
          className="input input--inline"
          value={filterEntity}
          onChange={(e) => onFilterEntity(e.target.value)}
          aria-label="Entity filter"
        >
          <option value="all">Any entity</option>
          {entityTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <div className="seg" role="tablist" aria-label="Enabled filter">
          {[
            { id: "all", label: "All" },
            { id: "enabled", label: "Enabled" },
            { id: "disabled", label: "Disabled" },
          ].map((o) => (
            <button
              key={o.id}
              className={`seg__btn${filterEnabled === o.id ? " seg__btn--active" : ""}`}
              type="button"
              onClick={() => onFilterEnabled(o.id)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div className="toolbar__actions">
        <button className="btn btn--ghost" type="button" onClick={onRefresh}>
          <IconRefresh /> Refresh
        </button>
        <button className="btn btn--primary" type="button" onClick={onCreate}>
          <IconPlus /> New rule
        </button>
      </div>
    </div>
  );
}

function ListView({
  rules,
  selectedId,
  listState,
  searchQuery,
  filterAction,
  filterEntity,
  filterEnabled,
  entityTypes,
  asOfMs,
  runtimeId,
  onSearch,
  onFilterAction,
  onFilterEntity,
  onFilterEnabled,
  onSelect,
  onCreate,
  onRefresh,
  onToggleEnabled,
  onTestFire,
}) {
  const filtered = _lvMemo(() => {
    let xs = rules;
    if (filterAction && filterAction !== "all") xs = xs.filter((r) => r.action === filterAction);
    if (filterEntity && filterEntity !== "all")
      xs = xs.filter((r) => r.entityType === filterEntity);
    if (filterEnabled === "enabled") xs = xs.filter((r) => r.enabled);
    if (filterEnabled === "disabled") xs = xs.filter((r) => !r.enabled);
    const q = (searchQuery || "").trim().toLowerCase();
    if (q) {
      xs = xs.filter((r) =>
        [r.id, r.name, r.condition, r.entityType].join(" ").toLowerCase().includes(q),
      );
    }
    return xs;
  }, [rules, filterAction, filterEntity, filterEnabled, searchQuery]);

  return (
    <div className="list-view">
      <header className="page-header">
        <div className="page-header__title">
          <h1>Alerts</h1>
          <p>
            Alert rules evaluate aligned activity events. Each rule has a condition DSL, a
            threshold, an action sink (toast / activity / webhook), and a cooldown window.
            Source-of-truth contract: <span className="kbd">DeckGoAlertsResponse</span>.
          </p>
        </div>
        <div className="page-header__hint">
          <IconKbd /> <span>⌘K</span> search · <span>⌘N</span> new · <span>⌘R</span> refresh
        </div>
      </header>

      <AlertsKpiStrip rules={rules} asOfMs={asOfMs} runtimeId={runtimeId} />

      <AlertsToolbar
        searchQuery={searchQuery}
        filterAction={filterAction}
        filterEntity={filterEntity}
        filterEnabled={filterEnabled}
        entityTypes={entityTypes}
        onSearch={onSearch}
        onFilterAction={onFilterAction}
        onFilterEntity={onFilterEntity}
        onFilterEnabled={onFilterEnabled}
        onCreate={onCreate}
        onRefresh={onRefresh}
      />

      <div className="row-head" role="row" aria-hidden="true">
        <div className="row-head__col row-head__col--glyph"></div>
        <div className="row-head__col">Rule</div>
        <div className="row-head__col">Condition</div>
        <div className="row-head__col">Threshold</div>
        <div className="row-head__col">Action</div>
        <div className="row-head__col">Cooldown</div>
        <div className="row-head__col">Last fired</div>
        <div className="row-head__col row-head__col--right"></div>
      </div>
      {listState === "loading" ? (
        <div className="list-state list-state--loading">
          <IconRefresh className="spin" />
          <div>Loading alert rules…</div>
        </div>
      ) : listState === "error" ? (
        <div className="list-state list-state--error">
          <IconAlert />
          <div>
            <strong>Failed to load alert rules.</strong>
            <p>BFF returned 5xx. Retry or check Gateway logs.</p>
            <button className="btn btn--primary" type="button" onClick={onRefresh}>
              <IconRefresh /> Retry
            </button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="list-state list-state--empty">
          <IconBell />
          <div>
            <strong>No rules match this filter.</strong>
            <p>Try clearing search, expanding action / entity, or create a new rule.</p>
            <button className="btn btn--primary" type="button" onClick={onCreate}>
              <IconPlus /> New rule
            </button>
          </div>
        </div>
      ) : (
        <div className="list">
          {filtered.map((r) => (
            <RuleRow
              key={r.id}
              rule={r}
              selected={r.id === selectedId}
              onSelect={onSelect}
              onToggleEnabled={onToggleEnabled}
              onTestFire={onTestFire}
            />
          ))}
        </div>
      )}
    </div>
  );
}

Object.assign(window, {
  ListView,
  AlertsKpiStrip,
  AlertsToolbar,
  RuleRow,
  fmtCooldown,
  fmtRel,
});
