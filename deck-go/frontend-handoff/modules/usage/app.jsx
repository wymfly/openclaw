// app.jsx — UsageApp orchestrator.
// Single-page dashboard:
//   - Topbar (eyebrow / title / KPI strip / range presets / refresh / ⌘K)
//   - Cost trend (large area chart)
//   - Provider rail (per-provider quota windows)
//   - Daily aggregate (bars + tools summary)
//   - Sessions table + lazy session detail drawer

const { useEffect, useMemo, useState } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/ {
  theme: "dark",
  density: "compact",
} /*EDITMODE-END*/;

function UsageApp() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const [costResp, setCostResp] = useState(window.USAGE_COST_RESPONSE);
  const [providersResp, setProvidersResp] = useState(window.USAGE_PROVIDERS_RESPONSE);
  const [sessionsResp, setSessionsResp] = useState(window.USAGE_SESSIONS_RESPONSE);
  const [bootstrap] = useState(window.USAGE_BOOTSTRAP);
  const [range, setRange] = useState(window.USAGE_RANGE_PRESETS.find((r) => r.isDefault).id);
  const [selectedSessionKey, setSelectedSessionKey] = useState(null);
  const [trendMode, setTrendMode] = useState("cost"); // cost | tokens

  // ⌘K → focus first interactive control (the search input lives in the
  // session table). For demo we just blur+focus the first input.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const input = document.querySelector('input[type="search"]');
        if (input) input.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", t.theme);
    document.documentElement.setAttribute("data-density", t.density);
  }, [t.theme, t.density]);

  const handleRefresh = () => {
    // Simulated refetch — bump updatedAt timestamps.
    const now = Date.now();
    setCostResp({ ...costResp, updatedAt: now });
    setProvidersResp({ ...providersResp, updatedAt: now });
    setSessionsResp({ ...sessionsResp, updatedAt: now });
  };

  const handleSelectSession = (key) => {
    setSelectedSessionKey((prev) => (prev === key ? null : key));
  };
  const closeDetail = () => setSelectedSessionKey(null);

  const selectedSession = useMemo(
    () => sessionsResp.sessions.find((s) => s.key === selectedSessionKey) || null,
    [sessionsResp, selectedSessionKey],
  );

  const totals = sessionsResp.totals || {};
  const aggregates = sessionsResp.aggregates || {};

  // KPI strip values.
  const totalCost14d = useMemo(
    () => costResp.daily.reduce((sum, d) => sum + (d.totalCost || d.cost || 0), 0),
    [costResp],
  );
  const today = costResp.daily[costResp.daily.length - 1];
  const yest = costResp.daily[costResp.daily.length - 2];
  const costDelta =
    today && yest && yest.totalCost
      ? ((today.totalCost - yest.totalCost) / yest.totalCost) * 100
      : 0;
  const costDeltaTone = costDelta > 10 ? "warn" : costDelta < -10 ? "ok" : "neutral";

  // Cost trend chart points.
  const costPoints = useMemo(
    () =>
      costResp.daily.map((d) => ({
        x: new Date(d.date).getTime(),
        y: d.totalCost || d.cost || 0,
        label: formatDateShort(d.date),
        date: d.date,
      })),
    [costResp],
  );

  // Daily aggregate bars (tokens or cost depending on trendMode).
  const dailyBars = useMemo(() => {
    const daily = aggregates.daily || [];
    return daily.map((d) => ({
      label: d.date,
      shortLabel: formatDateShort(d.date),
      value: trendMode === "cost" ? d.cost : d.tokens,
    }));
  }, [aggregates, trendMode]);

  return (
    <div className="usage-app">
      <header className="usage-app__topbar">
        <div className="usage-app__brand">
          <span className="usage-app__eyebrow">deck-go · usage</span>
          <h1 className="usage-app__title">Cost &amp; quota cockpit</h1>
          <p className="usage-app__subtitle">
            Endpoints: <code>/api/usage/cost</code> · <code>/api/usage/providers</code> ·{" "}
            <code>/api/usage/sessions</code>
          </p>
        </div>
        <div className="usage-app__kpi-strip" role="group" aria-label="Usage KPI">
          <div className="usage-app__kpi usage-app__kpi--accent">
            <span className="usage-app__kpi-lbl">Cost · {costResp.days || 14}d</span>
            <strong className="mono">{formatCost(totalCost14d)}</strong>
          </div>
          <div className={`usage-app__kpi usage-app__kpi--${costDeltaTone}`}>
            <span className="usage-app__kpi-lbl">vs yesterday</span>
            <strong className="mono">
              {costDelta >= 0 ? "+" : ""}
              {costDelta.toFixed(1)}%
            </strong>
          </div>
          <div className="usage-app__kpi">
            <span className="usage-app__kpi-lbl">Tokens · 7d</span>
            <strong className="mono">{formatTokens(totals.totalTokens)}</strong>
          </div>
          <div className="usage-app__kpi">
            <span className="usage-app__kpi-lbl">Sessions</span>
            <strong className="mono">{sessionsResp.sessions.length}</strong>
          </div>
        </div>
        <div className="usage-app__actions">
          <div className="usage-app__range" role="tablist" aria-label="Date range">
            {window.USAGE_RANGE_PRESETS.map((r) => (
              <button
                key={r.id}
                role="tab"
                aria-selected={range === r.id}
                className={`ds-seg ${range === r.id ? "ds-seg--on" : ""}`}
                onClick={() => setRange(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="usage-app__bootstrap">
            {bootstrap.ok ? (
              <span className="usage-app__bs usage-app__bs--ok">
                <IconCheck size={11} /> bootstrap OK
              </span>
            ) : (
              <span className="usage-app__bs usage-app__bs--err">
                <IconAlert size={11} /> bootstrap not ready
              </span>
            )}
          </div>
          <span className="ds-kbd-hint" title="Focus session search">
            <kbd>⌘</kbd>
            <kbd>K</kbd>
          </span>
          <button className="ds-btn ds-btn--ghost" onClick={handleRefresh} title="Refetch usage">
            <IconRefresh size={13} /> Refresh
          </button>
        </div>
      </header>

      <main className="usage-app__main">
        <section className="usage-app__row usage-app__row--trend">
          <header className="usage-app__row-head">
            <h2>Cost trend</h2>
            <p className="usage-app__row-hint">Last {costResp.days || 14} days · daily totalCost</p>
            <div className="usage-app__trend-toggle" role="tablist" aria-label="Trend mode">
              <button
                role="tab"
                aria-selected={trendMode === "cost"}
                className={`ds-seg ${trendMode === "cost" ? "ds-seg--on" : ""}`}
                onClick={() => setTrendMode("cost")}
              >
                <IconCoin size={11} /> Cost
              </button>
              <button
                role="tab"
                aria-selected={trendMode === "tokens"}
                className={`ds-seg ${trendMode === "tokens" ? "ds-seg--on" : ""}`}
                onClick={() => setTrendMode("tokens")}
              >
                <IconSigma size={11} /> Tokens
              </button>
            </div>
          </header>
          <div className="usage-app__trend-card">
            <AreaTrend
              tone="accent"
              points={costPoints}
              width={1100}
              height={220}
              labelFmt={(p) => `${p.label}: $${p.y.toFixed(2)}`}
            />
          </div>
        </section>

        <section className="usage-app__row usage-app__row--two-col">
          <article className="usage-app__provider-rail">
            <header className="usage-app__row-head">
              <h2>Provider quota</h2>
              <p className="usage-app__row-hint">
                Per-provider quota windows · tones: HOT ≥ 90% · WARM ≥ 60% · OK
              </p>
            </header>
            <div className="provider-rail__list">
              {providersResp.providers.map((p) => (
                <div key={p.provider} className={`provider-card provider-card--${p.provider}`}>
                  <header className="provider-card__head">
                    <ProviderIcon provider={p.provider} size={16} />
                    <div>
                      <strong>{p.displayName}</strong>
                      <span className="provider-card__plan">{p.plan || ""}</span>
                    </div>
                    {p.error ? (
                      <span className="provider-card__err">
                        <IconAlert size={11} /> {p.error}
                      </span>
                    ) : null}
                  </header>
                  <div className="provider-card__body">
                    {p.windows.map((w, i) => (
                      <QuotaBar
                        key={i}
                        percent={w.usedPercent}
                        label={w.label}
                        resetAt={w.resetAt}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="usage-app__aggregate">
            <header className="usage-app__row-head">
              <h2>Daily aggregate</h2>
              <p className="usage-app__row-hint">
                {trendMode === "cost" ? "Cost" : "Tokens"} · 7d · message + tool counts available
              </p>
            </header>
            <div className="usage-app__bars">
              <BarMini entries={dailyBars} width={520} height={120} tone="accent" />
            </div>
            <dl className="usage-app__aggregate-def">
              <div>
                <dt>Messages</dt>
                <dd>
                  <strong>{(aggregates.messages?.total || 0).toLocaleString()}</strong>
                  <span className="dd-hint">
                    user {aggregates.messages?.user || 0} · assistant{" "}
                    {aggregates.messages?.assistant || 0} · tool{" "}
                    {aggregates.messages?.toolCalls || 0} · err {aggregates.messages?.errors || 0}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Latency</dt>
                <dd>
                  <strong>avg {aggregates.latency?.avgMs || 0}ms</strong>
                  <span className="dd-hint">
                    p95 {aggregates.latency?.p95Ms || 0}ms · max {aggregates.latency?.maxMs || 0}ms
                  </span>
                </dd>
              </div>
              <div>
                <dt>Top tools</dt>
                <dd>
                  <ul className="tools-list">
                    {(aggregates.tools?.tools || []).slice(0, 6).map((tl, i) => (
                      <li key={i}>
                        <code>{tl.name}</code> <span className="mono">{tl.count}</span>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div>
                <dt>Token mix</dt>
                <dd>
                  <strong className="mono">in {formatTokens(totals.input)}</strong>
                  <span className="dd-hint">
                    out {formatTokens(totals.output)} · cache R {formatTokens(totals.cacheRead)} ·
                    cache W {formatTokens(totals.cacheWrite)}
                  </span>
                </dd>
              </div>
            </dl>
          </article>
        </section>

        <section className="usage-app__row usage-app__row--two-col usage-app__row--bottom">
          <SessionTable
            sessions={sessionsResp.sessions}
            selectedKey={selectedSessionKey}
            onSelect={handleSelectSession}
            agentLabels={window.USAGE_AGENT_LABELS}
            channelLabels={window.USAGE_CHANNEL_LABELS}
          />
          <SessionDetail
            session={selectedSession}
            agentLabels={window.USAGE_AGENT_LABELS}
            channelLabels={window.USAGE_CHANNEL_LABELS}
            modelLabels={window.USAGE_MODEL_LABELS}
            providerLabels={window.USAGE_PROVIDER_LABELS}
            onClose={closeDetail}
          />
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

ReactDOM.createRoot(document.getElementById("root")).render(<UsageApp />);
