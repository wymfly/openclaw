// channels — Selected-channel detail view (full-width, tabs).

const { useMemo: _dvMemo, useState: _dvState } = React;

const CHANNEL_TABS = [
  { id: "overview", label: "Overview" },
  { id: "throughput", label: "Throughput" },
  { id: "probe", label: "Probe" },
  { id: "settings", label: "Settings" },
  { id: "routing", label: "Routing" },
  { id: "wecom", label: "WeCom access", wecomOnly: true },
];

function DetailView({ channel, tweaks, setTweak, onBack, onTest, onLogout }) {
  const isWeCom = channel.id === "wecom";
  const tabs = CHANNEL_TABS.filter((t) => !t.wecomOnly || isWeCom);
  const tabId = tabs.find((t) => t.id === tweaks.activeTab) ? tweaks.activeTab : "overview";

  const accounts = channel.core.accounts || [];
  const tp = window.MOCK.throughput[channel.id] || { messagesIn: 0, messagesOut: 0, buckets: [] };
  const probe = window.MOCK.probe[channel.id];
  const cfg = window.MOCK.channelConfig[channel.id];
  const routing = window.MOCK.routing[channel.id];
  const alerts = accounts.filter((aid) => {
    const d = window.MOCK.accountDiagnostics[aid];
    return d && (d.health === "warn" || d.health === "err");
  });

  const renderTab = () => {
    if (tweaks.detailState === "loading") {
      return (
        <div className="empty">
          <span className="spinner" /> Loading channel detail…
        </div>
      );
    }
    if (tweaks.detailState === "error") {
      return (
        <div className="empty">
          <strong>Failed to load channel detail</strong>
          One of GET /channels, /throughput, or /test returned an error.
          <button className="btn btn--sm">Retry</button>
        </div>
      );
    }
    switch (tabId) {
      case "throughput":
        return (
          <TabThroughput
            channel={channel}
            tp={tp}
            window={tweaks.throughputWindow}
            setTweak={setTweak}
          />
        );
      case "probe":
        return (
          <TabProbe
            channel={channel}
            probe={probe}
            accounts={accounts}
            alerts={alerts}
            onTest={onTest}
          />
        );
      case "settings":
        return (
          <TabSettings
            channel={channel}
            cfg={cfg}
            dirty={tweaks.configDirty}
            setDirty={(v) => setTweak("configDirty", v)}
          />
        );
      case "routing":
        return <TabRouting routing={routing} />;
      case "wecom":
        return <TabWeCom accounts={accounts} />;
      case "overview":
      default:
        return (
          <TabOverview
            channel={channel}
            tp={tp}
            probe={probe}
            accounts={accounts}
            alerts={alerts}
          />
        );
    }
  };

  return (
    <main className="view">
      <div className="detail__head">
        <button className="btn btn--ghost detail__back" onClick={onBack}>
          <IconArrowL /> Channels
        </button>
        <span className="detail__back-trail">/ {channel.label}</span>
      </div>

      <header className="hero">
        <ChannelGlyph id={channel.id} size={44} />
        <div>
          <h1 className="hero__title">
            {channel.label}
            <small>{channel.id}</small>
          </h1>
          <p className="hero__sub">
            {channel.detailLabel}
            {channel.meta?.pluginId && (
              <>
                {" "}
                · plugin <strong>{channel.meta.pluginId}</strong>
              </>
            )}
            {channel.defaultAccountId && (
              <>
                {" "}
                · default <code>{channel.defaultAccountId}</code>
              </>
            )}
          </p>
          <div className="hero__meta">
            {channel.core.enabled ? (
              channel.core.healthy ? (
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
            <span className="pill">{accounts.length} acct</span>
            {alerts.length > 0 && (
              <span className="pill pill--warn">
                {alerts.length} alert{alerts.length > 1 ? "s" : ""}
              </span>
            )}
            {probe?.ok && (
              <span className="pill pill--info">
                <IconActivity />
                {probe.latencyMs}ms probe
              </span>
            )}
            {channel.meta?.pluginOrigin && (
              <span className="pill">{channel.meta.pluginOrigin}</span>
            )}
          </div>
        </div>
        <div className="hero__actions">
          <button className="btn" onClick={onTest}>
            Test channel
          </button>
          <button className="btn btn--danger" onClick={onLogout} disabled={!channel.core.enabled}>
            <IconLogout /> Logout
          </button>
        </div>
      </header>

      <nav className="tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tabId === t.id}
            className={"tab " + (tabId === t.id ? "is-active" : "")}
            onClick={() => setTweak("activeTab", t.id)}
          >
            {t.label}
            {t.id === "routing" && routing && routing.bindings?.length > 0 && (
              <span className="tab__count">{routing.bindings.length}</span>
            )}
          </button>
        ))}
      </nav>

      <section className="detail__body">{renderTab()}</section>

      <footer className="view__footer">
        <div className="view__footer-row">
          <span>
            cfg <strong>{cfg?.hash || "—"}</strong>
          </span>
          {routing && (
            <span>
              routing <strong>{routing.configHash}</strong>
            </span>
          )}
        </div>
        <div className="view__footer-row">
          <span>
            <span className="kbd">esc</span> back
          </span>
        </div>
      </footer>
    </main>
  );
}

