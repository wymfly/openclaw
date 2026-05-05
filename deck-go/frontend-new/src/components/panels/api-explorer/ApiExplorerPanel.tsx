import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DeckGoGatewayDescribeResponse, DeckGoGatewayInvokeResult } from "../../../api";
import { fetchGatewayDescribe, invokeGatewayMethod } from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import {
  GatewayNotConfiguredEmptyState,
  gatewayNotConfiguredValue,
  isGatewayNotConfiguredValue,
} from "../../runtime/GatewayNotConfiguredEmptyState";
import { JsonDetails } from "../../shared/ShellComponents";
import "./api-explorer-panel.css";

type ExplorerTab = "methods" | "events";
type BuilderTab = "params" | "body" | "headers" | "docs";
type ResponseTab = "body" | "headers" | "trace";
type BodyMode = "form" | "raw";
type PanelState = "idle" | "loading" | "ready";

type MethodInfo = {
  name: string;
  scope: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  since?: number;
};

type EventInfo = {
  name: string;
  payload?: Record<string, unknown>;
  since?: number;
};

type HistoryEntry = {
  at: string;
  durationMs: number;
  id: string;
  method: string;
  params: Record<string, unknown>;
  response: DeckGoGatewayInvokeResult;
};

type MethodDomainEntry = [domain: string, items: MethodInfo[]];
type SchemaRecord = Record<string, unknown>;

const MAX_SCHEMA_DEPTH = 4;
const DEFAULT_RUNTIME_ID = "rt_local";

function groupMethodsByDomain(methods: MethodInfo[]) {
  const groups: Record<string, MethodInfo[]> = {};
  for (const method of methods) {
    const dot = method.name.indexOf(".");
    const domain = dot > 0 ? method.name.slice(0, dot) : "other";
    (groups[domain] ??= []).push(method);
  }
  const sortedEntries = Object.entries(groups).toSorted(([left], [right]) =>
    left.localeCompare(right),
  ) as MethodDomainEntry[];
  return Object.fromEntries(
    sortedEntries.map(([domain, items]) => [
      domain,
      items.slice().toSorted((left, right) => left.name.localeCompare(right.name)),
    ]),
  ) as Record<string, MethodInfo[]>;
}

function asSchemaRecord(value: unknown): SchemaRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as SchemaRecord)
    : null;
}

function schemaProperties(schema: SchemaRecord | undefined) {
  if (!schema) {
    return [];
  }
  const properties = asSchemaRecord(schema.properties);
  if (!properties) {
    return [];
  }
  return Object.entries(properties)
    .map(([name, value]) => [name, asSchemaRecord(value) ?? { type: "any" }] as const)
    .toSorted(([left], [right]) => left.localeCompare(right));
}

function schemaRequired(schema: SchemaRecord | undefined) {
  return new Set(Array.isArray(schema?.required) ? schema.required.map(String) : []);
}

function schemaEnumValues(schema: SchemaRecord) {
  return Array.isArray(schema.enum) ? schema.enum : [];
}

function schemaEnum(schema: SchemaRecord) {
  return schemaEnumValues(schema).map(String);
}

function schemaType(schema: SchemaRecord | undefined) {
  const value = schema?.type;
  if (Array.isArray(value)) {
    return value.map(String).join(" | ");
  }
  return typeof value === "string" ? value : "object";
}

function schemaDescription(schema: SchemaRecord | undefined) {
  return typeof schema?.description === "string" ? schema.description : "";
}

function methodKind(method: MethodInfo) {
  if (method.name.includes("stream") || method.name.includes("subscribe")) {
    return "stream";
  }
  return method.scope.includes("read") ? "query" : "mutation";
}

function canRunMethod(method: MethodInfo | null) {
  if (!method) {
    return false;
  }
  return methodKind(method) === "query" && method.scope.includes("read");
}

