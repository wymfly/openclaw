// session-detail.jsx — right-side detail drawer for the selected session.
//
// Lazy-loads logs + timeseries + context-weight via simulated API. The drawer
// has 4 tabs: Overview / Timeseries / Context / Logs.

const { useEffect: useEffectDetail, useState: useStateDetail } = React;

const DETAIL_TABS = [
  { id: "overview", label: "Overview", icon: IconLayer },
  { id: "timeseries", label: "Timeseries", icon: IconChart },
  { id: "context", label: "Context", icon: IconBrain },
  { id: "logs", label: "Logs", icon: IconActivity },
];

function SessionDetail({
  session,
  agentLabels,
  channelLabels,
  modelLabels,
  providerLabels,
  onClose,
}) {
  const [tab, setTab] = useStateDetail("overview");
  const [phase, setPhase] = useStateDetail("idle"); // idle | loading | ready | error
  const [logs, setLogs] = useStateDetail(null);
  const [timeseries, setTimeseries] = useStateDetail(null);

  useEffectDetail(() => {
    if (!session) return;
    setPhase("loading");
    setLogs(null);
    setTimeseries(null);
    const t = setTimeout(
      () => {
        // 5% simulated error to exercise the error path.
        if (Math.random() < 0.05) {
          setPhase("error");
          return;
        }
        setLogs(window.USAGE_SESSION_LOGS_BY_KEY[session.key] || { logs: [] });
        setTimeseries(window.USAGE_SESSION_TIMESERIES_BY_KEY[session.key] || null);
        setPhase("ready");
      },
      360 + Math.random() * 320,
    );
    return () => clearTimeout(t);
  }, [session]);

  if (!session) {
    return (
      <aside className="session-detail session-detail--empty">
        <header className="session-detail__head">
          <h2>Session detail</h2>
        </header>
        <div className="session-detail__placeholder">
          <IconLayer size={28} />
          <strong>Pick a session</strong>
          <span>Click a row in the table to inspect logs, context-weight, and timeseries.</span>
        </div>
      </aside>
    );
  }

  const u = session.usage || {};
  const ctx = session.contextWeight || null;

  return (
    <aside className="session-detail" aria-label={`Session ${session.label || session.key}`}>
      <header className="session-detail__head">
        <div className="session-detail__title-block">
          <span className="session-detail__eyebrow">Session detail</span>
          <h2 className="session-detail__title">
            {session.label || session.sessionId || session.key}
          </h2>
          <div className="session-detail__meta">
            <code>{session.sessionId || session.key}</code>
            <span>·</span>
            <AgentChip
              agentId={session.agentId}
              label={agentLabels[session.agentId] || session.agentId}
            />
            <span>·</span>
            <ChannelChip
              channel={session.channel}
              label={channelLabels[session.channel] || session.channel}
            />
            <span>·</span>
            <span>{formatRelative(session.updatedAt)}</span>
          </div>
        </div>
        <button
          className="session-detail__close ds-icon-btn"
          onClick={onClose}
          aria-label="Close session detail"
        >
          <IconClose size={14} />
        </button>
      </header>

      <div className="session-detail__tabs" role="tablist" aria-label="Session detail tabs">
        {DETAIL_TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`session-detail__tab ${tab === t.id ? "session-detail__tab--on" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <t.icon size={13} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="session-detail__body">
        {phase === "loading" ? (
          <div className="session-detail__loader">
            <span className="spinner" /> Loading…
          </div>
        ) : phase === "error" ? (
          <div className="session-detail__error" role="alert">
            <IconAlert size={14} />
            <strong>Could not load session detail.</strong>
            <button className="ds-btn ds-btn--ghost" onClick={() => setTab("overview")}>
              Retry
            </button>
          </div>
        ) : tab === "overview" ? (
          <SessionOverviewTab
            session={session}
            usage={u}
            ctx={ctx}
            timeseries={timeseries}
            modelLabels={modelLabels}
            providerLabels={providerLabels}
          />
        ) : tab === "timeseries" ? (
          <SessionTimeseriesTab timeseries={timeseries} />
        ) : tab === "context" ? (
          <SessionContextTab ctx={ctx} />
        ) : (
          <SessionLogsTab logs={logs} />
        )}
      </div>
    </aside>
  );
}

function SessionOverviewTab({ session, usage, ctx, timeseries, modelLabels, providerLabels }) {
  return (
    <div className="session-detail__section">
      <div className="session-detail__kpi-grid">
        <div className="kpi-cell">
          <span className="kpi-cell__lbl">Tokens in</span>
          <strong>{formatTokens(usage.input)}</strong>
        </div>
        <div className="kpi-cell">
          <span className="kpi-cell__lbl">Tokens out</span>
          <strong>{formatTokens(usage.output)}</strong>
        </div>
        <div className="kpi-cell">
          <span className="kpi-cell__lbl">Total tokens</span>
          <strong>{formatTokens(usage.totalTokens)}</strong>
        </div>
        <div className="kpi-cell">
          <span className="kpi-cell__lbl">Total cost</span>
          <strong>{formatCost(usage.totalCost)}</strong>
        </div>
      </div>
      <dl className="session-detail__def">
        <div>
          <dt>Session id</dt>
          <dd>
            <code>{session.sessionId || session.key}</code>
          </dd>
        </div>
        <div>
          <dt>Agent</dt>
          <dd>{session.agentId ? <AgentChip agentId={session.agentId} /> : "—"}</dd>
        </div>
        <div>
          <dt>Channel</dt>
          <dd>{session.channel ? <ChannelChip channel={session.channel} /> : "—"}</dd>
        </div>
        <div>
          <dt>Provider</dt>
          <dd>
            {ctx?.provider ? (
              <ProviderPill
                provider={ctx.provider}
                label={providerLabels[ctx.provider] || ctx.provider}
              />
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div>
          <dt>Model</dt>
          <dd>{ctx?.model ? modelLabels[ctx.model] || ctx.model : "—"}</dd>
        </div>
        <div>
          <dt>Workspace</dt>
          <dd className="mono">{ctx?.workspaceDir || "—"}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{formatRelative(session.updatedAt)}</dd>
        </div>
        <div>
          <dt>Context source</dt>
          <dd>{ctx?.source || "(no report)"}</dd>
        </div>
      </dl>
      {timeseries ? (
        <div className="session-detail__sub">
          <SectionHeader title="Cost trajectory" hint="Cumulative cost over the session." />
          <AreaTrend
            tone="accent"
            points={timeseries.points.map((p) => ({
              x: p.timestamp,
              y: p.cumulativeCost,
              label: formatTime(p.timestamp),
            }))}
            width={640}
            height={160}
            labelFmt={(p) => `${formatTime(p.x)}: $${p.y.toFixed(2)}`}
          />
        </div>
      ) : null}
    </div>
  );
}

function SessionTimeseriesTab({ timeseries }) {
  if (!timeseries || !timeseries.points || timeseries.points.length === 0) {
    return (
      <div className="session-detail__section">
        <div className="empty-card">
          <IconChart size={20} />
          <strong>No timeseries available.</strong>
          <span>This session has not yielded enough data points.</span>
        </div>
      </div>
    );
  }
  return (
    <div className="session-detail__section">
      <SectionHeader
        title="Token throughput (stacked)"
        hint="Per-bucket input / output / cache-read tokens."
      />
      <StackedAreaTimeseries points={timeseries.points} width={640} height={220} />
      <ul className="stacked-legend" aria-label="Token throughput legend">
        <li>
          <span className="stacked-legend__sw stacked-legend__sw--input" /> Input
        </li>
        <li>
          <span className="stacked-legend__sw stacked-legend__sw--output" /> Output
        </li>
        <li>
          <span className="stacked-legend__sw stacked-legend__sw--cache" /> Cache-read
        </li>
      </ul>
      <div className="session-detail__sub">
        <SectionHeader title="Per-bucket" hint="Last 8 buckets" />
        <table className="session-detail__bucket-table">
          <thead>
            <tr>
              <th>Time</th>
              <th className="num">Input</th>
              <th className="num">Output</th>
              <th className="num">Cache R</th>
              <th className="num">Cache W</th>
              <th className="num">Total</th>
              <th className="num">Cost</th>
              <th className="num">Σ Tokens</th>
              <th className="num">Σ Cost</th>
            </tr>
          </thead>
          <tbody>
            {timeseries.points.map((p, i) => (
              <tr key={i}>
                <td className="mono">{formatTime(p.timestamp)}</td>
                <td className="num mono">{formatTokens(p.input)}</td>
                <td className="num mono">{formatTokens(p.output)}</td>
                <td className="num mono">{formatTokens(p.cacheRead)}</td>
                <td className="num mono">{formatTokens(p.cacheWrite)}</td>
                <td className="num mono">{formatTokens(p.totalTokens)}</td>
                <td className="num mono">{formatCost(p.cost)}</td>
                <td className="num mono">{formatTokens(p.cumulativeTokens)}</td>
                <td className="num mono">
                  <strong>{formatCost(p.cumulativeCost)}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SessionContextTab({ ctx }) {
  if (!ctx) {
    return (
      <div className="session-detail__section">
        <div className="empty-card">
          <IconBrain size={20} />
          <strong>No context-weight report.</strong>
          <span>This session is too short or pre-dates context tracing.</span>
        </div>
      </div>
    );
  }
  const sys = ctx.systemPrompt?.chars || 0;
  const sysProj = ctx.systemPrompt?.projectContextChars || 0;
  const sysOther = ctx.systemPrompt?.nonProjectContextChars || 0;
  const skillsTotal = ctx.skills?.promptChars || 0;
  const toolsList = ctx.tools?.listChars || 0;
  const toolsSchema = ctx.tools?.schemaChars || 0;
  const filesTotal = (ctx.injectedWorkspaceFiles || []).reduce(
    (sum, f) => sum + (f.injectedChars || 0),
    0,
  );
  const grandTotal = sys + skillsTotal + toolsList + toolsSchema + filesTotal;
  return (
    <div className="session-detail__section">
      <SectionHeader
        title="Context weight"
        hint={`Source: ${ctx.source} · ${formatRelative(ctx.generatedAt)} · total ${grandTotal.toLocaleString()} chars`}
      />
      <ContextWeightBar report={ctx} />
      <div className="session-detail__sub">
        <SectionHeader title="System prompt" hint={`${sys.toLocaleString()} chars`} />
        <dl className="session-detail__def">
          <div>
            <dt>Project context</dt>
            <dd>{sysProj.toLocaleString()} chars</dd>
          </div>
          <div>
            <dt>Non-project context</dt>
            <dd>{sysOther.toLocaleString()} chars</dd>
          </div>
        </dl>
      </div>
      <div className="session-detail__sub">
        <SectionHeader
          title="Skills"
          hint={`${(ctx.skills?.entries || []).length} active · ${skillsTotal.toLocaleString()} chars total`}
        />
        <table className="session-detail__inline-table">
          <thead>
            <tr>
              <th>Name</th>
              <th className="num">Chars</th>
            </tr>
          </thead>
          <tbody>
            {(ctx.skills?.entries || []).length === 0 ? (
              <tr>
                <td colSpan={2} className="td-empty">
                  No skills loaded.
                </td>
              </tr>
            ) : (
              (ctx.skills?.entries || []).map((s, i) => (
                <tr key={i}>
                  <td className="mono">{s.name}</td>
                  <td className="num mono">{(s.blockChars || 0).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="session-detail__sub">
        <SectionHeader
          title="Tools"
          hint={`${(ctx.tools?.entries || []).length} tools · list ${toolsList.toLocaleString()} chars + schemas ${toolsSchema.toLocaleString()} chars`}
        />
        <table className="session-detail__inline-table">
          <thead>
            <tr>
              <th>Name</th>
              <th className="num">Summary</th>
              <th className="num">Schema</th>
              <th className="num">Props</th>
            </tr>
          </thead>
          <tbody>
            {(ctx.tools?.entries || []).map((t, i) => (
              <tr key={i}>
                <td className="mono">{t.name}</td>
                <td className="num mono">{(t.summaryChars || 0).toLocaleString()}</td>
                <td className="num mono">{(t.schemaChars || 0).toLocaleString()}</td>
                <td className="num mono">{t.propertiesCount ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="session-detail__sub">
        <SectionHeader
          title="Injected workspace files"
          hint={`${(ctx.injectedWorkspaceFiles || []).length} files · ${filesTotal.toLocaleString()} chars`}
        />
        <table className="session-detail__inline-table">
          <thead>
            <tr>
              <th>File</th>
              <th className="num">Raw</th>
              <th className="num">Injected</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(ctx.injectedWorkspaceFiles || []).map((f, i) => (
              <tr key={i}>
                <td className="mono">{f.path}</td>
                <td className="num mono">{(f.rawChars || 0).toLocaleString()}</td>
                <td className="num mono">{(f.injectedChars || 0).toLocaleString()}</td>
                <td>
                  {f.missing ? (
                    <span className="td-tag td-tag--error">missing</span>
                  ) : f.truncated ? (
                    <span className="td-tag td-tag--warn">truncated</span>
                  ) : (
                    <span className="td-tag td-tag--ok">full</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SessionLogsTab({ logs }) {
  const list = logs?.logs || [];
  if (list.length === 0) {
    return (
      <div className="session-detail__section">
        <div className="empty-card">
          <IconActivity size={20} />
          <strong>No logs.</strong>
          <span>This session has not produced loggable events.</span>
        </div>
      </div>
    );
  }
  return (
    <div className="session-detail__section">
      <SectionHeader
        title={`Logs (${list.length})`}
        hint="In-memory; persists for the session lifetime."
      />
      <ol className="session-detail__logs">
        {list.map((l, i) => (
          <li key={i} className={`log-row log-row--${l.role}`}>
            <span className="log-row__ts mono">{formatTime(l.timestamp)}</span>
            <span className={`log-row__role log-row__role--${l.role}`}>{l.role}</span>
            <span className="log-row__content">{l.content}</span>
            <span className="log-row__metric mono">
              {formatTokens(l.tokens)} · {formatCost(l.cost)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function SectionHeader({ title, hint }) {
  return (
    <div className="ds-section-header">
      <h3>{title}</h3>
      {hint ? <span className="ds-section-header__hint">{hint}</span> : null}
    </div>
  );
}

Object.assign(window, { SessionDetail, SectionHeader });
