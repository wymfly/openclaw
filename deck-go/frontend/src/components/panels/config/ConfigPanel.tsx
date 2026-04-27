import { useEffect, useMemo, useState } from "react";
import type {
  DeckGoConfigLookupChild,
  DeckGoConfigLookupResponse,
  DeckGoConfigSnapshotResponse,
} from "../../../api";
import { applyDeckConfig, fetchDeckConfig, lookupConfigPath } from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import { computeConfigDiff, type DiffEntry } from "../../../lib/config-diff";
import { JsonDetails, ShellStat } from "../../shared/ShellComponents";

type PanelState = "idle" | "loading" | "ready";
type StructuredFieldKind = "boolean" | "enum" | "number" | "string" | "readonly";

type StructuredEnumOption = {
  inputValue: string;
  label: string;
  value: unknown;
};

type ConfigConflictPreview = {
  entries: DiffEntry[];
  message: string;
  remoteHash: string;
  remoteRaw: string;
};

function summarizeTopLevelKeys(rawConfig: string) {
  try {
    const parsed = parseRawConfig(rawConfig);
    if (parsed && typeof parsed === "object") {
      return Object.keys(parsed as Record<string, unknown>).toSorted((left, right) =>
        left.localeCompare(right),
      );
    }
  } catch {
    return [];
  }
  return [];
}

