// app.jsx — GatewayApp orchestrator.
// Read-only control-plane dashboard with one mutation surface (gateway.batch
// composer dry-run). Sections:
//   - Topbar (eyebrow / title / health pill / runtime version / Refresh)
//   - Health + Status hero (4-cell KPI + channel rail + heartbeat agent rail)
//   - Throughput card (bars + latency line, last 30m, hand-rolled SVG sparks)
//   - Tabs: Methods & Events (DescribeExplorer) / Batch console / Activity
//   - Activity tab — recent audit entries

const { useEffect, useMemo, useState } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/ {
  theme: "dark",
  density: "compact",
} /*EDITMODE-END*/;

const TAB_DEFS = [
  { id: "describe", label: "Methods & Events", icon: IconLayers },
  { id: "batch", label: "Batch console", icon: IconBolt },
  { id: "activity", label: "Activity", icon: IconActivity },
];

function GatewayApp() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [tab, setTab] = useState("describe");
  const [healthResp, setHealthResp] = useState(window.GW_HEALTH_RESPONSE);
  const [statusResp] = useState(window.GW_STATUS_RESPONSE);
  const [describeResp] = useState(window.GW_DESCRIBE_RESPONSE);
  const [recentBatches] = useState(window.GW_RECENT_BATCHES);
  const [throughputPoints] = useState(window.GW_THROUGHPUT_POINTS);
  const [auditEntries] = useState(window.GW_AUDIT_ENTRIES);
  const [bootstrap] = useState(window.GW_BOOTSTRAP);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", t.theme);
    document.documentElement.setAttribute("data-density", t.density);
  }, [t.theme, t.density]);

  const handleRefresh = () => {
    setHealthResp({ ...healthResp, ts: Date.now() });
  };

  const channelOrder = healthResp.channelOrder || [];
  const channelEntries = channelOrder.map((id) => ({
    id,
    label: healthResp.channelLabels?.[id] || id,
    state: healthResp.channels?.[id] || {},
  }));

  const heartbeatAgents = (statusResp.heartbeat?.agents || []).map((a) => ({
    agentId: a.agentId,
    enabled: a.enabled,
    every: a.every,
    everyMs: a.everyMs,
    sessions: healthResp.agents?.find((h) => h.agentId === a.agentId)?.sessions?.count ?? 0,
  }));

  const throughputRequests = useMemo(
    () => throughputPoints.map((p) => p.requests),
    [throughputPoints],
  );
  const throughputErrors = useMemo(() => throughputPoints.map((p) => p.errors), [throughputPoints]);
  const throughputLatency = useMemo(
    () => throughputPoints.map((p) => p.latencyP95),
    [throughputPoints],
  );

  const totalRequests = throughputRequests.reduce((s, v) => s + v, 0);
  const totalErrors = throughputErrors.reduce((s, v) => s + v, 0);
  const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
  const avgLatency = Math.round(
    throughputLatency.reduce((s, v) => s + v, 0) / Math.max(1, throughputLatency.length),
  );

  return (
    <div className="gateway-app">
      <header className="gateway-app__topbar">
        <div className="gateway-app__brand">
          <span className="gateway-app__eyebrow">deck-go · gateway</span>
          <h1 className="gateway-app__title">Gateway control plane</h1>
          <p className="gateway-app__subtitle">
            <code>{statusResp.runtimeVersion || "unknown"}</code> · heartbeat{" "}
            <code>{healthResp.heartbeatSeconds || 30}s</code> · ts{" "}
            <code>{formatTime(healthResp.ts)}</code>
          </p>
        </div>
        <div className="gateway-app__health">
          <div
            className={`gateway-app__health-pill gateway-app__health-pill--${healthResp.ok ? "ok" : "err"}`}
          >
            <IconHeart size={12} />
            {healthResp.ok ? "Gateway OK" : "Gateway DOWN"}
          </div>
          <div className="gateway-app__state-pill">
            state · <strong>{statusResp.state || "—"}</strong>
          </div>
          <div
            className={`gateway-app__bootstrap-pill gateway-app__bootstrap-pill--${bootstrap.ok ? "ok" : "err"}`}
          >
            {bootstrap.ok ? "bootstrap OK" : "bootstrap not ready"}
          </div>
        </div>
        <button
          className="ds-btn ds-btn--ghost"
          onClick={handleRefresh}
          title="Refetch health + status"
        >
          <IconRefresh size={13} /> Refresh
        </button>
      </header>

      <main className="gateway-app__main">
        <section className="gateway-app__hero">
          <div className="gateway-app__kpi-grid">
            <div className="kpi-cell kpi-cell--accent">
              <span className="kpi-cell__lbl">Sessions</span>
              <strong>{healthResp.sessions?.count ?? 0}</strong>
              <span className="kpi-cell__hint">
                defaults model · {statusResp.sessions?.defaults?.model || "—"}
              </span>
            </div>
            <div className="kpi-cell">
              <span className="kpi-cell__lbl">Channels</span>
              <strong>
                {channelEntries.filter((c) => c.state.connected).length}
                <span className="kpi-cell__sub"> / {channelEntries.length}</span>
              </strong>
              <span className="kpi-cell__hint">connected / total</span>
            </div>
            <div className="kpi-cell">
              <span className="kpi-cell__lbl">Agents heartbeating</span>
              <strong>
                {heartbeatAgents.filter((a) => a.enabled).length}
                <span className="kpi-cell__sub"> / {heartbeatAgents.length}</span>
              </strong>
              <span className="kpi-cell__hint">enabled / total</span>
            </div>
            <div className="kpi-cell">
              <span className="kpi-cell__lbl">Health probe</span>
              <strong>{formatMs(healthResp.durationMs)}</strong>
              <span className="kpi-cell__hint">last probe duration</span>
            </div>
          </div>
          <div className="gateway-app__hero-rails">
            <article className="hero-rail">
              <header className="hero-rail__head">
                <h3>Channel summary</h3>
                <span className="hero-rail__hint">
                  link · {statusResp.linkChannel?.label || "—"} · auth age{" "}
                  {formatMs(statusResp.linkChannel?.authAgeMs)}
                </span>
              </header>
              <ul className="hero-rail__list" role="list">
                {channelEntries.map((c) => (
                  <li
                    key={c.id}
                    className={`channel-pill ${c.state.connected ? "channel-pill--on" : "channel-pill--off"}`}
                  >
                    <ConnDot connected={c.state.connected} />
                    <span className="channel-pill__label">{c.label}</span>
                    <span className="channel-pill__last mono">
                      {c.state.lastSeen ? formatRelative(c.state.lastSeen) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
            <article className="hero-rail">
              <header className="hero-rail__head">
                <h3>Heartbeat agents</h3>
                <span className="hero-rail__hint">
                  {heartbeatAgents.length} agents · default ·{" "}
                  <code>{statusResp.heartbeat?.defaultAgentId}</code>
                </span>
              </header>
              <ul className="hero-rail__list" role="list">
                {heartbeatAgents.map((a) => (
                  <li
                    key={a.agentId}
                    className={`agent-pill ${a.enabled ? "agent-pill--on" : "agent-pill--off"}`}
                  >
                    <strong>{a.agentId}</strong>
                    <span className="agent-pill__every mono">every {a.every}</span>
                    <span className="agent-pill__sessions mono">{a.sessions} sessions</span>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section className="gateway-app__throughput">
          <header className="gateway-app__row-head">
            <h2>Throughput</h2>
            <p className="gateway-app__row-hint">
              Last 30 minutes · per-minute buckets · BFF projection (not part of describe contract)
            </p>
          </header>
          <div className="gateway-app__throughput-grid">
            <div className="throughput-card">
              <span className="throughput-card__lbl">Requests / min</span>
              <strong className="mono">{totalRequests}</strong>
              <SparkBar values={throughputRequests} width={260} height={36} tone="accent" />
            </div>
            <div className={`throughput-card throughput-card--${errorRate > 1 ? "warn" : "ok"}`}>
              <span className="throughput-card__lbl">Error rate</span>
              <strong className="mono">{errorRate.toFixed(2)}%</strong>
              <SparkBar
                values={throughputErrors}
                width={260}
                height={36}
                tone={errorRate > 1 ? "warn" : "ok"}
              />
            </div>
            <div className="throughput-card">
              <span className="throughput-card__lbl">Latency p95</span>
              <strong className="mono">{avgLatency}ms</strong>
              <SparkLine values={throughputLatency} width={260} height={36} tone="accent" />
            </div>
            <div className="throughput-card">
              <span className="throughput-card__lbl">Queued events</span>
              <strong className="mono">{statusResp.queuedSystemEvents?.length || 0}</strong>
              <ul className="throughput-card__queue">
                {(statusResp.queuedSystemEvents || []).slice(0, 4).map((e) => (
                  <li key={e}>
                    <code>{e}</code>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="gateway-app__tabs-section">
          <div className="gateway-app__tabs" role="tablist" aria-label="Gateway sections">
            {TAB_DEFS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                className={`gateway-app__tab ${tab === t.id ? "gateway-app__tab--on" : ""}`}
                onClick={() => setTab(t.id)}
              >
                <t.icon size={13} />
                <span>{t.label}</span>
                {t.id === "batch" ? (
                  <span className="ds-seg__count">{recentBatches.length}</span>
                ) : null}
                {t.id === "activity" ? (
                  <span className="ds-seg__count">{auditEntries.length}</span>
                ) : null}
              </button>
            ))}
          </div>
          <div className="gateway-app__tab-body">
            {tab === "describe" ? (
              <DescribeExplorer describeResp={describeResp} />
            ) : tab === "batch" ? (
              <BatchConsole recentBatches={recentBatches} />
            ) : (
              <ActivityList entries={auditEntries} />
            )}
          </div>
        </section>
      </main>

      <TweaksPanel>
        <TweakSection label="Theme" />
        <TweakRadio
          label="Theme"
          value={t.theme}
          options={["dark", "light"]}
          onChange={(v) => setTweak("theme", v)}
        />
        <TweakSection label="Density" />
        <TweakRadio
          label="Density"
          value={t.density}
          options={["compact", "cozy"]}
          onChange={(v) => setTweak("density", v)}
        />
      </TweaksPanel>
    </div>
  );
}

function ActivityList({ entries }) {
  return (
    <article className="activity-list">
      <header className="activity-list__head">
        <h2>Recent activity</h2>
        <p className="gateway-app__row-hint">BFF audit projection · last {entries.length} events</p>
      </header>
      <ul className="activity-list__rows" role="list">
        {entries.map((e, i) => (
          <li key={i} className={`activity-row activity-row--${e.ok ? "ok" : "err"}`}>
            <span className="activity-row__ts mono">{formatTime(e.ts)}</span>
            <span className="activity-row__when">{formatRelative(e.ts)}</span>
            <span className="activity-row__actor">{e.actor}</span>
            <code className="activity-row__method">{e.method}</code>
            <span className={`activity-row__status activity-row__status--${e.ok ? "ok" : "err"}`}>
              {e.ok ? <IconCheck size={11} /> : <IconAlert size={11} />} {e.ok ? "ok" : "err"}
            </span>
            <span className="activity-row__meta mono">{e.meta ? JSON.stringify(e.meta) : "—"}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<GatewayApp />);
