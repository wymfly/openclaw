import { useEffect, useMemo, useState } from "react";
import type { DeckGoGatewayDescribeResponse } from "../../../api";
import { fetchGatewayDescribe } from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import {
  GatewayNotConfiguredEmptyState,
  gatewayNotConfiguredValue,
  isGatewayNotConfiguredValue,
} from "../../runtime/GatewayNotConfiguredEmptyState";
import { JsonDetails } from "../../shared/ShellComponents";
import "./api-explorer-panel.css";

type ExplorerTab = "methods" | "events";
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

type MethodDomainEntry = [domain: string, items: MethodInfo[]];
type SchemaRecord = Record<string, unknown>;

const MAX_SCHEMA_DEPTH = 4;

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

function schemaProperties(schema: SchemaRecord) {
  const properties = asSchemaRecord(schema.properties);
  if (!properties) {
    return [];
  }
  return Object.entries(properties)
    .map(([name, value]) => [name, asSchemaRecord(value) ?? { type: "any" }] as const)
    .toSorted(([left], [right]) => left.localeCompare(right));
}

function schemaRequired(schema: SchemaRecord) {
  return new Set(Array.isArray(schema.required) ? schema.required.map(String) : []);
}

function schemaEnum(schema: SchemaRecord) {
  return Array.isArray(schema.enum) ? schema.enum.map(String) : [];
}

