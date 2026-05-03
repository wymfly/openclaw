/* deck-go threads prototype v2 — detail view */

function ThreadDetailView({
  thread,
  recentActivity,
  auditTrail,
  channelKindFromId,
  now,
  activeTab,
  onTabChange,
  onBack,
  onUnbind,
  onRebind,
  onRename,
  onOpenChat,
  onOpenRaw,
}) {
  if (!thread) return null;

  const channelKind = channelKindFromId(thread.channelId);
  const isStale = now - thread.lastActivityAt > 24 * 3600_000;

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "activity", label: "Recent activity" },
    { id: "audit", label: "Audit" },
    { id: "raw", label: "Raw entry" },
  ];

  return (
    <section className="detail-view" aria-label="Thread detail">
      <header className="detail-view__hero">
        <button type="button" className="back-btn" onClick={onBack}>
          <IconChevronLeft size={14} />
          <span>All bindings</span>
        </button>

        <div className="detail-view__hero-row">
          <ChannelTile channelKind={channelKind} channelId={thread.channelId} />
          <span className="hero-arrow" aria-hidden="true">
            <IconLink size={14} />
          </span>
          <span className="hero-agent">
            <span className="hero-agent__id">{thread.agentId}</span>
            <span className="hero-agent__session" title={thread.targetSessionKey}>
              {thread.targetSessionKey}
            </span>
          </span>
          <TargetKindPill kind={thread.targetKind} />
          {isStale && <span className="status-pill status-pill--warn">stale 24h+</span>}
        </div>

        <h1 className="detail-view__title">{thread.label ?? thread.threadId}</h1>
        <p className="detail-view__meta">
          <span title={new Date(thread.boundAt).toISOString()}>
            bound {relativeTime(thread.boundAt, now)}
          </span>
          <span aria-hidden>·</span>
          <span>last activity {relativeTime(thread.lastActivityAt, now)}</span>
          <span aria-hidden>·</span>
          <span>
            by <strong>{thread.boundBy}</strong>
          </span>
        </p>

        <div className="detail-view__actions">
          <button type="button" className="action-btn action-btn--primary" onClick={onOpenChat}>
            <IconChat size={12} />
            <span>Open chat</span>
            <IconArrowOut size={11} />
          </button>
          <button type="button" className="action-btn" onClick={onRename}>
            <IconTag size={12} />
            <span>Rename label</span>
          </button>
          <button type="button" className="action-btn" onClick={onRebind}>
            <IconLink size={12} />
            <span>Re-bind agent</span>
          </button>
          <button type="button" className="action-btn action-btn--danger" onClick={onUnbind}>
            <IconUnlink size={12} />
            <span>Unbind</span>
          </button>
          <button type="button" className="action-btn" onClick={onOpenRaw}>
            <IconAudit size={12} />
            <span>Raw entry</span>
          </button>
        </div>
      </header>

      <nav className="tab-bar" role="tablist" aria-label="Thread sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            className={`tab-bar__tab${activeTab === t.id ? " tab-bar__tab--on" : ""}`}
            onClick={() => onTabChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="detail-view__body">
        {activeTab === "overview" && (
          <OverviewTab thread={thread} channelKind={channelKind} now={now} />
        )}
        {activeTab === "activity" && (
          <ActivityTab events={recentActivity[thread.threadId] ?? []} now={now} />
        )}
        {activeTab === "audit" && <AuditTab events={auditTrail[thread.threadId] ?? []} now={now} />}
        {activeTab === "raw" && <RawTab thread={thread} />}
      </div>
    </section>
  );
}

