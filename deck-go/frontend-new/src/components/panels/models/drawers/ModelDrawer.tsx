import { useEffect, useState } from "react";
import type {
  DeckGoModelEntry,
  DeckGoModelInputModality,
  DeckGoModelUpsertRequest,
} from "@/api-types";
import { Banner, Button, Drawer, Input, Tab, Toggle } from "@/design-system/atoms";
import { useTranslations } from "@/i18n/provider";
import {
  booleanToggleAction,
  modelDefaultRoles,
  modelUsageRelations,
  modelUsageRoles,
} from "../lib/models-selectors";

const MODEL_TABS = ["overview", "identity", "capacity", "cost", "networking", "advanced"] as const;
type ModelTab = (typeof MODEL_TABS)[number];

const INPUT_MODALITIES: DeckGoModelInputModality[] = ["text", "image"];
const DEFAULT_INPUT_MODALITIES: DeckGoModelInputModality[] = ["text"];

export interface ModelDrawerProps {
  open: boolean;
  baseHash: string | undefined;
  providerId: string;
  model: DeckGoModelEntry | undefined;
  isCreate: boolean;
  busy: boolean;
  conflict: boolean;
  errorMessage?: string;
  onClose: () => void;
  onSubmit: (request: DeckGoModelUpsertRequest) => Promise<void>;
}