function schemaType(schema: SchemaRecord) {
  const value = schema.type;
  if (Array.isArray(value)) {
    return value.map(String).join(" | ");
  }
  return typeof value === "string" ? value : "any";
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
  const [tab, setTab] = useState<ExplorerTab>("methods");
  const [search, setSearch] = useState("");
  const [selectedMethodName, setSelectedMethodName] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [error, setError] = useState("");

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
  }, [reloadNonce]);

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
        method.name.toLowerCase().includes(query) || method.scope.toLowerCase().includes(query),
    );
  }, [methods, search]);

  const groupedMethods = useMemo(() => groupMethodsByDomain(filteredMethods), [filteredMethods]);
  const selectedMethod =
    methods.find((method) => method.name === selectedMethodName) ?? methods[0] ?? null;
  const untyped = payload?.untyped ?? [];
  const gatewayNotConfigured = isGatewayNotConfiguredValue(error);

  return (
    <section className="api-explorer-panel" data-testid="api-explorer-panel">
      <header className="api-explorer-panel__header">
        <div className="api-explorer-panel__title-stack">
          <p className="api-explorer-panel__eyebrow">{t("method")}</p>
          <h2 className="api-explorer-panel__title">{t("panelTitle")}</h2>
          <p className="api-explorer-panel__description">{t("panelDescription")}</p>
        </div>
        <div className="api-explorer-panel__header-actions">
          <span
            className={`api-explorer-panel__pill ${loadState === "ready" ? "is-positive" : ""}`}
          >
            {t("describeStatus", { state: t(loadState) })}
          </span>
          <span className="api-explorer-panel__pill">
            {t("methodsCount", { count: methods.length })}
          </span>
          <span className="api-explorer-panel__pill">
            {t("eventsCount", { count: events.length })}
          </span>
          <span className="api-explorer-panel__pill">
            {t("untypedCount", { count: untyped.length })}
          </span>
        </div>
      </header>

      <div className="api-explorer-panel__workspace">
        <article className="api-explorer-panel__card">
          <div className="api-explorer-panel__card-head">
            <div>
              <p className="api-explorer-panel__eyebrow">{t("methodsTab")}</p>
              <h3 className="api-explorer-panel__card-title">{t("panelTitle")}</h3>
            </div>
            <span className="api-explorer-panel__pill">
              {tab === "methods" ? t("methodsTab") : t("eventsTab")}
            </span>
          </div>

          <div className="api-explorer-panel__body">
            <div className="api-explorer-panel__metrics">
              <ApiMetric
                label={t("methodsLower")}
                tone={loadState === "ready" ? "positive" : undefined}
                value={methods.length}
              />
              <ApiMetric label={t("eventsLower")} value={events.length} />
              <ApiMetric label={t("untypedLower")} value={untyped.length} />
            </div>

            <div className="api-explorer-panel__actions">
              <button
                className={`api-explorer-panel__button ${tab === "methods" ? "is-primary" : ""}`}
                type="button"
                onClick={() => setTab("methods")}
              >
                {t("methodsTab")}
              </button>
              <button
                className={`api-explorer-panel__button ${tab === "events" ? "is-primary" : ""}`}
                type="button"
                onClick={() => setTab("events")}
              >
                {t("eventsTab")}
              </button>
              <button
                className="api-explorer-panel__button"
                disabled={loadState === "loading"}
                type="button"
                onClick={() => setReloadNonce((current) => current + 1)}
              >
                {loadState === "loading" ? t("loadingDescribe") : t("refreshDescribe")}
              </button>
            </div>

            {gatewayNotConfigured ? (
              <GatewayNotConfiguredEmptyState className="api-explorer-panel__surface" />
            ) : error ? (
              <p className="api-explorer-panel__note is-error">{error}</p>
            ) : null}

            {gatewayNotConfigured ? null : tab === "methods" ? (
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
                <div className="api-explorer-panel__catalog">
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
                                type="button"
                                className={`api-explorer-panel__row ${selectedMethod?.name === method.name ? "is-selected" : ""}`}
                                onClick={() => setSelectedMethodName(method.name)}
                              >
                                <strong>{method.name}</strong>
                                <span className="api-explorer-panel__meta">
                                  {t("methodMeta", {
                                    scope: method.scope,
                                    since: method.since ?? t("na"),
                                  })}
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
                      <div className="api-explorer-panel__row api-explorer-panel__event-row">
                        <strong>{event.name}</strong>
                        <span className="api-explorer-panel__meta">
                          {t("sinceMeta", { since: event.since ?? t("na") })}
                        </span>
                        <SchemaSection title={t("eventPayload")} schema={event.payload} />
                      </div>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </article>

        <article className="api-explorer-panel__card">
          <div className="api-explorer-panel__card-head">
            <div>
              <p className="api-explorer-panel__eyebrow">{t("method")}</p>
              <h3 className="api-explorer-panel__card-title">{t("selectedMethod")}</h3>
            </div>
            {selectedMethod ? (
              <span className="api-explorer-panel__pill">
                {t("sinceValue", { since: selectedMethod.since ?? t("na") })}
              </span>
            ) : null}
          </div>

          <div className="api-explorer-panel__body">
            <p className="api-explorer-panel__description">{t("selectedMethodDescription")}</p>
            {selectedMethod ? (
              <>
                <div className="api-explorer-panel__hero">
                  <div>
                    <p className="api-explorer-panel__eyebrow">{t("method")}</p>
                    <strong>{selectedMethod.name}</strong>
                    <p className="api-explorer-panel__note">
                      {t("scopeMeta", { scope: selectedMethod.scope })}
                    </p>
                  </div>
                  <div className="api-explorer-panel__pill-row">
                    <span className="api-explorer-panel__pill">{t("paramsSchemaTitle")}</span>
                    <span className="api-explorer-panel__pill">{t("resultSchemaTitle")}</span>
                  </div>
                </div>
                <div className="api-explorer-panel__metrics is-two">
                  <ApiMetric label={t("scope")} value={selectedMethod.scope} />
                  <ApiMetric label={t("since")} value={selectedMethod.since ?? t("na")} />
                </div>
                <SchemaSection title={t("paramsSchemaTitle")} schema={selectedMethod.params} />
                <SchemaSection title={t("resultSchemaTitle")} schema={selectedMethod.result} />
              </>
            ) : (
              <p className="api-explorer-panel__note">{t("chooseMethod")}</p>
            )}
            {untyped.length > 0 ? (
              <JsonDetails title={t("untypedMethods")} payload={untyped} />
            ) : null}
          </div>
        </article>
      </div>
    </section>
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
