// MemoryDreams — Dreams tab. Two-column: agent picker (left) +
// dream diary content viewer + action buttons (right).
//
// Actions map to DeckGoMemoryDreamAction enum:
// "read" | "backfill" | "reset" | "resetShortTerm" | "repair" | "dedupe"

const DREAM_ACTIONS = [
  { id: "read", label: "Read", danger: false, hint: "Re-read the diary file (no mutation)" },
  {
    id: "backfill",
    label: "Backfill",
    danger: false,
    hint: "Re-ingest session corpus into peripheral tier",
  },
  { id: "dedupe", label: "Dedupe", danger: false, hint: "Merge duplicate entries" },
  {
    id: "repair",
    label: "Repair",
    danger: false,
    hint: "Fix malformed frontmatter / broken links",
  },
  {
    id: "resetShortTerm",
    label: "Reset short-term",
    danger: true,
    hint: "Drop working tier; preserve core",
  },
  { id: "reset", label: "Reset all", danger: true, hint: "Drop all tiers. Cannot be undone." },
];

const ActionResult = ({ result }) => {
  if (!result) return null;
  return (
    <div className="memory-dreams__action-result">
      <div className="memory-dreams__action-result-head">
        <strong>Last action: {result.action}</strong>
        <span className="muted small">on {result.agentId}</span>
      </div>
      <ul className="memory-dreams__action-result-list">
        {result.scannedFiles != null && (
          <li>
            scanned files: <strong>{result.scannedFiles}</strong>
          </li>
        )}
        {result.written != null && (
          <li>
            written: <strong>{result.written}</strong>
          </li>
        )}
        {result.replaced != null && (
          <li>
            replaced: <strong>{result.replaced}</strong>
          </li>
        )}
        {result.removedEntries != null && (
          <li>
            removed: <strong>{result.removedEntries}</strong>
          </li>
        )}
        {result.removedShortTermEntries != null && (
          <li>
            removed short-term: <strong>{result.removedShortTermEntries}</strong>
          </li>
        )}
        {result.dedupedEntries != null && (
          <li>
            deduped: <strong>{result.dedupedEntries}</strong>
          </li>
        )}
        {result.keptEntries != null && (
          <li>
            kept: <strong>{result.keptEntries}</strong>
          </li>
        )}
        {result.archiveDir && (
          <li>
            archive dir: <code>{result.archiveDir}</code>
          </li>
        )}
        {result.archivedDreamsDiary && <li>archived dreams diary ✓</li>}
        {result.archivedSessionCorpus && <li>archived session corpus ✓</li>}
        {result.changed === false && <li className="muted">no changes</li>}
        {result.warnings && result.warnings.length > 0 && (
          <li>
            warnings:{" "}
            {result.warnings.map((w, i) => (
              <code key={i}>{w}</code>
            ))}
          </li>
        )}
      </ul>
    </div>
  );
};

const ConfirmRow = ({ action, onConfirm, onCancel }) => (
  <div className="memory-dreams__confirm">
    <span>
      <IconAlert /> Confirm <strong>{action.label}</strong>? {action.hint}
    </span>
    <div className="memory-dreams__confirm-actions">
      <button className="btn btn--danger btn--sm" onClick={onConfirm}>
        Confirm
      </button>
      <button className="btn btn--ghost btn--sm" onClick={onCancel}>
        Cancel
      </button>
    </div>
  </div>
);