function toNumberOrUndefined(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function ModelDrawer(props: ModelDrawerProps) {
  const t = useTranslations("models");
  const model = props.model;
  const defaultRoles = model ? modelDefaultRoles(model) : [];
  const usageRelations = model ? modelUsageRelations(model) : [];
  const usageRoles = model ? modelUsageRoles(model) : [];
  const [tab, setTab] = useState<ModelTab>("overview");
  const [modelId, setModelId] = useState(model?.id ?? "");
  const [name, setName] = useState(model?.name ?? "");
  const [api, setApi] = useState(model?.api ?? "");
  const [inheritsApi, setInheritsApi] = useState(model?.inheritsApi ?? true);
  const [reasoning, setReasoning] = useState(Boolean(model?.reasoning));
  const [inputs, setInputs] = useState(
    new Set<DeckGoModelInputModality>(model?.inputs ?? DEFAULT_INPUT_MODALITIES),
  );
  const [contextWindow, setContextWindow] = useState(
    model?.contextWindow != null ? String(model.contextWindow) : "",
  );
  const [contextTokens, setContextTokens] = useState(
    model?.contextTokens != null ? String(model.contextTokens) : "",
  );
  const [maxTokens, setMaxTokens] = useState(
    model?.maxTokens != null ? String(model.maxTokens) : "",
  );
  const [costInput, setCostInput] = useState(
    model?.cost?.input != null ? String(model.cost.input) : "",
  );
  const [costOutput, setCostOutput] = useState(
    model?.cost?.output != null ? String(model.cost.output) : "",
  );
  const [costCacheRead, setCostCacheRead] = useState(
    model?.cost?.cacheRead != null ? String(model.cost.cacheRead) : "",
  );
  const [costCacheWrite, setCostCacheWrite] = useState(
    model?.cost?.cacheWrite != null ? String(model.cost.cacheWrite) : "",
  );

  useEffect(() => {
    setTab("overview");
    setModelId(model?.id ?? "");
    setName(model?.name ?? "");
    setApi(model?.api ?? "");
    setInheritsApi(model?.inheritsApi ?? true);
    setReasoning(Boolean(model?.reasoning));
    setInputs(new Set<DeckGoModelInputModality>(model?.inputs ?? DEFAULT_INPUT_MODALITIES));
    setContextWindow(model?.contextWindow != null ? String(model.contextWindow) : "");
    setContextTokens(model?.contextTokens != null ? String(model.contextTokens) : "");
    setMaxTokens(model?.maxTokens != null ? String(model.maxTokens) : "");
    setCostInput(model?.cost?.input != null ? String(model.cost.input) : "");
    setCostOutput(model?.cost?.output != null ? String(model.cost.output) : "");
    setCostCacheRead(model?.cost?.cacheRead != null ? String(model.cost.cacheRead) : "");
    setCostCacheWrite(model?.cost?.cacheWrite != null ? String(model.cost.cacheWrite) : "");
  }, [model, props.open]);

  const toggleInput = (modality: DeckGoModelInputModality) => {
    setInputs((prev) => {
      const next = new Set(prev);
      if (next.has(modality)) {
        next.delete(modality);
      } else {
        next.add(modality);
      }
      return next;
    });
  };

  const submit = async () => {
    if (!props.baseHash || !modelId.trim()) {
      return;
    }
    const request: DeckGoModelUpsertRequest = {
      expectedBaseHash: props.baseHash,
      providerId: props.providerId,
      modelId: modelId.trim(),
      isCreate: props.isCreate,
      name: name.trim() || undefined,
      api: api.trim() || undefined,
      inheritsApi,
      reasoning: booleanToggleAction(reasoning),
      inputs: Array.from(inputs),
      contextWindow: toNumberOrUndefined(contextWindow),
      contextTokens: toNumberOrUndefined(contextTokens),
      maxTokens: toNumberOrUndefined(maxTokens),
      cost: {
        input: toNumberOrUndefined(costInput),
        output: toNumberOrUndefined(costOutput),
        cacheRead: toNumberOrUndefined(costCacheRead),
        cacheWrite: toNumberOrUndefined(costCacheWrite),
      },
    };
    await props.onSubmit(request);
  };

  return (
    <Drawer
      open={props.open}
      onClose={props.onClose}
      width={520}
      scrim
      aria-label={t("modelDrawer.title")}
    >
      <div className="models-drawer">
        <header className="models-drawer-head">
          <h3>
            {props.isCreate
              ? t("modelDrawer.titleCreate", { provider: props.providerId })
              : t("modelDrawer.titleEdit", { provider: props.providerId })}
          </h3>
          <Button variant="ghost" size="sm" onClick={props.onClose}>
            {t("actions.close")}
          </Button>
        </header>
        {props.conflict ? <Banner variant="warn">{t("conflict.baseHashStale")}</Banner> : null}
        {props.errorMessage ? <Banner variant="error">{props.errorMessage}</Banner> : null}
        <nav className="models-drawer-tabs" role="tablist">
          {MODEL_TABS.map((value) => (
            <Tab
              key={value}
              role="tab"
              aria-selected={tab === value}
              active={tab === value}
              onClick={() => setTab(value)}
            >
              {t(`modelDrawer.tabs.${value}`)}
            </Tab>
          ))}
        </nav>
        <section className="models-drawer-body" role="tabpanel">
          {tab === "overview" ? (
            <div className="models-form">
              {!props.isCreate && (usageRelations.length > 0 || usageRoles.length > 0) ? (
                <Banner variant="info">{t("modelDrawer.hints.policyOwner")}</Banner>
              ) : null}
              <label>
                {t("modelDrawer.fields.modelId")}
                <Input
                  value={modelId}
                  onChange={(event) => setModelId(event.target.value)}
                  disabled={!props.isCreate}
                  placeholder="gpt-5.4"
                />
              </label>
              <label>
                {t("modelDrawer.fields.name")}
                <Input value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              {!props.isCreate && (usageRelations.length > 0 || usageRoles.length > 0) ? (
                <ul className="models-drawer-summary">
                  {usageRelations.length > 0 ? (
                    <li>
                      {t("modelDrawer.summary.usageRelations", {
                        relations: usageRelations
                          .map((relation) => t(`impactDialog.relation.${relation}`))
                          .join(", "),
                      })}
                    </li>
                  ) : null}
                  {usageRoles.length > 0 ? (
                    <li>
                      {t("modelDrawer.summary.usageRoles", {
                        roles: usageRoles.join(", "),
                      })}
                    </li>
                  ) : null}
                  {defaultRoles.length > 0 ? (
                    <li>
                      {t("modelDrawer.summary.defaultRoles", {
                        roles: defaultRoles.join(", "),
                      })}
                    </li>
                  ) : null}
                </ul>
              ) : null}
            </div>
          ) : null}
          {tab === "identity" ? (
            <div className="models-form">
              <label>
                {t("modelDrawer.fields.api")}
                <Input
                  value={api}
                  onChange={(event) => setApi(event.target.value)}
                  disabled={inheritsApi}
                  placeholder={t("modelDrawer.fields.apiPlaceholder")}
                />
              </label>
              <div className="models-form-toggle">
                <Toggle
                  checked={inheritsApi}
                  onCheckedChange={setInheritsApi}
                  aria-label={t("modelDrawer.fields.inheritsApi")}
                />
                <span>{t("modelDrawer.fields.inheritsApi")}</span>
              </div>
              <div className="models-form-toggle">
                <Toggle
                  checked={reasoning}
                  onCheckedChange={setReasoning}
                  aria-label={t("modelDrawer.fields.reasoning")}
                />
                <span>{t("modelDrawer.fields.reasoning")}</span>
              </div>
              <fieldset className="models-form-fieldset">
                <legend>{t("modelDrawer.fields.inputs")}</legend>
                {INPUT_MODALITIES.map((modality) => (
                  <label key={modality} className="models-form-checkbox">
                    <input
                      type="checkbox"
                      checked={inputs.has(modality)}
                      onChange={() => toggleInput(modality)}
                    />
                    <span>{modality}</span>
                  </label>
                ))}
              </fieldset>
            </div>
          ) : null}
          {tab === "capacity" ? (
            <div className="models-form">
              <label>
                {t("modelDrawer.fields.contextWindow")}
                <Input
                  inputMode="numeric"
                  value={contextWindow}
                  onChange={(event) => setContextWindow(event.target.value)}
                />
              </label>
              <label>
                {t("modelDrawer.fields.contextTokens")}
                <Input
                  inputMode="numeric"
                  value={contextTokens}
                  onChange={(event) => setContextTokens(event.target.value)}
                />
              </label>
              <label>
                {t("modelDrawer.fields.maxTokens")}
                <Input
                  inputMode="numeric"
                  value={maxTokens}
                  onChange={(event) => setMaxTokens(event.target.value)}
                />
              </label>
            </div>
          ) : null}
          {tab === "cost" ? (
            <div className="models-form">
              <label>
                {t("modelDrawer.fields.costInput")}
                <Input value={costInput} onChange={(event) => setCostInput(event.target.value)} />
              </label>
              <label>
                {t("modelDrawer.fields.costOutput")}
                <Input value={costOutput} onChange={(event) => setCostOutput(event.target.value)} />
              </label>
              <label>
                {t("modelDrawer.fields.costCacheRead")}
                <Input
                  value={costCacheRead}
                  onChange={(event) => setCostCacheRead(event.target.value)}
                />
              </label>
              <label>
                {t("modelDrawer.fields.costCacheWrite")}
                <Input
                  value={costCacheWrite}
                  onChange={(event) => setCostCacheWrite(event.target.value)}
                />
              </label>
            </div>
          ) : null}
          {tab === "networking" ? (
            <div className="models-form">
              <p className="models-form-hint">{t("modelDrawer.hints.networking")}</p>
              <p className="models-form-meta">
                {t("modelDrawer.summary.headers", {
                  state: model?.hasHeaders ? "yes" : "no",
                })}
              </p>
            </div>
          ) : null}
          {tab === "advanced" ? (
            <div className="models-form">
              <p className="models-form-hint">{t("modelDrawer.hints.advanced")}</p>
              <ul className="models-drawer-summary">
                <li>
                  {t("modelDrawer.summary.compatPresent", {
                    state: model?.compat.hasCompat ? "yes" : "no",
                  })}
                </li>
                {model?.compat.flags && model.compat.flags.length > 0 ? (
                  <li>
                    {t("modelDrawer.summary.compatFlags", {
                      flags: model.compat.flags.join(","),
                    })}
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}
        </section>
        <footer className="models-drawer-foot">
          <Button variant="ghost" size="sm" onClick={props.onClose} disabled={props.busy}>
            {t("actions.cancel")}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void submit()}
            disabled={props.busy || !props.baseHash || !modelId.trim()}
          >
            {props.busy ? t("actions.saving") : t("actions.save")}
          </Button>
        </footer>
      </div>
    </Drawer>
  );
}
