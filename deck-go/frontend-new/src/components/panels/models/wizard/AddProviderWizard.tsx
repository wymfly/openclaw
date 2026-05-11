import { useEffect, useMemo, useState } from "react";
import type {
  DeckGoCatalogProvider,
  DeckGoModelProviderAuthMode,
  DeckGoModelProviderUpsertModelInput,
  DeckGoModelProviderUpsertRequest,
} from "@/api-types";
import { Banner, Button, Drawer, Input, Select } from "@/design-system/atoms";
import { useTranslations } from "@/i18n/provider";
import { SecretInputField } from "../drawers/SecretInputField";
import { envSecretRef, secretRefLabel, type SecretEditAction } from "../lib/models-selectors";

const STEP_KEYS = ["select", "configure", "review"] as const;
type WizardStep = (typeof STEP_KEYS)[number];

const AUTH_MODES: DeckGoModelProviderAuthMode[] = ["api-key", "aws-sdk", "oauth", "token"];

export interface AddProviderWizardProps {
  open: boolean;
  baseHash: string | undefined;
  catalogProviders: DeckGoCatalogProvider[];
  existingProviderIds: string[];
  initialProviderId?: string;
  busy: boolean;
  errorMessage?: string;
  onClose: () => void;
  onEditExisting: (providerId: string) => void;
  onSubmit: (request: DeckGoModelProviderUpsertRequest) => Promise<void>;
}

interface DraftState {
  source: "catalog" | "custom";
  providerId: string;
  catalogId?: string;
  api: string;
  baseUrl: string;
  auth: DeckGoModelProviderAuthMode;
  secret: SecretEditAction;
  models: DraftModel[];
}

interface DraftModel extends DeckGoModelProviderUpsertModelInput {
  selected: boolean;
}

function emptyDraft(): DraftState {
  return {
    source: "catalog",
    providerId: "",
    api: "",
    baseUrl: "",
    auth: "api-key",
    secret: { kind: "set-ref", ref: envSecretRef("") },
    models: [],
  };
}

function draftFromCatalog(entry: DeckGoCatalogProvider): DraftState {
  const auth: DeckGoModelProviderAuthMode = AUTH_MODES.includes(
    entry.authType as DeckGoModelProviderAuthMode,
  )
    ? (entry.authType as DeckGoModelProviderAuthMode)
    : "api-key";
  const models = (entry.models ?? []).map((model) => {
    const draftModel: DraftModel = {
      id: model.id,
      selected: true,
    };
    if (model.name) {
      draftModel.name = model.name;
    }
    if (model.contextWindow != null) {
      draftModel.contextWindow = model.contextWindow;
    }
    if (model.maxTokens != null) {
      draftModel.maxTokens = model.maxTokens;
    }
    if (model.reasoning) {
      draftModel.reasoning = "enable";
    }
    return draftModel;
  });
  return {
    ...emptyDraft(),
    source: "catalog",
    catalogId: entry.id,
    providerId: entry.id ?? "",
    api: entry.api ?? "",
    baseUrl: entry.defaultBaseUrl ?? "",
    auth,
    models,
  };
}

function selectedModelInputs(models: DraftModel[]): DeckGoModelProviderUpsertModelInput[] {
  return models.filter((model) => model.selected).map(({ selected: _selected, ...model }) => model);
}