function OverviewTab({ thread, channelKind, now }) {
  const meta = CHANNEL_META[channelKind] ?? { label: channelKind, tone: "iron" };
  const targetMeta = TARGET_KIND_META[thread.targetKind] ?? { label: thread.targetKind };

  return (
    <article className="card">
      <header className="card__head">
        <h3>Binding</h3>
      </header>
      <dl className="kv-grid">
        <div>
          <dt>Thread ID</dt>
          <dd className="mono">{thread.threadId}</dd>
        </div>
        <div>
          <dt>Channel</dt>
          <dd>
            {meta.label} <span className="dim">— {thread.channelId}</span>
          </dd>
        </div>
        <div>
          <dt>Account</dt>
          <dd>{thread.accountId}</dd>
        </div>
        <div>
          <dt>Agent</dt>
          <dd>{thread.agentId}</dd>
        </div>
        <div>
          <dt>Target session</dt>
          <dd className="mono">{thread.targetSessionKey}</dd>
        </div>
        <div>
          <dt>Target kind</dt>
          <dd>{targetMeta.label}</dd>
        </div>
        <div>
          <dt>Bound by</dt>
          <dd>{thread.boundBy}</dd>
        </div>
        <div>
          <dt>Bound at</dt>
          <dd>
            {formatAbsolute(thread.boundAt)}{" "}
            <span className="dim">({relativeTime(thread.boundAt, now)})</span>
          </dd>
        </div>
        <div>
          <dt>Last activity</dt>
          <dd>
            {formatAbsolute(thread.lastActivityAt)}{" "}
            <span className="dim">({relativeTime(thread.lastActivityAt, now)})</span>
          </dd>
        </div>
        <div>
          <dt>Label</dt>
          <dd>{thread.label ?? <span className="dim">(none)</span>}</dd>
        </div>
      </dl>

      <p className="card__note">
        <strong>Threads is a binding registry, not a transcript store.</strong> The conversation
        itself lives in the <code>Chat</code> panel for the linked agent + session — click{" "}
        <strong>Open chat</strong> to jump there. Recent activity below is a BFF projection of
        deck-go monitor events for this session.
      </p>
    </article>
  );
}

function ActivityTab({ events, now }) {
  if (events.length === 0) {
    return (
      <article className="card empty-card">
        <div className="empty-card__glyph">
          <IconActivity size={26} />
        </div>
        <h3>No recent activity projected.</h3>
        <p>The BFF activity projection is empty for this binding.</p>
      </article>
    );
  }
  return (
    <article className="card">
      <header className="card__head">
        <h3>Recent activity</h3>
        <span className="card__hint">BFF projection · DeckGoMonitorRunEvent</span>
      </header>
      <ul className="timeline" role="list">
        {events.map((e, i) => (
          <li key={i} className="timeline__row">
            <span className="timeline__time">{relativeTime(e.ts, now)}</span>
            <ActivityKindBadge kind={e.kind} />
            <span className="timeline__title">{e.title}</span>
            {e.note && <span className="timeline__note">{e.note}</span>}
          </li>
        ))}
      </ul>
    </article>
  );
}

function AuditTab({ events, now }) {
  if (events.length === 0) {
    return (
      <article className="card empty-card">
        <div className="empty-card__glyph">
          <IconAudit size={26} />
        </div>
        <h3>No audit entries.</h3>
        <p>This binding has no recorded mutations yet.</p>
      </article>
    );
  }
  return (
    <article className="card">
      <header className="card__head">
        <h3>Audit trail</h3>
        <span className="card__hint">BFF projection · mutation log</span>
      </header>
      <ul className="audit" role="list">
        {events.map((e, i) => (
          <li key={i} className="audit__row">
            <span className="audit__time">{relativeTime(e.ts, now)}</span>
            <span className="audit__action">{e.action}</span>
            <span className="audit__actor">{e.actor}</span>
            <span className="audit__note">{e.note}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function RawTab({ thread }) {
  return (
    <article className="card">
      <header className="card__head">
        <h3>Raw entry</h3>
        <span className="card__hint">DeckGoThreadEntry</span>
      </header>
      <pre className="raw-json">{JSON.stringify(thread, null, 2)}</pre>
    </article>
  );
}

Object.assign(window, { ThreadDetailView, OverviewTab, ActivityTab, AuditTab, RawTab });
