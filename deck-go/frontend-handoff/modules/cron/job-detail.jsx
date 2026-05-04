// JobDetail — right pane: hero + actions row + 4 tabs (Overview / Schedule
// / History / Payload-and-audit). Mutations: Run now / Toggle enabled /
// Edit (opens CronBuilder) / Delete (confirm dialog).

const TABS = ["overview", "schedule", "history", "payload"];

const JobDetail = ({ job, runs, onAction, onEdit }) => {
  const [tab, setTab] = React.useState("overview");
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [runNowPhase, setRunNowPhase] = React.useState("idle"); // idle | running | done

  React.useEffect(() => {
    setTab("overview");
    setConfirmDelete(false);
    setRunNowPhase("idle");
  }, [job?.id]);

  if (!job) {
    return (
      <div className="job-detail job-detail--empty">
        <div className="job-detail__empty-card">
          <IconCalendar />
          <p>Pick a job from the list.</p>
          <p className="muted">Or use the New job button to create one.</p>
        </div>
      </div>
    );
  }

  const jobRuns = runs.filter((r) => r.jobId === job.id).sort((a, b) => b.ts - a.ts);
  const lastRun = jobRuns[0] || null;
  const okCount = jobRuns.filter((r) => r.status === "ok").length;
  const errCount = jobRuns.filter((r) => r.status === "error").length;
  const skippedCount = jobRuns.filter((r) => r.status === "skipped").length;

  const handleRunNow = () => {
    setRunNowPhase("running");
    setTimeout(() => {
      onAction(job.id, "run");
      setRunNowPhase("done");
      setTimeout(() => setRunNowPhase("idle"), 800);
    }, 720);
  };

  return (
    <div className="job-detail">
      <div className="job-detail__hero">
        <div className="job-detail__hero-head">
          <ScheduleBadge schedule={job.schedule} />
          <code className="job-detail__id">{job.id}</code>
          <EnabledToggle enabled={job.enabled} />
          {job.failureAlert && (
            <span className="failure-alert-badge">
              <IconAlert />
              alerts
            </span>
          )}
        </div>
        <h2 className="job-detail__title">{job.name}</h2>
        {job.description && <p className="job-detail__desc">{job.description}</p>}
        <div className="job-detail__hero-meta">
          <span className="job-detail__meta-cell">
            <IconClock />
            next:{" "}
            {job.enabled ? (
              <CountdownTimer targetMs={job.nextRunAtMs} prefix="in " />
            ) : (
              <span className="muted small">disabled</span>
            )}
          </span>
          <span className="job-detail__meta-cell">
            <IconLayers />
            {job.sessionTarget}
          </span>
          <span className="job-detail__meta-cell">
            <IconBolt />
            {job.wakeMode}
          </span>
          {job.agentId && (
            <span className="job-detail__meta-cell">
              <IconBolt />
              {job.agentId}
            </span>
          )}
        </div>
      </div>

      <div className="job-detail__actions">
        <button
          className={`job-detail__btn job-detail__btn--primary ${runNowPhase === "running" ? "job-detail__btn--spin" : ""}`}
          onClick={handleRunNow}
          disabled={runNowPhase !== "idle" || !job.enabled}
        >
          <IconPlay />
          Run now
        </button>
        <button
          className="job-detail__btn"
          onClick={() => onAction(job.id, job.enabled ? "disable" : "enable")}
        >
          {job.enabled ? <IconPause /> : <IconPlay />}
          {job.enabled ? "Disable" : "Enable"}
        </button>
        <button className="job-detail__btn" onClick={() => onEdit(job)}>
          <IconEdit />
          Edit
        </button>
        <button
          className="job-detail__btn job-detail__btn--danger"
          onClick={() => setConfirmDelete(true)}
        >
          <IconTrash />
          Delete
        </button>
        {runNowPhase === "running" && (
          <span className="job-detail__action-phase" role="status">
            running…
          </span>
        )}
        {runNowPhase === "done" && (
          <span className="job-detail__action-phase job-detail__action-phase--done">
            <IconCheck />
            triggered
          </span>
        )}
      </div>

      <div className="job-detail__tabs" role="tablist" aria-label="Job detail tabs">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`job-detail__tab ${tab === t ? "job-detail__tab--on" : ""}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="job-detail__body">
        {tab === "overview" && (
          <OverviewTab
            job={job}
            stats={{ ok: okCount, err: errCount, skipped: skippedCount, last: lastRun }}
          />
        )}
        {tab === "schedule" && <ScheduleTab job={job} />}
        {tab === "history" && <HistoryTab runs={jobRuns} />}
        {tab === "payload" && <PayloadTab job={job} />}
      </div>

      {confirmDelete && (
        <div className="modal-backdrop" onClick={() => setConfirmDelete(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Delete job confirm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal__head">
              <h3 className="modal__title">Delete job?</h3>
              <button
                className="modal__close"
                onClick={() => setConfirmDelete(false)}
                aria-label="Close confirm"
              >
                <IconClose />
              </button>
            </div>
            <div className="modal__body">
              <p>
                This will permanently delete <strong>{job.name}</strong> and stop all future runs.
              </p>
              <p className="muted small">
                Job id: <code>{job.id}</code>
              </p>
            </div>
            <div className="modal__foot">
              <button className="modal__btn" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
              <button
                className="modal__btn modal__btn--danger"
                onClick={() => {
                  onAction(job.id, "delete");
                  setConfirmDelete(false);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const OverviewTab = ({ job, stats }) => (
  <div className="detail-section">
    <h4 className="detail-section__title">Recent run stats</h4>
    <div className="overview-grid">
      <OverviewCell label="OK" value={stats.ok} tone="ok" />
      <OverviewCell label="Errors" value={stats.err} tone={stats.err > 0 ? "err" : "neutral"} />
      <OverviewCell label="Skipped" value={stats.skipped} tone="warn" />
      <OverviewCell
        label="Last duration"
        value={stats.last ? formatDuration(stats.last.durationMs) : "—"}
        tone="neutral"
      />
    </div>
    <h4 className="detail-section__title">Lifecycle</h4>
    <ul className="detail-list">
      <li>
        Created: <code>{formatTime(job.createdAtMs)}</code>
      </li>
      <li>
        Updated: <code>{formatTime(job.updatedAtMs)}</code> ({formatRelative(job.updatedAtMs)})
      </li>
      {job.deleteAfterRun && (
        <li>
          <strong>Self-deleting</strong>: removed after first successful run.
        </li>
      )}
      <li>
        Failure alerts: <strong>{job.failureAlert ? "enabled" : "disabled"}</strong>
      </li>
    </ul>
  </div>
);

const OverviewCell = ({ label, value, tone }) => (
  <div className={`overview-cell overview-cell--${tone}`}>
    <span className="overview-cell__value">{value}</span>
    <span className="overview-cell__label">{label}</span>
  </div>
);

const ScheduleTab = ({ job }) => (
  <div className="detail-section">
    <h4 className="detail-section__title">Schedule</h4>
    <div className="schedule-grid">
      <SchedulePair label="Kind" value={job.schedule.kind} />
      {job.schedule.kind === "cron" && (
        <>
          <SchedulePair label="Cron expr" value={<code>{job.schedule.expr}</code>} />
          <SchedulePair label="Timezone" value={job.schedule.tz || "UTC"} />
        </>
      )}
      {job.schedule.kind === "every" && (
        <>
          <SchedulePair label="Interval" value={formatDuration(job.schedule.everyMs)} />
          {job.schedule.staggerMs && (
            <SchedulePair label="Stagger" value={`±${formatDuration(job.schedule.staggerMs)}`} />
          )}
          {job.schedule.anchorMs && (
            <SchedulePair label="Anchor" value={formatTime(job.schedule.anchorMs)} />
          )}
        </>
      )}
      {job.schedule.kind === "at" && (
        <SchedulePair label="At" value={<code>{job.schedule.at}</code>} />
      )}
      <SchedulePair
        label="Next run"
        value={
          job.enabled && job.nextRunAtMs ? (
            <CountdownTimer targetMs={job.nextRunAtMs} prefix="in " />
          ) : (
            <span className="muted">disabled</span>
          )
        }
      />
    </div>
    <h4 className="detail-section__title">Raw</h4>
    <pre className="json-block">{JSON.stringify(job.schedule, null, 2)}</pre>
  </div>
);

const SchedulePair = ({ label, value }) => (
  <div className="schedule-pair">
    <span className="schedule-pair__label">{label}</span>
    <span className="schedule-pair__value">{value}</span>
  </div>
);

const HistoryTab = ({ runs }) => {
  if (runs.length === 0) {
    return <p className="muted">No runs recorded yet.</p>;
  }
  return (
    <div className="detail-section">
      <h4 className="detail-section__title">Last {Math.min(20, runs.length)} runs</h4>
      <div className="run-table" role="table">
        <div className="run-table__head" role="row">
          <span>When</span>
          <span>Status</span>
          <span>Duration</span>
          <span>Error / delivery</span>
        </div>
        {runs.slice(0, 20).map((r) => (
          <div
            key={r.id}
            role="row"
            className={`run-table__row ${r.status === "error" ? "run-table__row--err" : ""}`}
          >
            <span className="run-table__when">
              <code>{formatTime(r.ts)}</code> ·{" "}
              <span className="muted small">{formatRelative(r.ts)}</span>
            </span>
            <span>
              <RunStatusBadge status={r.status} />
            </span>
            <span>
              <code>{formatDuration(r.durationMs)}</code>
            </span>
            <span className="run-table__msg">
              {r.error ? (
                <span className="muted small">{r.error}</span>
              ) : r.delivery ? (
                <code className="muted small">{JSON.stringify(r.delivery)}</code>
              ) : (
                <span className="muted small">—</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const PayloadTab = ({ job }) => (
  <div className="detail-section">
    <h4 className="detail-section__title">Payload kind</h4>
    <p>
      <code>{job.payload?.kind}</code>
      <span className="muted small">
        {" "}
        · session target <code>{job.sessionTarget}</code> · wake <code>{job.wakeMode}</code>
      </span>
    </p>
    <h4 className="detail-section__title">Raw payload</h4>
    <pre className="json-block">{JSON.stringify(job.payload, null, 2)}</pre>
    {job.delivery && (
      <>
        <h4 className="detail-section__title">Delivery hint</h4>
        <pre className="json-block">{JSON.stringify(job.delivery, null, 2)}</pre>
      </>
    )}
  </div>
);

Object.assign(window, { JobDetail });
