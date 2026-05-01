// Sidebar — sessions list with rename, search, delete states.
const { useState: useStateS } = React;

function Sidebar({ collapsed, sessions, activeKey, onPick, onNew, density }) {
  const [q, setQ] = useStateS("");
  const [editing, setEditing] = useStateS(null);
  const [deleteTarget, setDeleteTarget] = useStateS(null);
  const [hovered, setHovered] = useStateS(null);

  const filtered = sessions.filter((s) => !q || s.title.toLowerCase().includes(q.toLowerCase()));

  if (collapsed) {
    return (
      <aside className="sidebar collapsed">
        <button className="icon-btn" title="New session" onClick={onNew}>
          <I.Plus size={14} />
        </button>
        <div className="agent-stack">
          {["m", "r", "d"].map((c, i) => (
            <div key={i} className={"agent-dot" + (i === 0 ? " active" : "")}>
              {c}
            </div>
          ))}
        </div>
        <div className="rule"></div>
        {sessions.slice(0, 8).map((s) => (
          <button
            key={s.key}
            className={"session-mini" + (s.key === activeKey ? " active" : "")}
            onClick={() => onPick(s.key)}
            title={s.title}
          >
            {s.streaming ? (
              <span className="dot streaming-dot" style={{ background: "var(--accent)" }} />
            ) : (
              <I.Hash size={11} />
            )}
          </button>
        ))}
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      <div className="agent-tabs">
        <button className="agent-tab active">main</button>
        <button className="agent-tab">researcher</button>
        <button className="agent-tab">code-reviewer</button>
        <button className="agent-tab muted">
          <I.Plus size={11} />
        </button>
      </div>
      <div className="sidebar-actions">
        <button className="btn-primary" onClick={onNew}>
          <I.Plus size={12} /> New session
        </button>
      </div>
      <div className="sidebar-search">
        <I.Search size={12} />
        <input placeholder="Search sessions" value={q} onChange={(e) => setQ(e.target.value)} />
        {q && (
          <button className="x-btn" onClick={() => setQ("")}>
            <I.X size={11} />
          </button>
        )}
      </div>
      <div className="session-list scroll-y">
        {filtered.length === 0 && (
          <div className="empty-rows mono small">{q ? "No matches" : "No sessions yet"}</div>
        )}
        {filtered.map((s) => {
          const active = s.key === activeKey;
          const isEdit = editing === s.key;
          return (
            <div
              key={s.key}
              className={
                "session-row" + (active ? " active" : "") + (s.streaming ? " streaming" : "")
              }
              onMouseEnter={() => setHovered(s.key)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => !isEdit && onPick(s.key)}
              onDoubleClick={() => setEditing(s.key)}
            >
              <div className="row-title-line">
                {s.streaming && (
                  <span className="dot streaming-dot" style={{ background: "var(--accent)" }} />
                )}
                {isEdit ? (
                  <input
                    className="rename-input"
                    autoFocus
                    defaultValue={s.title}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "Escape") {
                        setEditing(null);
                      }
                    }}
                    onBlur={() => setEditing(null)}
                  />
                ) : (
                  <span className="row-title">{s.title}</span>
                )}
                {hovered === s.key && !isEdit && (
                  <button
                    className="row-trash"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(s);
                    }}
                  >
                    <I.Trash size={11} />
                  </button>
                )}
              </div>
              <div className="row-preview">{s.preview}</div>
              <div className="row-meta mono">{s.updated}</div>
            </div>
          );
        })}
      </div>
      <div className="sidebar-foot mono small">
        Default agent: <span className="kbd">main</span>
      </div>

      {deleteTarget && (
        <div className="modal-scrim" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete session?</h3>
            <p>"{deleteTarget.title}" will be removed permanently.</p>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button className="btn-danger" onClick={() => setDeleteTarget(null)}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

window.Sidebar = Sidebar;
