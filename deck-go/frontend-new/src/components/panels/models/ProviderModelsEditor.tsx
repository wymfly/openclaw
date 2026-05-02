import { useMemo, useState } from "react";
import type { DeckGoCatalogProvider } from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import { StringRecordEditor } from "./StringRecordEditor";

type ProviderModelObject = Record<string, unknown> & {
  id?: string;
  name?: string;
  api?: string;
  contextWindow?: number;
  maxTokens?: number;
  reasoning?: boolean;
  input?: string[];
  cost?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
  };
  headers?: Record<string, string>;
  compat?: Record<string, unknown>;
};

type CompatBooleanField =
  | "supportsStore"
  | "supportsDeveloperRole"
  | "supportsReasoningEffort"
  | "supportsTools"
  | "supportsUsageInStreaming"
  | "supportsStrictMode"
  | "nativeWebSearchTool";

const COMPAT_BOOLEAN_FIELDS: Array<{ key: CompatBooleanField; labelKey: string }> = [
  { key: "supportsStore", labelKey: "editor.compatStore" },
  { key: "supportsDeveloperRole", labelKey: "editor.compatDeveloperRole" },
  { key: "supportsReasoningEffort", labelKey: "editor.compatReasoningEffort" },
  { key: "supportsTools", labelKey: "editor.compatTools" },
  { key: "supportsUsageInStreaming", labelKey: "editor.compatStreamUsage" },
  { key: "supportsStrictMode", labelKey: "editor.compatStrictMode" },
  { key: "nativeWebSearchTool", labelKey: "editor.compatNativeWebSearch" },
];

const COMPAT_MAX_TOKEN_FIELDS = ["max_completion_tokens", "max_tokens"];
const COMPAT_THINKING_FORMATS = ["openai", "openrouter", "zai", "qwen", "qwen-chat-template"];

type ProviderModelDraft = {
  key: string;
  value: string | ProviderModelObject;
  model: ProviderModelObject;
  isStringEntry: boolean;
};

function modelDrafts(value: unknown): ProviderModelDraft[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry, index) => {
    if (typeof entry === "string") {
      return {
        key: `${entry}-${index}`,
        value: entry,
        model: { id: entry, name: entry },
        isStringEntry: true,
      };
    }
    if (entry && typeof entry === "object") {
      const model = entry as ProviderModelObject;
      const id = typeof model.id === "string" && model.id.trim() ? model.id : `model-${index}`;
      return {
        key: `${id}-${index}`,
        value: model,
        model,
        isStringEntry: false,
      };
    }
    return {
      key: `invalid-${index}`,
      value: { id: "", name: "" },
      model: { id: "", name: "" },
      isStringEntry: false,
    };
  });
}

function updateModelAt(modelsValue: unknown, index: number, patch: Partial<ProviderModelObject>) {
  return modelDrafts(modelsValue).map((draft, draftIndex) => {
    if (draftIndex !== index) {
      return draft.value;
    }
    return {
      ...draft.model,
      ...patch,
    };
  });
}

function removeModelAt(modelsValue: unknown, index: number) {
  return modelDrafts(modelsValue)
    .filter((_, draftIndex) => draftIndex !== index)
    .map((draft) => draft.value);
}

function parsePositiveNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const next = Number(trimmed);
  return Number.isFinite(next) && next > 0 ? next : undefined;
}

function parseNonNegativeNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const next = Number(trimmed);
  return Number.isFinite(next) && next >= 0 ? next : undefined;
}

function readModelCost(value: unknown): ProviderModelObject["cost"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  return {
    input:
      typeof record.input === "number" && Number.isFinite(record.input) ? record.input : undefined,
    output:
      typeof record.output === "number" && Number.isFinite(record.output)
        ? record.output
        : undefined,
    cacheRead:
      typeof record.cacheRead === "number" && Number.isFinite(record.cacheRead)
        ? record.cacheRead
        : undefined,
    cacheWrite:
      typeof record.cacheWrite === "number" && Number.isFinite(record.cacheWrite)
        ? record.cacheWrite
        : undefined,
  };
}

function readPlainRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readStringRecord(value: unknown) {
  const record = readPlainRecord(value);
  const next: Record<string, string> = {};
  for (const [key, entry] of Object.entries(record)) {
    if (typeof entry === "string") {
      next[key] = entry;
    }
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function mergeModelCost(
  current: ProviderModelObject["cost"],
  field: keyof NonNullable<ProviderModelObject["cost"]>,
  value: number | undefined,
) {
  const next = { ...current, [field]: value };
  const cleaned = Object.fromEntries(
    Object.entries(next).filter(([, entry]) => typeof entry === "number"),
  ) as NonNullable<ProviderModelObject["cost"]>;
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

function mergeCompatBoolean(
  current: unknown,
  field: CompatBooleanField,
  enabled: boolean,
): Record<string, unknown> | undefined {
  const next = { ...readPlainRecord(current) };
  if (enabled) {
    next[field] = true;
  } else {
    delete next[field];
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function mergeCompatString(
  current: unknown,
  field: "maxTokensField" | "thinkingFormat",
  value: string,
): Record<string, unknown> | undefined {
  const next = { ...readPlainRecord(current) };
  const trimmed = value.trim();
  if (trimmed) {
    next[field] = trimmed;
  } else {
    delete next[field];
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function catalogModelIds(provider: DeckGoCatalogProvider | undefined) {
  return new Set((provider?.models ?? []).map((model) => model.id));
}

function providerModelFromCatalog(
  model: NonNullable<DeckGoCatalogProvider["models"]>[number],
): ProviderModelObject {
  return {
    id: model.id,
    name: model.name ?? model.id,
    ...(typeof model.contextWindow === "number" ? { contextWindow: model.contextWindow } : {}),
    ...(typeof model.maxTokens === "number" ? { maxTokens: model.maxTokens } : {}),
    ...(typeof model.reasoning === "boolean" ? { reasoning: model.reasoning } : {}),
    input: ["text"],
  };
}

export function ProviderModelsEditor(props: {
  catalogProvider?: DeckGoCatalogProvider;
  modelsValue: unknown;
  onChange: (models: unknown[]) => void;
}) {
  const t = useTranslations("models");
  const [newModelId, setNewModelId] = useState("");
  const [newModelName, setNewModelName] = useState("");
  const [newModelApi, setNewModelApi] = useState("");
  const [newContextWindow, setNewContextWindow] = useState("");
  const [newMaxTokens, setNewMaxTokens] = useState("");

  const drafts = useMemo(() => modelDrafts(props.modelsValue), [props.modelsValue]);
  const existingIds = useMemo(
    () => new Set(drafts.map((draft) => draft.model.id).filter(Boolean)),
    [drafts],
  );
  const catalogModels = useMemo(
    () => (props.catalogProvider?.models ?? []).filter((model) => !existingIds.has(model.id)),
    [existingIds, props.catalogProvider],
  );
  const knownCatalogIds = useMemo(
    () => catalogModelIds(props.catalogProvider),
    [props.catalogProvider],
  );

  const addModel = () => {
    const id = newModelId.trim();
    if (!id) {
      return;
    }
    const entry: ProviderModelObject = {
      id,
      name: newModelName.trim() || id,
      ...(newModelApi.trim() ? { api: newModelApi.trim() } : {}),
      contextWindow: parsePositiveNumber(newContextWindow) ?? 128000,
      maxTokens: parsePositiveNumber(newMaxTokens) ?? 4096,
      reasoning: false,
      input: ["text"],
    };
    props.onChange([...drafts.map((draft) => draft.value), entry]);
    setNewModelId("");
    setNewModelName("");
    setNewModelApi("");
    setNewContextWindow("");
    setNewMaxTokens("");
  };

  const addCatalogModel = (model: NonNullable<DeckGoCatalogProvider["models"]>[number]) => {
    props.onChange([...drafts.map((draft) => draft.value), providerModelFromCatalog(model)]);
  };

  const addAllCatalogModels = () => {
    props.onChange([
      ...drafts.map((draft) => draft.value),
      ...catalogModels.map(providerModelFromCatalog),
    ]);
  };

  return (
    <div className="deckgo-surface-tile deck-ui-models-surface">
      <p className="deckgo-surface-label">{t("editor.providerModelEntries")}</p>
      <div className="deckgo-pill-row deck-ui-models-pill-row">
        <span className="deckgo-pill">{t("editor.entriesCount", { count: drafts.length })}</span>
        <span className="deckgo-pill">
          {t("editor.catalogAdditionsCount", { count: catalogModels.length })}
        </span>
      </div>
      {drafts.length === 0 ? (
        <p className="deckgo-note">{t("editor.noProviderModelEntries")}</p>
      ) : (
        <ul className="deckgo-shell-list deck-ui-models-list">
          {drafts.map((draft, index) => {
            const modelId = draft.model.id ?? "";
            const inputModes = Array.isArray(draft.model.input) ? draft.model.input : [];
            const cost = readModelCost(draft.model.cost);
            const headers = readStringRecord(draft.model.headers);
            const compat = readPlainRecord(draft.model.compat);
            return (
              <li key={draft.key}>
                <div className="deckgo-selectable-card deck-ui-models-row">
                  <div className="deckgo-panel-hero-strip deck-ui-models-hero">
                    <div>
                      <strong>{modelId || t("editor.unnamedModel")}</strong>
                      <p className="deckgo-note">
                        {draft.isStringEntry
                          ? t("editor.stringEntry")
                          : t("editor.structuredEntry")}
                      </p>
                    </div>
                    <button
                      className="deckgo-button deck-ui-models-button"
                      type="button"
                      onClick={() => props.onChange(removeModelAt(props.modelsValue, index))}
                    >
                      {t("editor.removeModel", { model: modelId || index + 1 })}
                    </button>
                  </div>
                  <div className="deckgo-grid deckgo-grid-3 deck-ui-models-grid deck-ui-models-spaced">
                    <label className="deckgo-label deck-ui-models-label">
                      <span>{t("editor.id")}</span>
                      <input
                        aria-label={`Provider model id ${modelId || index + 1}`}
                        className="deckgo-input deck-ui-models-input"
                        value={modelId}
                        onChange={(event) =>
                          props.onChange(
                            updateModelAt(props.modelsValue, index, {
                              id: event.target.value.trim(),
                            }),
                          )
                        }
                      />
                    </label>
                    <label className="deckgo-label deck-ui-models-label">
                      <span>{t("editor.name")}</span>
                      <input
                        aria-label={`Provider model name ${modelId || index + 1}`}
                        className="deckgo-input deck-ui-models-input"
                        value={draft.model.name ?? ""}
                        onChange={(event) =>
                          props.onChange(
                            updateModelAt(props.modelsValue, index, {
                              name: event.target.value.trim(),
                            }),
                          )
                        }
                      />
                    </label>
                    <label className="deckgo-label deck-ui-models-label">
                      <span>{t("editor.api")}</span>
                      <input
                        aria-label={`Provider model API ${modelId || index + 1}`}
                        className="deckgo-input deck-ui-models-input"
                        value={draft.model.api ?? ""}
                        onChange={(event) =>
                          props.onChange(
                            updateModelAt(props.modelsValue, index, {
                              api: event.target.value.trim() || undefined,
                            }),
                          )
                        }
                      />
                    </label>
                    <label className="deckgo-label deck-ui-models-label">
                      <span>{t("editor.contextWindow")}</span>
                      <input
                        aria-label={`Provider model context ${modelId || index + 1}`}
                        className="deckgo-input deck-ui-models-input"
                        min={1}
                        type="number"
                        value={draft.model.contextWindow ?? ""}
                        onChange={(event) =>
                          props.onChange(
                            updateModelAt(props.modelsValue, index, {
                              contextWindow: parsePositiveNumber(event.target.value),
                            }),
                          )
                        }
                      />
                    </label>
                    <label className="deckgo-label deck-ui-models-label">
                      <span>{t("editor.maxTokens")}</span>
                      <input
                        aria-label={`Provider model max tokens ${modelId || index + 1}`}
                        className="deckgo-input deck-ui-models-input"
                        min={1}
                        type="number"
                        value={draft.model.maxTokens ?? ""}
                        onChange={(event) =>
                          props.onChange(
                            updateModelAt(props.modelsValue, index, {
                              maxTokens: parsePositiveNumber(event.target.value),
                            }),
                          )
                        }
                      />
                    </label>
                    <label className="deckgo-pill deck-ui-models-check-end">
                      <input
                        aria-label={`Provider model reasoning ${modelId || index + 1}`}
                        checked={draft.model.reasoning === true}
                        onChange={(event) =>
                          props.onChange(
                            updateModelAt(props.modelsValue, index, {
                              reasoning: event.target.checked,
                            }),
                          )
                        }
                        type="checkbox"
                      />{" "}
                      {t("editor.reasoning")}
                    </label>
                  </div>
                  <div className="deckgo-pill-row deck-ui-models-pill-row deck-ui-models-spaced">
                    {(["text", "image"] as const).map((mode) => (
                      <label className="deckgo-pill" key={mode}>
                        <input
                          aria-label={`Provider model ${mode} input ${modelId || index + 1}`}
                          checked={inputModes.includes(mode)}
                          onChange={(event) => {
                            const nextInput = event.target.checked
                              ? [...new Set([...inputModes, mode])]
                              : inputModes.filter((entry) => entry !== mode);
                            props.onChange(
                              updateModelAt(props.modelsValue, index, {
                                input: nextInput.length > 0 ? nextInput : undefined,
                              }),
                            );
                          }}
                          type="checkbox"
                        />{" "}
                        {mode}
                      </label>
                    ))}
                    {modelId && knownCatalogIds.has(modelId) ? (
                      <span className="deckgo-pill is-positive">{t("editor.catalogKnown")}</span>
                    ) : null}
                  </div>
                  <div className="deckgo-grid deckgo-grid-2 deck-ui-models-grid deck-ui-models-spaced">
                    {(
                      [
                        ["input", t("editor.inputCost")],
                        ["output", t("editor.outputCost")],
                        ["cacheRead", t("editor.cacheReadCost")],
                        ["cacheWrite", t("editor.cacheWriteCost")],
                      ] as Array<[keyof NonNullable<ProviderModelObject["cost"]>, string]>
                    ).map(([field, label]) => (
                      <label className="deckgo-label deck-ui-models-label" key={field}>
                        <span>{label}</span>
                        <input
                          aria-label={`Provider model ${field} cost ${modelId || index + 1}`}
                          className="deckgo-input deck-ui-models-input"
                          min={0}
                          step="0.01"
                          type="number"
                          value={cost?.[field] ?? ""}
                          onChange={(event) =>
                            props.onChange(
                              updateModelAt(props.modelsValue, index, {
                                cost: mergeModelCost(
                                  cost,
                                  field,
                                  parseNonNegativeNumber(event.target.value),
                                ),
                              }),
                            )
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <StringRecordEditor
                    addLabel={t("editor.addModelHeader")}
                    ariaPrefix={`Provider model header ${modelId || index + 1}`}
                    emptyText={t("editor.noModelHeaders")}
                    nameLabel={t("editor.headerName")}
                    removeLabel={t("editor.removeHeader")}
                    title={t("editor.modelHeaders")}
                    value={headers}
                    valueLabel={t("editor.headerValue")}
                    onChange={(nextHeaders) =>
                      props.onChange(
                        updateModelAt(props.modelsValue, index, {
                          headers: nextHeaders,
                        }),
                      )
                    }
                  />
                  <div className="deckgo-surface-tile deck-ui-models-surface deck-ui-models-spaced">
                    <p className="deckgo-surface-label">{t("editor.modelCompat")}</p>
                    <div className="deckgo-pill-row deck-ui-models-pill-row">
                      {COMPAT_BOOLEAN_FIELDS.map((field) => (
                        <label className="deckgo-pill" key={field.key}>
                          <input
                            aria-label={`Provider model compat ${field.key} ${modelId || index + 1}`}
                            checked={compat[field.key] === true}
                            onChange={(event) =>
                              props.onChange(
                                updateModelAt(props.modelsValue, index, {
                                  compat: mergeCompatBoolean(
                                    draft.model.compat,
                                    field.key,
                                    event.target.checked,
                                  ),
                                }),
                              )
                            }
                            type="checkbox"
                          />{" "}
                          {t(field.labelKey)}
                        </label>
                      ))}
                    </div>
                    <div className="deckgo-grid deckgo-grid-2 deck-ui-models-grid deck-ui-models-spaced">
                      <label className="deckgo-label deck-ui-models-label">
                        <span>{t("editor.maxTokensField")}</span>
                        <select
                          aria-label={`Provider model compat max tokens field ${modelId || index + 1}`}
                          className="deckgo-input deck-ui-models-input"
                          value={
                            typeof compat.maxTokensField === "string" ? compat.maxTokensField : ""
                          }
                          onChange={(event) =>
                            props.onChange(
                              updateModelAt(props.modelsValue, index, {
                                compat: mergeCompatString(
                                  draft.model.compat,
                                  "maxTokensField",
                                  event.target.value,
                                ),
                              }),
                            )
                          }
                        >
                          <option value="">{t("common.defaultValue")}</option>
                          {COMPAT_MAX_TOKEN_FIELDS.map((field) => (
                            <option key={field} value={field}>
                              {field}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="deckgo-label deck-ui-models-label">
                        <span>{t("editor.thinkingFormat")}</span>
                        <select
                          aria-label={`Provider model compat thinking format ${modelId || index + 1}`}
                          className="deckgo-input deck-ui-models-input"
                          value={
                            typeof compat.thinkingFormat === "string" ? compat.thinkingFormat : ""
                          }
                          onChange={(event) =>
                            props.onChange(
                              updateModelAt(props.modelsValue, index, {
                                compat: mergeCompatString(
                                  draft.model.compat,
                                  "thinkingFormat",
                                  event.target.value,
                                ),
                              }),
                            )
                          }
                        >
                          <option value="">{t("common.defaultValue")}</option>
                          {COMPAT_THINKING_FORMATS.map((format) => (
                            <option key={format} value={format}>
                              {format}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="deckgo-surface-tile deck-ui-models-surface deck-ui-models-spaced">
        <p className="deckgo-surface-label">{t("editor.addProviderModel")}</p>
        <div className="deckgo-grid deckgo-grid-3 deck-ui-models-grid">
          <label className="deckgo-label deck-ui-models-label">
            <span>{t("editor.id")}</span>
            <input
              aria-label="New provider model id"
              className="deckgo-input deck-ui-models-input"
              value={newModelId}
              onChange={(event) => setNewModelId(event.target.value)}
            />
          </label>
          <label className="deckgo-label deck-ui-models-label">
            <span>{t("editor.name")}</span>
            <input
              aria-label="New provider model name"
              className="deckgo-input deck-ui-models-input"
              value={newModelName}
              onChange={(event) => setNewModelName(event.target.value)}
            />
          </label>
          <label className="deckgo-label deck-ui-models-label">
            <span>{t("editor.api")}</span>
            <input
              aria-label="New provider model API"
              className="deckgo-input deck-ui-models-input"
              value={newModelApi}
              onChange={(event) => setNewModelApi(event.target.value)}
            />
          </label>
          <label className="deckgo-label deck-ui-models-label">
            <span>{t("editor.contextWindow")}</span>
            <input
              aria-label="New provider model context"
              className="deckgo-input deck-ui-models-input"
              min={1}
              type="number"
              value={newContextWindow}
              onChange={(event) => setNewContextWindow(event.target.value)}
            />
          </label>
          <label className="deckgo-label deck-ui-models-label">
            <span>{t("editor.maxTokens")}</span>
            <input
              aria-label="New provider model max tokens"
              className="deckgo-input deck-ui-models-input"
              min={1}
              type="number"
              value={newMaxTokens}
              onChange={(event) => setNewMaxTokens(event.target.value)}
            />
          </label>
        </div>
        <div className="deckgo-actions deck-ui-models-actions deck-ui-models-spaced">
          <button
            className="deckgo-button deck-ui-models-button"
            disabled={!newModelId.trim()}
            type="button"
            onClick={addModel}
          >
            {t("editor.addModelEntry")}
          </button>
        </div>
      </div>
      {catalogModels.length > 0 ? (
        <div className="deckgo-surface-tile deck-ui-models-surface deck-ui-models-spaced">
          <p className="deckgo-surface-label">{t("editor.addFromCatalog")}</p>
          <div className="deckgo-actions deck-ui-models-actions deck-ui-models-actions-bottom">
            <button
              className="deckgo-button deck-ui-models-button"
              type="button"
              onClick={addAllCatalogModels}
            >
              {t("editor.addAllCatalogModels", { count: catalogModels.length })}
            </button>
          </div>
          <div className="deckgo-pill-row deck-ui-models-pill-row">
            {catalogModels.map((model) => (
              <button
                className="deckgo-pill"
                key={model.id}
                type="button"
                onClick={() => addCatalogModel(model)}
              >
                {t("editor.addCatalogModel", { model: model.id })}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
