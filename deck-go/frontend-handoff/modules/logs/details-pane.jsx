/* deck-go logs prototype v2 — selected entry details pane */

function DetailsPane({ line, onJumpCorrelation, onOpenRaw, onCopyMessage, copyState }) {
  if (!line) {
    return (
      <aside className="details-pane details-pane--empty" aria-label="Log line details">
        <div className="details-pane__empty">
          <div className="details-pane__empty-glyph" aria-hidden="true">
            <IconLayers size={28} />
          </div>
          <h3>No line selected</h3>
          <p>Click any row to inspect its payload, fields, stack trace, and correlation context.</p>
        </div>
      </aside>
    );
  }

  const meta = LEVEL_META[line.level] ?? LEVEL_META.info;
  const Icon = meta.Icon;
  const fields = line.fields ?? {};
  const fieldEntries = Object.entries(fields);

  return (
    <aside className="details-pane" aria-label="Log line details">
      <header className={`details-pane__hero ${meta.cls}`}>
        <div className="details-pane__hero-top">
          <span className="details-pane__pill">
            <Icon size={14} />
            {meta.label}
          </span>
          <SourceTile source={line.source} />
          <span className="details-pane__cursor">#{line.cursor}</span>
        </div>
        <h2 className="details-pane__msg">{line.message}</h2>
        <p className="details-pane__hero-meta">
          <span title={line.ts}>{line.ts}</span>
          <span aria-hidden>·</span>
          <span>{line.sessionKey}</span>
          {line.correlationId && (
            <>
              <span aria-hidden>·</span>
              <button
                type="button"
                className="details-pane__cid-btn"
                onClick={() => onJumpCorrelation(line.correlationId)}
              >
                <IconLink size={11} />
                {line.correlationId}
              </button>
            </>
          )}
        </p>
        <div className="details-pane__hero-actions">
          <button type="button" className="details-pane__action" onClick={onCopyMessage}>
            <IconCopy size={12} />
            <span>{copyState === "copied" ? "Copied" : "Copy line"}</span>
          </button>
          <button type="button" className="details-pane__action" onClick={onOpenRaw}>
            <IconExport size={12} />
            <span>Open raw payload</span>
          </button>
          {line.correlationId && (
            <button
              type="button"
              className="details-pane__action details-pane__action--accent"
              onClick={() => onJumpCorrelation(line.correlationId)}
            >
              <IconLink size={12} />
              <span>Filter by correlation</span>
            </button>
          )}
        </div>
      </header>

      <section className="details-pane__section" aria-labelledby="dp-fields">
        <header className="details-pane__section-head">
          <h3 id="dp-fields">Structured fields</h3>
          <span className="details-pane__section-hint">{fieldEntries.length} keys</span>
        </header>
        {fieldEntries.length === 0 ? (
          <p className="details-pane__empty-row">No structured fields recorded.</p>
        ) : (
          <dl className="details-pane__kv">
            {fieldEntries.map(([k, v]) => (
              <div key={k} className="details-pane__kv-row">
                <dt>{k}</dt>
                <dd>{String(v)}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section className="details-pane__section" aria-labelledby="dp-context">
        <header className="details-pane__section-head">
          <h3 id="dp-context">Correlation context</h3>
        </header>
        {line.correlationId ? (
          <p className="details-pane__context">
            Lines sharing <code>{line.correlationId}</code> form a request span. Click{" "}
            <strong>Filter by correlation</strong> to narrow the stream to this trace.
          </p>
        ) : (
          <p className="details-pane__context details-pane__context--muted">
            No correlation id on this line. Lines emitted outside an active RPC span will not have
            one.
          </p>
        )}
      </section>

      {line.stack && (
        <section className="details-pane__section" aria-labelledby="dp-stack">
          <header className="details-pane__section-head">
            <h3 id="dp-stack">Stack trace</h3>
            <span className="details-pane__section-hint">attached on error</span>
          </header>
          <pre className="details-pane__stack">{line.stack}</pre>
        </section>
      )}

      <section className="details-pane__section" aria-labelledby="dp-raw">
        <header className="details-pane__section-head">
          <h3 id="dp-raw">Raw line</h3>
          <span className="details-pane__section-hint">DeckGoLogsTailResponse.lines[i]</span>
        </header>
        <pre className="details-pane__code">{JSON.stringify(line, null, 2)}</pre>
      </section>
    </aside>
  );
}

Object.assign(window, { DetailsPane });
