/* deck-go logs prototype v2 — filter bar (level / source / correlation / free-text) */

function FilterBar({
  query,
  onQueryChange,
  levels,
  enabledLevels,
  onToggleLevel,
  sources,
  source,
  onSourceChange,
  sessions,
  session,
  onSessionChange,
  correlationId,
  onCorrelationChange,
  onClearAll,
}) {
  return (
    <section className="filter-bar" aria-label="Log filters">
      <div className="filter-bar__row filter-bar__row--text">
        <label className="filter-bar__field filter-bar__field--search">
          <span className="filter-bar__label">Free text</span>
          <span className="filter-bar__input-wrap">
            <span className="filter-bar__icon">
              <IconSearch size={13} />
            </span>
            <input
              className="filter-bar__input"
              type="search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="ts | message | session | field"
              aria-label="Free text filter"
            />
          </span>
        </label>

        <label className="filter-bar__field filter-bar__field--cid">
          <span className="filter-bar__label">Correlation id</span>
          <span className="filter-bar__input-wrap">
            <span className="filter-bar__icon">
              <IconLink size={13} />
            </span>
            <input
              className="filter-bar__input"
              type="text"
              value={correlationId}
              onChange={(e) => onCorrelationChange(e.target.value)}
              placeholder="trace-... (exact)"
              aria-label="Correlation id filter"
            />
          </span>
        </label>

        <button
          type="button"
          className="filter-bar__clear"
          onClick={onClearAll}
          aria-label="Clear all filters"
        >
          <IconClose size={12} />
          <span>Clear all</span>
        </button>
      </div>

      <div className="filter-bar__row filter-bar__row--seg">
        <fieldset className="filter-bar__levels" aria-label="Log levels">
          <legend className="filter-bar__label">Levels</legend>
          <span className="level-toggle-row">
            {levels.map((level) => {
              const meta = LEVEL_META[level];
              const Icon = meta.Icon;
              const checked = enabledLevels.has(level);
              return (
                <label
                  key={level}
                  className={`level-toggle ${meta.badge}${checked ? " level-toggle--on" : ""}`}
                >
                  <input type="checkbox" checked={checked} onChange={() => onToggleLevel(level)} />
                  <Icon size={12} />
                  <span>{meta.label}</span>
                </label>
              );
            })}
          </span>
        </fieldset>

        <label className="filter-bar__field filter-bar__field--select">
          <span className="filter-bar__label">Source</span>
          <select
            className="filter-bar__select"
            value={source}
            onChange={(e) => onSourceChange(e.target.value)}
          >
            <option value="__all__">all sources</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-bar__field filter-bar__field--select">
          <span className="filter-bar__label">Session</span>
          <select
            className="filter-bar__select"
            value={session}
            onChange={(e) => onSessionChange(e.target.value)}
          >
            <option value="__all__">all sessions</option>
            {sessions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

Object.assign(window, { FilterBar });
