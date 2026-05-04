// DocsTree — left pane: collapsible categories (DeckGoDocCategory enum:
// summary | plan | spec | manual | draft) → docs. Selected leaf highlighted.

const DocsTree = ({ categories, docs, selectedId, onSelect, keywordFilter }) => {
  const [collapsed, setCollapsed] = React.useState(() => new Set());

  const toggle = (id) => {
    setCollapsed((curr) => {
      const next = new Set(curr);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredDocs = React.useMemo(() => {
    if (!keywordFilter) return docs;
    return docs.filter((d) => d.keywords.includes(keywordFilter));
  }, [docs, keywordFilter]);

  const docsByCategory = React.useMemo(() => {
    const map = new Map();
    for (const d of filteredDocs) {
      if (!map.has(d.category)) map.set(d.category, []);
      map.get(d.category).push(d);
    }
    return map;
  }, [filteredDocs]);

  return (
    <div className="docs-tree">
      <div className="docs-tree__head">
        <h3 className="docs-tree__title">
          <IconBook />
          Documents
        </h3>
        <span className="docs-tree__count">
          {filteredDocs.length} / {docs.length}
        </span>
      </div>
      {keywordFilter && (
        <div className="docs-tree__active-filter">
          <span className="muted small">Keyword filter:</span>
          <code className="docs-tree__tag-chip">{keywordFilter}</code>
        </div>
      )}
      <div className="docs-tree__body" role="tree">
        {categories.map((cat) => {
          const docsInCat = docsByCategory.get(cat.id) || [];
          if (docsInCat.length === 0) return null;
          const open = !collapsed.has(cat.id) || keywordFilter;
          return (
            <div key={cat.id} className="docs-tree__cat" role="treeitem" aria-expanded={open}>
              <button className="docs-tree__cat-head" onClick={() => toggle(cat.id)}>
                {open ? <IconChevronD /> : <IconChevronR />}
                <span className="docs-tree__cat-name">{cat.label}</span>
                <span className="docs-tree__cat-count">{docsInCat.length}</span>
              </button>
              {open && <div className="docs-tree__cat-desc muted small">{cat.description}</div>}
              {open && (
                <ul className="docs-tree__leaves" role="group">
                  {docsInCat.map((d) => (
                    <li key={d.id} role="none">
                      <button
                        role="treeitem"
                        aria-selected={selectedId === d.id}
                        className={`docs-tree__leaf ${selectedId === d.id ? "docs-tree__leaf--on" : ""}`}
                        onClick={() => onSelect(d.id)}
                      >
                        <span className="docs-tree__leaf-title">{d.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

Object.assign(window, { DocsTree });
