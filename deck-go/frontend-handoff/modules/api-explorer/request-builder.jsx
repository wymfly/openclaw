// RequestBuilder — center pane: method hero + tabs (params / headers /
// body / docs). Body uses plain textarea (future CodeMirror follow-up — see
// implementation-notes.md stack decision). Params tab shows schema-driven
// form when method has typed properties.

const REQUEST_TABS = [
  { id: "params", label: "Params" },
  { id: "headers", label: "Headers" },
  { id: "body", label: "Body" },
  { id: "docs", label: "Docs" },
];

const RequestBuilder = ({
  method,
  draft,
  onChange,
  onRun,
  running,
  bodyMode,
  onBodyMode,
  rawBody,
  onRawBody,
  bodyError,
  onUseSample,
}) => {
  const [tab, setTab] = React.useState("params");

  if (!method) {
    return (
      <div className="request-builder__empty">
        <IconCode />
        <p>Pick a method on the left to start building a request.</p>
      </div>
    );
  }

  const propEntries = Object.entries(method.params.properties || {});
  const requiredSet = new Set(method.params.required || []);

  return (
    <div className="request-builder">
      <header className="request-builder__hero">
        <div className="request-builder__hero-top">
          <KindBadge kind={method.kind} />
          <ScopeBadge scope={method.scope} />
          <code className="request-builder__name">{method.name}</code>
        </div>
        <p className="request-builder__desc">{method.description}</p>
        <div className="request-builder__hero-actions">
          <button
            className={`btn btn--primary ${running ? "btn--running" : ""}`}
            onClick={onRun}
            disabled={running || !!bodyError}
          >
            {running ? (
              <>
                <Spinner />
                Running…
              </>
            ) : (
              <>
                <IconPlay />
                Run
              </>
            )}
          </button>
          <button className="btn btn--ghost" onClick={onUseSample} disabled={running}>
            Use sample
          </button>
          <button className="btn btn--ghost" disabled={running}>
            <IconBookmark />
            Save preset
          </button>
        </div>
      </header>

      <nav className="request-builder__tabs">
        {REQUEST_TABS.map((t) => (
          <button
            key={t.id}
            className={`request-tab ${tab === t.id ? "request-tab--on" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === "body" && bodyError && <span className="request-tab__err-dot" />}
          </button>
        ))}
      </nav>

      <div className="request-builder__tab-body">
        {tab === "params" && (
          <ParamsTab
            entries={propEntries}
            requiredSet={requiredSet}
            draft={draft}
            onChange={onChange}
          />
        )}
        {tab === "headers" && <HeadersTab method={method} />}
        {tab === "body" && (
          <BodyTab
            method={method}
            mode={bodyMode}
            onMode={onBodyMode}
            rawBody={rawBody}
            onRawBody={onRawBody}
            bodyError={bodyError}
            draft={draft}
          />
        )}
        {tab === "docs" && <DocsTab method={method} />}
      </div>
    </div>
  );
};

// ---- ParamsTab (schema-driven form) ------------------------------------

const ParamsTab = ({ entries, requiredSet, draft, onChange }) => {
  if (entries.length === 0) {
    return (
      <div className="form-empty">
        <p className="muted">No parameters — this method takes an empty payload.</p>
      </div>
    );
  }
  return (
    <div className="param-form">
      {entries.map(([name, schema]) => (
        <ParamField
          key={name}
          name={name}
          schema={schema}
          required={requiredSet.has(name)}
          value={draft[name]}
          onChange={(v) => onChange({ ...draft, [name]: v })}
        />
      ))}
    </div>
  );
};

const ParamField = ({ name, schema, required, value, onChange }) => {
  const inputId = `param-${name}`;
  const renderInput = () => {
    if (schema.type === "boolean") {
      return (
        <label className="param-bool">
          <input
            id={inputId}
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>{value ? "true" : "false"}</span>
        </label>
      );
    }
    if (schema.enum) {
      return (
        <select id={inputId} value={value || ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {schema.enum.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }
    if (schema.type === "integer" || schema.type === "number") {
      return (
        <input
          id={inputId}
          type="number"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          placeholder={schema.default !== undefined ? `default ${schema.default}` : ""}
          min={schema.minimum}
          max={schema.maximum}
        />
      );
    }
    if (schema.type === "array") {
      const arr = Array.isArray(value) ? value : [];
      return (
        <ArrayInput
          id={inputId}
          items={arr}
          onChange={onChange}
          placeholder={schema.items?.description || "value"}
        />
      );
    }
    if (schema.type === "object") {
      return (
        <textarea
          id={inputId}
          className="param-json"
          value={value ? JSON.stringify(value, null, 2) : ""}
          onChange={(e) => {
            try {
              onChange(JSON.parse(e.target.value));
            } catch {
              /* hold last valid; production: surface inline */
            }
          }}
          rows={4}
          placeholder="JSON object"
        />
      );
    }
    return (
      <input
        id={inputId}
        type="text"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        placeholder={schema.format || "string"}
      />
    );
  };
  return (
    <div className="param-field">
      <label htmlFor={inputId} className="param-field__label">
        <code>{name}</code>
        <span className="param-field__type">
          {schema.type}
          {schema.nullable ? "?" : ""}
        </span>
        {required && <span className="param-field__required">required</span>}
      </label>
      {renderInput()}
      {schema.description && <span className="param-field__hint">{schema.description}</span>}
    </div>
  );
};

const ArrayInput = ({ id, items, onChange, placeholder }) => {
  return (
    <div className="array-input">
      {items.map((v, i) => (
        <div key={i} className="array-input__row">
          <input
            type="text"
            value={typeof v === "object" ? JSON.stringify(v) : v}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
            placeholder={placeholder}
          />
          <button
            type="button"
            className="array-input__remove"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            aria-label="Remove item"
          >
            <IconMinus />
          </button>
        </div>
      ))}
      <button type="button" className="array-input__add" onClick={() => onChange([...items, ""])}>
        <IconPlus />
        Add item
      </button>
    </div>
  );
};

// ---- HeadersTab --------------------------------------------------------

const STANDARD_HEADERS = [
  { name: "X-Deck-Trace", value: "(auto-generated per request)", readonly: true },
  {
    name: "X-Deck-Scope",
    value: "operator.read | operator.write | operator.admin",
    readonly: true,
  },
  { name: "Authorization", value: "Bearer <session-token from cookie>", readonly: true },
  { name: "Content-Type", value: "application/json", readonly: true },
];

const HeadersTab = ({ method }) => (
  <div className="headers-tab">
    <p className="muted small">
      The Gateway transport injects auth + scope + trace headers automatically. Browser code cannot
      override these — listed here for reference only.
    </p>
    <table className="headers-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        {STANDARD_HEADERS.map((h) => (
          <tr key={h.name}>
            <td>
              <code>{h.name}</code>
            </td>
            <td className="muted">{h.value}</td>
          </tr>
        ))}
        <tr>
          <td>
            <code>X-Deck-Required-Scope</code>
          </td>
          <td>
            <ScopeBadge scope={method.scope} />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
);

// ---- BodyTab -----------------------------------------------------------

const BodyTab = ({ method, mode, onMode, rawBody, onRawBody, bodyError, draft }) => {
  const formattedFromForm = React.useMemo(() => {
    try {
      return JSON.stringify(draft, null, 2);
    } catch {
      return "{}";
    }
  }, [draft]);

  return (
    <div className="body-tab">
      <div className="body-tab__head">
        <div className="seg-filter seg-filter--sm">
          <button
            className={`seg-filter__btn ${mode === "form" ? "seg-filter__btn--on" : ""}`}
            onClick={() => onMode("form")}
          >
            Form-derived
          </button>
          <button
            className={`seg-filter__btn ${mode === "raw" ? "seg-filter__btn--on" : ""}`}
            onClick={() => onMode("raw")}
          >
            Raw JSON
          </button>
        </div>
        <span className="muted small">
          {formatBytes(new Blob([mode === "raw" ? rawBody : formattedFromForm]).size)}
        </span>
      </div>
      {mode === "form" ? (
        <HighlightedJson value={formattedFromForm} maxHeight={420} />
      ) : (
        <textarea
          className={`body-textarea ${bodyError ? "body-textarea--err" : ""}`}
          value={rawBody}
          onChange={(e) => onRawBody(e.target.value)}
          spellCheck={false}
          rows={20}
          placeholder='{ "key": "value" }'
        />
      )}
      {bodyError && <span className="body-tab__error">{bodyError}</span>}
    </div>
  );
};

// ---- DocsTab -----------------------------------------------------------

const DocsTab = ({ method }) => (
  <div className="docs-tab">
    <section className="docs-section">
      <h4>Description</h4>
      <p>{method.description}</p>
    </section>
    <section className="docs-section">
      <h4>Parameters</h4>
      {Object.entries(method.params.properties || {}).length === 0 ? (
        <p className="muted">No parameters.</p>
      ) : (
        Object.entries(method.params.properties).map(([name, schema]) => (
          <ParamRow
            key={name}
            name={name}
            schema={schema}
            required={(method.params.required || []).includes(name)}
          />
        ))
      )}
    </section>
    <section className="docs-section">
      <h4>Result</h4>
      <code className="result-type">{method.result}</code>
    </section>
    <section className="docs-section">
      <h4>Required scope</h4>
      <ScopeBadge scope={method.scope} />
    </section>
    <section className="docs-section">
      <h4>Sample params</h4>
      <HighlightedJson value={method.sample} maxHeight={240} />
    </section>
  </div>
);

const Spinner = () => (
  <span className="spinner" aria-hidden="true">
    <svg width="14" height="14" viewBox="0 0 24 24">
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="40 60"
      />
    </svg>
  </span>
);

Object.assign(window, { RequestBuilder, Spinner });
