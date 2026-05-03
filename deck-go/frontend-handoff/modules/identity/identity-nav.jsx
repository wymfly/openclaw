/* global React, IconSearch, IconPlus, IconUsers */
const IdentityNav = ({
  canonicals,
  selectedId,
  onSelect,
  query,
  onQueryChange,
  onCreate,
  fetchedAt,
  configHash,
  onRefresh,
}) => {
  const filtered = canonicals.filter((c) => {
    if (!query) return true;
    const q = query.toLowerCase();
    if (c.canonical.toLowerCase().includes(q)) return true;
    if (c.description && c.description.toLowerCase().includes(q)) return true;
    return c.peers.some(
      (p) =>
        p.peerId.toLowerCase().includes(q) ||
        (p.displayName && p.displayName.toLowerCase().includes(q)) ||
        p.channel.toLowerCase().includes(q),
    );
  });

  const ageMins = fetchedAt ? Math.max(0, Math.round((Date.now() - fetchedAt) / 60000)) : 0;
  return (
    <aside className="identity-nav" aria-label="Canonical identities">
      <div className="identity-nav__head">
        <div className="identity-nav__title">
          <IconUsers size={14} />
          <span>Canonicals</span>
          <span className="identity-nav__count">{canonicals.length}</span>
        </div>
        <button
          type="button"
          className="ds-btn ds-btn--ghost ds-btn--sm"
          onClick={onCreate}
          title="Create canonical"
        >
          <IconPlus size={12} /> New
        </button>
      </div>

      <div className="identity-nav__search">
        <IconSearch size={12} />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search canonical or peer…"
          aria-label="Search canonicals"
        />
      </div>

      <div className="identity-nav__list" role="tablist" aria-label="Canonicals">
        {filtered.length === 0 ? (
          <div className="identity-nav__empty">No canonicals match.</div>
        ) : (
          filtered.map((c) => {
            const peerCount = c.peers.length;
            const channelSet = Array.from(new Set(c.peers.map((p) => p.channel)));
            const tone = peerCount === 0 ? "warn" : peerCount >= 3 ? "accent" : "iron";
            const isOn = c.canonical === selectedId;
            return (
              <button
                key={c.canonical}
                type="button"
                role="tab"
                aria-selected={isOn}
                className={`identity-nav__item ${isOn ? "identity-nav__item--on" : ""}`}
                onClick={() => onSelect(c.canonical)}
              >
                <div className="identity-nav__item-head">
                  <strong>{c.canonical}</strong>
                  <span className={`identity-nav__peer-count identity-nav__peer-count--${tone}`}>
                    {peerCount} {peerCount === 1 ? "peer" : "peers"}
                  </span>
                </div>
                {c.description ? <p className="identity-nav__hint">{c.description}</p> : null}
                {channelSet.length > 0 ? (
                  <div className="identity-nav__channels">
                    {channelSet.map((ch) => (
                      <span
                        key={ch}
                        className={`identity-nav__channel-chip identity-nav__channel-chip--${ch}`}
                      >
                        {ch}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="identity-nav__hint identity-nav__hint--warn">
                    No peers — guarded slot.
                  </p>
                )}
              </button>
            );
          })
        )}
      </div>

      <div className="identity-nav__foot">
        <div className="identity-nav__hash">
          <span className="identity-nav__hash-label">Hash</span>
          <code>{configHash || "—"}</code>
        </div>
        <div className="identity-nav__refresh">
          <span>{ageMins}m ago</span>
          <button type="button" className="ds-btn ds-btn--ghost ds-btn--xs" onClick={onRefresh}>
            Refresh
          </button>
        </div>
      </div>
    </aside>
  );
};

Object.assign(window, { IdentityNav });
