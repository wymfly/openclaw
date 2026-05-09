import { useMemo, useState } from "react";
import type {
  DeckGoCatalogProvider,
  DeckGoModelProviderAuthMode,
  DeckGoModelProviderUpsertRequest,
} from "@/api-types";
import { Banner, Button, Drawer, Input, Select } from "@/design-system/atoms";
import { useTranslations } from "@/i18n/provider";
import { SecretInputField } from "../drawers/SecretInputField";
import type { SecretEditAction } from "../lib/models-selectors";

const STEP_KEYS = ["select", "configure", "review"] as const;
type WizardStep = (typeof STEP_KEYS)[number];

const AUTH_MODES: DeckGoModelProviderAuthMode[] = ["api-key", "aws-sdk", "oauth", "token"];

export interface AddProviderWizardProps {
  open: boolean;
  baseHash: string | undefined;
  catalogProviders: DeckGoCatalogProvider[];
  busy: boolean;
  errorMessage?: string;
  onClose: () => void;
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
}

function emptyDraft(): DraftState {
  return {
    source: "catalog",
    providerId: "",
    api: "",
    baseUrl: "",
    auth: "api-key",
    secret: { kind: "set-ref", ref: "" },
  };
}

export function AddProviderWizard(props: AddProviderWizardProps) {
  const t = useTranslations("models");
  const [step, setStep] = useState<WizardStep>("select");
  const [draft, setDraft] = useState(emptyDraft());

  const sortedCatalog = useMemo(
    () =>
      [...props.catalogProviders].toSorted((left, right) =>
        (left.id ?? "").localeCompare(right.id ?? ""),
      ),
    [props.catalogProviders],
  );

  const ready =
    draft.providerId.trim().length > 0 &&
    (draft.secret.kind !== "set-ref" || draft.secret.ref.trim().length > 0);

  const reset = () => {
    setStep("select");
    setDraft(emptyDraft());
  };

  const close = () => {
    reset();
    props.onClose();
  };

  const pickCatalog = (entry: DeckGoCatalogProvider) => {
    const auth: DeckGoModelProviderAuthMode = AUTH_MODES.includes(
      entry.authType as DeckGoModelProviderAuthMode,
    )
      ? (entry.authType as DeckGoModelProviderAuthMode)
      : "api-key";
    setDraft({
      ...draft,
      source: "catalog",
      catalogId: entry.id,
      providerId: entry.id ?? "",
      api: entry.api ?? "",
      baseUrl: entry.defaultBaseUrl ?? "",
      auth,
    });
  };

  const pickCustom = () => {
    setDraft({
      ...emptyDraft(),
      source: "custom",
    });
  };

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
        ref: draft.secret.ref.trim(),
        refTemplate: draft.secret.refTemplate,
      };
    } else if (draft.secret.kind === "clear") {
      request.apiKey = { action: "clear" };
    } else {
      request.apiKey = { action: "preserve" };
    }
    await props.onSubmit(request);
    reset();
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
                    <li key={entry.id} data-active={draft.catalogId === entry.id || undefined}>
                      <button type="button" onClick={() => pickCatalog(entry)}>
                        <strong>{entry.id}</strong>
                        <span>{entry.api ?? t("provider.apiUnknown")}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <Button variant="ghost" size="sm" onClick={pickCustom}>
                {t("addProvider.useCustom")}
              </Button>
            </div>
          ) : null}
          {step === "configure" ? (
            <div className="models-form">
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
            </div>
          ) : null}
          {step === "review" ? (
            <div className="models-form models-wizard-review">
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
                    ? t("addProvider.review.secretRef", { ref: draft.secret.ref })
                    : draft.secret.kind === "clear"
                      ? t("secret.actions.clear")
                      : t("secret.actions.preserve")}
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