/* ── Overview tab ───────────────────────────────────────────────── */
function TabOverview({ channel, tp, probe, accounts, alerts }) {
  const tilesIn = tp.messagesIn || 0;
  const tilesOut = tp.messagesOut || 0;
  return (
    <>
      <section className="section">
        <header className="section__head">
          <h2 className="section__title">Inventory snapshot</h2>
          <p className="section__hint">From `GET /channels` projected by Deck BFF.</p>
        </header>
        <div className="tile-row">
          <div className="tile">
            <span className="tile__label">Messages in (1h)</span>
            <span className="tile__value">{tilesIn}</span>
            <span className="tile__delta tile__delta--up">
              +{Math.round(tilesIn * 0.18)} vs prev hour
            </span>
          </div>
          <div className="tile">
            <span className="tile__label">Messages out (1h)</span>
            <span className="tile__value">{tilesOut}</span>
            <span className="tile__delta tile__delta--up">
              +{Math.round(tilesOut * 0.12)} vs prev hour
            </span>
          </div>
          <div className="tile">
            <span className="tile__label">Probe latency</span>
            <span className="tile__value">{probe?.ok ? `${probe.latencyMs}ms` : "—"}</span>
            <span className="tile__delta">
              {probe?.ok ? "success" : probe?.error || "no probe"}
            </span>
          </div>
          <div className="tile">
            <span className="tile__label">Accounts</span>
            <span className="tile__value">{accounts.length}</span>
            <span className={"tile__delta " + (alerts.length > 0 ? "tile__delta--down" : "")}>
              {alerts.length} alerting · {accounts.length - alerts.length} ok
            </span>
          </div>
        </div>
      </section>

      {alerts.length > 0 && (
        <section className="section">
          <header className="section__head">
            <h2 className="section__title">Account alerts</h2>
            <p className="section__hint">
              Accounts needing operator attention before production routing.
            </p>
          </header>
          <div className="acct-list">
            {alerts.map((aid) => {
              const d = window.MOCK.accountDiagnostics[aid] || {};
              return (
                <div key={aid} className="acct-row" data-health={d.health || "warn"}>
                  <span className="acct-row__indicator" />
                  <div>
                    <div className="acct-row__title">
                      {d.displayName || aid} <small>{aid}</small>
                    </div>
                    <p className="acct-row__desc">
                      {d.title} — {d.description}
                    </p>
                    {d.nextStep && <p className="acct-row__next">Next: {d.nextStep}</p>}
                  </div>
                  <span className={"pill " + (d.health === "err" ? "pill--err" : "pill--warn")}>
                    {d.health === "err" ? "error" : "warning"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="section">
        <header className="section__head">
          <h2 className="section__title">Quick links</h2>
        </header>
        <div className="hero__actions">
          <button className="btn">
            <IconPlug /> Open {channel.meta?.pluginId || "plugin"}
          </button>
          {channel.id === "wecom" && (
            <button className="btn">
              <IconRoute /> Routing for WeCom
            </button>
          )}
          <button className="btn">
            <IconCog /> Channel settings
          </button>
        </div>
      </section>
    </>
  );
}

/* ── Throughput tab ─────────────────────────────────────────────── */
function TabThroughput({ channel, tp, window: w, setTweak }) {
  const buckets = tp.buckets || [];
  const max = Math.max(1, ...buckets.map((b) => Math.max(b.in || 0, b.out || 0)));
  return (
    <section className="section">
      <header className="section__head">
        <div>
          <h2 className="section__title">Throughput · {w}</h2>
          <p className="section__hint">
            Windowed in/out buckets from `GET /channels/{channel.id}/throughput`.
          </p>
        </div>
        <div className="toolbar__filter">
          {["1h", "6h", "24h"].map((it) => (
            <button
              key={it}
              type="button"
              className={w === it ? "is-active" : ""}
              onClick={() => setTweak("throughputWindow", it)}
            >
              {it}
            </button>
          ))}
        </div>
      </header>
      {buckets.length === 0 ? (
        <div className="empty">
          <strong>No buckets in this window</strong>The BFF returned zero buckets — do not fabricate
          traffic.
        </div>
      ) : (
        <>
          <div
            className="chart"
            role="img"
            aria-label={`${tp.messagesIn} in / ${tp.messagesOut} out`}
          >
            {buckets.map((b, i) => {
              const inH = Math.round(((b.in || 0) / max) * 100);
              const outH = Math.round(((b.out || 0) / max) * 100);
              return (
                <div
                  key={i}
                  className="chart__bar"
                  title={`${new Date(b.time || 0).toLocaleTimeString()} · in ${b.in} / out ${b.out}`}
                >
                  <div className="chart__seg chart__seg--in" style={{ height: `${inH}%` }} />
                  <div className="chart__seg chart__seg--out" style={{ height: `${outH}%` }} />
                </div>
              );
            })}
          </div>
          <div className="chart__legend">
            <span>
              <span className="chart__swatch" style={{ background: "var(--ds-accent)" }} /> messages
              in · {tp.messagesIn}
            </span>
            <span>
              <span
                className="chart__swatch"
                style={{ background: "color-mix(in srgb, var(--ds-accent) 40%, transparent)" }}
              />{" "}
              messages out · {tp.messagesOut}
            </span>
          </div>
        </>
      )}
    </section>
  );
}

/* ── Probe tab ──────────────────────────────────────────────────── */
function TabProbe({ probe, accounts, alerts, onTest }) {
  return (
    <>
      <section className="section">
        <header className="section__head">
          <h2 className="section__title">Probe result</h2>
          <button className="btn btn--primary btn--sm" onClick={onTest}>
            Run probe
          </button>
        </header>
        {!probe ? (
          <div className="empty">No probe taken since channel was disabled.</div>
        ) : (
          <div className={"probe-card " + (probe.ok ? "is-ok" : "is-fail")}>
            <span className="probe-card__icon">{probe.ok ? <IconCheck /> : <IconX />}</span>
            <div className="probe-card__main">
              <strong>
                {probe.ok ? "Probe success" : "Probe failed"} — {probe.latencyMs}ms
              </strong>
              <small>
                check {probe.check} · checked{" "}
                {probe.checkedAt ? new Date(probe.checkedAt).toLocaleTimeString() : "—"}
                {probe.error && <> · {probe.error}</>}
              </small>
            </div>
            <span className={"pill " + (probe.ok ? "pill--ok" : "pill--err")}>
              {probe.ok ? "ok" : "error"}
            </span>
          </div>
        )}
      </section>

      <section className="section">
        <header className="section__head">
          <h2 className="section__title">Account diagnostics</h2>
          <p className="section__hint">
            {accounts.length} accounts · {alerts.length} alert{alerts.length === 1 ? "" : "s"}
          </p>
        </header>
        {accounts.length === 0 ? (
          <div className="empty">
            <strong>No accounts configured</strong>Add a provider account before running probes.
          </div>
        ) : (
          <div className="acct-list">
            {accounts.map((aid) => {
              const d = window.MOCK.accountDiagnostics[aid] || {};
              return (
                <div key={aid} className="acct-row" data-health={d.health || "muted"}>
                  <span className="acct-row__indicator" />
                  <div>
                    <div className="acct-row__title">
                      {d.displayName || aid} <small>{aid}</small>
                    </div>
                    <p className="acct-row__desc">
                      {d.title} — {d.description}
                    </p>
                    {d.nextStep && <p className="acct-row__next">Next: {d.nextStep}</p>}
                  </div>
                  <span
                    className={
                      "pill " +
                      (d.health === "ok"
                        ? "pill--ok"
                        : d.health === "err"
                          ? "pill--err"
                          : d.health === "warn"
                            ? "pill--warn"
                            : d.health === "info"
                              ? "pill--info"
                              : "pill--muted")
                    }
                  >
                    {d.health || "unknown"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

/* ── Settings tab ───────────────────────────────────────────────── */
function TabSettings({ channel, cfg, dirty, setDirty }) {
  const [retry, setRetry] = _dvState(cfg?.config?.retry?.attempts ?? 3);
  const [jitter, setJitter] = _dvState(cfg?.config?.retry?.jitter ?? 0.2);
  const [enabled, setEnabled] = _dvState(cfg?.config?.enabled ?? channel.core.enabled);
  const [webhookOn, setWebhookOn] = _dvState(cfg?.config?.webhook?.enabled ?? false);
  const [webhookUrl, setWebhookUrl] = _dvState(cfg?.config?.webhook?.url ?? "");
  const [patchText, setPatchText] = _dvState("");

  const markDirty = () => {
    if (!dirty) setDirty(true);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    setDirty(false);
  };

  return (
    <form className="section" onSubmit={onSubmit}>
      <header className="section__head">
        <div>
          <h2 className="section__title">Channel settings</h2>
          <p className="section__hint">
            Generic channel config and JSON patch seam — server owns get/patch and base hash.
          </p>
        </div>
        {dirty && <span className="form__dirty">unsaved changes</span>}
      </header>
      <div className="form">
        <div className="form__row">
          <label className="form__label">Enabled</label>
          <button
            type="button"
            className={"toggle " + (enabled ? "is-on" : "")}
            onClick={() => {
              setEnabled(!enabled);
              markDirty();
            }}
          >
            <span className="toggle__switch" />
            {enabled ? "Channel enabled" : "Channel disabled"}
          </button>
        </div>
        <div className="form__row">
          <label className="form__label" htmlFor={`retry-${channel.id}`}>
            Retry attempts
          </label>
          <input
            id={`retry-${channel.id}`}
            type="number"
            min="0"
            max="10"
            className="input"
            value={retry}
            onChange={(e) => {
              setRetry(Number(e.target.value));
              markDirty();
            }}
          />
          <span className="form__hint">Server applies exponential backoff per provider.</span>
        </div>
        <div className="form__row">
          <label className="form__label" htmlFor={`jitter-${channel.id}`}>
            Jitter
          </label>
          <input
            id={`jitter-${channel.id}`}
            type="number"
            step="0.05"
            min="0"
            max="1"
            className="input"
            value={jitter}
            onChange={(e) => {
              setJitter(Number(e.target.value));
              markDirty();
            }}
          />
          <span className="form__hint">Fraction of base interval (0 – 1).</span>
        </div>
        <div className="form__row">
          <label className="form__label">Webhook</label>
          <button
            type="button"
            className={"toggle " + (webhookOn ? "is-on" : "")}
            onClick={() => {
              setWebhookOn(!webhookOn);
              markDirty();
            }}
          >
            <span className="toggle__switch" />
            {webhookOn ? "Webhook on" : "Webhook off"}
          </button>
        </div>
        <div className="form__row form__row--full">
          <label className="form__label" htmlFor={`hook-${channel.id}`}>
            Webhook URL
          </label>
          <input
            id={`hook-${channel.id}`}
            type="url"
            className="input"
            placeholder="https://hooks.example.com/…"
            value={webhookUrl}
            disabled={!webhookOn}
            onChange={(e) => {
              setWebhookUrl(e.target.value);
              markDirty();
            }}
          />
        </div>
        <div className="form__row form__row--full">
          <label className="form__label">Free-form JSON patch</label>
          <textarea
            className="input"
            placeholder='{"slashCommands":{"autoRegister":true}}'
            rows={4}
            value={patchText}
            onChange={(e) => {
              setPatchText(e.target.value);
              markDirty();
            }}
          />
          <span className="form__hint">
            Applied via PATCH /channels/{channel.id} after merge with current config.
          </span>
        </div>
      </div>
      <div className="form__actions">
        <button type="submit" className="btn btn--primary" disabled={!dirty}>
          <IconCheck /> Save settings
        </button>
        <button type="button" className="btn" disabled={!dirty} onClick={() => setDirty(false)}>
          Discard
        </button>
        <span className="form__hint" style={{ marginLeft: "auto" }}>
          base hash <code>{cfg?.baseHash || "—"}</code>
        </span>
      </div>
    </form>
  );
}

/* ── Routing tab ────────────────────────────────────────────────── */
function TabRouting({ routing }) {
  const fmtMatch = (m) => {
    const parts = [`channel ${m.channel}`];
    if (m.accountId) parts.push(`acct ${m.accountId}`);
    if (m.peer) parts.push(`${m.peer.kind} ${m.peer.id}`);
    if (m.guildId) parts.push(`guild ${m.guildId}`);
    if (m.teamId) parts.push(`team ${m.teamId}`);
    return parts.join(" · ");
  };
  return (
    <section className="section">
      <header className="section__head">
        <div>
          <h2 className="section__title">Routing bindings</h2>
          <p className="section__hint">
            From `GET /routing` filtered to this channel. Default agent:{" "}
            <strong>{routing?.defaultAgentId || "—"}</strong>
          </p>
        </div>
        <button className="btn btn--primary btn--sm">
          <IconPlus /> Add binding
        </button>
      </header>
      {!routing || routing.bindings.length === 0 ? (
        <div className="empty">
          <strong>No bindings on this channel</strong>
          Traffic falls through to the default agent.
        </div>
      ) : (
        <div className="binding-list">
          {routing.bindings.map((b) => (
            <div key={b.id} className="binding">
              <span className="binding__tier">{b.tier}</span>
              <span className="binding__match">
                {fmtMatch(b.match)}
                {b.comment && <em> — {b.comment}</em>}
              </span>
              <span className="binding__agent">→ {b.agentId}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ── WeCom access tab (provider-specific) ───────────────────────── */
function TabWeCom({ accounts }) {
  return (
    <section className="section">
      <header className="section__head">
        <div>
          <h2 className="section__title">WeCom access controls</h2>
          <p className="section__hint">
            Provider-specific allow-from / dynamic-agents / fail-closed routing per tenant.
          </p>
        </div>
        <span className="pill pill--info">
          <IconShield /> wecom-only
        </span>
      </header>
      <div className="wecom-grid">
        {accounts.map((aid) => {
          const wa = window.MOCK.wecomAccess[aid];
          if (!wa) return null;
          const d = window.MOCK.accountDiagnostics[aid] || {};
          return (
            <article key={aid} className="wecom-card">
              <header className="wecom-card__title">
                {d.displayName || aid}
                <span className="pill pill--muted">{aid}</span>
              </header>
              <div className="wecom-card__row">
                <span>Allow from agents</span>
                <strong>{(wa.allowFromAgents || []).join(", ") || "—"}</strong>
              </div>
              <div className="wecom-card__row">
                <span>Allow bots</span>
                <span className={"toggle " + (wa.allowBots ? "is-on" : "")}>
                  <span className="toggle__switch" />
                  {wa.allowBots ? "on" : "off"}
                </span>
              </div>
              <div className="wecom-card__row">
                <span>Dynamic agents</span>
                <span className={"toggle " + (wa.dynamicAgentsEnabled ? "is-on" : "")}>
                  <span className="toggle__switch" />
                  {wa.dynamicAgentsEnabled ? "on" : "off"}
                </span>
              </div>
              <div className="wecom-card__row">
                <span>Fail-closed routing</span>
                <span className={"toggle " + (wa.failClosedRouting ? "is-on" : "")}>
                  <span className="toggle__switch" />
                  {wa.failClosedRouting ? "on" : "off"}
                </span>
              </div>
              <div className="wecom-card__row">
                <span>Last saved</span>
                <small style={{ color: "var(--ds-text-3)", fontFamily: "var(--ds-font-mono)" }}>
                  {new Date(wa.lastSavedMs).toLocaleString()}
                </small>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

Object.assign(window, { DetailView, CHANNEL_TABS });
