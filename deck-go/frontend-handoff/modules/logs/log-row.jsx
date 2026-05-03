/* deck-go logs prototype v2 — single log row component */

function formatTs(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${String(d.getUTCMilliseconds()).padStart(3, "0")}`;
}

function relativeTs(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function LogRow({ line, selected, onSelect, density }) {
  const meta = LEVEL_META[line.level] ?? LEVEL_META.info;
  const sourceMeta = SOURCE_META[line.source] ?? { tone: "tone-iron" };
  const isError = line.level === "error";
  const compact = density === "compact";
  return (
    <li
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      className={`log-row ${meta.cls}${selected ? " log-row--selected" : ""}${isError ? " log-row--error-tint" : ""}${compact ? " log-row--compact" : ""}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <span className="log-row__col log-row__col--ts">
        <span className="log-row__ts" title={line.ts}>
          {formatTs(line.ts)}
        </span>
        {!compact && <span className="log-row__date">{relativeTs(line.ts)}</span>}
      </span>
      <span className="log-row__col log-row__col--level">
        <LevelPill level={line.level} compact />
      </span>
      <span className="log-row__col log-row__col--source">
        <span className={`source-dot source-dot--${sourceMeta.tone}`} />
        <span className="log-row__source">{line.source}</span>
      </span>
      <span className="log-row__col log-row__col--session">
        <span className="log-row__session">{line.sessionKey}</span>
        {line.correlationId && (
          <span className="log-row__cid" title={line.correlationId}>
            <IconLink size={10} />
            {line.correlationId.replace(/^trace-/, "")}
          </span>
        )}
      </span>
      <span className="log-row__col log-row__col--msg">
        <span className="log-row__msg">{line.message}</span>
      </span>
      <span className="log-row__col log-row__col--cursor">
        <span className="log-row__cursor">#{line.cursor}</span>
      </span>
    </li>
  );
}

Object.assign(window, { LogRow, formatTs, relativeTs });
