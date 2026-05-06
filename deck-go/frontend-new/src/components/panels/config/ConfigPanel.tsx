import { useEffect, useMemo, useState } from "react";
import type {
  DeckGoConfigLookupChild,
  DeckGoConfigLookupResponse,
  DeckGoConfigSnapshotResponse,
} from "../../../api";
import { applyDeckConfig, fetchDeckConfig, lookupConfigPath } from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import { computeConfigDiff, type DiffEntry } from "../../../lib/config-diff";
import { JsonDetails } from "../../shared/ShellComponents";
import "./config-panel.css";

type PanelState = "idle" | "loading" | "ready";
type PreviewPaneMode = "diff" | "raw" | "history";
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
  return (
    hintBoolean(child, "sensitive") ||
    hintBoolean(child, "secret") ||
    hintString(child, "inputType") === "password"
  );
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

function sectionDisplayLabel(t: ReturnType<typeof useTranslations>, section: string) {
  return t.has(section) ? t(section) : section.charAt(0).toUpperCase() + section.slice(1);
}

function dirtyCountForSection(entries: DiffEntry[], section: string) {
  return entries.filter((entry) => entry.path === section || entry.path.startsWith(`${section}.`))
    .length;
}

function isConfigConflictMessage(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("config changed") || normalized.includes("base hash");
}

