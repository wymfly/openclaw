// models — List view, provider-grouped.

const { useMemo: _lvMemo } = React;

function ListView({
  models,
  listState,
  searchQuery,
  filter,
  onSearch,
  onFilter,
  onSelect,
  onCatalogClick,
}) {
  const totals = _lvMemo(() => {
    const providers = new Set(models.map((m) => m.provider));
    const defaults = models.filter((m) => m.isDefault).length;
    const fallbacks = models.filter((m) => m.fallback).length;
    const local = models.filter((m) => m.local).length;
    const reasoning = models.filter((m) => m.reasoning).length;
    return {
      total: models.length,
      providers: providers.size,
      defaults,
      fallbacks,
      local,
      reasoning,
    };
  }, [models]);

  const filtered = _lvMemo(() => {
    const q = (searchQuery || "").trim().toLowerCase();
    return models.filter((m) => {
      if (filter === "default" && !m.isDefault) return false;
      if (filter === "fallback" && !m.fallback) return false;
      if (filter === "local" && !m.local) return false;
      if (filter === "reasoning" && !m.reasoning) return false;
      if (q) {
        const hit =
          m.id.toLowerCase().includes(q) ||
          m.displayName.toLowerCase().includes(q) ||
          m.provider.toLowerCase().includes(q) ||
          (m.family || "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [models, searchQuery, filter]);

  // Group by provider, preserving runtime order
  const grouped = _lvMemo(() => {
    const out = [];
    const seen = new Set();
    for (const m of filtered) {
      if (!seen.has(m.provider)) {
        seen.add(m.provider);
        out.push({ provider: m.provider, models: [] });
      }
      out[out.findIndex((g) => g.provider === m.provider)].models.push(m);
    }
    return out;
  }, [filtered]);

  const onRowKey = (e, id) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(id);
    }
  };

  const fmtCtx = (n) => (n >= 1000 ? `${(n / 1000).toFixed(0)}k` : `${n}`);
  const cost = window.MOCK.usage.cost;

  return (
    <main className="view">
      <header className="list-view__head">
        <div>
          <h1 className="list-view__title">Models</h1>
          <p className="list-view__subtitle">
            Inspect runtime-configured models, provider auth state, fallback chains, and usage
            pressure.
          </p>
        </div>
        <div className="list-view__actions">
          <button className="btn btn--ghost" type="button">
            <IconRefresh /> Refresh
          </button>
          <button className="btn btn--primary" type="button" onClick={onCatalogClick}>
            <IconPlus /> Add from catalog
            <span className="kbd">⌘N</span>
          </button>
        </div>
      </header>

      <div className="kpi-strip" role="group" aria-label="Models KPIs">
        <div className="kpi">
          <span className="kpi__label">Models</span>
          <span className="kpi__value">{totals.total}</span>
          <span className="kpi__hint">
            {totals.providers} provider{totals.providers > 1 ? "s" : ""}
          </span>
        </div>
        <div className="kpi">
          <span className="kpi__label">Defaults</span>
          <span className="kpi__value">{totals.defaults}</span>
          <span className="kpi__hint">one per provider</span>
        </div>
        <div className="kpi">
          <span className="kpi__label">Fallback</span>
          <span className="kpi__value">{totals.fallbacks}</span>
          <span className="kpi__hint">in active chains</span>
        </div>
        <div className="kpi">
          <span className="kpi__label">Local</span>
          <span className="kpi__value">{totals.local}</span>
          <span className="kpi__hint">via Ollama</span>
        </div>
        <div className="kpi">
          <span className="kpi__label">Spend (24h)</span>
          <span className="kpi__value">${(cost.totals.in + cost.totals.out).toFixed(2)}</span>
          <span className="kpi__hint">{cost.currency} · in + out</span>
        </div>
      </div>

      <div className="toolbar">
        <label className="toolbar__search">
          <IconSearch />
          <input
            placeholder="Search by id, family, provider…"
            value={searchQuery || ""}
            onChange={(e) => onSearch(e.target.value)}
          />
          <span className="kbd">⌘K</span>
        </label>
        <div className="toolbar__filter" role="tablist" aria-label="Filter">
          {[
            { id: "all", label: "All" },
            { id: "default", label: "Defaults" },
            { id: "fallback", label: "Fallback" },
            { id: "reasoning", label: "Reasoning" },
            { id: "local", label: "Local" },
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

      {listState === "loading" && (
        <div className="empty">
          <span className="spinner" /> Loading models…
        </div>
      )}
      {listState === "error" && (
        <div className="empty">
          <strong>Failed to load model registry</strong>
          GET /models/config returned an error. <button className="btn btn--sm">Retry</button>
        </div>
      )}
      {listState === "empty" && (
        <div className="empty">
          <IconEmpty />
          <strong>No models configured</strong>
          Pick from the provider catalog to make models available to the runtime.
          <button className="btn btn--primary" onClick={onCatalogClick}>
            <IconPlus /> Add from catalog
          </button>
        </div>
      )}

      {listState === "ready" &&
        (filtered.length === 0 ? (
          <div className="empty">
            <strong>No models match this filter</strong>
            Adjust the search or filter to see more results.
          </div>
        ) : (
          <>
            <div className="row__head" role="row">
              <div></div>
              <div className="col-name">Model</div>
              <div className="col-context">Context</div>
              <div className="col-tokens">Max out</div>
              <div className="col-probe">Probe</div>
              <div>Spend</div>
              <div>Status</div>
            </div>

            {grouped.map((g) => {
              const auth = window.MOCK.authProviders.find((a) => a.provider === g.provider);
              return (
                <section className="provider-section" key={g.provider}>
                  <header className="provider-section__head">
                    <ProviderGlyph id={g.provider} size={20} />
                    <span className="provider-section__title">
                      {authProviderDisplay(g.provider)}
                    </span>
                    {auth ? (
                      <ProviderStatusPill status={auth.status} />
                    ) : (
                      <span className="pill pill--muted">unknown</span>
                    )}
                    <span className="pill pill--muted">
                      {g.models.length} model{g.models.length > 1 ? "s" : ""}
                    </span>
                  </header>
                  {g.models.map((m) => {
                    const probe = window.MOCK.probe[m.id];
                    const perModel = window.MOCK.usage.cost.perModel[m.id];
                    return (
                      <div
                        key={m.id}
                        role="button"
                        tabIndex={0}
                        className={"row " + (m.isDefault ? "is-default" : "")}
                        onClick={() => onSelect(m.id)}
                        onKeyDown={(e) => onRowKey(e, m.id)}
                      >
                        <ProviderGlyph id={m.provider} size={28} />
                        <div className="row__id">
                          <span className="row__id-name">
                            {m.displayName}
                            {m.isDefault && (
                              <span className="pill pill--info">
                                <IconStar />
                                default
                              </span>
                            )}
                            {m.fallback && <span className="pill pill--muted">fallback</span>}
                            {m.reasoning && (
                              <span className="pill pill--info">
                                <IconBrain />
                                reasoning
                              </span>
                            )}
                          </span>
                          <span className="row__id-meta">
                            {m.id}
                            {m.family ? ` · ${m.family}` : ""}
                          </span>
                        </div>
                        <div className="row__num col-context">
                          {fmtCtx(m.contextWindow)}
                          <small>tokens</small>
                        </div>
                        <div className="row__num col-tokens">
                          {fmtCtx(m.maxTokens)}
                          <small>tokens</small>
                        </div>
                        <div>
                          {probe?.status === "ok" ? (
                            <span className="pill pill--ok">
                              <span className="pill__dot" />
                              {probe.latencyMs}ms
                            </span>
                          ) : probe?.status === "cooldown" ? (
                            <span className="pill pill--warn">
                              <span className="pill__dot" />
                              cooldown
                            </span>
                          ) : probe?.status === "unknown" ? (
                            <span className="pill pill--muted">—</span>
                          ) : (
                            <span className="pill pill--err">
                              <span className="pill__dot" />
                              error
                            </span>
                          )}
                        </div>
                        <div className="row__num">
                          {perModel ? `$${(perModel.in + perModel.out).toFixed(2)}` : "—"}
                        </div>
                        <div>
                          {m.isDefault ? (
                            <span className="pill pill--ok">
                              <span className="pill__dot" />
                              active
                            </span>
                          ) : m.fallback ? (
                            <span className="pill pill--info">
                              <span className="pill__dot" />
                              ready
                            </span>
                          ) : m.lastUsedMs ? (
                            <span className="pill pill--muted">
                              <span className="pill__dot" />
                              idle
                            </span>
                          ) : (
                            <span className="pill pill--muted">
                              <span className="pill__dot" />
                              unused
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </section>
              );
            })}
          </>
        ))}

      <footer className="view__footer">
        <div className="view__footer-row">
          <span>
            {filtered.length} of {models.length} models
          </span>
          <span>
            <IconActivity /> hash <strong>{window.MOCK.modelsConfig.hash}</strong>
          </span>
        </div>
        <div className="view__footer-row">
          <span>
            <span className="kbd">↵</span> open
          </span>
          <span>
            <span className="kbd">⌘N</span> add
          </span>
          <span>
            <span className="kbd">⌘K</span> search
          </span>
        </div>
      </footer>
    </main>
  );
}

function authProviderDisplay(provider) {
  const map = {
    anthropic: "Anthropic",
    openai: "OpenAI",
    google: "Google AI",
    ollama: "Ollama (local)",
    openrouter: "OpenRouter",
  };
  return map[provider] || provider;
}

function ProviderStatusPill({ status }) {
  const map = {
    ready: { cls: "pill pill--ok", text: "ready" },
    cooldown: { cls: "pill pill--warn", text: "cooldown" },
    missing: { cls: "pill pill--err", text: "missing key" },
    error: { cls: "pill pill--err", text: "error" },
  };
  const it = map[status] || { cls: "pill pill--muted", text: status || "unknown" };
  return (
    <span className={it.cls}>
      <span className="pill__dot" />
      {it.text}
    </span>
  );
}

Object.assign(window, { ListView, authProviderDisplay, ProviderStatusPill });
