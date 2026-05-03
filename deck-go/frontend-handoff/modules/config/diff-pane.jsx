// diff-pane.jsx — Right column: raw editor / diff preview / apply history.

const { useMemo } = React;

function relativeTime(now, ts) {
  const diff = Math.max(0, now - ts);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatAbsolute(ts) {
  const d = new Date(ts);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) if (!deepEqual(a[k], b[k])) return false;
  return true;
}

function flatten(obj, prefix = "") {
  const out = {};
  if (obj === null || typeof obj !== "object") {
    out[prefix] = obj;
    return out;
  }
  if (Array.isArray(obj)) {
    out[prefix] = obj;
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "object" && v !== null && !Array.isArray(v))
      Object.assign(out, flatten(v, next));
    else out[next] = v;
  }
  return out;
}

function computeDiff(base, draft) {
  const flatBase = flatten(base);
  const flatDraft = flatten(draft);
  const keys = new Set([...Object.keys(flatBase), ...Object.keys(flatDraft)]);
  const out = [];
  for (const k of keys) {
    const a = flatBase[k];
    const b = flatDraft[k];
    if (deepEqual(a, b)) continue;
    let kind = "modified";
    if (a === undefined) kind = "added";
    else if (b === undefined) kind = "removed";
    out.push({ path: k, before: a, after: b, kind });
  }
  return out;
}

function renderValue(v) {
  if (v === undefined) return <span className="diff-row__null">⌀</span>;
  if (v === null) return <span className="diff-row__null">null</span>;
  if (typeof v === "boolean") return <code className="diff-row__bool">{String(v)}</code>;
  if (typeof v === "string")
    return <code className="diff-row__str">"{v.length > 60 ? v.slice(0, 60) + "…" : v}"</code>;
  if (Array.isArray(v)) return <code className="diff-row__arr">[{v.length}]</code>;
  return <code className="diff-row__num">{String(v)}</code>;
}

function DiffPane({
  baseConfig,
  draftConfig,
  draftRaw,
  draftValid,
  onDraftRaw,
  recentApplies,
  now,
  mode,
  onModeChange,
  onOpenSnapshot,
  onSelectPath,
}) {
  const diff = useMemo(() => computeDiff(baseConfig, draftConfig), [baseConfig, draftConfig]);
  return (
    <section className="diff-pane" aria-label="Draft preview">
      <div className="diff-pane__head">
        <div>
          <p className="diff-pane__eyebrow">draft preview</p>
          <h2 className="diff-pane__title">
            {mode === "diff" ? "Diff" : mode === "raw" ? "Raw JSON" : "Recent applies"}
          </h2>
          <p className="diff-pane__hint">
            {mode === "diff" ? `${diff.length} path${diff.length === 1 ? "" : "s"} changed.` : null}
            {mode === "raw" ? "Edit JSON directly. Form pane stays in sync." : null}
            {mode === "history" ? `${recentApplies.length} most recent apply attempts.` : null}
          </p>
        </div>
        <div className="diff-pane__modes" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "diff"}
            className={`diff-pane__mode${mode === "diff" ? " diff-pane__mode--on" : ""}`}
            onClick={() => onModeChange("diff")}
          >
            Diff
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "raw"}
            className={`diff-pane__mode${mode === "raw" ? " diff-pane__mode--on" : ""}`}
            onClick={() => onModeChange("raw")}
          >
            Raw
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "history"}
            className={`diff-pane__mode${mode === "history" ? " diff-pane__mode--on" : ""}`}
            onClick={() => onModeChange("history")}
          >
            History
          </button>
        </div>
      </div>

      <div className="diff-pane__body">
        {mode === "diff" ? (
          diff.length === 0 ? (
            <div className="diff-pane__empty">
              <window.IconCheck size={18} />
              <p>Draft matches base. Nothing to apply.</p>
            </div>
          ) : (
            <ul className="diff-list">
              {diff.map((row) => (
                <li key={row.path} className={`diff-row diff-row--${row.kind}`}>
                  <button
                    type="button"
                    className="diff-row__path"
                    onClick={() => onSelectPath(row.path)}
                  >
                    <code>{row.path}</code>
                  </button>
                  <span className={`diff-row__tag diff-row__tag--${row.kind}`}>{row.kind}</span>
                  <div className="diff-row__values">
                    <span className="diff-row__before">{renderValue(row.before)}</span>
                    <window.IconArrowOut size={11} />
                    <span className="diff-row__after">{renderValue(row.after)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : null}

        {mode === "raw" ? (
          <RawJsonEditor raw={draftRaw} valid={draftValid} onChange={onDraftRaw} />
        ) : null}

        {mode === "history" ? (
          <ul className="apply-history">
            {recentApplies.map((r) => (
              <li
                key={r.ts}
                className={`apply-history__row apply-history__row--${r.ok ? "ok" : "err"}`}
              >
                <div className="apply-history__head">
                  <span className="apply-history__rel">{relativeTime(now, r.ts)}</span>
                  <span className="apply-history__abs">{formatAbsolute(r.ts)}</span>
                  {r.ok ? (
                    <window.StatusPill tone="success" icon={window.IconCheck}>
                      applied
                    </window.StatusPill>
                  ) : (
                    <window.StatusPill tone="warn" icon={window.IconAlert}>
                      rejected
                    </window.StatusPill>
                  )}
                </div>
                <div className="apply-history__paths">
                  {r.paths.map((p) => (
                    <code key={p}>{p}</code>
                  ))}
                </div>
                <div className="apply-history__hashes">
                  <window.HashChip kind="from" hash={r.previousHash} />
                  <window.IconArrowOut size={10} />
                  <window.HashChip kind="to" hash={r.newHash} />
                  <span className="apply-history__actor">
                    <window.IconUser size={10} /> {r.actor}
                  </span>
                </div>
                {r.error ? <p className="apply-history__error">{r.error}</p> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="diff-pane__footer">
        <button type="button" className="ds-btn" onClick={onOpenSnapshot}>
          <window.IconJson size={12} />
          <span>View snapshot</span>
        </button>
      </div>
    </section>
  );
}

function RawJsonEditor({ raw, valid, onChange }) {
  return (
    <div className="raw-editor">
      <textarea
        className="ds-textarea ds-textarea--mono raw-editor__area"
        value={raw}
        onChange={(e) => onChange(e.target.value)}
        spellCheck="false"
        aria-label="Raw openclaw.json draft"
      />
      <div className="raw-editor__status" aria-live="polite">
        {valid ? (
          <window.StatusPill tone="success" icon={window.IconCheck}>
            JSON valid
          </window.StatusPill>
        ) : (
          <window.StatusPill tone="warn" icon={window.IconAlert}>
            JSON invalid
          </window.StatusPill>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { DiffPane, RawJsonEditor, computeDiff });
