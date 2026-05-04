// DocViewer — right pane: doc hero (breadcrumb + title + provenance + meta +
// keyword chips + delete) + markdown body + outline rail (right edge).
// Clicking a keyword filters the tree; clicking the breadcrumb scrolls to top.

const deriveExcerpt = (content) => {
  const lines = content.split("\n");
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith("#") || t.startsWith("```") || t.startsWith("|") || t.startsWith("-"))
      continue;
    return t.slice(0, 160) + (t.length > 160 ? "…" : "");
  }
  return "";
};

const DocViewer = ({
  doc,
  categories,
  agents,
  allKeywords,
  onKeywordFilter,
  keywordFilter,
  onSelectId,
  onCopyId,
  copiedId,
  onDelete,
}) => {
  const containerRef = React.useRef(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const cat = categories.find((c) => c.id === doc.category);
  const agent = doc.sourceAgent ? agents[doc.sourceAgent] : null;
  const excerpt = React.useMemo(() => deriveExcerpt(doc.content), [doc.content]);

  const outline = React.useMemo(() => {
    const headings = [];
    const lines = doc.content.split("\n");
    for (const line of lines) {
      if (line.startsWith("# ")) headings.push({ level: 1, text: line.slice(2) });
      else if (line.startsWith("## ")) headings.push({ level: 2, text: line.slice(3) });
    }
    return headings;
  }, [doc.content]);

  const relatedDocs = React.useMemo(() => {
    return DOCS.filter(
      (d) => d.id !== doc.id && d.keywords.some((k) => doc.keywords.includes(k)),
    ).slice(0, 4);
  }, [doc]);

  const scrollToTop = () => {
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  React.useEffect(() => {
    setConfirmDelete(false);
  }, [doc.id]);

  return (
    <article className="doc-viewer" ref={containerRef}>
      <header className="doc-hero">
        <nav className="doc-hero__breadcrumb">
          <button className="doc-hero__crumb" onClick={scrollToTop}>
            <IconBook />
            <span>{cat?.label || doc.category}</span>
          </button>
          <IconChevronR />
          <span className="doc-hero__crumb-current">{doc.title}</span>
        </nav>
        <h1 className="doc-hero__title">{doc.title}</h1>
        {excerpt && <p className="doc-hero__summary muted">{excerpt}</p>}

        <div className="doc-hero__provenance">
          <span className="doc-hero__prov-label muted small">Source</span>
          {doc.sourceAgent && agent ? (
            <span className="doc-hero__prov-agent">
              <span className="doc-hero__prov-agent-dot" style={{ background: agent.color }} />
              <span>{agent.name}</span>
            </span>
          ) : (
            <span className="doc-hero__prov-agent muted small">no agent</span>
          )}
          <span className="doc-hero__prov-divider muted small">·</span>
          {doc.sourceSession ? (
            <code className="doc-hero__prov-session">{doc.sourceSession}</code>
          ) : (
            <span className="muted small">no session</span>
          )}
        </div>

        <div className="doc-hero__meta">
          <span className="muted small">
            <IconClock />
            extracted {formatRelative(doc.extractedAt)}
          </span>
          <span className="muted small doc-hero__meta-divider">·</span>
          <span className="muted small">
            <IconClock />
            updated {formatRelative(doc.updatedAt)}
          </span>
          <span className="muted small doc-hero__meta-divider">·</span>
          <span className="muted small">{doc.language}</span>
          <button className="doc-hero__slug" onClick={() => onCopyId(doc.id)} title="Copy doc id">
            <IconHash />
            <code>{doc.id}</code>
            <IconCopy />
            {copiedId === doc.id && <span className="doc-hero__slug-copied">copied</span>}
          </button>
          {confirmDelete ? (
            <span className="doc-hero__delete-confirm">
              <span className="muted small">Delete this doc?</span>
              <button className="btn btn--danger btn--sm" onClick={() => onDelete(doc.id)}>
                Confirm delete
              </button>
              <button className="btn btn--ghost btn--sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </span>
          ) : (
            <button
              className="doc-hero__delete"
              onClick={() => setConfirmDelete(true)}
              title="Delete this doc"
            >
              Delete
            </button>
          )}
        </div>

        {doc.keywords.length > 0 && (
          <div className="doc-hero__tags">
            {doc.keywords.map((k) => (
              <TagChip
                key={k}
                tag={k}
                active={keywordFilter === k}
                onClick={() => onKeywordFilter(k === keywordFilter ? null : k)}
              />
            ))}
          </div>
        )}
      </header>

      <div className="doc-body">
        <div className="doc-body__main">
          <MarkdownView source={doc.content} />

          {relatedDocs.length > 0 && (
            <section className="related-docs">
              <h4 className="related-docs__title">Related docs</h4>
              <ul className="related-docs__list">
                {relatedDocs.map((d) => (
                  <li key={d.id}>
                    <button className="related-docs__row" onClick={() => onSelectId(d.id)}>
                      <span className="related-docs__row-title">{d.title}</span>
                      <span className="related-docs__row-summary muted small">
                        {deriveExcerpt(d.content)}
                      </span>
                      <IconArrowRight />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="doc-body__outline">
          <h4 className="doc-outline__title muted small">On this page</h4>
          <ul className="doc-outline__list">
            {outline.map((h, i) => (
              <li key={i} className={`doc-outline__item doc-outline__item--l${h.level}`}>
                <span>{h.text}</span>
              </li>
            ))}
          </ul>
          <div className="doc-outline__tags">
            <h4 className="doc-outline__title muted small">All keywords</h4>
            <div className="doc-outline__tag-cloud">
              {allKeywords.map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`doc-outline__tag ${keywordFilter === k ? "doc-outline__tag--on" : ""}`}
                  onClick={() => onKeywordFilter(k === keywordFilter ? null : k)}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </article>
  );
};

Object.assign(window, { DocViewer });