function initialValueForSchema(schema: SchemaRecord | undefined): unknown {
  if (!schema) {
    return null;
  }
  if ("default" in schema) {
    return schema.default;
  }
  const enumValues = schemaEnumValues(schema);
  if (enumValues.length > 0) {
    return enumValues[0];
  }
  switch (schemaType(schema)) {
    case "array":
      return [];
    case "boolean":
      return false;
    case "integer":
    case "number":
      return 0;
    case "object":
      return buildDraftFromSchema(schema);
    case "string":
      return "";
    default:
      return null;
  }
}

function buildDraftFromSchema(schema: SchemaRecord | undefined): Record<string, unknown> {
  const entries = schemaProperties(schema);
  if (entries.length === 0) {
    return {};
  }
  return Object.fromEntries(
    entries.map(([name, property]) => [name, initialValueForSchema(property)]),
  );
}

function stringifyJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function parseJsonObject(value: string) {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("JSON body must be an object");
  }
  return parsed as Record<string, unknown>;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleTimeString();
}

function headersFromResult(result: DeckGoGatewayInvokeResult | null): Record<string, string> {
  if (!result) {
    return {};
  }
  return {
    ...result.headers,
    ...(result.requestId ? { "x-deck-request-id": result.requestId } : {}),
  };
}