export function AddProviderWizard(props: AddProviderWizardProps) {
  const t = useTranslations("models");
  const [step, setStep] = useState<WizardStep>("select");
  const [draft, setDraft] = useState(emptyDraft());
  const [appliedInitial, setAppliedInitial] = useState<string | undefined>();

  const sortedCatalog = useMemo(
    () =>
      [...props.catalogProviders].toSorted((left, right) =>
        (left.id ?? "").localeCompare(right.id ?? ""),
      ),
    [props.catalogProviders],
  );

  const collisionProviderId = props.existingProviderIds.find(
    (id) => id === draft.providerId.trim(),
  );
  const hasCollision = Boolean(collisionProviderId);

  const ready =
    draft.providerId.trim().length > 0 &&
    !hasCollision &&
    (draft.secret.kind !== "set-ref" || draft.secret.ref.id.trim().length > 0);

  const reset = () => {
    setStep("select");
    setDraft(emptyDraft());
  };

  const close = () => {
    reset();
    props.onClose();
  };

  const pickCatalog = (entry: DeckGoCatalogProvider) => {
    setDraft(draftFromCatalog(entry));
    setStep("configure");
  };

  const pickCustom = () => {
    setDraft({
      ...emptyDraft(),
      source: "custom",
    });
    setStep("configure");
  };

  useEffect(() => {
    if (!props.open) {
      setAppliedInitial(undefined);
      return;
    }
    const marker = props.initialProviderId ? `catalog:${props.initialProviderId}` : "select";
    if (appliedInitial === marker) {
      return;
    }
    if (!props.initialProviderId) {
      reset();
      setAppliedInitial(marker);
      return;
    }
    const initialEntry = props.catalogProviders.find(
      (entry) => entry.id === props.initialProviderId,
    );
    if (!initialEntry) {
      return;
    }
    setDraft(draftFromCatalog(initialEntry));
    setStep("configure");
    setAppliedInitial(marker);
  }, [appliedInitial, props.catalogProviders, props.initialProviderId, props.open]);

  const submit = async () => {
    if (!props.baseHash || !ready) {
      return;
    }
    const request: DeckGoModelProviderUpsertRequest = {
      expectedBaseHash: props.baseHash,
      providerId: draft.providerId.trim(),
      isCreate: true,
      api: draft.api.trim() || undefined,
      baseUrl: draft.baseUrl.trim() || undefined,
      auth: draft.auth,
    };
    if (draft.secret.kind === "set-ref") {
      request.apiKey = {
        action: "set-ref",
        ref: { ...draft.secret.ref, id: draft.secret.ref.id.trim() },
      };
    } else if (draft.secret.kind === "clear") {
      request.apiKey = { action: "clear" };
    } else {
      request.apiKey = { action: "preserve" };
    }
    const models = selectedModelInputs(draft.models);
    if (models.length > 0) {
      request.models = models;
    }
    await props.onSubmit(request);
    reset();
    props.onClose();
  };

  return (
    <Drawer open={props.open} onClose={close} width={560} scrim aria-label={t("addProvider.title")}>
      <div className="models-drawer">
        <header className="models-drawer-head">
          <h3>{t("addProvider.title")}</h3>
          <Button variant="ghost" size="sm" onClick={close}>
            {t("actions.close")}
          </Button>
        </header>
        {props.errorMessage ? <Banner variant="error">{props.errorMessage}</Banner> : null}
        <ol className="models-wizard-steps" aria-label={t("addProvider.stepsLabel")}>
          {STEP_KEYS.map((key, index) => (
            <li key={key} aria-current={step === key} data-active={step === key || undefined}>
              <span className="models-wizard-step-index">{index + 1}</span>
              <span>{t(`addProvider.steps.${key}`)}</span>
            </li>
          ))}
        </ol>
        <section className="models-drawer-body">
          {step === "select" ? (
            <div className="models-form">
              <p className="models-form-hint">{t("addProvider.hints.select")}</p>
              {sortedCatalog.length === 0 ? (
                <p className="models-form-meta">{t("addProvider.noCatalog")}</p>
              ) : (
                <ul className="models-wizard-catalog">
                  {sortedCatalog.map((entry) => (
                    <li
                      key={entry.id}
                      data-active={draft.catalogId === entry.id || undefined}
                      data-configured={props.existingProviderIds.includes(entry.id) || undefined}
                    >
                      <button type="button" onClick={() => pickCatalog(entry)}>
                        <strong>{entry.id}</strong>
                        <span>
                          {props.existingProviderIds.includes(entry.id)
                            ? t("providerLibrary.configured")
                            : t("addProvider.templateSummary", {
                                api: entry.api ?? t("provider.apiUnknown"),
                                count: entry.modelCount ?? entry.models?.length ?? 0,
                              })}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <Button variant="ghost" size="sm" onClick={pickCustom}>
                {t("addProvider.startBlank")}
              </Button>
            </div>
          ) : null}
          {step === "configure" ? (
            <div className="models-form">
              {hasCollision && collisionProviderId ? (
                <Banner variant="warn">
                  <span>
                    {t("addProvider.collision.description", { provider: collisionProviderId })}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      close();
                      props.onEditExisting(collisionProviderId);
                    }}
                  >
                    {t("addProvider.collision.editExisting")}
                  </Button>
                </Banner>
              ) : null}
              <label>
                {t("providerDrawer.fields.providerId")}
                <Input
                  value={draft.providerId}
                  onChange={(event) => setDraft({ ...draft, providerId: event.target.value })}
                />
              </label>
              <label>
                {t("providerDrawer.fields.api")}
                <Input
                  value={draft.api}
                  onChange={(event) => setDraft({ ...draft, api: event.target.value })}
                />
              </label>
              <label>
                {t("providerDrawer.fields.baseUrl")}
                <Input
                  value={draft.baseUrl}
                  onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })}
                />
              </label>
              <label>
                {t("providerDrawer.fields.auth")}
                <Select
                  value={draft.auth}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      auth: event.target.value as DeckGoModelProviderAuthMode,
                    })
                  }
                >
                  {AUTH_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </Select>
              </label>
              <SecretInputField
                label={t("providerDrawer.fields.apiKey")}
                status={undefined}
                action={draft.secret}
                onChange={(secret) => setDraft({ ...draft, secret })}
                description={t("addProvider.hints.secret")}
                testId="add-provider-api-key"
              />
              <fieldset className="models-form-fieldset models-template-models">
                <legend>{t("addProvider.models.title")}</legend>
                {draft.models.length === 0 ? (
                  <p className="models-form-meta">{t("addProvider.models.empty")}</p>
                ) : (
                  <ul className="models-template-model-list">
                    {draft.models.map((model) => (
                      <li key={model.id}>
                        <label className="models-form-checkbox">
                          <input
                            type="checkbox"
                            checked={model.selected}
                            onChange={() =>
                              setDraft({
                                ...draft,
                                models: draft.models.map((candidate) =>
                                  candidate.id === model.id
                                    ? { ...candidate, selected: !candidate.selected }
                                    : candidate,
                                ),
                              })
                            }
                          />
                          <span>
                            <strong>{model.name || model.id}</strong>
                            <small>
                              {model.id}
                              {model.contextWindow
                                ? ` · ${t("rows.contextWindow", { value: model.contextWindow })}`
                                : ""}
                            </small>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="models-form-hint">{t("addProvider.models.hint")}</p>
              </fieldset>
            </div>
          ) : null}
          {step === "review" ? (
            <div className="models-form models-wizard-review">
              {hasCollision && collisionProviderId ? (
                <Banner variant="warn">
                  {t("addProvider.collision.description", { provider: collisionProviderId })}
                </Banner>
              ) : null}
              <dl>
                <dt>{t("providerDrawer.fields.providerId")}</dt>
                <dd>{draft.providerId || "—"}</dd>
                <dt>{t("providerDrawer.fields.api")}</dt>
                <dd>{draft.api || "—"}</dd>
                <dt>{t("providerDrawer.fields.baseUrl")}</dt>
                <dd>{draft.baseUrl || "—"}</dd>
                <dt>{t("providerDrawer.fields.auth")}</dt>
                <dd>{draft.auth}</dd>
                <dt>{t("providerDrawer.fields.apiKey")}</dt>
                <dd>
                  {draft.secret.kind === "set-ref"
                    ? t("addProvider.review.secretRef", { ref: secretRefLabel(draft.secret.ref) })
                    : draft.secret.kind === "clear"
                      ? t("secret.actions.clear")
                      : t("secret.actions.preserve")}
                </dd>
                <dt>{t("addProvider.models.reviewLabel")}</dt>
                <dd>
                  {t("addProvider.models.reviewCount", {
                    count: selectedModelInputs(draft.models).length,
                  })}
                </dd>
              </dl>
            </div>
          ) : null}
        </section>
        <footer className="models-drawer-foot">
          {step !== "select" ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep(step === "review" ? "configure" : "select")}
              disabled={props.busy}
            >
              {t("actions.back")}
            </Button>
          ) : null}
          {step !== "review" ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setStep(step === "select" ? "configure" : "review")}
              disabled={props.busy || (step === "configure" && !ready)}
            >
              {t("actions.next")}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() => void submit()}
              disabled={props.busy || !props.baseHash || !ready}
            >
              {props.busy ? t("actions.saving") : t("addProvider.submit")}
            </Button>
          )}
        </footer>
      </div>
    </Drawer>
  );
}
