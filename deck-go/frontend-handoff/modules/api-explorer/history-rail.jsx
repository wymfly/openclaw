// HistoryRail — collapsible right-side rail with last N requests. Click an
// entry to load its method + params back into the request builder.

const HistoryRail = ({ history, onPick, open, onToggle }) => {
  if (!open) {
    return (
      <button
        className="history-rail__handle"
        onClick={onToggle}
        title="Show history"
        aria-label="Show history"
      >
        <IconHistory />
        <span className="history-rail__handle-count">{history.length}</span>
      </button>
    );
  }
  return (
    <aside className="history-rail">
      <header className="history-rail__head">
        <h3>
          <IconHistory />
          Recent requests
        </h3>
        <button className="history-rail__close" onClick={onToggle} aria-label="Hide history">
          <IconClose />
        </button>
      </header>
      <ul className="history-rail__list">
        {history.length === 0 ? (
          <li className="history-rail__empty">No history yet.</li>
        ) : (
          history.map((h) => (
            <li key={h.id}>
              <button
                className={`history-row ${h.success ? "history-row--ok" : "history-row--err"}`}
                onClick={() => onPick(h)}
              >
                <div className="history-row__head">
                  <code className="history-row__method">{h.method}</code>
                  <StatusCodeBadge statusCode={h.statusCode} />
                </div>
                <div className="history-row__sub">
                  <span className="muted small">{formatRelative(h.at)}</span>
                  <span className="muted small">·</span>
                  <span className="muted small">{h.durationMs}ms</span>
                  <span className="muted small">·</span>
                  <span className="muted small">{h.env}</span>
                </div>
                {h.error && <span className="history-row__err">{h.error}</span>}
                <div className="history-row__params">
                  <code className="muted small">{paramsPreview(h.paramsPreview)}</code>
                </div>
              </button>
            </li>
          ))
        )}
      </ul>
    </aside>
  );
};

function paramsPreview(p) {
  if (!p || Object.keys(p).length === 0) return "{}";
  const entries = Object.entries(p).map(([k, v]) => {
    let val;
    if (typeof v === "string") val = v.length > 24 ? `${v.slice(0, 22)}…` : v;
    else if (typeof v === "number") val = v;
    else if (typeof v === "boolean") val = v ? "true" : "false";
    else if (v === null) val = "null";
    else val = "{…}";
    return `${k}: ${val}`;
  });
  return `{ ${entries.slice(0, 2).join(", ")}${entries.length > 2 ? ", …" : ""} }`;
}

Object.assign(window, { HistoryRail });