function ApiMetric(props: { label: string; value: string | number; tone?: "positive" }) {
  return (
    <div className={`api-explorer-panel__metric ${props.tone ? `is-${props.tone}` : ""}`}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

export function ApiExplorerPanel() {
  const t = useTranslations("apiExplorer");
  const [payload, setPayload] = useState<DeckGoGatewayDescribeResponse | null>(null);
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [catalogTab, setCatalogTab] = useState<ExplorerTab>("methods");
  const [builderTab, setBuilderTab] = useState<BuilderTab>("params");
  const [responseTab, setResponseTab] = useState<ResponseTab>("body");
  const [bodyMode, setBodyMode] = useState<BodyMode>("form");
  const [search, setSearch] = useState("");
  const [selectedMethodName, setSelectedMethodName] = useState("");
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [rawBody, setRawBody] = useState("{}");
  const [bodyError, setBodyError] = useState("");
  const [running, setRunning] = useState(false);
  const [response, setResponse] = useState<DeckGoGatewayInvokeResult | null>(null);
  const [lastDurationMs, setLastDurationMs] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [copiedKey, setCopiedKey] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [error, setError] = useState("");
  const copyTimerRef = useRef<number | null>(null);
  const skipNextSeedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    void fetchGatewayDescribe()
      .then((next) => {
        if (cancelled) {
          return;
        }
        setPayload(next);
        setLoadState("ready");
        setError("");
        const firstMethod =
          Object.keys(next.methods ?? {})
            .slice()
            .toSorted((left, right) => left.localeCompare(right))[0] ?? "";
        setSelectedMethodName((current) =>
          current && next.methods && current in next.methods ? current : firstMethod,
        );
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }
        setLoadState("idle");
        setError(gatewayNotConfiguredValue(loadError, t("failedLoadDescribe")));
      });
    return () => {
      cancelled = true;
    };
  }, [reloadNonce, t]);

  useEffect(
    () => () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    },
    [],
  );

  const methods = useMemo<MethodInfo[]>(
    () =>
      Object.entries(payload?.methods ?? {})
        .map(([name, meta]) => ({
          name,
          scope: meta.scope || "unknown",
          params: meta.params,
          result: meta.result,
          since: meta.since,
        }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [payload],
  );

  const events = useMemo<EventInfo[]>(
    () =>
      Object.entries(payload?.events ?? {})
        .map(([name, meta]) => ({
          name,
          payload: meta.payload,
          since: meta.since,
        }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [payload],
  );

  const filteredMethods = useMemo(() => {
    if (!search.trim()) {
      return methods;
    }
    const query = search.trim().toLowerCase();
    return methods.filter(
      (method) =>
        method.name.toLowerCase().includes(query) ||
        method.scope.toLowerCase().includes(query) ||
        methodKind(method).includes(query),
    );
  }, [methods, search]);

  const groupedMethods = useMemo(() => groupMethodsByDomain(filteredMethods), [filteredMethods]);
  const selectedMethod =
    methods.find((method) => method.name === selectedMethodName) ?? methods[0] ?? null;
  const untyped = payload?.untyped ?? [];
  const gatewayNotConfigured = isGatewayNotConfiguredValue(error);
  const runAllowed = canRunMethod(selectedMethod);

  const seedMethodDraft = useCallback((method: MethodInfo | null) => {
    const nextDraft = buildDraftFromSchema(method?.params);
    setDraft(nextDraft);
    setRawBody(stringifyJson(nextDraft));
    setBodyError("");
    setResponse(null);
    setLastDurationMs(null);
    setBodyMode("form");
    setBuilderTab("params");
  }, []);

  useEffect(() => {
    if (skipNextSeedRef.current) {
      skipNextSeedRef.current = false;
      return;
    }
    seedMethodDraft(selectedMethod);
  }, [seedMethodDraft, selectedMethod?.name]);

  const selectMethod = (name: string) => {
    setSelectedMethodName(name);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#/${name}`);
    }
  };

  const updateDraft = (name: string, value: unknown) => {
    setDraft((current) => {
      const next = { ...current, [name]: value };
      if (bodyMode === "form") {
        setRawBody(stringifyJson(next));
      }
      return next;
    });
  };

  const updateRawBody = (value: string) => {
    setRawBody(value);
    try {
      const parsed = parseJsonObject(value);
      setDraft(parsed);
      setBodyError("");
    } catch (parseError) {
      setBodyError(parseError instanceof Error ? parseError.message : t("invalidJson"));
    }
  };

  const resetSample = () => seedMethodDraft(selectedMethod);

  const runSelectedMethod = async () => {
    if (!selectedMethod || running || !runAllowed) {
      return;
    }
    let params = draft;
    if (bodyMode === "raw") {
      try {
        params = parseJsonObject(rawBody);
        setBodyError("");
      } catch (parseError) {
        setBodyError(parseError instanceof Error ? parseError.message : t("invalidJson"));
        return;
      }
    }
    setRunning(true);
    setResponse(null);
    const started = performance.now();
    try {
      const result = await invokeGatewayMethod(selectedMethod.name, params, {
        runtimeId: DEFAULT_RUNTIME_ID,
        timeoutMs: 10_000,
      });
      const durationMs = Math.max(1, Math.round(performance.now() - started));
      setResponse(result);
      setLastDurationMs(durationMs);
      setResponseTab("body");
      setHistory((current) =>
        [
          {
            at: new Date().toISOString(),
            durationMs,
            id: `${Date.now()}-${selectedMethod.name}`,
            method: selectedMethod.name,
            params,
            response: result,
          },
          ...current,
        ].slice(0, 50),
      );
    } finally {
      setRunning(false);
    }
  };

  const pickHistory = (entry: HistoryEntry) => {
    skipNextSeedRef.current = true;
    setSelectedMethodName(entry.method);
    setDraft(entry.params);
    setRawBody(stringifyJson(entry.params));
    setBodyError("");
    setResponse(entry.response);
    setLastDurationMs(entry.durationMs);
    setBuilderTab("body");
    setResponseTab("body");
  };

  const copyPayload = (kind: string, value: unknown) => {
    void navigator.clipboard?.writeText(typeof value === "string" ? value : stringifyJson(value));
    setCopiedKey(kind);
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => setCopiedKey(""), 1400);
  };

  return (
    <section className="api-explorer-panel" data-testid="api-explorer-panel">
      <header className="api-explorer-panel__topbar">
        <div className="api-explorer-panel__brand">
          <h1>{t("panelTitle")}</h1>
          <span>{t("subtitle")}</span>
        </div>
        <div className="api-explorer-panel__transport">
          <span>{t("runtime")}</span>
          <code>{DEFAULT_RUNTIME_ID}</code>
          <span>{t("transportRoute")}</span>
        </div>
        <div className="api-explorer-panel__topbar-actions">
          <span className={loadState === "ready" ? "is-positive" : ""}>
            {t("describeStatus", { state: t(loadState) })}
          </span>
          <button
            className="api-explorer-panel__button"
            disabled={loadState === "loading"}
            type="button"
            onClick={() => setReloadNonce((current) => current + 1)}
          >
            {loadState === "loading" ? t("loadingDescribe") : t("refreshDescribe")}
          </button>
        </div>
      </header>

      <main className="api-explorer-panel__workspace">
        <aside className="api-explorer-panel__tree">
          <div className="api-explorer-panel__metrics">
            <ApiMetric
              label={t("methodsLower")}
              tone={loadState === "ready" ? "positive" : undefined}
              value={methods.length}
            />
            <ApiMetric label={t("eventsLower")} value={events.length} />
            <ApiMetric label={t("untypedLower")} value={untyped.length} />
          </div>

          <div className="api-explorer-panel__tabs" role="tablist" aria-label={t("catalogTabs")}>
            <button
              className={catalogTab === "methods" ? "is-active" : ""}
              type="button"
              onClick={() => setCatalogTab("methods")}
            >
              {t("methodsTab")}
            </button>
            <button
              className={catalogTab === "events" ? "is-active" : ""}
              type="button"
              onClick={() => setCatalogTab("events")}
            >
              {t("eventsTab")}
            </button>
          </div>

          {gatewayNotConfigured ? (
            <GatewayNotConfiguredEmptyState className="api-explorer-panel__surface" />
          ) : error ? (
            <p className="api-explorer-panel__note is-error">{error}</p>
          ) : null}

          {gatewayNotConfigured ? null : catalogTab === "methods" ? (
            <>
              <label className="api-explorer-panel__field">
                <span>{t("searchMethods")}</span>
                <input
                  className="api-explorer-panel__input"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("methodSearchPlaceholder")}
                />
              </label>
              <div className="api-explorer-panel__catalog" role="tree">
                {Object.entries(groupedMethods).length === 0 ? (
                  <p className="api-explorer-panel__note">{t("noMethodsMatchCurrentSearch")}</p>
                ) : (
                  Object.entries(groupedMethods).map(([domain, items]) => (
                    <div className="api-explorer-panel__domain" key={domain}>
                      <p className="api-explorer-panel__eyebrow">
                        {domain} ({items.length})
                      </p>
                      <ul className="api-explorer-panel__list">
                        {items.map((method) => (
                          <li key={method.name}>
                            <button
                              aria-selected={selectedMethod?.name === method.name}
                              role="treeitem"
                              type="button"
                              className={`api-explorer-panel__method-row ${
                                selectedMethod?.name === method.name ? "is-selected" : ""
                              }`}
                              onClick={() => selectMethod(method.name)}
                            >
                              <strong>{method.name}</strong>
                              <span>
                                <KindBadge value={methodKind(method)} />
                                <ScopeBadge value={method.scope} />
                                {t("sinceValue", { since: method.since ?? t("na") })}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <ul className="api-explorer-panel__list">
              {events.length === 0 ? (
                <p className="api-explorer-panel__note">{t("noEventsDescribed")}</p>
              ) : (
                events.map((event) => (
                  <li key={event.name}>
                    <div className="api-explorer-panel__event-row">
                      <strong>{event.name}</strong>
                      <span>{t("sinceMeta", { since: event.since ?? t("na") })}</span>
                      <SchemaSection title={t("eventPayload")} schema={event.payload} />
                    </div>
                  </li>
                ))
              )}
            </ul>
          )}

          {untyped.length > 0 ? (
            <JsonDetails title={t("untypedMethods")} payload={untyped} />
          ) : null}
        </aside>

        <section className="api-explorer-panel__builder">
          <RequestBuilder
            bodyError={bodyError}
            bodyMode={bodyMode}
            builderTab={builderTab}
            canRun={runAllowed}
            draft={draft}
            method={selectedMethod}
            rawBody={rawBody}
            running={running}
            setBodyMode={setBodyMode}
            setBuilderTab={setBuilderTab}
            updateDraft={updateDraft}
            updateRawBody={updateRawBody}
            onResetSample={resetSample}
            onRun={() => void runSelectedMethod()}
          />
        </section>

        <section className="api-explorer-panel__response">
          <ResponsePane
            copiedKey={copiedKey}
            durationMs={lastDurationMs}
            response={response}
            responseTab={responseTab}
            running={running}
            setResponseTab={setResponseTab}
            onCopy={copyPayload}
          />
        </section>

        <HistoryRail
          history={history}
          open={historyOpen}
          onPick={pickHistory}
          onToggle={() => setHistoryOpen((current) => !current)}
        />
      </main>
    </section>
  );
}

function KindBadge({ value }: { value: string }) {
  return <span className={`api-explorer-panel__badge is-${value}`}>{value}</span>;
}

function ScopeBadge({ value }: { value: string }) {
  const tone = value.includes("admin") ? "admin" : value.includes("write") ? "write" : "read";
  return <span className={`api-explorer-panel__badge is-${tone}`}>{value}</span>;
}

function RequestBuilder({
  bodyError,
  bodyMode,
  builderTab,
  canRun,
  draft,
  method,
  rawBody,
  running,
  setBodyMode,
  setBuilderTab,
  updateDraft,
  updateRawBody,
  onResetSample,
  onRun,
}: {
  bodyError: string;
  bodyMode: BodyMode;
  builderTab: BuilderTab;
  canRun: boolean;
  draft: Record<string, unknown>;
  method: MethodInfo | null;
  rawBody: string;
  running: boolean;
  setBodyMode: (mode: BodyMode) => void;
  setBuilderTab: (tab: BuilderTab) => void;
  updateDraft: (name: string, value: unknown) => void;
  updateRawBody: (value: string) => void;
  onResetSample: () => void;
  onRun: () => void;
}) {
  const t = useTranslations("apiExplorer");
  const properties = schemaProperties(method?.params);
  const required = schemaRequired(method?.params);

  if (!method) {
    return (
      <div className="api-explorer-panel__empty-center">
        <p>{t("chooseMethod")}</p>
      </div>
    );
  }

  return (
    <article className="api-explorer-panel__builder-card">
      <header className="api-explorer-panel__method-hero">
        <div>
          <p className="api-explorer-panel__eyebrow">{t("method")}</p>
          <h2>{method.name}</h2>
          <p>{t("scopeMeta", { scope: method.scope })}</p>
        </div>
        <div className="api-explorer-panel__hero-actions">
          <button
            className="api-explorer-panel__button is-primary"
            disabled={running || Boolean(bodyError) || !canRun}
            type="button"
            onClick={onRun}
          >
            {running ? t("running") : t("run")}
          </button>
          <button
            className="api-explorer-panel__button"
            disabled={running}
            type="button"
            onClick={onResetSample}
          >
            {t("useSample")}
          </button>
        </div>
      </header>

      {!canRun ? <p className="api-explorer-panel__safe-note">{t("readOnlyRunOnly")}</p> : null}

      <div className="api-explorer-panel__tabs" role="tablist" aria-label={t("builderTabs")}>
        {(["params", "body", "headers", "docs"] as BuilderTab[]).map((tab) => (
          <button
            className={builderTab === tab ? "is-active" : ""}
            key={tab}
            type="button"
            onClick={() => setBuilderTab(tab)}
          >
            {t(`builderTab.${tab}`)}
            {tab === "body" && bodyError ? (
              <span className="api-explorer-panel__error-dot" />
            ) : null}
          </button>
        ))}
      </div>

      <div className="api-explorer-panel__builder-body">
        {builderTab === "params" ? (
          properties.length > 0 ? (
            <div className="api-explorer-panel__param-grid">
              {properties.map(([name, schema]) => (
                <ParamField
                  key={name}
                  name={name}
                  required={required.has(name)}
                  schema={schema}
                  value={draft[name]}
                  onChange={(value) => updateDraft(name, value)}
                />
              ))}
            </div>
          ) : (
            <p className="api-explorer-panel__note">{t("noParams")}</p>
          )
        ) : null}
        {builderTab === "body" ? (
          <div className="api-explorer-panel__body-editor">
            <div className="api-explorer-panel__segmented">
              <button
                className={bodyMode === "form" ? "is-active" : ""}
                type="button"
                onClick={() => {
                  setBodyMode("form");
                  updateRawBody(stringifyJson(draft));
                }}
              >
                {t("formMode")}
              </button>
              <button
                className={bodyMode === "raw" ? "is-active" : ""}
                type="button"
                onClick={() => setBodyMode("raw")}
              >
                {t("rawJsonMode")}
              </button>
            </div>
            <textarea
              value={rawBody}
              onChange={(event) => updateRawBody(event.target.value)}
              spellCheck={false}
            />
            {bodyError ? <p className="api-explorer-panel__note is-error">{bodyError}</p> : null}
          </div>
        ) : null}
        {builderTab === "headers" ? (
          <div className="api-explorer-panel__surface">
            <p className="api-explorer-panel__label">{t("headersReadonly")}</p>
            <p className="api-explorer-panel__note">{t("headersReadonlyDescription")}</p>
          </div>
        ) : null}
        {builderTab === "docs" ? (
          <>
            <SchemaSection title={t("paramsSchemaTitle")} schema={method.params} />
            <SchemaSection title={t("resultSchemaTitle")} schema={method.result} />
          </>
        ) : null}
      </div>
    </article>
  );
}

function ParamField({
  name,
  required,
  schema,
  value,
  onChange,
}: {
  name: string;
  required: boolean;
  schema: SchemaRecord;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const type = schemaType(schema);
  const enumValues = schemaEnumValues(schema);
  const selectedEnumIndex = enumValues.findIndex((item) => Object.is(item, value));

  return (
    <label className="api-explorer-panel__param">
      <span>
        <code>{name}</code>
        {required ? <em>required</em> : null}
      </span>
      {enumValues.length > 0 ? (
        <select
          value={selectedEnumIndex >= 0 ? String(selectedEnumIndex) : ""}
          onChange={(event) => onChange(enumValues[Number(event.target.value)])}
        >
          {enumValues.map((item, index) => (
            <option key={`${index}-${String(item)}`} value={index}>
              {String(item)}
            </option>
          ))}
        </select>
      ) : type === "boolean" ? (
        <input
          checked={Boolean(value)}
          type="checkbox"
          onChange={(event) => onChange(event.target.checked)}
        />
      ) : type === "number" || type === "integer" ? (
        <input
          type="number"
          value={typeof value === "number" ? value : ""}
          onChange={(event) =>
            onChange(event.target.value === "" ? null : Number(event.target.value))
          }
        />
      ) : type === "array" ? (
        <input
          value={Array.isArray(value) ? value.join(", ") : ""}
          onChange={(event) =>
            onChange(
              event.target.value
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
            )
          }
        />
      ) : type === "object" ? (
        <textarea
          rows={4}
          value={value && typeof value === "object" ? stringifyJson(value) : "{}"}
          onChange={(event) => {
            try {
              onChange(parseJsonObject(event.target.value));
            } catch {
              onChange(value);
            }
          }}
        />
      ) : (
        <input
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      <small>
        {type}
        {schemaDescription(schema) ? ` · ${schemaDescription(schema)}` : ""}
      </small>
    </label>
  );
}

function ResponsePane({
  copiedKey,
  durationMs,
  response,
  responseTab,
  running,
  setResponseTab,
  onCopy,
}: {
  copiedKey: string;
  durationMs: number | null;
  response: DeckGoGatewayInvokeResult | null;
  responseTab: ResponseTab;
  running: boolean;
  setResponseTab: (tab: ResponseTab) => void;
  onCopy: (kind: string, value: unknown) => void;
}) {
  const t = useTranslations("apiExplorer");
  const headers = headersFromResult(response);

  if (running) {
    return (
      <article className="api-explorer-panel__response-card">
        <div className="api-explorer-panel__response-head is-running">{t("running")}</div>
        <p className="api-explorer-panel__note">{t("awaitingResponse")}</p>
      </article>
    );
  }

  if (!response) {
    return (
      <article className="api-explorer-panel__response-card">
        <div className="api-explorer-panel__response-head">{t("noResponse")}</div>
        <p className="api-explorer-panel__note">{t("clickRunHint")}</p>
      </article>
    );
  }

  return (
    <article className="api-explorer-panel__response-card">
      <div className={`api-explorer-panel__response-head ${response.ok ? "is-ok" : "is-error"}`}>
        <strong>{response.statusCode}</strong>
        <span>{response.ok ? t("success") : response.error || t("failed")}</span>
        <em>{durationMs ? `${durationMs}ms` : t("na")}</em>
      </div>
      <div className="api-explorer-panel__tabs" role="tablist" aria-label={t("responseTabs")}>
        {(["body", "headers", "trace"] as ResponseTab[]).map((tab) => (
          <button
            className={responseTab === tab ? "is-active" : ""}
            key={tab}
            type="button"
            onClick={() => setResponseTab(tab)}
          >
            {t(`responseTab.${tab}`)}
          </button>
        ))}
        <button
          className="api-explorer-panel__copy"
          type="button"
          onClick={() =>
            onCopy(
              responseTab,
              responseTab === "body"
                ? response.body
                : responseTab === "headers"
                  ? headers
                  : response.requestId || headers["x-deck-trace"] || "",
            )
          }
        >
          {copiedKey === responseTab ? t("copied") : t("copy")}
        </button>
      </div>
      <div className="api-explorer-panel__response-body">
        {responseTab === "body" ? <JsonBlock value={response.body} /> : null}
        {responseTab === "headers" ? <JsonBlock value={headers} /> : null}
        {responseTab === "trace" ? (
          <div className="api-explorer-panel__trace">
            <span>{t("requestId")}</span>
            <code>{response.requestId || t("notAvailable")}</code>
            <span>{t("transportRoute")}</span>
            <code>/api/v1/runtimes/{DEFAULT_RUNTIME_ID}/gateway/rpc</code>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function HistoryRail({
  history,
  open,
  onPick,
  onToggle,
}: {
  history: HistoryEntry[];
  open: boolean;
  onPick: (entry: HistoryEntry) => void;
  onToggle: () => void;
}) {
  const t = useTranslations("apiExplorer");

  return (
    <aside className={`api-explorer-panel__history ${open ? "is-open" : "is-collapsed"}`}>
      <button className="api-explorer-panel__history-toggle" type="button" onClick={onToggle}>
        {open ? t("hideHistory") : t("showHistory")}
      </button>
      {open ? (
        <>
          <h3>{t("history")}</h3>
          {history.length === 0 ? (
            <p className="api-explorer-panel__note">{t("historyEmpty")}</p>
          ) : (
            <ul>
              {history.map((entry) => (
                <li key={entry.id}>
                  <button type="button" onClick={() => onPick(entry)}>
                    <strong>{entry.method}</strong>
                    <span>{entry.response.statusCode}</span>
                    <small>
                      {formatDate(entry.at)} · {entry.durationMs}ms
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </aside>
  );
}

function SchemaSection({ title, schema }: { title: string; schema?: Record<string, unknown> }) {
  const t = useTranslations("apiExplorer");

  return (
    <div className="api-explorer-panel__surface">
      <p className="api-explorer-panel__label">{title}</p>
      {schema ? (
        <SchemaViewer schema={schema} />
      ) : (
        <p className="api-explorer-panel__note">{t("noSchemaDescribed")}</p>
      )}
    </div>
  );
}

function SchemaViewer({ schema, depth = 0 }: { schema: SchemaRecord; depth?: number }) {
  const t = useTranslations("apiExplorer");
  const properties = schemaProperties(schema);
  const required = schemaRequired(schema);
  const enumValues = schemaEnum(schema);
  const arrayItems = asSchemaRecord(schema.items);
  const type = schemaType(schema);

  return (
    <div className={`api-explorer-panel__schema ${depth > 0 ? "is-nested" : ""}`}>
      <div className="api-explorer-panel__pill-row">
        <span className="api-explorer-panel__pill">{t("typeMeta", { type })}</span>
        {enumValues.length > 0 ? (
          <span className="api-explorer-panel__pill">
            {t("enumMeta", { values: enumValues.join(", ") })}
          </span>
        ) : null}
      </div>
      {properties.length > 0 && depth < MAX_SCHEMA_DEPTH ? (
        <ul className="api-explorer-panel__list api-explorer-panel__schema-list">
          {properties.map(([name, propertySchema]) => (
            <SchemaPropertyRow
              depth={depth}
              key={name}
              name={name}
              propertySchema={propertySchema}
              required={required.has(name)}
            />
          ))}
        </ul>
      ) : null}
      {arrayItems && depth < MAX_SCHEMA_DEPTH ? (
        <div className="api-explorer-panel__array-items">
          <p className="api-explorer-panel__eyebrow">{t("items")}</p>
          <SchemaViewer schema={arrayItems} depth={depth + 1} />
        </div>
      ) : null}
    </div>
  );
}

function SchemaPropertyRow({
  depth,
  name,
  propertySchema,
  required,
}: {
  depth: number;
  name: string;
  propertySchema: SchemaRecord;
  required: boolean;
}) {
  const t = useTranslations("apiExplorer");
  const childProperties = schemaProperties(propertySchema);
  const childItems = asSchemaRecord(propertySchema.items);
  const hasChildren = childProperties.length > 0 || Boolean(childItems);
  const [expanded, setExpanded] = useState(depth < 1);
  const enumValues = schemaEnum(propertySchema);

  return (
    <li>
      <div className="api-explorer-panel__schema-row">
        {hasChildren ? (
          <button
            aria-label={t(expanded ? "collapseSchema" : "expandSchema", { name })}
            className="api-explorer-panel__schema-toggle"
            type="button"
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? "v" : ">"}
          </button>
        ) : (
          <span className="api-explorer-panel__schema-toggle-placeholder" aria-hidden="true" />
        )}
        <div className="api-explorer-panel__schema-body">
          <p className="api-explorer-panel__eyebrow">
            {name}
            {required ? ` ${t("required")}` : ""}
          </p>
          <div className="api-explorer-panel__pill-row">
            <span className="api-explorer-panel__pill">
              {t("typeMeta", { type: schemaType(propertySchema) })}
            </span>
            {enumValues.length > 0 ? (
              <span className="api-explorer-panel__pill">
                {t("enumMeta", { values: enumValues.join(", ") })}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      {hasChildren && expanded ? <SchemaViewer schema={propertySchema} depth={depth + 1} /> : null}
    </li>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  return <pre className="api-explorer-panel__json">{stringifyJson(value)}</pre>;
}
