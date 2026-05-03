// models — Detail view: model hero + tabs.

const MODEL_TABS = [
  { id: "overview", label: "Overview" },
  { id: "limits", label: "Limits" },
  { id: "pricing", label: "Pricing" },
  { id: "usage", label: "Usage" },
  { id: "auth", label: "Auth" },
  { id: "audit", label: "Audit" },
];

function DetailView({ model, tweaks, setTweak, onBack, onProbe, onAuthConfig }) {
  const tabId = MODEL_TABS.find((t) => t.id === tweaks.activeTab) ? tweaks.activeTab : "overview";
  const probe = window.MOCK.probe[model.id];
  const auth = window.MOCK.authProviders.find((a) => a.provider === model.provider);
  const cost = window.MOCK.usage.cost.perModel[model.id];
  const pricing = window.MOCK.pricing[model.id];

  const fmtCtx = (n) => (n >= 1000 ? `${(n / 1000).toFixed(0)}k` : `${n}`);

  const renderTab = () => {
    if (tweaks.detailState === "loading")
      return (
        <div className="empty">
          <span className="spinner" /> Loading model detail…
        </div>
      );
    if (tweaks.detailState === "error")
      return (
        <div className="empty">
          <strong>Failed to load model detail</strong>
          Either /models/config or deck.auth.probe returned an error.{" "}
          <button className="btn btn--sm">Retry</button>
        </div>
      );
    switch (tabId) {
      case "limits":
        return <TabLimits model={model} />;
      case "pricing":
        return <TabPricing model={model} pricing={pricing} cost={cost} />;
      case "usage":
        return <TabUsage model={model} cost={cost} />;
      case "auth":
        return <TabAuth provider={model.provider} auth={auth} onConfigClick={onAuthConfig} />;
      case "audit":
        return <TabAudit model={model} />;
      case "overview":
      default:
        return (
          <TabOverview
            model={model}
            probe={probe}
            auth={auth}
            cost={cost}
            pricing={pricing}
            fmtCtx={fmtCtx}
          />
        );
    }
  };

  return (
    <main className="view">
      <div className="detail__head">
        <button className="btn btn--ghost detail__back" onClick={onBack}>
          <IconArrowL /> Models
        </button>
        <span className="detail__back-trail">
          / {authProviderDisplay(model.provider)} / {model.displayName}
        </span>
      </div>

      <header className="hero">
        <ProviderGlyph id={model.provider} size={44} />
        <div>
          <h1 className="hero__title">
            {model.displayName}
            <small>{model.id}</small>
          </h1>
          <p className="hero__sub">
            {authProviderDisplay(model.provider)} · {model.family || "—"} · context{" "}
            {fmtCtx(model.contextWindow)}/{fmtCtx(model.maxTokens)} max-out
          </p>
          <div className="hero__meta">
            {model.isDefault && (
              <span className="pill pill--ok">
                <IconStar />
                default for {model.provider}
              </span>
            )}
            {model.fallback && <span className="pill pill--info">fallback</span>}
            {model.reasoning && (
              <span className="pill pill--info">
                <IconBrain />
                reasoning
              </span>
            )}
            {model.local && (
              <span className="pill pill--info">
                <IconCpu />
                local
              </span>
            )}
            {auth ? (
              <ProviderStatusPill status={auth.status} />
            ) : (
              <span className="pill pill--muted">unknown</span>
            )}
            {probe?.status === "ok" && (
              <span className="pill pill--ok">
                <IconActivity />
                {probe.latencyMs}ms probe
              </span>
            )}
            {probe?.status === "cooldown" && (
              <span className="pill pill--warn">
                <span className="pill__dot" />
                cooldown
              </span>
            )}
          </div>
        </div>
        <div className="hero__actions">
          <button className="btn" onClick={onProbe}>
            Run probe
          </button>
          <button className="btn btn--primary">
            <IconStar /> Set default
          </button>
        </div>
      </header>

      <nav className="tabs" role="tablist">
        {MODEL_TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tabId === t.id}
            className={"tab " + (tabId === t.id ? "is-active" : "")}
            onClick={() => setTweak("activeTab", t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <section className="detail__body">{renderTab()}</section>

      <footer className="view__footer">
        <div className="view__footer-row">
          <span>
            cfg <strong>{window.MOCK.modelsConfig.hash}</strong>
          </span>
          {auth?.source && (
            <span>
              auth via <strong>{auth.source}</strong>
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
function TabOverview({ model, probe, auth, cost, pricing, fmtCtx }) {
  return (
    <>
      <section className="section">
        <header className="section__head">
          <h2 className="section__title">Runtime snapshot</h2>
          <p className="section__hint">From `models.configured` runtime call.</p>
        </header>
        <div className="tile-row">
          <div className="tile">
            <span className="tile__label">Context window</span>
            <span className="tile__value">{fmtCtx(model.contextWindow)}</span>
            <span className="tile__delta">tokens</span>
          </div>
          <div className="tile">
            <span className="tile__label">Max output</span>
            <span className="tile__value">{fmtCtx(model.maxTokens)}</span>
            <span className="tile__delta">tokens per response</span>
          </div>
          <div className="tile">
            <span className="tile__label">Probe latency</span>
            <span className="tile__value">
              {probe?.status === "ok" ? `${probe.latencyMs}ms` : "—"}
            </span>
            <span className="tile__delta">
              {probe?.status === "ok"
                ? "deck.auth.probe success"
                : probe?.error || "no recent probe"}
            </span>
          </div>
          <div className="tile">
            <span className="tile__label">Spend (24h)</span>
            <span className="tile__value">
              {cost ? `$${(cost.in + cost.out).toFixed(2)}` : "$0.00"}
            </span>
            <span className="tile__delta">{cost ? `${cost.requests} requests` : "no usage"}</span>
          </div>
        </div>
      </section>

      <section className="section">
        <header className="section__head">
          <h2 className="section__title">Provider auth</h2>
          <p className="section__hint">
            From `deck.auth.overview` for {authProviderDisplay(model.provider)}.
          </p>
        </header>
        {auth ? (
          <div className="auth-list">
            <div className="auth-row">
              <ProviderGlyph id={auth.provider} size={28} />
              <div className="auth-row__main">
                <span className="auth-row__name">{authProviderDisplay(auth.provider)}</span>
                <span className="auth-row__src">{auth.auth?.source || auth.source || "—"}</span>
              </div>
              <span className="pill pill--muted">
                {auth.auth?.type || (auth.authPresent ? "auth" : "no auth")}
              </span>
              <span className="pill">{auth.scope || "—"}</span>
              <ProviderStatusPill status={auth.status} />
            </div>
          </div>
        ) : (
          <div className="empty">No auth provider configured for {model.provider}.</div>
        )}
      </section>

      <section className="section">
        <header className="section__head">
          <h2 className="section__title">Quick pricing</h2>
          <p className="section__hint">Snapshot from {pricing?.source || "vendor"}.</p>
        </header>
        {pricing ? (
          <div className="pricing">
            <div className="pricing__cell">
              <span className="pricing__label">Input · per 1M tokens</span>
              <span className="pricing__value">${pricing.inputPer1MTokens.toFixed(2)}</span>
              <span className="pricing__src">{pricing.source}</span>
            </div>
            <div className="pricing__cell">
              <span className="pricing__label">Output · per 1M tokens</span>
              <span className="pricing__value">${pricing.outputPer1MTokens.toFixed(2)}</span>
              <span className="pricing__src">{pricing.source}</span>
            </div>
            <div className="pricing__cell">
              <span className="pricing__label">Effective ratio</span>
              <span className="pricing__value">
                {pricing.outputPer1MTokens > 0
                  ? `${(pricing.outputPer1MTokens / Math.max(pricing.inputPer1MTokens, 0.0001)).toFixed(1)}×`
                  : "—"}
              </span>
              <span className="pricing__src">out / in</span>
            </div>
          </div>
        ) : (
          <div className="empty">No pricing snapshot for this model.</div>
        )}
      </section>
    </>
  );
}

/* ── Limits tab ─────────────────────────────────────────────────── */
function TabLimits({ model }) {
  const fmtCtx = (n) => (n >= 1000 ? `${(n / 1000).toFixed(0)}k` : `${n}`);
  return (
    <section className="section">
      <header className="section__head">
        <h2 className="section__title">Limits & capabilities</h2>
        <p className="section__hint">Surface contract caps; runtime may apply tighter limits.</p>
      </header>
      <div className="tile-row">
        <div className="tile">
          <span className="tile__label">Context window</span>
          <span className="tile__value">{fmtCtx(model.contextWindow)}</span>
          <span className="tile__delta">tokens</span>
        </div>
        <div className="tile">
          <span className="tile__label">Max output</span>
          <span className="tile__value">{fmtCtx(model.maxTokens)}</span>
          <span className="tile__delta">tokens per response</span>
        </div>
        <div className="tile">
          <span className="tile__label">Reasoning</span>
          <span className="tile__value">{model.reasoning ? "yes" : "no"}</span>
          <span className="tile__delta">extended thinking</span>
        </div>
        <div className="tile">
          <span className="tile__label">Local</span>
          <span className="tile__value">{model.local ? "yes" : "no"}</span>
          <span className="tile__delta">{model.local ? "no network" : "remote api"}</span>
        </div>
      </div>
      <div className="banner">
        Limits come from runtime config. To raise a cap (e.g. `maxTokens`), update{" "}
        <code>openclaw.json</code> via <code>PATCH /models/config</code>; the server validates
        against provider-published ceilings.
      </div>
    </section>
  );
}

/* ── Pricing tab ────────────────────────────────────────────────── */
function TabPricing({ model, pricing, cost }) {
  if (!pricing)
    return (
      <div className="empty">
        <strong>No pricing for {model.id}</strong>This model is local or pricing is not yet
        snapshotted.
      </div>
    );
  const blendedPerCall = cost && cost.requests > 0 ? (cost.in + cost.out) / cost.requests : null;
  return (
    <section className="section">
      <header className="section__head">
        <h2 className="section__title">Pricing & spend</h2>
        <p className="section__hint">{pricing.source}</p>
      </header>
      <div className="pricing">
        <div className="pricing__cell">
          <span className="pricing__label">Input · per 1M</span>
          <span className="pricing__value">${pricing.inputPer1MTokens.toFixed(2)}</span>
          <span className="pricing__src">prompt + system</span>
        </div>
        <div className="pricing__cell">
          <span className="pricing__label">Output · per 1M</span>
          <span className="pricing__value">${pricing.outputPer1MTokens.toFixed(2)}</span>
          <span className="pricing__src">streamed completion</span>
        </div>
        <div className="pricing__cell">
          <span className="pricing__label">Average call (24h)</span>
          <span className="pricing__value">
            {blendedPerCall ? `$${blendedPerCall.toFixed(4)}` : "—"}
          </span>
          <span className="pricing__src">{cost ? `${cost.requests} reqs` : "no calls"}</span>
        </div>
      </div>
      <div className="banner banner--warn">
        Pricing snapshots may lag vendor changes. The runtime does not block API calls based on this
        snapshot — it bills per the vendor invoice.
      </div>
    </section>
  );
}

/* ── Usage tab ──────────────────────────────────────────────────── */
function TabUsage({ model, cost }) {
  const provider = window.MOCK.usage.providers.find((p) => p.provider === model.provider);
  const auth = window.MOCK.authProviders.find((a) => a.provider === model.provider);
  return (
    <>
      <section className="section">
        <header className="section__head">
          <h2 className="section__title">Provider quota windows</h2>
          <p className="section__hint">From `deck.auth.overview.usage.windows`.</p>
        </header>
        {!auth?.usage?.windows?.length ? (
          <div className="empty">
            <strong>No quota windows reported</strong>Provider does not expose usage windows.
          </div>
        ) : (
          <div className="tile-row">
            {auth.usage.windows.map((w, i) => (
              <div key={i} className="quota">
                <div className="quota__head">
                  <strong>{w.label}</strong>
                  <span>{w.usedPercent}%</span>
                </div>
                <div className="quota__bar">
                  <div
                    className="quota__fill"
                    data-level={w.usedPercent > 80 ? "err" : w.usedPercent > 60 ? "warn" : ""}
                    style={{ width: `${w.usedPercent}%` }}
                  />
                </div>
                <span className="quota__hint">
                  resets in {w.resetsInMs ? Math.round(w.resetsInMs / 60000) + "m" : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <header className="section__head">
          <h2 className="section__title">This model · 24h</h2>
          <p className="section__hint">Slice from `GET /models/usage/cost`.</p>
        </header>
        {!cost ? (
          <div className="empty">No usage in last 24h.</div>
        ) : (
          <div className="tile-row">
            <div className="tile">
              <span className="tile__label">Spend</span>
              <span className="tile__value">${(cost.in + cost.out).toFixed(2)}</span>
              <span className="tile__delta">{cost.requests} reqs</span>
            </div>
            <div className="tile">
              <span className="tile__label">Input cost</span>
              <span className="tile__value">${cost.in.toFixed(2)}</span>
              <span className="tile__delta">prompt + cached</span>
            </div>
            <div className="tile">
              <span className="tile__label">Output cost</span>
              <span className="tile__value">${cost.out.toFixed(2)}</span>
              <span className="tile__delta">streamed</span>
            </div>
            <div className="tile">
              <span className="tile__label">Avg cost / req</span>
              <span className="tile__value">
                ${(cost.requests > 0 ? (cost.in + cost.out) / cost.requests : 0).toFixed(4)}
              </span>
              <span className="tile__delta">blended</span>
            </div>
          </div>
        )}
      </section>

      {provider && (
        <section className="section">
          <header className="section__head">
            <h2 className="section__title">Provider health</h2>
            <p className="section__hint">From `GET /models/usage/providers`.</p>
          </header>
          <div className="tile-row">
            <div className="tile">
              <span className="tile__label">Quota usage</span>
              <span className="tile__value">{provider.quotaPercent}%</span>
              <span className="tile__delta">{provider.status}</span>
            </div>
            <div className="tile">
              <span className="tile__label">RPM</span>
              <span className="tile__value">{provider.requestsPerMin}</span>
              <span className="tile__delta">requests / min</span>
            </div>
            <div className="tile">
              <span className="tile__label">Error rate</span>
              <span className="tile__value">{provider.errorRatePercent}%</span>
              <span className="tile__delta">last 1h</span>
            </div>
            <div className="tile">
              <span className="tile__label">Auth source</span>
              <span className="tile__value" style={{ fontSize: 13 }}>
                {auth?.source || "—"}
              </span>
              <span className="tile__delta">{auth?.scope || "—"} scope</span>
            </div>
          </div>
        </section>
      )}
    </>
  );
}

/* ── Auth tab ───────────────────────────────────────────────────── */
function TabAuth({ provider, auth, onConfigClick }) {
  if (!auth)
    return (
      <div className="empty">
        <strong>No auth for {provider}</strong>Provider missing in `deck.auth.overview` response.
      </div>
    );
  return (
    <>
      <section className="section">
        <header className="section__head">
          <h2 className="section__title">Auth state · {authProviderDisplay(provider)}</h2>
          <button className="btn btn--primary btn--sm" onClick={onConfigClick}>
            <IconKey /> Configure
          </button>
        </header>
        <div className="auth-list">
          <div className="auth-row">
            <ProviderGlyph id={provider} size={28} />
            <div className="auth-row__main">
              <span className="auth-row__name">
                {auth.auth?.type || (auth.authPresent ? "auth present" : "no auth")}
              </span>
              <span className="auth-row__src col-source">
                {auth.auth?.source || auth.source || "—"}
              </span>
            </div>
            <span className="pill pill--muted">{auth.scope || "—"}</span>
            <span className="pill">{auth.editable ? "editable" : "read-only"}</span>
            <ProviderStatusPill status={auth.status} />
          </div>
        </div>
      </section>

      {auth.cooldown && (
        <section className="section">
          <header className="section__head">
            <h2 className="section__title">Cooldown</h2>
          </header>
          <div className="banner banner--warn">
            Reason: <strong>{auth.cooldown.reason}</strong> · resets in{" "}
            <strong>{Math.round((auth.cooldown.remainingMs || 0) / 60000)}m</strong> (
            {auth.cooldown.until ? new Date(auth.cooldown.until).toLocaleTimeString() : "—"}).
          </div>
        </section>
      )}

      {auth.oauth && (
        <section className="section">
          <header className="section__head">
            <h2 className="section__title">OAuth</h2>
          </header>
          <div className="tile-row">
            <div className="tile">
              <span className="tile__label">Status</span>
              <span className="tile__value">{auth.oauth.status}</span>
            </div>
            <div className="tile">
              <span className="tile__label">Expires</span>
              <span className="tile__value">
                {auth.oauth.expiresAt ? new Date(auth.oauth.expiresAt).toLocaleString() : "—"}
              </span>
            </div>
            <div className="tile">
              <span className="tile__label">Remaining</span>
              <span className="tile__value">
                {auth.oauth.remainingMs
                  ? Math.round(auth.oauth.remainingMs / 3_600_000) + "h"
                  : "—"}
              </span>
            </div>
            <div className="tile">
              <span className="tile__label">Profile</span>
              <span className="tile__value" style={{ fontSize: 13 }}>
                {auth.auth?.profileId || "default"}
              </span>
            </div>
          </div>
        </section>
      )}
    </>
  );
}

/* ── Audit tab ──────────────────────────────────────────────────── */
function TabAudit({ model }) {
  const items = window.MOCK.audit.filter((a) => a.model === model.id);
  return (
    <section className="section">
      <header className="section__head">
        <h2 className="section__title">Audit log</h2>
        <p className="section__hint">BFF projection over `PATCH /models/config` history.</p>
      </header>
      {items.length === 0 ? (
        <div className="empty">No recorded changes for this model.</div>
      ) : (
        <div className="audit-list">
          {items.map((a, i) => (
            <div key={i} className="audit-row">
              <span className="audit-row__ts">{new Date(a.ts).toLocaleString()}</span>
              <span className="audit-row__msg">
                <strong>{a.action}</strong>
                {a.before && (
                  <>
                    {" "}
                    · before <code>{a.before}</code>
                  </>
                )}
                {a.after && (
                  <>
                    {" "}
                    · after <code>{a.after}</code>
                  </>
                )}
                {a.note && <> · {a.note}</>}
                {a.chain && <> · chain {a.chain.join(" → ")}</>}
              </span>
              <span className="audit-row__actor">{a.actor}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

Object.assign(window, { DetailView, MODEL_TABS });