const MemoryDreams = () => {
  const [activeAgent, setActiveAgent] = React.useState(AGENTS[0].id);
  const [pendingAction, setPendingAction] = React.useState(null);
  const [actionResult, setActionResult] = React.useState(null);
  const [running, setRunning] = React.useState(false);

  const diary = DREAMS.diaries[activeAgent];

  const runAction = (actionId) => {
    setRunning(true);
    setTimeout(() => {
      // Mock action result per actionId
      const base = { agentId: activeAgent, action: actionId, path: diary?.path };
      const fakeResults = {
        read: { ...base, found: !!diary?.found, content: diary?.content },
        backfill: { ...base, scannedFiles: 3, written: 24, changed: true },
        dedupe: { ...base, scannedFiles: 142, dedupedEntries: 7, keptEntries: 135 },
        repair: {
          ...base,
          scannedFiles: 14,
          replaced: 2,
          warnings: ["frontmatter missing on 1 file"],
        },
        resetShortTerm: {
          ...base,
          removedShortTermEntries: 24,
          archivedSessionIngestion: true,
          archiveDir: ".memory-archive/2026-05-04T13-30-00Z",
        },
        reset: {
          ...base,
          removedEntries: 142,
          archivedDreamsDiary: true,
          archivedSessionCorpus: true,
          archiveDir: ".memory-archive/2026-05-04T13-30-00Z",
        },
      };
      setActionResult(fakeResults[actionId] || base);
      setRunning(false);
      setPendingAction(null);
    }, 600);
  };

  const handleClick = (action) => {
    setActionResult(null);
    if (action.danger) {
      setPendingAction(action);
    } else {
      runAction(action.id);
    }
  };

  return (
    <div className="memory-dreams">
      <aside className="memory-dreams__side">
        <h3 className="memory-dreams__side-title muted small">Agent</h3>
        <ul className="memory-dreams__agent-list">
          {AGENTS.map((a) => {
            const d = DREAMS.diaries[a.id];
            const active = activeAgent === a.id;
            return (
              <li key={a.id}>
                <button
                  className={`memory-dreams__agent-row ${active ? "memory-dreams__agent-row--on" : ""}`}
                  onClick={() => {
                    setActiveAgent(a.id);
                    setActionResult(null);
                    setPendingAction(null);
                  }}
                >
                  <AgentDot agentId={a.id} />
                  <span className="memory-dreams__agent-found muted small">
                    {d?.found ? `${formatRelative(d.updatedAtMs)}` : "no diary"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <h3 className="memory-dreams__side-title muted small">Maintenance</h3>
        <div className="memory-dreams__actions">
          {DREAM_ACTIONS.map((action) => (
            <button
              key={action.id}
              className={`memory-dreams__action ${action.danger ? "memory-dreams__action--danger" : ""}`}
              onClick={() => handleClick(action)}
              disabled={running}
              title={action.hint}
            >
              {action.danger && <IconShield />}
              {!action.danger && <IconBrain />}
              {action.label}
            </button>
          ))}
        </div>
      </aside>

      <section className="memory-dreams__main">
        <header className="memory-dreams__main-head">
          <div>
            <h2 className="memory-dreams__main-title">
              <IconBrain />
              Dreams · {activeAgent}
            </h2>
            <p className="muted small">
              {diary?.found ? (
                <>
                  diary at <code>{diary.path}</code> · updated {formatRelative(diary.updatedAtMs)}
                </>
              ) : (
                <>
                  no diary file at{" "}
                  <code>{diary?.path || `/agents/${activeAgent}/dreams.diary.md`}</code>
                </>
              )}
            </p>
          </div>
          {running && <span className="memory-dreams__running muted small">running…</span>}
        </header>

        {pendingAction && (
          <ConfirmRow
            action={pendingAction}
            onConfirm={() => runAction(pendingAction.id)}
            onCancel={() => setPendingAction(null)}
          />
        )}

        <ActionResult result={actionResult} />

        {diary?.found ? (
          <div className="memory-dreams__diary">
            <MarkdownView source={diary.content || ""} />
          </div>
        ) : (
          <div className="memory-dreams__empty">
            <p className="muted">
              No dream diary for this agent yet. Run <strong>Backfill</strong> to seed from the
              session corpus, or <strong>Read</strong> to verify the file path.
            </p>
          </div>
        )}
      </section>
    </div>
  );
};

Object.assign(window, { MemoryDreams });