function parseRawConfig(rawConfig: string): unknown {
  try {
    return JSON.parse(rawConfig) as unknown;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRawConfigRecord(rawConfig: string): Record<string, unknown> | null {
  const parsed = parseRawConfig(rawConfig);
  return isRecord(parsed) ? parsed : null;
}

function snapshotRawConfig(snapshot: DeckGoConfigSnapshotResponse) {
  return typeof snapshot.raw === "string"
    ? snapshot.raw
    : JSON.stringify(snapshot.config ?? {}, null, 2);
}

function readConfigPath(config: unknown, path: string) {
  if (!path) {
    return config;
  }
  let current = config;
  for (const part of path.split(".")) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function writeConfigPath(config: unknown, path: string, value: unknown) {
  const parts = path.split(".").filter((part) => part.length > 0);
  if (parts.length === 0) {
    return value;
  }
  const root: Record<string, unknown> = isRecord(config) ? { ...config } : {};
  let current = root;
  for (const part of parts.slice(0, -1)) {
    const nextValue = current[part];
    const next = isRecord(nextValue) ? { ...nextValue } : {};
    current[part] = next;
    current = next;
  }
  current[parts[parts.length - 1]] = value;
  return root;
}

function schemaChildPath(child: DeckGoConfigLookupChild) {
  return child.path || child.key;
}

function schemaChildType(child: DeckGoConfigLookupChild) {
  if (Array.isArray(child.type)) {
    return child.type.find((entry) => entry !== "null") ?? child.type[0];
  }
  return child.type;
}

function schemaChildSchema(
  lookup: DeckGoConfigLookupResponse,
  child: DeckGoConfigLookupChild,
): Record<string, unknown> | null {
  const schema = lookup.schema;
  if (!isRecord(schema)) {
    return null;
  }
  const properties = schema.properties;
  if (!isRecord(properties)) {
    return null;
  }
  const childSchema = properties[child.key];
  return isRecord(childSchema) ? childSchema : null;
}

function enumInputValue(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function enumOptionsFromValues(values: unknown[]): StructuredEnumOption[] {
  return values
    .map((value) => {
      const inputValue = enumInputValue(value);
      return typeof inputValue === "string"
        ? {
            inputValue,
            label: String(value),
            value,
          }
        : null;
    })
    .filter((option): option is StructuredEnumOption => option !== null);
}

function structuredEnumOptions(
  child: DeckGoConfigLookupChild,
  childSchema: Record<string, unknown> | null,
): StructuredEnumOption[] {
  const hintEnum = child.hint?.enum;
  if (Array.isArray(hintEnum) && hintEnum.length > 0) {
    return enumOptionsFromValues(hintEnum);
  }
  if (Array.isArray(childSchema?.enum) && childSchema.enum.length > 0) {
    return enumOptionsFromValues(childSchema.enum);
  }
  const oneOf = childSchema?.oneOf ?? childSchema?.anyOf;
  if (!Array.isArray(oneOf)) {
    return [];
  }
  const constValues = oneOf
    .map((entry) => (isRecord(entry) && "const" in entry ? entry.const : undefined))
    .filter((value) => value !== undefined);
  return enumOptionsFromValues(constValues);
}

function structuredFieldKind(
  child: DeckGoConfigLookupChild,
  value: unknown,
  enumOptions: StructuredEnumOption[],
): StructuredFieldKind {
  const schemaType = schemaChildType(child);
  if (enumOptions.length > 0) {
    return "enum";
  }
  if (schemaType === "boolean") {
    return "boolean";
  }
  if (schemaType === "number" || schemaType === "integer") {
    return "number";
  }
  if (schemaType === "string") {
    return "string";
  }
  if (typeof value === "boolean") {
    return "boolean";
  }
  if (typeof value === "number") {
    return "number";
  }
  if (typeof value === "string" || value === undefined || value === null) {
    return child.hasChildren ? "readonly" : "string";
  }
  return "readonly";
}

function formatStructuredInputValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  if (value === undefined || value === null) {
    return "";
  }
  return JSON.stringify(value);
}

function formatStructuredJsonValue(value: unknown) {
  if (value === undefined) {
    return "";
  }
  return JSON.stringify(value, null, 2);
}

function hintString(child: DeckGoConfigLookupChild, key: string) {
  const value = child.hint?.[key];
  return typeof value === "string" ? value : undefined;
}

function hintBoolean(child: DeckGoConfigLookupChild, key: string) {
  return child.hint?.[key] === true;
}

function isSensitiveChild(child: DeckGoConfigLookupChild) {
  return hintBoolean(child, "sensitive") || hintString(child, "inputType") === "password";
}

function hintTags(child: DeckGoConfigLookupChild) {
  const tags = child.hint?.tags;
  return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === "string") : [];
}

function schemaString(schema: Record<string, unknown> | null, key: string) {
  const value = schema?.[key];
  return typeof value === "string" ? value : undefined;
}

function childMatchesStructuredFilter(params: {
  child: DeckGoConfigLookupChild;
  childSchema: Record<string, unknown> | null;
  query: string;
  tag: string;
}) {
  const { child, childSchema, query, tag } = params;
  const tags = hintTags(child);
  if (tag && !tags.some((entry) => entry.toLowerCase() === tag.toLowerCase())) {
    return false;
  }
  if (!query) {
    return true;
  }
  const haystack = [
    child.key,
    child.path,
    schemaChildType(child),
    hintString(child, "label"),
    hintString(child, "help"),
    hintString(child, "placeholder"),
    schemaString(childSchema, "description"),
    ...tags,
  ];
  return haystack.some((entry) =>
    Array.isArray(entry)
      ? entry.some((item) => item.toLowerCase().includes(query))
      : typeof entry === "string" && entry.toLowerCase().includes(query),
  );
}

function diffTypeLabel(type: DiffEntry["type"]) {
  if (type === "add") {
    return "diffAdded";
  }
  if (type === "remove") {
    return "diffRemoved";
  }
  return "diffChanged";
}

function formatDiffValue(value: unknown) {
  if (value === undefined) {
    return "undefined";
  }
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return JSON.stringify(value.length > 80 ? `${value.slice(0, 80)}...` : value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.length} items]`;
  }
  if (isRecord(value)) {
    return "{...}";
  }
  if (typeof value === "string") {
    return value;
  }
  return "";
}

function isConfigConflictMessage(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("config changed") || normalized.includes("base hash");
}

export function ConfigPanel() {
  const t = useTranslations("config");
  const [rawConfig, setRawConfig] = useState("");
  const [lastLoadedRawConfig, setLastLoadedRawConfig] = useState("");
  const [baseHash, setBaseHash] = useState("");
  const [schemaPath, setSchemaPath] = useState("agents.defaults");
  const [rootLookup, setRootLookup] = useState<DeckGoConfigLookupResponse | null>(null);
  const [lookupResult, setLookupResult] = useState<DeckGoConfigLookupResponse | null>(null);
  const [selectedSection, setSelectedSection] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [structuredFieldFilter, setStructuredFieldFilter] = useState("");
  const [structuredFieldTag, setStructuredFieldTag] = useState("");
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [actionState, setActionState] = useState<"idle" | "saving" | "lookup">("idle");
  const [error, setError] = useState("");
  const [actionResult, setActionResult] = useState<unknown>(null);
  const [pendingDiffEntries, setPendingDiffEntries] = useState<DiffEntry[] | null>(null);
  const [conflictPreview, setConflictPreview] = useState<ConfigConflictPreview | null>(null);
  const [structuredJsonDrafts, setStructuredJsonDrafts] = useState<Record<string, string>>({});
  const [visibleSensitiveFields, setVisibleSensitiveFields] = useState<Record<string, boolean>>({});

  const refresh = async () => {
    setLoadState("loading");
    try {
      const next = await fetchDeckConfig();
      const nextRaw = snapshotRawConfig(next);
      setRawConfig(nextRaw);
      setLastLoadedRawConfig(nextRaw);
      setBaseHash(next.hash ?? next.baseHash ?? "");
      setPendingDiffEntries(null);
      setConflictPreview(null);
      setStructuredJsonDrafts({});
      setVisibleSensitiveFields({});
      setLoadState("ready");
      setError("");
    } catch (loadError) {
      setLoadState("idle");
      setError(loadError instanceof Error ? loadError.message : t("loadConfigFailed"));
    }
  };

  const loadRootSchema = async () => {
    try {
      const result = await lookupConfigPath("");
      setRootLookup(result);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("schemaLookupFailed"));
    }
  };

  useEffect(() => {
    void refresh();
    void loadRootSchema();
    void lookupAction("agents.defaults");
  }, []);

  const topLevelKeys = useMemo(() => summarizeTopLevelKeys(rawConfig), [rawConfig]);
  const parsedConfig = useMemo(() => parseRawConfig(rawConfig), [rawConfig]);
  const isDirty = rawConfig !== lastLoadedRawConfig;
  const schemaSections = useMemo(() => {
    const rootSections =
      rootLookup?.children.map(schemaChildPath).filter((path) => path.trim().length > 0) ?? [];
    return rootSections.length > 0 ? rootSections : topLevelKeys;
  }, [rootLookup, topLevelKeys]);
  const filteredSchemaSections = useMemo(() => {
    const query = sectionFilter.trim().toLowerCase();
    if (!query) {
      return schemaSections;
    }
    return schemaSections.filter((section) => section.toLowerCase().includes(query));
  }, [schemaSections, sectionFilter]);
  const selectedSectionValue = useMemo(
    () => (selectedSection ? readConfigPath(parsedConfig, selectedSection) : undefined),
    [parsedConfig, selectedSection],
  );
  const structuredFieldTags = useMemo(() => {
    const tags = new Set<string>();
    for (const child of lookupResult?.children ?? []) {
      for (const tag of hintTags(child)) {
        tags.add(tag);
      }
    }
    return [...tags].toSorted((left, right) => left.localeCompare(right));
  }, [lookupResult]);
  const visibleLookupChildren = useMemo(() => {
    const query = structuredFieldFilter.trim().toLowerCase();
    const tag = structuredFieldTag.trim();
    return (lookupResult?.children ?? []).filter((child) =>
      childMatchesStructuredFilter({
        child,
        childSchema: lookupResult ? schemaChildSchema(lookupResult, child) : null,
        query,
        tag,
      }),
    );
  }, [lookupResult, structuredFieldFilter, structuredFieldTag]);

  useEffect(() => {
    if (schemaSections.length === 0) {
      setSelectedSection("");
      return;
    }
    setSelectedSection((current) =>
      current && schemaSections.includes(current) ? current : schemaSections[0],
    );
  }, [schemaSections]);

  useEffect(() => {
    if (structuredFieldTag && !structuredFieldTags.includes(structuredFieldTag)) {
      setStructuredFieldTag("");
    }
  }, [structuredFieldTag, structuredFieldTags]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  const lookupAction = async (nextPath = schemaPath) => {
    if (!nextPath.trim()) {
      setError(t("schemaPathRequired"));
      return;
    }
    setActionState("lookup");
    try {
      const result = await lookupConfigPath(nextPath.trim());
      setLookupResult(result);
      setSchemaPath(nextPath.trim());
      setError("");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("schemaLookupFailed"));
    } finally {
      setActionState("idle");
    }
  };

  const previewSaveAction = () => {
    setConflictPreview(null);
    const loadedConfig = parseRawConfigRecord(lastLoadedRawConfig);
    const nextConfig = parseRawConfigRecord(rawConfig);
    if (!nextConfig) {
      setPendingDiffEntries(null);
      setError(t("rawConfigObjectRequired"));
      return;
    }
    if (!loadedConfig) {
      setPendingDiffEntries(null);
      setError(t("loadedConfigObjectRequired"));
      return;
    }
    const entries = computeConfigDiff(loadedConfig, nextConfig);
    if (entries.length === 0) {
      setPendingDiffEntries(null);
      setError(t("noConfigChanges"));
      return;
    }
    setPendingDiffEntries(entries);
    setError("");
  };

  const handleApplyConflict = async (message: string) => {
    try {
      const remote = await fetchDeckConfig();
      const remoteRaw = snapshotRawConfig(remote);
      const remoteHash = remote.hash ?? remote.baseHash ?? "";
      const remoteConfig = parseRawConfigRecord(remoteRaw);
      const localConfig = parseRawConfigRecord(rawConfig);
      const entries =
        remoteConfig && localConfig ? computeConfigDiff(remoteConfig, localConfig) : [];
      setBaseHash(remoteHash);
      setConflictPreview({
        entries,
        message,
        remoteHash,
        remoteRaw,
      });
      setError("");
    } catch (conflictError) {
      setError(
        conflictError instanceof Error
          ? t("conflictReloadFailedWithMessage", { message: conflictError.message })
          : t("conflictReloadFailed"),
      );
    }
  };

  const reloadConflictRemote = () => {
    if (!conflictPreview) {
      return;
    }
    setRawConfig(conflictPreview.remoteRaw);
    setLastLoadedRawConfig(conflictPreview.remoteRaw);
    setBaseHash(conflictPreview.remoteHash);
    setPendingDiffEntries(null);
    setConflictPreview(null);
    setStructuredJsonDrafts({});
    setVisibleSensitiveFields({});
    setError("");
  };

  const saveAction = async (baseHashOverride = baseHash) => {
    setPendingDiffEntries(null);
    setConflictPreview(null);
    setActionState("saving");
    try {
      const result = await applyDeckConfig(rawConfig, baseHashOverride);
      setActionResult(result);
      setBaseHash(result.baseHash ?? result.hash ?? baseHashOverride);
      setError("");
      await refresh();
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : t("configApplyFailed");
      if (isConfigConflictMessage(message)) {
        await handleApplyConflict(message);
      } else {
        setError(message);
      }
    } finally {
      setActionState("idle");
    }
  };

  const updateStructuredPath = (path: string, value: unknown) => {
    try {
      const parsed = JSON.parse(rawConfig) as unknown;
      const nextConfig = writeConfigPath(parsed, path, value);
      setRawConfig(JSON.stringify(nextConfig, null, 2));
      setPendingDiffEntries(null);
      setConflictPreview(null);
      setStructuredJsonDrafts({});
      setVisibleSensitiveFields({});
      setError("");
    } catch {
      setError(t("rawConfigValidRequired"));
    }
  };

  const updateStructuredNumberPath = (path: string, rawValue: string) => {
    if (!rawValue.trim()) {
      setError(t("pathRequiresNumber", { path }));
      return;
    }
    const nextValue = Number(rawValue);
    if (!Number.isFinite(nextValue)) {
      setError(t("pathRequiresFiniteNumber", { path }));
      return;
    }
    updateStructuredPath(path, nextValue);
  };

  const updateStructuredJsonDraft = (path: string, value: string) => {
    setStructuredJsonDrafts((current) => ({
      ...current,
      [path]: value,
    }));
  };

  const applyStructuredJsonPath = (path: string, value: unknown) => {
    const draft = structuredJsonDrafts[path] ?? formatStructuredJsonValue(value);
    try {
      updateStructuredPath(path, JSON.parse(draft) as unknown);
    } catch {
      setError(t("pathRequiresValidJson", { path }));
    }
  };

  const toggleSensitiveVisibility = (path: string) => {
    setVisibleSensitiveFields((current) => ({
      ...current,
      [path]: !current[path],
    }));
  };

  return (
    <section className="deckgo-panel-workspace deck-ui-config">
      <div className="deckgo-column deck-ui-config-column">
        <article className="deckgo-card is-float deck-ui-config-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">{t("panelTitle")}</h2>
          </div>
          <p className="deckgo-card-subtitle">{t("panelDescription")}</p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-config-body">
            <div className="deckgo-pill-row deck-ui-config-status-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                {t("configStatus", { status: t(loadState) })}
              </span>
              <span className="deckgo-pill">
                {t("topLevelKeysCount", { count: topLevelKeys.length })}
              </span>
              <span className="deckgo-pill">
                {t("schemaSectionsCount", { count: schemaSections.length })}
              </span>
              <span className="deckgo-pill">
                {t("hashValue", { value: baseHash || t("notAvailable") })}
              </span>
              <span className={`deckgo-pill ${isDirty ? "is-warning" : "is-muted"}`}>
                {t("unsavedStatus", { value: isDirty ? t("yes") : t("no") })}
              </span>
            </div>
            <div className="deckgo-grid deckgo-grid-3 deck-ui-config-stats">
              <ShellStat label={t("keys")} value={topLevelKeys.length} />
              <ShellStat label={t("schemaPath")} value={schemaPath} />
              <ShellStat label={t("hash")} value={baseHash || t("notAvailable")} />
            </div>
            <div className="deckgo-actions deck-ui-config-actions">
              <button
                className="deckgo-button deck-ui-config-button"
                type="button"
                onClick={() => void refresh()}
              >
                {t("refreshConfig")}
              </button>
              <button
                className="deckgo-button is-primary deck-ui-config-button"
                type="button"
                onClick={() => previewSaveAction()}
                disabled={!isDirty || actionState !== "idle"}
              >
                {actionState === "saving" ? t("saving") : t("applyConfig")}
              </button>
              <button
                className="deckgo-button deck-ui-config-button"
                type="button"
                onClick={() => {
                  setRawConfig(lastLoadedRawConfig);
                  setPendingDiffEntries(null);
                  setConflictPreview(null);
                  setStructuredJsonDrafts({});
                  setVisibleSensitiveFields({});
                }}
                disabled={!isDirty || actionState !== "idle"}
              >
                {t("resetEdits")}
              </button>
            </div>
            {error ? <p className="deckgo-note deck-ui-config-error">{error}</p> : null}
            {pendingDiffEntries ? (
              <div
                className="deckgo-surface-tile deck-ui-config-surface deck-ui-config-dialog"
                role="dialog"
                aria-label={t("configDiffPreview")}
              >
                <div className="deckgo-card-header">
                  <div>
                    <p className="deckgo-surface-label">{t("configDiffPreview")}</p>
                    <strong>
                      {t("pendingConfigChanges", { count: pendingDiffEntries.length })}
                    </strong>
                    <p className="deckgo-note">{t("configDiffDescription")}</p>
                  </div>
                </div>
                <ul className="deckgo-shell-list deck-ui-config-list">
                  {pendingDiffEntries.slice(0, 50).map((entry) => (
                    <li key={entry.path}>
                      <div className="deckgo-selectable-card deck-ui-config-row">
                        <div className="deckgo-card-header">
                          <div>
                            <strong>{entry.path}</strong>
                            <p className="deckgo-note">
                              {formatDiffValue(entry.oldValue)} -&gt;{" "}
                              {formatDiffValue(entry.newValue)}
                            </p>
                          </div>
                          <span className="deckgo-pill">{t(diffTypeLabel(entry.type))}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                {pendingDiffEntries.length > 50 ? (
                  <p className="deckgo-note">
                    {t("additionalChangesHidden", { count: pendingDiffEntries.length - 50 })}
                  </p>
                ) : null}
                <div className="deckgo-actions deck-ui-config-actions">
                  <button
                    className="deckgo-button is-primary deck-ui-config-button"
                    type="button"
                    onClick={() => void saveAction()}
                    disabled={actionState !== "idle"}
                  >
                    {t("confirmApplyConfig")}
                  </button>
                  <button
                    className="deckgo-button deck-ui-config-button"
                    type="button"
                    onClick={() => setPendingDiffEntries(null)}
                    disabled={actionState !== "idle"}
                  >
                    {t("cancelDiffPreview")}
                  </button>
                </div>
              </div>
            ) : null}
            {conflictPreview ? (
              <div
                className="deckgo-surface-tile deck-ui-config-surface deck-ui-config-dialog"
                role="dialog"
                aria-label={t("configApplyConflict")}
              >
                <div className="deckgo-card-header">
                  <div>
                    <p className="deckgo-surface-label">{t("configApplyConflict")}</p>
                    <strong>{t("remoteConfigChanged")}</strong>
                    <p className="deckgo-note">{conflictPreview.message}</p>
                    <p className="deckgo-note">
                      {t("latestHashDescription", {
                        hash: conflictPreview.remoteHash || t("notAvailable"),
                      })}
                    </p>
                  </div>
                  <span className="deckgo-pill is-warning">
                    {t("diffsCount", { count: conflictPreview.entries.length })}
                  </span>
                </div>
                {conflictPreview.entries.length === 0 ? (
                  <p className="deckgo-note">{t("noConflictDiffComputed")}</p>
                ) : (
                  <ul className="deckgo-shell-list deck-ui-config-list">
                    {conflictPreview.entries.slice(0, 50).map((entry) => (
                      <li key={entry.path}>
                        <div className="deckgo-selectable-card deck-ui-config-row">
                          <div className="deckgo-card-header">
                            <div>
                              <strong>{entry.path}</strong>
                              <p className="deckgo-note">
                                {t("remoteToLocalDiff", {
                                  remote: formatDiffValue(entry.oldValue),
                                  local: formatDiffValue(entry.newValue),
                                })}
                              </p>
                            </div>
                            <span className="deckgo-pill">{t(diffTypeLabel(entry.type))}</span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {conflictPreview.entries.length > 50 ? (
                  <p className="deckgo-note">
                    {t("additionalConflictDiffsHidden", {
                      count: conflictPreview.entries.length - 50,
                    })}
                  </p>
                ) : null}
                <div className="deckgo-actions deck-ui-config-actions">
                  <button
                    className="deckgo-button deck-ui-config-button"
                    type="button"
                    onClick={() => reloadConflictRemote()}
                    disabled={actionState !== "idle"}
                  >
                    {t("reloadLatestConfig")}
                  </button>
                  <button
                    className="deckgo-button is-primary deck-ui-config-button"
                    type="button"
                    onClick={() => void saveAction(conflictPreview.remoteHash)}
                    disabled={!conflictPreview.remoteHash || actionState !== "idle"}
                  >
                    {t("retryLocalWithLatestHash")}
                  </button>
                  <button
                    className="deckgo-button deck-ui-config-button"
                    type="button"
                    onClick={() => setConflictPreview(null)}
                    disabled={actionState !== "idle"}
                  >
                    {t("dismissConflict")}
                  </button>
                </div>
              </div>
            ) : null}
            <label className="deckgo-label deck-ui-config-label">
              <span>{t("rawConfig")}</span>
              <textarea
                className="deckgo-textarea deck-ui-config-textarea"
                rows={20}
                value={rawConfig}
                onChange={(event) => {
                  setRawConfig(event.target.value);
                  setPendingDiffEntries(null);
                  setConflictPreview(null);
                  setStructuredJsonDrafts({});
                }}
              />
            </label>
          </div>
        </article>
      </div>

      <div className="deckgo-column deckgo-panel-main deck-ui-config-column">
        <article className="deckgo-card is-float deck-ui-config-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">{t("configDetail")}</h2>
          </div>
          <p className="deckgo-card-subtitle">{t("configDetailDescription")}</p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-config-body">
            <div className="deckgo-surface-tile deck-ui-config-surface">
              <p className="deckgo-surface-label">{t("schemaSections")}</p>
              <input
                className="deckgo-input deck-ui-config-input"
                value={sectionFilter}
                onChange={(event) => setSectionFilter(event.target.value)}
                placeholder={t("filterSections")}
              />
              <div className="deckgo-actions deck-ui-config-actions">
                {filteredSchemaSections.length === 0 ? (
                  <span className="deckgo-note deck-ui-config-empty">
                    {t("noMatchingSchemaSections")}
                  </span>
                ) : (
                  filteredSchemaSections.map((section) => (
                    <button
                      key={section}
                      className={`deckgo-button deck-ui-config-button ${selectedSection === section ? "is-primary" : ""}`}
                      type="button"
                      onClick={() => {
                        setSelectedSection(section);
                        void lookupAction(section);
                      }}
                      disabled={actionState !== "idle"}
                    >
                      {section}
                    </button>
                  ))
                )}
              </div>
            </div>
            <div className="deckgo-surface-tile deck-ui-config-surface">
              <p className="deckgo-surface-label">{t("lookupConfigPath")}</p>
              <div className="deckgo-actions deck-ui-config-actions">
                <input
                  className="deckgo-input deck-ui-config-input"
                  value={schemaPath}
                  onChange={(event) => setSchemaPath(event.target.value)}
                  placeholder={t("configPath")}
                />
                <button
                  className="deckgo-button deck-ui-config-button"
                  type="button"
                  onClick={() => void lookupAction()}
                  disabled={actionState !== "idle"}
                >
                  {actionState === "lookup" ? t("lookingUp") : t("lookupSchema")}
                </button>
              </div>
            </div>
            <div className="deckgo-surface-tile deck-ui-config-surface">
              <p className="deckgo-surface-label">{t("structuredSectionEditor")}</p>
              {lookupResult ? (
                <>
                  <p className="deckgo-note">
                    {t("editingSchemaChildren", { path: lookupResult.path })}
                  </p>
                  {lookupResult.children.length === 0 ? (
                    <p className="deckgo-note deck-ui-config-empty">{t("noEditableChildFields")}</p>
                  ) : (
                    <>
                      <div className="deckgo-actions deck-ui-config-actions">
                        <input
                          className="deckgo-input deck-ui-config-input"
                          value={structuredFieldFilter}
                          onChange={(event) => setStructuredFieldFilter(event.target.value)}
                          placeholder={t("filterStructuredFields")}
                        />
                        {structuredFieldTags.length > 0 ? (
                          <>
                            <button
                              className={`deckgo-button deckgo-button-compact deck-ui-config-button ${
                                structuredFieldTag ? "" : "is-primary"
                              }`}
                              type="button"
                              onClick={() => setStructuredFieldTag("")}
                            >
                              {t("allTags")}
                            </button>
                            {structuredFieldTags.map((tag) => (
                              <button
                                key={tag}
                                className={`deckgo-button deckgo-button-compact deck-ui-config-button ${
                                  structuredFieldTag === tag ? "is-primary" : ""
                                }`}
                                type="button"
                                onClick={() => setStructuredFieldTag(tag)}
                              >
                                {tag}
                              </button>
                            ))}
                          </>
                        ) : null}
                      </div>
                      <p className="deckgo-note">
                        {t("showingStructuredFields", {
                          visible: visibleLookupChildren.length,
                          total: lookupResult.children.length,
                        })}
                      </p>
                      {visibleLookupChildren.length === 0 ? (
                        <p className="deckgo-note deck-ui-config-empty">
                          {t("noStructuredFieldsMatch")}
                        </p>
                      ) : null}
                      <div className="deckgo-shell-list deck-ui-config-list deck-ui-config-field-list">
                        {visibleLookupChildren.map((child) => {
                          const childPath = schemaChildPath(child);
                          const childValue = readConfigPath(parsedConfig, childPath);
                          const childSchema = schemaChildSchema(lookupResult, child);
                          const enumOptions = structuredEnumOptions(child, childSchema);
                          const enumValue = enumInputValue(childValue) ?? "";
                          const fieldKind = structuredFieldKind(child, childValue, enumOptions);
                          const isSensitive = isSensitiveChild(child);
                          const isSensitiveVisible = visibleSensitiveFields[childPath];
                          const label = hintString(child, "label") ?? child.key;
                          const placeholder = hintString(child, "placeholder") ?? childPath;
                          return (
                            <div
                              key={childPath}
                              className="deckgo-selectable-card deck-ui-config-row deck-ui-config-field-card"
                            >
                              <div className="deckgo-card-header">
                                <div>
                                  <strong>{label}</strong>
                                  <p className="deckgo-note">{childPath}</p>
                                </div>
                                <span className="deckgo-pill">
                                  {schemaChildType(child) ?? fieldKind}
                                </span>
                                {isSensitive ? (
                                  <span className="deckgo-pill is-warning">{t("sensitive")}</span>
                                ) : null}
                              </div>
                              {fieldKind === "boolean" ? (
                                <label className="deckgo-checkbox-row deck-ui-config-check">
                                  <input
                                    aria-label={`Edit ${childPath}`}
                                    type="checkbox"
                                    checked={childValue === true}
                                    onChange={(event) =>
                                      updateStructuredPath(childPath, event.target.checked)
                                    }
                                  />
                                  <span>{childValue === true ? t("enabled") : t("disabled")}</span>
                                </label>
                              ) : null}
                              {fieldKind === "enum" ? (
                                <select
                                  aria-label={`Edit ${childPath}`}
                                  className="deckgo-input deck-ui-config-input"
                                  value={enumValue}
                                  onChange={(event) => {
                                    const selectedOption = enumOptions.find(
                                      (option) => option.inputValue === event.target.value,
                                    );
                                    if (selectedOption) {
                                      updateStructuredPath(childPath, selectedOption.value);
                                    }
                                  }}
                                >
                                  {enumOptions.map((option) => (
                                    <option key={option.inputValue} value={option.inputValue}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              ) : null}
                              {fieldKind === "number" ? (
                                <input
                                  aria-label={`Edit ${childPath}`}
                                  className="deckgo-input deck-ui-config-input"
                                  type="number"
                                  value={formatStructuredInputValue(childValue)}
                                  onChange={(event) =>
                                    updateStructuredNumberPath(childPath, event.target.value)
                                  }
                                  placeholder={placeholder}
                                />
                              ) : null}
                              {fieldKind === "string" ? (
                                <div className="deckgo-actions deck-ui-config-actions">
                                  <input
                                    aria-label={`Edit ${childPath}`}
                                    className="deckgo-input deck-ui-config-input"
                                    type={isSensitive && !isSensitiveVisible ? "password" : "text"}
                                    value={formatStructuredInputValue(childValue)}
                                    onChange={(event) =>
                                      updateStructuredPath(childPath, event.target.value)
                                    }
                                    placeholder={placeholder}
                                  />
                                  {isSensitive ? (
                                    <button
                                      aria-label={`Toggle visibility ${childPath}`}
                                      className="deckgo-button deckgo-button-compact deck-ui-config-button"
                                      type="button"
                                      onClick={() => toggleSensitiveVisibility(childPath)}
                                    >
                                      {isSensitiveVisible ? t("hidePassword") : t("showPassword")}
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}
                              {fieldKind === "readonly" ? (
                                <div>
                                  <p className="deckgo-note">{t("jsonFieldDescription")}</p>
                                  <textarea
                                    aria-label={`Edit JSON ${childPath}`}
                                    className="deckgo-textarea deck-ui-config-textarea"
                                    rows={6}
                                    value={
                                      structuredJsonDrafts[childPath] ??
                                      formatStructuredJsonValue(childValue)
                                    }
                                    onChange={(event) =>
                                      updateStructuredJsonDraft(childPath, event.target.value)
                                    }
                                  />
                                  <div className="deckgo-actions deck-ui-config-actions">
                                    <button
                                      aria-label={`Apply JSON ${childPath}`}
                                      className="deckgo-button deckgo-button-compact deck-ui-config-button"
                                      type="button"
                                      onClick={() => applyStructuredJsonPath(childPath, childValue)}
                                    >
                                      {t("applyJsonField")}
                                    </button>
                                    <button
                                      aria-label={`Reset JSON ${childPath}`}
                                      className="deckgo-button deckgo-button-compact deck-ui-config-button"
                                      type="button"
                                      onClick={() =>
                                        updateStructuredJsonDraft(
                                          childPath,
                                          formatStructuredJsonValue(childValue),
                                        )
                                      }
                                    >
                                      {t("resetJsonField")}
                                    </button>
                                  </div>
                                  <JsonDetails
                                    title={t("valuePayload", { path: childPath })}
                                    payload={childValue}
                                  />
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <p className="deckgo-note deck-ui-config-empty">{t("runSchemaLookup")}</p>
              )}
            </div>
            <div className="deckgo-panel-hero-strip deck-ui-config-hero">
              <div>
                <p className="deckgo-kicker">{t("topLevelSections")}</p>
                <strong>{selectedSection || topLevelKeys[0] || t("noConfigKeys")}</strong>
                <p className="deckgo-note">{t("currentSectionValueDescription")}</p>
              </div>
              <div className="deckgo-pill-row deck-ui-config-status-row">
                <span className="deckgo-pill">
                  {t("sectionsCount", { count: topLevelKeys.length })}
                </span>
                <span className="deckgo-pill">
                  {t("schemaChildrenCount", { count: lookupResult?.children.length ?? 0 })}
                </span>
              </div>
            </div>
            {topLevelKeys.length === 0 ? (
              <p className="deckgo-note deck-ui-config-empty">{t("noTopLevelKeys")}</p>
            ) : (
              <ul className="deckgo-shell-list deck-ui-config-list">
                {topLevelKeys.map((key) => (
                  <li key={key}>
                    <div className="deckgo-selectable-card deck-ui-config-row">
                      <strong>{key}</strong>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {selectedSection ? (
              selectedSectionValue === undefined ? (
                <p className="deckgo-note deck-ui-config-empty">{t("selectedSectionMissing")}</p>
              ) : (
                <JsonDetails
                  title={t("configSectionPayload", { section: selectedSection })}
                  payload={selectedSectionValue}
                />
              )
            ) : null}
            {lookupResult ? (
              <JsonDetails title={t("schemaLookupPayload")} payload={lookupResult} />
            ) : null}
            {actionResult ? (
              <JsonDetails title={t("lastApplyResult")} payload={actionResult} />
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}
