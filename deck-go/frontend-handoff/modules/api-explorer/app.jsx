// ApiExplorerApp — orchestrator: topbar + 3-pane (method tree / request /
// response) + collapsible history rail. Selected method id stays in URL
// hash; environment selector is a dropdown.

const findMethod = (catalog, name) => {
  for (const ns of catalog) {
    const m = ns.methods.find((x) => x.name === name);
    if (m) return m;
  }
  return null;
};

const buildDraftFromSchema = (schema) => {
  const draft = {};
  const props = schema.properties || {};
  for (const [name, p] of Object.entries(props)) {
    if (p.default !== undefined) draft[name] = p.default;
    else if (p.nullable) draft[name] = null;
    else draft[name] = p.type === "array" ? [] : p.type === "object" ? {} : "";
  }
  return draft;
};

const ApiExplorerApp = () => {
  const [selectedMethodName, setSelectedMethodName] = React.useState(() => {
    const hash = window.location.hash.replace("#/", "");
    return hash || "deck.agents.detail";
  });
  const [environment, setEnvironment] = React.useState("local");
  const [query, setQuery] = React.useState("");

  const method = findMethod(METHOD_CATALOG, selectedMethodName);

  const [draft, setDraft] = React.useState(() => (method ? { ...method.sample } : {}));
  const [bodyMode, setBodyMode] = React.useState("form");
  const [rawBody, setRawBody] = React.useState(() => JSON.stringify(method?.sample || {}, null, 2));
  const [bodyError, setBodyError] = React.useState(null);

  const [running, setRunning] = React.useState(false);
  const [response, setResponse] = React.useState(null);
  const [lastDurationMs, setLastDurationMs] = React.useState(null);

  const [history, setHistory] = React.useState(HISTORY);

  const [historyOpen, setHistoryOpen] = React.useState(true);
  const [copiedKey, setCopiedKey] = React.useState(null);

  React.useEffect(() => {
    if (selectedMethodName) {
      window.history.replaceState(null, "", `#/${selectedMethodName}`);
    }
  }, [selectedMethodName]);

  const handleSelectMethod = (name) => {
    if (name === selectedMethodName) return;
    setSelectedMethodName(name);
    const next = findMethod(METHOD_CATALOG, name);
    if (next) {
      const seeded = { ...next.sample };
      setDraft(seeded);
      setRawBody(JSON.stringify(seeded, null, 2));
      setBodyMode("form");
      setBodyError(null);
      setResponse(null);
      setLastDurationMs(null);
    }
  };

  const handleRawBody = (text) => {
    setRawBody(text);
    try {
      const parsed = JSON.parse(text);
      setBodyError(null);
      setDraft(parsed);
    } catch (e) {
      setBodyError(e.message);
    }
  };

  const handleUseSample = () => {
    if (!method) return;
    setDraft({ ...method.sample });
    setRawBody(JSON.stringify(method.sample, null, 2));
    setBodyError(null);
  };

  const handleRun = () => {
    if (!method || running || bodyError) return;
    setRunning(true);
    setResponse(null);
    const startedAt = Date.now();
    setTimeout(
      () => {
        const sample = SAMPLE_RESPONSES[method.name] || DEFAULT_SAMPLE_RESPONSE;
        const dur = Date.now() - startedAt;
        const resp = {
          statusCode: sample.statusCode,
          body: sample.body,
          headers: {
            ...sample.headers,
            "x-deck-trace": `trace-${Math.random().toString(36).slice(2, 10)}`,
          },
          success: sample.statusCode < 400,
        };
        setResponse(resp);
        setLastDurationMs(dur);
        setRunning(false);
        setHistory((curr) =>
          [
            {
              id: `hist-${Date.now().toString(36)}`,
              method: method.name,
              paramsPreview: pickShallow(draft, 3),
              statusCode: resp.statusCode,
              durationMs: dur,
              success: resp.success,
              at: new Date().toISOString(),
              env: environment,
            },
            ...curr,
          ].slice(0, 50),
        );
      },
      480 + Math.floor(Math.random() * 280),
    );
  };

  const handlePickHistory = (h) => {
    handleSelectMethod(h.method);
  };

  const handleCopy = (kind, resp) => {
    let payload;
    if (kind === "body") payload = JSON.stringify(resp.body, null, 2);
    else if (kind === "headers") {
      payload = Object.entries(resp.headers || {})
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");
    } else {
      payload = (resp.headers && resp.headers["x-deck-trace"]) || "—";
    }
    navigator.clipboard.writeText(payload).catch(() => {});
    setCopiedKey(kind);
    setTimeout(() => setCopiedKey(null), 1400);
  };

  const env = ENVIRONMENTS.find((e) => e.id === environment) || ENVIRONMENTS[0];

  return (
    <div className="api-explorer-shell">
      <header className="api-explorer-topbar">
        <div className="api-explorer-topbar__brand">
          <IconCode />
          <span>API Explorer</span>
          <span className="muted small">/ Gateway method catalog</span>
        </div>
        <div className="api-explorer-topbar__env">
          <IconNetwork />
          <select value={environment} onChange={(e) => setEnvironment(e.target.value)}>
            {ENVIRONMENTS.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
          <code className="muted small api-explorer-topbar__base">{env.base}</code>
        </div>
        <div className="api-explorer-topbar__actions">
          <button className="btn btn--ghost" title="Refresh catalog">
            <IconRefresh />
          </button>
        </div>
      </header>

      <main className="api-explorer-workspace">
        <aside className="api-explorer-workspace__tree">
          <MethodTree
            catalog={METHOD_CATALOG}
            selected={selectedMethodName}
            onSelect={handleSelectMethod}
            query={query}
            onQuery={setQuery}
          />
        </aside>
        <section className="api-explorer-workspace__builder">
          <RequestBuilder
            method={method}
            draft={draft}
            onChange={setDraft}
            onRun={handleRun}
            running={running}
            bodyMode={bodyMode}
            onBodyMode={setBodyMode}
            rawBody={rawBody}
            onRawBody={handleRawBody}
            bodyError={bodyError}
            onUseSample={handleUseSample}
          />
        </section>
        <section className="api-explorer-workspace__response">
          <ResponsePane
            response={response}
            running={running}
            lastDurationMs={lastDurationMs}
            copiedKey={copiedKey}
            onCopy={handleCopy}
          />
        </section>
        <HistoryRail
          history={history}
          onPick={handlePickHistory}
          open={historyOpen}
          onToggle={() => setHistoryOpen(!historyOpen)}
        />
      </main>

      <TweaksPanel />
    </div>
  );
};

function pickShallow(obj, n) {
  const out = {};
  let i = 0;
  for (const k of Object.keys(obj)) {
    if (i >= n) break;
    out[k] = obj[k];
    i++;
  }
  return out;
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<ApiExplorerApp />);
