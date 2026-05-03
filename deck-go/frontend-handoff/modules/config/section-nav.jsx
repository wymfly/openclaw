// section-nav.jsx — Left rail listing the top-level config sections.

const { useMemo } = React;

function SectionNav({ sections, activeSection, onSelect, dirtyPaths, query, onQueryChange }) {
  const dirtyBySection = useMemo(() => {
    const map = {};
    for (const path of dirtyPaths) {
      const top = path.split(".")[0];
      map[top] = (map[top] || 0) + 1;
    }
    return map;
  }, [dirtyPaths]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.path.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q),
    );
  }, [sections, query]);

  return (
    <aside className="section-nav" aria-label="Configuration sections">
      <div className="section-nav__head">
        <p className="section-nav__eyebrow">openclaw.json</p>
        <h2 className="section-nav__title">Sections</h2>
        <p className="section-nav__hint">{sections.length} top-level keys.</p>
      </div>
      <div className="section-nav__search">
        <window.IconSearch size={13} />
        <input
          type="search"
          placeholder="Filter sections…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label="Filter config sections"
        />
      </div>
      <ul className="section-nav__list" role="tablist">
        {filtered.map((s) => {
          const dirty = dirtyBySection[s.id] || 0;
          const active = activeSection === s.id;
          return (
            <li key={s.id}>
              <button
                type="button"
                className={`section-nav__item${active ? " section-nav__item--on" : ""}`}
                role="tab"
                aria-selected={active}
                onClick={() => onSelect(s.id)}
              >
                <span className="section-nav__icon">
                  <window.SectionIcon section={s.id} />
                </span>
                <span className="section-nav__body">
                  <span className="section-nav__label">{s.label}</span>
                  <span className="section-nav__path">{s.path}</span>
                </span>
                {dirty > 0 ? (
                  <span className="section-nav__dirty" aria-label={`${dirty} unsaved changes`}>
                    {dirty}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
        {filtered.length === 0 ? <li className="section-nav__empty">No sections match.</li> : null}
      </ul>
    </aside>
  );
}

Object.assign(window, { SectionNav });
