// settings-nav.jsx — Left rail listing settings sections.

const { useMemo } = React;

function SettingsNav({ sections, activeSection, onSelect, dirtyBySection, query, onQueryChange }) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter(
      (s) => s.label.toLowerCase().includes(q) || s.description.toLowerCase().includes(q),
    );
  }, [sections, query]);

  return (
    <aside className="settings-nav" aria-label="Settings sections">
      <div className="settings-nav__head">
        <p className="settings-nav__eyebrow">deck-go-settings.json</p>
        <h2 className="settings-nav__title">Settings</h2>
      </div>
      <div className="settings-nav__search">
        <window.IconSearch size={13} />
        <input
          type="search"
          placeholder="Search settings…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label="Filter settings sections"
        />
      </div>
      <ul className="settings-nav__list" role="tablist">
        {filtered.map((s) => {
          const dirty = dirtyBySection[s.id] || 0;
          const active = activeSection === s.id;
          return (
            <li key={s.id}>
              <button
                type="button"
                className={`settings-nav__item${active ? " settings-nav__item--on" : ""}`}
                role="tab"
                aria-selected={active}
                onClick={() => onSelect(s.id)}
              >
                <span className="settings-nav__icon">
                  <window.SectionIcon icon={s.icon} />
                </span>
                <span className="settings-nav__body">
                  <span className="settings-nav__label">{s.label}</span>
                  <span className="settings-nav__hint">{s.description}</span>
                </span>
                {dirty > 0 ? (
                  <span className="settings-nav__dirty" aria-label={`${dirty} unsaved`}>
                    {dirty}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
        {filtered.length === 0 ? <li className="settings-nav__empty">No sections match.</li> : null}
      </ul>
    </aside>
  );
}

Object.assign(window, { SettingsNav });
