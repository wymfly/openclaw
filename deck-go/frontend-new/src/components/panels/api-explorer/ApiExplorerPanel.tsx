import { useEffect, useMemo, useState } from "react";
import type { DeckGoGatewayDescribeResponse } from "../../../api";
import { fetchGatewayDescribe } from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import {
  GatewayNotConfiguredEmptyState,
  gatewayNotConfiguredValue,
  isGatewayNotConfiguredValue,
} from "../../runtime/GatewayNotConfiguredEmptyState";
import { JsonDetails, ShellStat } from "../../shared/ShellComponents";

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
    <section className="deckgo-panel-workspace deck-ui-api-explorer">
      <div className="deckgo-column deck-ui-api-column">
        <article className="deckgo-card is-float deck-ui-api-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">{t("panelTitle")}</h2>
          </div>
          <p className="deckgo-card-subtitle">{t("panelDescription")}</p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-api-body">
            <div className="deckgo-pill-row deck-ui-api-status-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                {t("describeStatus", { state: t(loadState) })}
              </span>
              <span className="deckgo-pill">{t("methodsCount", { count: methods.length })}</span>
              <span className="deckgo-pill">{t("eventsCount", { count: events.length })}</span>
              <span className="deckgo-pill">{t("untypedCount", { count: untyped.length })}</span>
            </div>
            <div className="deckgo-grid deckgo-grid-3 deck-ui-api-stats">
              <ShellStat label={t("methodsLower")} value={methods.length} />
              <ShellStat label={t("eventsLower")} value={events.length} />
              <ShellStat label={t("untypedLower")} value={untyped.length} />
            </div>
            <div className="deckgo-pill-row deck-ui-api-actions">
              <button
                className={`deckgo-button deck-ui-api-button ${tab === "methods" ? "is-primary" : ""}`}
                type="button"
                onClick={() => setTab("methods")}
              >
                {t("methodsTab")}
              </button>
              <button
                className={`deckgo-button deck-ui-api-button ${tab === "events" ? "is-primary" : ""}`}
                type="button"
                onClick={() => setTab("events")}
              >
                {t("eventsTab")}
              </button>
              <button
                className="deckgo-button deck-ui-api-button"
                disabled={loadState === "loading"}
                type="button"
                onClick={() => setReloadNonce((current) => current + 1)}
              >
                {loadState === "loading" ? t("loadingDescribe") : t("refreshDescribe")}
              </button>
            </div>
            {gatewayNotConfigured ? (
              <GatewayNotConfiguredEmptyState className="deck-ui-api-surface" />
            ) : error ? (
              <p className="deckgo-note">{error}</p>
            ) : null}
            {gatewayNotConfigured ? null : tab === "methods" ? (
              <>
                <label className="deckgo-label">
                  <span>{t("searchMethods")}</span>
                  <input
                    className="deckgo-input deck-ui-api-input"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t("methodSearchPlaceholder")}
                  />
                </label>
                <div className="deckgo-shell-list deck-ui-api-domain-list">
                  {Object.entries(groupedMethods).length === 0 ? (
                    <p className="deckgo-note">{t("noMethodsMatchCurrentSearch")}</p>
                  ) : (
                    Object.entries(groupedMethods).map(([domain, items]) => (
                      <div className="deck-ui-api-domain" key={domain}>
                        <p className="deckgo-kicker deck-ui-api-domain-title">
                          {domain} ({items.length})
                        </p>
                        <ul className="deckgo-shell-list deck-ui-api-method-list">
                          {items.map((method) => (
                            <li key={method.name}>
                              <button
                                type="button"
                                className={`deckgo-selectable-card deck-ui-api-row ${selectedMethod?.name === method.name ? "is-selected" : ""}`}
                                onClick={() => setSelectedMethodName(method.name)}
                              >
                                <strong>{method.name}</strong>
                                <div className="deckgo-meta">
                                  {t("methodMeta", {
                                    scope: method.scope,
                                    since: method.since ?? t("na"),
                                  })}
                                </div>
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
              <ul className="deckgo-shell-list deck-ui-api-event-list">
                {events.length === 0 ? (
                  <p className="deckgo-note">{t("noEventsDescribed")}</p>
                ) : (
                  events.map((event) => (
                    <li key={event.name}>
                      <div className="deckgo-selectable-card deck-ui-api-row deck-ui-api-event-row">
                        <strong>{event.name}</strong>
                        <div className="deckgo-meta">
                          {t("sinceMeta", { since: event.since ?? t("na") })}
                        </div>
                        <SchemaSection title={t("eventPayload")} schema={event.payload} />
                      </div>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </article>
      </div>

      <div className="deckgo-column deckgo-panel-main deck-ui-api-column deck-ui-api-detail-column">
        <article className="deckgo-card is-float deck-ui-api-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">{t("selectedMethod")}</h2>
          </div>
          <p className="deckgo-card-subtitle">{t("selectedMethodDescription")}</p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-api-body">
            {selectedMethod ? (
              <>
                <div className="deckgo-panel-hero-strip deck-ui-api-hero">
                  <div>
                    <p className="deckgo-kicker">{t("method")}</p>
                    <strong>{selectedMethod.name}</strong>
                    <p className="deckgo-note">{t("scopeMeta", { scope: selectedMethod.scope })}</p>
                  </div>
                  <div className="deckgo-pill-row">
                    <span className="deckgo-pill">
                      {t("sinceValue", { since: selectedMethod.since ?? t("na") })}
                    </span>
                  </div>
                </div>
                <div className="deckgo-grid deckgo-grid-2 deck-ui-api-detail-stats">
                  <ShellStat label={t("scope")} value={selectedMethod.scope} />
                  <ShellStat label={t("since")} value={selectedMethod.since ?? t("na")} />
                </div>
                <SchemaSection title={t("paramsSchemaTitle")} schema={selectedMethod.params} />
                <SchemaSection title={t("resultSchemaTitle")} schema={selectedMethod.result} />
              </>
            ) : (
              <p className="deckgo-note">{t("chooseMethod")}</p>
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
    <div className="deckgo-surface-tile deck-ui-api-surface">
      <p className="deckgo-surface-label">{title}</p>
      {schema ? (
        <SchemaViewer schema={schema} />
      ) : (
        <p className="deckgo-note">{t("noSchemaDescribed")}</p>
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
    <div className={`deck-ui-api-schema ${depth > 0 ? "is-nested" : ""}`}>
      <div className="deckgo-pill-row deck-ui-api-schema-pills">
        <span className="deckgo-pill">{t("typeMeta", { type })}</span>
        {enumValues.length > 0 ? (
          <span className="deckgo-pill">{t("enumMeta", { values: enumValues.join(", ") })}</span>
        ) : null}
      </div>
      {properties.length > 0 && depth < MAX_SCHEMA_DEPTH ? (
        <ul className="deckgo-shell-list deck-ui-api-schema-list">
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
        <div className="deck-ui-api-array-items">
          <p className="deckgo-kicker">{t("items")}</p>
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
      <div className="deckgo-schema-row deck-ui-api-schema-row">
        {hasChildren ? (
          <button
            aria-label={t(expanded ? "collapseSchema" : "expandSchema", { name })}
            className="deckgo-schema-toggle deck-ui-api-toggle"
            type="button"
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? "v" : ">"}
          </button>
        ) : (
          <span
            className="deckgo-schema-toggle-placeholder deck-ui-api-toggle-placeholder"
            aria-hidden="true"
          />
        )}
        <div className="deck-ui-api-schema-body">
          <p className="deckgo-kicker">
            {name}
            {required ? ` ${t("required")}` : ""}
          </p>
          <div className="deckgo-pill-row deck-ui-api-schema-pills">
            <span className="deckgo-pill">
              {t("typeMeta", { type: schemaType(propertySchema) })}
            </span>
            {enumValues.length > 0 ? (
              <span className="deckgo-pill">
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
