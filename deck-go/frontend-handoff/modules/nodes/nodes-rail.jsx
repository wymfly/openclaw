// Left rail: KPI strip + pending pairing surface + node inventory list.

const NodesRail = ({
  nodes,
  pairing,
  selectedKey,
  onSelectNode,
  onSelectPending,
  onRefresh,
  refreshing,
  onPairRequest,
}) => {
  const total = nodes.length;
  const connected = nodes.filter((n) => n.connected).length;
  const paired = nodes.filter((n) => n.paired).length;
  const pendingCount = pairing.length;

  // Match a pending request to a node (by nodeId). Orphans = pending without node.
  const pendingByNodeId = new Map(pairing.map((p) => [p.nodeId, p]));
  const orphans = pairing.filter((p) => !nodes.some((n) => n.nodeId === p.nodeId));

  return (
    <aside className="nodes-rail">
      <header className="nodes-rail__head">
        <div className="nodes-rail__brand">
          <IconNode size={18} />
          <span>Nodes</span>
        </div>
        <button
          type="button"
          className="rail-action"
          onClick={onRefresh}
          disabled={refreshing}
          title="Refresh"
        >
          <IconRefresh size={14} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      <div className="nodes-rail__kpis">
        <div className="kpi-card">
          <span className="kpi-card__label">Nodes</span>
          <span className="kpi-card__value">{total}</span>
        </div>
        <div className={`kpi-card ${connected === total ? "kpi-card--ok" : "kpi-card--warn"}`}>
          <span className="kpi-card__label">Connected</span>
          <span className="kpi-card__value">{connected}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-card__label">Paired</span>
          <span className="kpi-card__value">{paired}</span>
        </div>
        <div className={`kpi-card ${pendingCount > 0 ? "kpi-card--warn" : ""}`}>
          <span className="kpi-card__label">Pending</span>
          <span className="kpi-card__value">{pendingCount}</span>
        </div>
      </div>

      {pairing.length > 0 && (
        <section className="rail-section rail-section--pending">
          <header className="rail-section__head">
            <span className="rail-section__label">
              <IconAlert size={12} /> Pending pairing
            </span>
            <span className="rail-section__count">{pairing.length}</span>
          </header>
          <ul className="rail-list">
            {pairing.map((req) => {
              const isOrphan = !nodes.some((n) => n.nodeId === req.nodeId);
              const isSelected = selectedKey === `pair:${req.requestId}`;
              return (
                <li key={req.requestId}>
                  <button
                    type="button"
                    className={`pending-row ${isSelected ? "pending-row--active" : ""}`}
                    onClick={() => onSelectPending(req)}
                  >
                    <div className="pending-row__head">
                      <span className="pending-row__title">{req.displayName || req.nodeId}</span>
                      <span
                        className={`pill pending-row__tag ${
                          req.isRepair ? "pending-row__tag--repair" : "pending-row__tag--new"
                        }`}
                      >
                        {req.isRepair ? "repair" : "new"}
                      </span>
                    </div>
                    <div className="pending-row__meta">
                      <span className="mono">{shortId(req.requestId)}</span>
                      <span>·</span>
                      <span>{req.platform || "unknown"}</span>
                      <span>·</span>
                      <span>{formatRelative(req.ts)}</span>
                    </div>
                    {isOrphan && (
                      <div className="pending-row__hint">
                        <IconLink size={11} /> orphan request — node not in inventory
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="rail-section">
        <header className="rail-section__head">
          <span className="rail-section__label">Inventory</span>
          <span className="rail-section__count">{nodes.length}</span>
        </header>
        <ul className="rail-list rail-list--nodes">
          {nodes.map((n) => {
            const isSelected = selectedKey === `node:${n.nodeId}`;
            const pending = pendingByNodeId.get(n.nodeId);
            const tone = lifecycleTone(n, pending);
            return (
              <li key={n.nodeId}>
                <button
                  type="button"
                  className={`node-row ${isSelected ? "node-row--active" : ""}`}
                  onClick={() => onSelectNode(n)}
                >
                  <div className="node-row__head">
                    <StatusDot tone={tone.tone} label={tone.label} />
                    <span className="node-row__title">{n.displayName || n.nodeId}</span>
                    <PlatformPill platform={n.platform} />
                  </div>
                  <div className="node-row__meta">
                    <span className="mono">{shortId(n.nodeId)}</span>
                    {n.remoteIp && (
                      <>
                        <span>·</span>
                        <span className="mono">{n.remoteIp}</span>
                      </>
                    )}
                    <span>·</span>
                    <span>v{n.version || "—"}</span>
                  </div>
                  <div className="node-row__caps">
                    <span className={`pill mini ${n.connected ? "pill--ok" : "pill--muted"}`}>
                      {n.connected ? "connected" : "offline"}
                    </span>
                    <span className={`pill mini ${n.paired ? "pill--accent" : "pill--warn"}`}>
                      {n.paired ? "paired" : "unpaired"}
                    </span>
                    {pending && (
                      <span className="pill mini pill--warn">
                        {pending.isRepair ? "repair pending" : "pairing pending"}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
          {nodes.length === 0 && orphans.length === 0 && (
            <li className="rail-empty">No nodes in inventory.</li>
          )}
        </ul>
      </section>

      <footer className="nodes-rail__foot">
        <button type="button" className="primary-action" onClick={onPairRequest}>
          <IconLink size={13} /> Request pairing…
        </button>
        <p className="rail-hint">
          Operators may request pairing for a fresh device. Approval still required on the device
          side.
        </p>
      </footer>
    </aside>
  );
};

Object.assign(window, { NodesRail });
