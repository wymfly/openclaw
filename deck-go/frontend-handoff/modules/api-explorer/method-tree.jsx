// MethodTree — left pane: searchable, collapsible tree of namespaces →
// methods. Each leaf shows kind badge + scope badge. Selected method is
// highlighted; clicking selects.

const MethodTree = ({ catalog, selected, onSelect, query, onQuery }) => {
  const [collapsed, setCollapsed] = React.useState(() => new Set());

  const toggleNs = (ns) => {
    setCollapsed((curr) => {
      const next = new Set(curr);
      if (next.has(ns)) next.delete(ns);
      else next.add(ns);
      return next;
    });
  };

  const filtered = React.useMemo(() => {
    if (!query) return catalog;
    const q = query.toLowerCase();
    return catalog
      .map((ns) => ({
        ...ns,
        methods: ns.methods.filter(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            m.description.toLowerCase().includes(q) ||
            ns.namespace.toLowerCase().includes(q),
        ),
      }))
      .filter((ns) => ns.methods.length > 0);
  }, [catalog, query]);

  const totalMethods = catalog.reduce((sum, ns) => sum + ns.methods.length, 0);
  const visibleMethods = filtered.reduce((sum, ns) => sum + ns.methods.length, 0);

  return (
    <div className="method-tree">
      <div className="method-tree__head">
        <h3 className="method-tree__title">Methods</h3>
        <span className="method-tree__count">
          {visibleMethods === totalMethods
            ? `${totalMethods}`
            : `${visibleMethods} / ${totalMethods}`}
        </span>
      </div>
      <label className="search-input">
        <IconSearch />
        <input
          type="text"
          placeholder="Search methods…"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
      </label>

      <div className="method-tree__body" role="tree">
        {filtered.length === 0 ? (
          <div className="method-tree__empty">No methods match.</div>
        ) : (
          filtered.map((ns) => {
            const open = !collapsed.has(ns.namespace) || query;
            return (
              <div
                key={ns.namespace}
                className="method-tree__ns"
                role="treeitem"
                aria-expanded={open}
              >
                <button className="method-tree__ns-head" onClick={() => toggleNs(ns.namespace)}>
                  {open ? <IconChevronD /> : <IconChevronR />}
                  <span className="method-tree__ns-name">{ns.namespace}</span>
                  <span className="method-tree__ns-count">{ns.methods.length}</span>
                </button>
                {open && (
                  <ul className="method-tree__leaves" role="group">
                    {ns.methods.map((m) => (
                      <li key={m.name} role="none">
                        <button
                          role="treeitem"
                          aria-selected={selected === m.name}
                          className={`method-tree__leaf ${selected === m.name ? "method-tree__leaf--on" : ""}`}
                          onClick={() => onSelect(m.name)}
                        >
                          <span className="method-tree__leaf-name">
                            {m.name.replace(`${ns.namespace}.`, "")}
                          </span>
                          <span className="method-tree__leaf-meta">
                            <KindBadge kind={m.kind} />
                            <ScopeBadge scope={m.scope} />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

Object.assign(window, { MethodTree });
