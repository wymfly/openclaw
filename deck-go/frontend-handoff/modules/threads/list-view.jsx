/* deck-go threads prototype v2 — list view */

function relativeTime(ts, now) {
  const diff = now - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3600_000)}h ago`;
  const days = Math.round(diff / 86_400_000);
  return `${days}d ago`;
}

function formatAbsolute(ts) {
  return new Date(ts).toISOString().replace("T", " ").replace(/\..+$/, "Z");
}

function ThreadsListView({
  threads,
  query,
  onQueryChange,
  channelKindFilter,
  onChannelKindChange,
  targetKindFilter,
  onTargetKindChange,
  staleFilter,
  onStaleChange,
  onSelect,
  channelKinds,
  targetKinds,
  channelKindFromId,
  now,
  onRefresh,
}) {
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return threads.filter((t) => {
      if (channelKindFilter !== "__all__" && channelKindFromId(t.channelId) !== channelKindFilter)
        return false;
      if (targetKindFilter !== "__all__" && t.targetKind !== targetKindFilter) return false;
      if (staleFilter === "active" && now - t.lastActivityAt > 24 * 3600_000) return false;
      if (staleFilter === "stale" && now - t.lastActivityAt <= 24 * 3600_000) return false;
      if (q) {
        const hay =
          `${t.threadId} ${t.channelId} ${t.agentId} ${t.targetSessionKey} ${t.label ?? ""} ${t.accountId} ${t.boundBy}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [threads, query, channelKindFilter, targetKindFilter, staleFilter, channelKindFromId, now]);

  const kpis = React.useMemo(() => {
    const total = threads.length;
    const active = threads.filter((t) => now - t.lastActivityAt <= 24 * 3600_000).length;
    const channels = new Set(threads.map((t) => channelKindFromId(t.channelId))).size;
    const agents = new Set(threads.map((t) => t.agentId)).size;
    const auto = threads.filter((t) => t.boundBy === "auto-binding").length;
    return { total, active, channels, agents, auto };
  }, [threads, channelKindFromId, now]);

  return (
    <section className="list-view" aria-label="Threads list">
      <header className="list-view__metrics">
        <article className="metric">
          <span>Bindings</span>
          <strong>{kpis.total}</strong>
          <small>total</small>
        </article>
        <article className="metric metric--accent">
          <span>Active 24h</span>
          <strong>{kpis.active}</strong>
          <small>recent activity</small>
        </article>
        <article className="metric">
          <span>Channels</span>
          <strong>{kpis.channels}</strong>
          <small>kinds</small>
        </article>
        <article className="metric">
          <span>Agents</span>
          <strong>{kpis.agents}</strong>
          <small>distinct</small>
        </article>
        <article className="metric">
          <span>Auto-bound</span>
          <strong>{kpis.auto}</strong>
          <small>system-bound</small>
        </article>
        <article className="metric">
          <span>Visible</span>
          <strong>{filtered.length}</strong>
          <small>after filters</small>
        </article>
      </header>

      <div className="list-view__toolbar">
        <label className="search">
          <span className="search__icon">
            <IconSearch size={13} />
          </span>
          <input
            className="search__input"
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search thread / channel / agent / session / label / account"
            aria-label="Search threads"
          />
        </label>

        <div className="seg" role="tablist" aria-label="Channel kind">
          <button
            type="button"
            role="tab"
            aria-selected={channelKindFilter === "__all__"}
            className={`seg__btn${channelKindFilter === "__all__" ? " seg__btn--on" : ""}`}
            onClick={() => onChannelKindChange("__all__")}
          >
            all
          </button>
          {channelKinds.map((k) => {
            const meta = CHANNEL_META[k];
            const Glyph = meta.glyph;
            return (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={channelKindFilter === k}
                className={`seg__btn seg__btn--icon${channelKindFilter === k ? " seg__btn--on" : ""}`}
                onClick={() => onChannelKindChange(k)}
                title={meta.label}
              >
                <Glyph size={12} />
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>

        <div className="seg" role="tablist" aria-label="Target kind">
          <button
            type="button"
            role="tab"
            aria-selected={targetKindFilter === "__all__"}
            className={`seg__btn${targetKindFilter === "__all__" ? " seg__btn--on" : ""}`}
            onClick={() => onTargetKindChange("__all__")}
          >
            any target
          </button>
          {targetKinds.map((k) => {
            const meta = TARGET_KIND_META[k];
            return (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={targetKindFilter === k}
                className={`seg__btn${targetKindFilter === k ? " seg__btn--on" : ""}`}
                onClick={() => onTargetKindChange(k)}
              >
                {meta.label}
              </button>
            );
          })}
        </div>

        <div className="seg" role="tablist" aria-label="Activity recency">
          <button
            type="button"
            role="tab"
            aria-selected={staleFilter === "all"}
            className={`seg__btn${staleFilter === "all" ? " seg__btn--on" : ""}`}
            onClick={() => onStaleChange("all")}
          >
            all
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={staleFilter === "active"}
            className={`seg__btn${staleFilter === "active" ? " seg__btn--on" : ""}`}
            onClick={() => onStaleChange("active")}
          >
            active 24h
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={staleFilter === "stale"}
            className={`seg__btn${staleFilter === "stale" ? " seg__btn--on" : ""}`}
            onClick={() => onStaleChange("stale")}
          >
            stale
          </button>
        </div>

        <button
          type="button"
          className="action-btn"
          onClick={onRefresh}
          aria-label="Refresh threads"
        >
          <IconRefresh size={12} />
          <span>Refresh</span>
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="list-view__empty">
          <div className="list-view__empty-glyph">
            <IconChat size={28} />
          </div>
          <h3>No bindings match these filters.</h3>
          <p>Loosen the channel / target / recency filters or clear the search.</p>
        </div>
      ) : (
        <ul className="thread-list" role="list">
          <li className="thread-row thread-row--header" aria-hidden="true">
            <span className="thread-row__col thread-row__col--channel">Channel</span>
            <span className="thread-row__col thread-row__col--agent">Agent · session</span>
            <span className="thread-row__col thread-row__col--target">Target</span>
            <span className="thread-row__col thread-row__col--account">Account · bound by</span>
            <span className="thread-row__col thread-row__col--last">Last activity</span>
            <span className="thread-row__col thread-row__col--bound">Bound</span>
          </li>
          {filtered.map((t) => {
            const channelKind = channelKindFromId(t.channelId);
            const isStale = now - t.lastActivityAt > 24 * 3600_000;
            return (
              <li
                key={t.threadId}
                role="button"
                tabIndex={0}
                className={`thread-row${isStale ? " thread-row--stale" : ""}`}
                onClick={() => onSelect(t.threadId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(t.threadId);
                  }
                }}
              >
                <span className="thread-row__col thread-row__col--channel">
                  <ChannelTile channelKind={channelKind} channelId={t.channelId} />
                </span>
                <span className="thread-row__col thread-row__col--agent">
                  <span className="thread-row__agent">{t.agentId}</span>
                  <span className="thread-row__session" title={t.targetSessionKey}>
                    {t.targetSessionKey}
                  </span>
                  {t.label && (
                    <span className="thread-row__label" title={t.label}>
                      {t.label}
                    </span>
                  )}
                </span>
                <span className="thread-row__col thread-row__col--target">
                  <TargetKindPill kind={t.targetKind} />
                </span>
                <span className="thread-row__col thread-row__col--account">
                  <span className="thread-row__account">
                    <IconUser size={11} /> {t.accountId}
                  </span>
                  <span className="thread-row__bound-by">{t.boundBy}</span>
                </span>
                <span className="thread-row__col thread-row__col--last">
                  <span className={`thread-row__last${isStale ? " thread-row__last--stale" : ""}`}>
                    {relativeTime(t.lastActivityAt, now)}
                  </span>
                  <span className="thread-row__abs">{formatAbsolute(t.lastActivityAt)}</span>
                </span>
                <span className="thread-row__col thread-row__col--bound">
                  <span className="thread-row__bound">{relativeTime(t.boundAt, now)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

Object.assign(window, { ThreadsListView, relativeTime, formatAbsolute });
