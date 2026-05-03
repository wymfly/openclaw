// channels — Inventory list view (full-width, page-transition).

const { useMemo: _lvMemo } = React;

function ListView({
  channels,
  listState,
  searchQuery,
  filter,
  onSearch,
  onFilter,
  onSelect,
  onCreateClick,
}) {
  const totals = _lvMemo(() => {
    const enabled = channels.filter((c) => c.core.enabled).length;
    const accounts = channels.reduce((acc, c) => acc + (c.core.accounts || []).length, 0);
    const alerts = channels.reduce((acc, c) => {
      const accs = c.core.accounts || [];
      const wip = accs.filter((id) => {
        const d = window.MOCK.accountDiagnostics[id];
        return d && (d.health === "warn" || d.health === "err");
      });
      return acc + wip.length;
    }, 0);
    const unhealthy = channels.filter((c) => c.core.enabled && !c.core.healthy).length;
    return { enabled, accounts, alerts, unhealthy, total: channels.length };
  }, [channels]);

  const filtered = _lvMemo(() => {
    const q = (searchQuery || "").trim().toLowerCase();
    return channels.filter((c) => {
      if (filter === "enabled" && !c.core.enabled) return false;
      if (
        filter === "alerts" &&
        !(c.core.accounts || []).some((aid) => {
          const d = window.MOCK.accountDiagnostics[aid];
          return d && (d.health === "warn" || d.health === "err");
        })
      )
        return false;
      if (filter === "wecom" && c.id !== "wecom") return false;
      if (
        q &&
        !(
          c.id.includes(q) ||
          c.label.toLowerCase().includes(q) ||
          c.detailLabel.toLowerCase().includes(q)
        )
      )
        return false;
      return true;
    });
  }, [channels, searchQuery, filter]);

  const onRowKey = (e, id) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(id);
    }
  };

  return (
    <main className="view">
      <header className="list-view__head">
        <div>
          <h1 className="list-view__title">Channels</h1>
          <p className="list-view__subtitle">
            Operate provider connections, account diagnostics, and routing handoff through the Deck
            BFF chain.
          </p>
        </div>
        <div className="list-view__actions">
          <button className="btn btn--ghost" type="button" title="Refresh inventory">
            <IconRefresh /> Refresh
          </button>
          <button className="btn btn--primary" type="button" onClick={onCreateClick}>
            <IconPlus /> New channel
            <span className="kbd">⌘N</span>
          </button>
        </div>
      </header>

      <div className="kpi-strip" role="group" aria-label="Channel inventory KPIs">
        <div className="kpi">
          <span className="kpi__label">Channels</span>
          <span className="kpi__value">{totals.total}</span>
          <span className="kpi__hint">{totals.enabled} enabled</span>
        </div>
        <div className="kpi">
          <span className="kpi__label">Accounts</span>
          <span className="kpi__value">{totals.accounts}</span>
          <span className="kpi__hint">across all providers</span>
        </div>
        <div className="kpi">
          <span className="kpi__label">Alerts</span>
          <span className="kpi__value">{totals.alerts}</span>
          <span className="kpi__hint">accounts needing attention</span>
        </div>
        <div className="kpi">
          <span className="kpi__label">Unhealthy</span>
          <span className="kpi__value">{totals.unhealthy}</span>
          <span className="kpi__hint">enabled · probe failed</span>
        </div>
        <div className="kpi">
          <span className="kpi__label">Throughput</span>
          <span className="kpi__value">
            {channels.reduce((a, c) => a + (window.MOCK.throughput[c.id]?.messagesIn || 0), 0)}
          </span>
          <span className="kpi__hint">in · last hour</span>
        </div>
      </div>

      <div className="toolbar">
        <label className="toolbar__search">
          <IconSearch />
          <input
            placeholder="Search by id, label, plugin…"
            value={searchQuery || ""}
            onChange={(e) => onSearch(e.target.value)}
          />
          <span className="kbd">⌘K</span>
        </label>
        <div className="toolbar__filter" role="tablist" aria-label="Filter">
          {[
            { id: "all", label: "All" },
            { id: "enabled", label: "Enabled" },
            { id: "alerts", label: "Alerts" },
            { id: "wecom", label: "WeCom" },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              className={filter === f.id ? "is-active" : ""}
              onClick={() => onFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="row__head" role="row">
        <div></div>
        <div className="col-name">Channel</div>
        <div className="col-in">Throughput</div>
        <div className="col-out">Probe</div>
        <div className="col-late">Accts</div>
        <div className="col-status">Status</div>
      </div>

      {listState === "loading" && (
        <div className="empty">
          <span className="spinner" /> Loading channels…
        </div>
      )}
      {listState === "error" && (
        <div className="empty">
          <strong>Failed to load channel inventory</strong>
          GET /channels returned an error. <button className="btn btn--sm">Retry</button>
        </div>
      )}
      {listState === "empty" && (
        <div className="empty">
          <IconEmpty />
          <strong>No channels configured</strong>
          Connect a Telegram, Discord, WeCom, Slack, or QQ provider to start routing traffic.
          <button className="btn btn--primary" onClick={onCreateClick}>
            <IconPlus /> New channel
          </button>
        </div>
      )}

      {listState === "ready" &&
        (filtered.length === 0 ? (
          <div className="empty">
            <strong>No channels match this filter</strong>
            Adjust the search or filter to see more results.
          </div>
        ) : (
          <div role="list">
            {filtered.map((c) => {
              const tp = window.MOCK.throughput[c.id] || {
                messagesIn: 0,
                messagesOut: 0,
                buckets: [],
              };
              const probe = window.MOCK.probe[c.id];
              const acctIds = c.core.accounts || [];
              const alerts = acctIds.filter((aid) => {
                const d = window.MOCK.accountDiagnostics[aid];
                return d && (d.health === "warn" || d.health === "err");
              }).length;
              const max = Math.max(1, ...tp.buckets.map((b) => (b.in || 0) + (b.out || 0)));
              return (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  className={"row"}
                  onClick={() => onSelect(c.id)}
                  onKeyDown={(e) => onRowKey(e, c.id)}
                >
                  <ChannelGlyph id={c.id} size={28} />
                  <div className="row__id">
                    <span className="row__id-name">
                      {c.label}
                      {alerts > 0 && (
                        <span className="pill pill--warn" style={{ marginLeft: 8 }}>
                          {alerts} alert{alerts > 1 ? "s" : ""}
                        </span>
                      )}
                    </span>
                    <span className="row__id-meta">
                      {c.detailLabel || `${c.id} · ${(c.meta && c.meta.pluginId) || "no plugin"}`}
                    </span>
                  </div>
                  <div className="row__throughput">
                    {tp.buckets.slice(-12).map((b, i) => {
                      const total = (b.in || 0) + (b.out || 0);
                      const pct = Math.max(8, Math.round((total / max) * 100));
                      return <span key={i} className="row__bar" style={{ height: `${pct}%` }} />;
                    })}
                    <span className="row__num">
                      {tp.messagesIn}
                      <small>in</small>
                    </span>
                  </div>
                  <div className="col-out">
                    {probe ? (
                      probe.ok ? (
                        <span className="pill pill--ok">
                          <span className="pill__dot" />
                          {probe.latencyMs}ms
                        </span>
                      ) : (
                        <span className="pill pill--err">
                          <span className="pill__dot" />
                          failed
                        </span>
                      )
                    ) : (
                      <span className="pill pill--muted">—</span>
                    )}
                  </div>
                  <div className="row__num col-late">{acctIds.length}</div>
                  <div>
                    {c.core.enabled ? (
                      c.core.healthy ? (
                        <span className="pill pill--ok">
                          <span className="pill__dot" />
                          healthy
                        </span>
                      ) : (
                        <span className="pill pill--warn">
                          <span className="pill__dot" />
                          degraded
                        </span>
                      )
                    ) : (
                      <span className="pill pill--muted">
                        <span className="pill__dot" />
                        disabled
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

      <footer className="view__footer">
        <div className="view__footer-row">
          <span>
            {filtered.length} of {channels.length} channels
          </span>
          <span>
            <IconActivity /> ts {new Date(window.MOCK.status.ts || Date.now()).toLocaleTimeString()}
          </span>
        </div>
        <div className="view__footer-row">
          <span>
            <span className="kbd">↵</span> open
          </span>
          <span>
            <span className="kbd">⌘N</span> new
          </span>
          <span>
            <span className="kbd">⌘K</span> search
          </span>
        </div>
      </footer>
    </main>
  );
}

Object.assign(window, { ListView });
