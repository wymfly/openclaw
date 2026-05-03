/* deck-go logs prototype v2 — log stream pane (KPI strip + actions + filtered list + tape) */

function LogStream({
  lines,
  visible,
  selectedCursor,
  onSelect,
  density,
  streamState,
  onTogglePause,
  onRefresh,
  onClearLocal,
  onPrepareExport,
  bufferCap,
  cursor,
  liveTape,
  onOpenTapeRaw,
}) {
  const isPaused = streamState === "paused";
  const errorCount = visible.filter((l) => l.level === "error").length;
  const warnCount = visible.filter((l) => l.level === "warn").length;

  return (
    <section className="log-stream" aria-label="Log stream">
      <header className="log-stream__metrics">
        <article className="metric">
          <span>Cursor</span>
          <strong>{cursor}</strong>
          <small>deckGoLogsCursor</small>
        </article>
        <article className="metric">
          <span>Visible rows</span>
          <strong>{visible.length}</strong>
          <small>after local filters</small>
        </article>
        <article className="metric">
          <span>Loaded rows</span>
          <strong>{lines.length}</strong>
          <small>limit 200/tail</small>
        </article>
        <article className="metric metric--warn">
          <span>Warns</span>
          <strong>{warnCount}</strong>
          <small>visible window</small>
        </article>
        <article className="metric metric--error">
          <span>Errors</span>
          <strong>{errorCount}</strong>
          <small>visible window</small>
        </article>
        <article className="metric">
          <span>Buffer</span>
          <strong>{bufferCap.toLocaleString()}</strong>
          <small>local cap</small>
        </article>
      </header>

      <div className="log-stream__action-row">
        <button type="button" className="action-btn action-btn--primary" onClick={onRefresh}>
          <IconRefresh size={12} />
          <span>Refresh tail</span>
        </button>
        <button
          type="button"
          className={`action-btn${isPaused ? " action-btn--accent" : ""}`}
          onClick={onTogglePause}
        >
          {isPaused ? <IconPlay size={12} /> : <IconPause size={12} />}
          <span>{isPaused ? "Resume stream" : "Pause stream"}</span>
        </button>
        <button type="button" className="action-btn" onClick={onClearLocal}>
          <IconClear size={12} />
          <span>Clear local logs</span>
        </button>
        <button type="button" className="action-btn" onClick={onPrepareExport}>
          <IconExport size={12} />
          <span>Prepare export</span>
        </button>

        <span className="log-stream__live">
          <span className={`live-dot${isPaused ? " live-dot--paused" : ""}`} />
          <span>
            {isPaused ? "Stream paused" : "Streaming"}
            <span className="live-faint">
              {isPaused ? " — buffered events held" : " — log.batch / log.reset"}
            </span>
          </span>
        </span>
      </div>

      <div className="log-stream__panes">
        <article className="log-stream__list-card" aria-label="Filtered tail">
          <header className="list-card__head">
            <h3>Tail</h3>
            <span className="list-card__hint">
              {visible.length} of {lines.length} loaded
            </span>
          </header>
          {visible.length === 0 ? (
            <div className="log-stream__empty">
              <h4>No lines match these filters.</h4>
              <p>Loosen levels, sources, sessions, or clear the search.</p>
            </div>
          ) : (
            <ul className="log-stream__list" role="list">
              <li className="log-row log-row--header" aria-hidden="true">
                <span className="log-row__col log-row__col--ts">Time</span>
                <span className="log-row__col log-row__col--level">Level</span>
                <span className="log-row__col log-row__col--source">Source</span>
                <span className="log-row__col log-row__col--session">Session / Trace</span>
                <span className="log-row__col log-row__col--msg">Message</span>
                <span className="log-row__col log-row__col--cursor">Cursor</span>
              </li>
              {visible.map((line) => (
                <LogRow
                  key={`${line.cursor}-${line.ts}`}
                  line={line}
                  selected={line.cursor === selectedCursor}
                  onSelect={() => onSelect(line.cursor)}
                  density={density}
                />
              ))}
            </ul>
          )}
        </article>

        <article className="log-stream__tape-card" aria-label="Live event tape">
          <header className="tape-card__head">
            <h3>
              <IconStream size={12} /> Live tape
            </h3>
            <span className="tape-card__hint">/logs/stream</span>
          </header>
          <ul className="tape-list" role="list">
            {liveTape.map((evt) => (
              <li key={evt.id} className={`tape-row tape-row--${evt.event.replace(".", "-")}`}>
                <button
                  type="button"
                  className="tape-row__btn"
                  onClick={() => onOpenTapeRaw(evt)}
                  aria-label={`Open raw payload for ${evt.id}`}
                >
                  <span className="tape-row__id">{evt.id}</span>
                  <span className="tape-row__type">{evt.event}</span>
                  <span className="tape-row__summary">{evt.summary}</span>
                </button>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}

Object.assign(window, { LogStream });