export function ConfigPanel() {
  const t = useTranslations("config");
  const [rawConfig, setRawConfig] = useState("");
  const [lastLoadedRawConfig, setLastLoadedRawConfig] = useState("");
  const [rawConfigWritable, setRawConfigWritable] = useState(false);
  const [baseHash, setBaseHash] = useState("");
  const [schemaPath, setSchemaPath] = useState("");
  const [rootLookup, setRootLookup] = useState<DeckGoConfigLookupResponse | null>(null);
  const [lookupResult, setLookupResult] = useState<DeckGoConfigLookupResponse | null>(null);
  const [selectedSection, setSelectedSection] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [structuredFieldFilter, setStructuredFieldFilter] = useState("");
  const [structuredFieldTag, setStructuredFieldTag] = useState("");
  const [previewPaneMode, setPreviewPaneMode] = useState<PreviewPaneMode>("diff");
  const [_loadState, setLoadState] = useState<PanelState>("idle");
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
      const nextRawWritable = typeof next.raw === "string";
      setRawConfig(nextRaw);
      setLastLoadedRawConfig(nextRaw);
      setRawConfigWritable(nextRawWritable);
      setBaseHash(next.baseHash ?? next.hash ?? "");
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
  }, []);

  const topLevelKeys = useMemo(() => summarizeTopLevelKeys(rawConfig), [rawConfig]);
  const parsedConfig = useMemo(() => parseRawConfig(rawConfig), [rawConfig]);
  const rawDraftValid = useMemo(() => parseRawConfigRecord(rawConfig) !== null, [rawConfig]);
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
    return schemaSections.filter(
      (section) =>
        section.toLowerCase().includes(query) ||
        sectionDisplayLabel(t, section).toLowerCase().includes(query),
    );
  }, [schemaSections, sectionFilter, t]);
  const selectedSectionValue = useMemo(
    () => (selectedSection ? readConfigPath(parsedConfig, selectedSection) : undefined),
    [parsedConfig, selectedSection],
  );
  const diffEntries = useMemo(() => {
    const loadedConfig = parseRawConfigRecord(lastLoadedRawConfig);
    const nextConfig = parseRawConfigRecord(rawConfig);
    return loadedConfig && nextConfig ? computeConfigDiff(loadedConfig, nextConfig) : [];
  }, [lastLoadedRawConfig, rawConfig]);
  const selectedSectionDirtyCount = selectedSection
    ? dirtyCountForSection(diffEntries, selectedSection)
    : 0;
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
      current && schemaSections.includes(current)
        ? current
        : (schemaSections.find((section) => section === "agents") ?? schemaSections[0]),
    );
  }, [schemaSections]);

  useEffect(() => {
    if (!selectedSection || lookupResult) {
      return;
    }
    void lookupAction(selectedSection);
  }, [lookupResult, selectedSection]);

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
    if (!rawConfigWritable) {
      setPendingDiffEntries(null);
      setError(t("rawConfigUnavailableApplyBlocked"));
      return;
    }
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
    setPreviewPaneMode("diff");
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
    if (!rawConfigWritable) {
      setError(t("rawConfigUnavailableStructuredBlocked"));
      return;
    }
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
    <section className="config-panel" data-testid="config-panel">
      <header className="config-panel__topbar">
        <div>
          <p className="config-panel__eyebrow">{t("workbenchEyebrow")}</p>
          <h2 className="config-panel__title">{t("workbenchTitle")}</h2>
          <p className="config-panel__subtitle">{t("workbenchSubtitle")}</p>
        </div>
        <div className="config-panel__topbar-actions">
          <span className={`config-panel__pill ${isDirty ? "is-warning" : "is-positive"}`}>
            {isDirty ? t("unsavedCount", { count: diffEntries.length }) : t("snapshotInSync")}
          </span>
          <span className="config-panel__kbd">
            <kbd>⌘</kbd>
            <kbd>K</kbd>
            <span>{t("focusSectionSearch")}</span>
          </span>
        </div>
      </header>

      <main className="config-panel__layout">
        <aside className="config-panel__section-nav" aria-label={t("schemaSections")}>
          <div className="config-panel__section-nav-head">
            <p className="config-panel__eyebrow">openclaw.json</p>
            <h3>{t("schemaSections")}</h3>
            <p>{t("topLevelKeysCount", { count: schemaSections.length })}</p>
          </div>
          <label className="config-panel__search">
            <span>{t("filterSections")}</span>
            <input
              className="config-panel__input"
              value={sectionFilter}
              onChange={(event) => setSectionFilter(event.target.value)}
              placeholder={t("filterSections")}
              type="search"
            />
          </label>
          <div className="config-panel__section-list" role="tablist">
            {filteredSchemaSections.length === 0 ? (
              <p className="config-panel__empty">{t("noMatchingSchemaSections")}</p>
            ) : (
              filteredSchemaSections.map((section) => {
                const dirtyCount = dirtyCountForSection(diffEntries, section);
                return (
                  <button
                    key={section}
                    className={`config-panel__section-button ${
                      selectedSection === section ? "is-selected" : ""
                    }`}
                    type="button"
                    role="tab"
                    aria-selected={selectedSection === section}
                    onClick={() => {
                      setSelectedSection(section);
                      void lookupAction(section);
                    }}
                    disabled={actionState !== "idle"}
                  >
                    <span className="config-panel__section-icon">
                      {sectionDisplayLabel(t, section).slice(0, 1)}
                    </span>
                    <span>
                      <strong>{sectionDisplayLabel(t, section)}</strong>
                      <code>{section}</code>
                    </span>
                    {dirtyCount > 0 ? (
                      <span className="config-panel__dirty-count">{dirtyCount}</span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="config-panel__form-pane" aria-label={t("structuredSectionEditor")}>
          <div className="config-panel__form-head">
            <div>
              <p className="config-panel__eyebrow">{t("section")}</p>
              <h3>
                <code>{selectedSection || t("noConfigKeys")}</code>
              </h3>
              <p className="config-panel__meta">
                {lookupResult
                  ? t("editingSchemaChildren", { path: lookupResult.path })
                  : t("runSchemaLookup")}
              </p>
            </div>
            <div className="config-panel__actions">
              <button
                className="config-panel__button"
                type="button"
                onClick={() => setPreviewPaneMode(previewPaneMode === "diff" ? "raw" : "diff")}
              >
                {previewPaneMode === "diff" ? t("raw") : t("diff")}
              </button>
              <button className="config-panel__button" type="button" onClick={() => void refresh()}>
                {t("refreshConfig")}
              </button>
            </div>
          </div>

          <div className="config-panel__hash-row">
            <span className="config-panel__pill">
              {t("baseHash", { value: baseHash || t("notAvailable") })}
            </span>
            <span className="config-panel__pill">
              {t("draftHash", {
                value: isDirty ? `${baseHash || "draft"}*` : baseHash || t("notAvailable"),
              })}
            </span>
            <span
              className={`config-panel__pill ${
                selectedSectionDirtyCount > 0 ? "is-warning" : "is-positive"
              }`}
            >
              {selectedSectionDirtyCount > 0
                ? t("unsavedHere", { count: selectedSectionDirtyCount })
                : t("sectionClean")}
            </span>
          </div>

          {error ? <p className="config-panel__error">{error}</p> : null}
          {!rawConfigWritable ? (
            <p className="config-panel__notice">{t("rawConfigUnavailable")}</p>
          ) : null}

          <div className="config-panel__lookup-bar">
            <input
              className="config-panel__input"
              value={schemaPath}
              onChange={(event) => setSchemaPath(event.target.value)}
              placeholder={t("configPath")}
            />
            <button
              className="config-panel__button"
              type="button"
              onClick={() => void lookupAction()}
              disabled={actionState !== "idle"}
            >
              {actionState === "lookup" ? t("lookingUp") : t("lookupSchema")}
            </button>
          </div>

          {lookupResult ? (
            <>
              <div className="config-panel__field-toolbar">
                <input
                  className="config-panel__input"
                  value={structuredFieldFilter}
                  onChange={(event) => setStructuredFieldFilter(event.target.value)}
                  placeholder={t("filterStructuredFields")}
                  type="search"
                />
                {structuredFieldTags.length > 0 ? (
                  <div className="config-panel__tag-list">
                    <button
                      className={`config-panel__button ${structuredFieldTag ? "" : "is-primary"}`}
                      type="button"
                      onClick={() => setStructuredFieldTag("")}
                    >
                      {t("allTags")}
                    </button>
                    {structuredFieldTags.map((tag) => (
                      <button
                        key={tag}
                        className={`config-panel__button ${
                          structuredFieldTag === tag ? "is-primary" : ""
                        }`}
                        type="button"
                        onClick={() => setStructuredFieldTag(tag)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <p className="config-panel__meta">
                {t("showingStructuredFields", {
                  visible: visibleLookupChildren.length,
                  total: lookupResult.children.length,
                })}
              </p>
              {visibleLookupChildren.length === 0 ? (
                <p className="config-panel__empty">{t("noStructuredFieldsMatch")}</p>
              ) : null}
              <div className="config-panel__field-list">
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
                    <article key={childPath} className="config-panel__field-card">
                      <div className="config-panel__field-head">
                        <div>
                          <strong>{label}</strong>
                          <p className="config-panel__meta">{childPath}</p>
                        </div>
                        <div className="config-panel__pill-row">
                          {child.required ? (
                            <span className="config-panel__pill is-warning">{t("required")}</span>
                          ) : null}
                          <span className="config-panel__pill">
                            {schemaChildType(child) ?? fieldKind}
                          </span>
                          {isSensitive ? (
                            <span className="config-panel__pill is-warning">{t("sensitive")}</span>
                          ) : null}
                        </div>
                      </div>
                      {fieldKind === "boolean" ? (
                        <label className="config-panel__check">
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
                          className="config-panel__input"
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
                          className="config-panel__input"
                          type="number"
                          value={formatStructuredInputValue(childValue)}
                          onChange={(event) =>
                            updateStructuredNumberPath(childPath, event.target.value)
                          }
                          placeholder={placeholder}
                        />
                      ) : null}
                      {fieldKind === "string" ? (
                        <div className="config-panel__inline-actions">
                          <input
                            aria-label={`Edit ${childPath}`}
                            className="config-panel__input"
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
                              className="config-panel__button"
                              type="button"
                              onClick={() => toggleSensitiveVisibility(childPath)}
                            >
                              {isSensitiveVisible ? t("hidePassword") : t("showPassword")}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                      {fieldKind === "readonly" ? (
                        <div className="config-panel__json-field">
                          <p className="config-panel__meta">{t("jsonFieldDescription")}</p>
                          <textarea
                            aria-label={`Edit JSON ${childPath}`}
                            className="config-panel__textarea"
                            rows={6}
                            value={
                              structuredJsonDrafts[childPath] ??
                              formatStructuredJsonValue(childValue)
                            }
                            onChange={(event) =>
                              updateStructuredJsonDraft(childPath, event.target.value)
                            }
                          />
                          <div className="config-panel__actions">
                            <button
                              aria-label={`Apply JSON ${childPath}`}
                              className="config-panel__button"
                              type="button"
                              onClick={() => applyStructuredJsonPath(childPath, childValue)}
                            >
                              {t("applyJsonField")}
                            </button>
                            <button
                              aria-label={`Reset JSON ${childPath}`}
                              className="config-panel__button"
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
                    </article>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="config-panel__empty">{t("runSchemaLookup")}</p>
          )}

          <footer className="config-panel__form-footer">
            <button
              className="config-panel__button"
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
            <button
              className="config-panel__button is-primary"
              type="button"
              onClick={() => previewSaveAction()}
              disabled={!isDirty || !rawConfigWritable || actionState !== "idle"}
            >
              {actionState === "saving" ? t("saving") : t("applyConfig")}
            </button>
          </footer>
        </section>

        <aside className="config-panel__preview-pane" aria-label={t("draftPreview")}>
          <div className="config-panel__preview-head">
            <div>
              <p className="config-panel__eyebrow">{t("draftPreview")}</p>
              <h3>
                {previewPaneMode === "diff"
                  ? t("diff")
                  : previewPaneMode === "raw"
                    ? t("rawConfig")
                    : t("history")}
              </h3>
              <p className="config-panel__meta">
                {previewPaneMode === "diff"
                  ? t("pathsChanged", { count: diffEntries.length })
                  : previewPaneMode === "raw"
                    ? t(
                        rawConfigWritable
                          ? rawDraftValid
                            ? "jsonValid"
                            : "jsonInvalid"
                          : "rawConfigUnavailable",
                      )
                    : t("historyUnavailable")}
              </p>
            </div>
            <div className="config-panel__mode-tabs" role="tablist">
              {(["diff", "raw", "history"] as const).map((mode) => (
                <button
                  key={mode}
                  className={`config-panel__mode-tab ${
                    previewPaneMode === mode ? "is-selected" : ""
                  }`}
                  type="button"
                  role="tab"
                  aria-selected={previewPaneMode === mode}
                  onClick={() => setPreviewPaneMode(mode)}
                >
                  {mode === "diff" ? t("diff") : mode === "raw" ? t("raw") : t("history")}
                </button>
              ))}
            </div>
          </div>
          <div className="config-panel__preview-body">
            {previewPaneMode === "diff" ? (
              diffEntries.length === 0 ? (
                <div className="config-panel__preview-empty">
                  <span>✓</span>
                  <p>{t("draftMatchesBase")}</p>
                </div>
              ) : (
                <ul className="config-panel__diff-list">
                  {diffEntries.slice(0, 80).map((entry) => (
                    <li key={entry.path} className={`config-panel__diff-row is-${entry.type}`}>
                      <button
                        className="config-panel__diff-path"
                        type="button"
                        onClick={() => {
                          const top = entry.path.split(".")[0];
                          if (top) {
                            setSelectedSection(top);
                            void lookupAction(top);
                          }
                        }}
                      >
                        <code>{entry.path}</code>
                      </button>
                      <span className="config-panel__pill">{t(diffTypeLabel(entry.type))}</span>
                      <p className="config-panel__meta">
                        {formatDiffValue(entry.oldValue)} -&gt; {formatDiffValue(entry.newValue)}
                      </p>
                    </li>
                  ))}
                </ul>
              )
            ) : null}
            {previewPaneMode === "raw" ? (
              <label className="config-panel__raw-editor">
                <span>{t("rawConfig")}</span>
                <textarea
                  className="config-panel__textarea"
                  data-testid="config-raw-editor"
                  readOnly={!rawConfigWritable}
                  rows={24}
                  value={rawConfig}
                  onChange={(event) => {
                    setRawConfig(event.target.value);
                    setPendingDiffEntries(null);
                    setConflictPreview(null);
                    setStructuredJsonDrafts({});
                  }}
                />
              </label>
            ) : null}
            {previewPaneMode === "history" ? (
              <div className="config-panel__history">
                <p className="config-panel__notice">{t("historyUnavailable")}</p>
                {actionResult ? (
                  <JsonDetails title={t("lastApplyResult")} payload={actionResult} />
                ) : null}
                {selectedSection ? (
                  <JsonDetails
                    title={t("configSectionPayload", { section: selectedSection })}
                    payload={selectedSectionValue}
                  />
                ) : null}
                {lookupResult ? (
                  <JsonDetails title={t("schemaLookupPayload")} payload={lookupResult} />
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="config-panel__preview-footer">
            <button
              className="config-panel__button"
              type="button"
              onClick={() => setPreviewPaneMode("history")}
            >
              {t("viewSnapshot")}
            </button>
          </div>
        </aside>
      </main>

      {pendingDiffEntries ? (
        <div className="config-panel__modal" role="dialog" aria-label={t("configDiffPreview")}>
          <div className="config-panel__dialog">
            <div className="config-panel__field-head">
              <div>
                <p className="config-panel__label">{t("configDiffPreview")}</p>
                <strong>{t("pendingConfigChanges", { count: pendingDiffEntries.length })}</strong>
                <p className="config-panel__meta">{t("configDiffDescription")}</p>
              </div>
            </div>
            <ul className="config-panel__diff-list">
              {pendingDiffEntries.slice(0, 50).map((entry) => (
                <li key={entry.path} className={`config-panel__diff-row is-${entry.type}`}>
                  <code>{entry.path}</code>
                  <span className="config-panel__pill">{t(diffTypeLabel(entry.type))}</span>
                  <p className="config-panel__meta">
                    {formatDiffValue(entry.oldValue)} -&gt; {formatDiffValue(entry.newValue)}
                  </p>
                </li>
              ))}
            </ul>
            {pendingDiffEntries.length > 50 ? (
              <p className="config-panel__meta">
                {t("additionalChangesHidden", { count: pendingDiffEntries.length - 50 })}
              </p>
            ) : null}
            <div className="config-panel__actions">
              <button
                className="config-panel__button is-primary"
                type="button"
                onClick={() => void saveAction()}
                disabled={actionState !== "idle"}
              >
                {t("confirmApplyConfig")}
              </button>
              <button
                className="config-panel__button"
                type="button"
                onClick={() => setPendingDiffEntries(null)}
                disabled={actionState !== "idle"}
              >
                {t("cancelDiffPreview")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {conflictPreview ? (
        <div className="config-panel__modal" role="dialog" aria-label={t("configApplyConflict")}>
          <div className="config-panel__dialog">
            <div className="config-panel__field-head">
              <div>
                <p className="config-panel__label">{t("configApplyConflict")}</p>
                <strong>{t("remoteConfigChanged")}</strong>
                <p className="config-panel__meta">{conflictPreview.message}</p>
                <p className="config-panel__meta">
                  {t("latestHashDescription", {
                    hash: conflictPreview.remoteHash || t("notAvailable"),
                  })}
                </p>
              </div>
              <span className="config-panel__pill is-warning">
                {t("diffsCount", { count: conflictPreview.entries.length })}
              </span>
            </div>
            {conflictPreview.entries.length === 0 ? (
              <p className="config-panel__meta">{t("noConflictDiffComputed")}</p>
            ) : (
              <ul className="config-panel__diff-list">
                {conflictPreview.entries.slice(0, 50).map((entry) => (
                  <li key={entry.path} className={`config-panel__diff-row is-${entry.type}`}>
                    <code>{entry.path}</code>
                    <span className="config-panel__pill">{t(diffTypeLabel(entry.type))}</span>
                    <p className="config-panel__meta">
                      {t("remoteToLocalDiff", {
                        remote: formatDiffValue(entry.oldValue),
                        local: formatDiffValue(entry.newValue),
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {conflictPreview.entries.length > 50 ? (
              <p className="config-panel__meta">
                {t("additionalConflictDiffsHidden", {
                  count: conflictPreview.entries.length - 50,
                })}
              </p>
            ) : null}
            <div className="config-panel__actions">
              <button
                className="config-panel__button"
                type="button"
                onClick={() => reloadConflictRemote()}
                disabled={actionState !== "idle"}
              >
                {t("reloadLatestConfig")}
              </button>
              <button
                className="config-panel__button is-primary"
                type="button"
                onClick={() => void saveAction(conflictPreview.remoteHash)}
                disabled={!conflictPreview.remoteHash || actionState !== "idle"}
              >
                {t("retryLocalWithLatestHash")}
              </button>
              <button
                className="config-panel__button"
                type="button"
                onClick={() => setConflictPreview(null)}
                disabled={actionState !== "idle"}
              >
                {t("dismissConflict")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
