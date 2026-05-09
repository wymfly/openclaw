import { useEffect, useState } from "react";
import type {
  DeckGoModelProviderAuthMode,
  DeckGoModelProviderDetail,
  DeckGoModelProviderEntry,
  DeckGoModelProviderUpsertRequest,
} from "@/api-types";
import { Banner, Button, Drawer, Input, Select, Tab, Toggle } from "@/design-system/atoms";
import { useTranslations } from "@/i18n/provider";
import type { SecretEditAction } from "../lib/models-selectors";
import { SecretInputField } from "./SecretInputField";

const PROVIDER_TABS = ["overview", "identity", "networking", "models", "advanced"] as const;
type ProviderTab = (typeof PROVIDER_TABS)[number];

export interface ProviderDrawerProps {
  open: boolean;
  baseHash: string | undefined;
  provider: DeckGoModelProviderEntry | DeckGoModelProviderDetail | undefined;
  isCreate: boolean;
  busy: boolean;
  conflict: boolean;
  errorMessage?: string;
  onClose: () => void;
  onSubmit: (request: DeckGoModelProviderUpsertRequest) => Promise<void>;
}

const AUTH_MODES: DeckGoModelProviderAuthMode[] = ["api-key", "aws-sdk", "oauth", "token"];

export function ProviderDrawer(props: ProviderDrawerProps) {
  const t = useTranslations("models");
  const provider = props.provider;
  const [tab, setTab] = useState<ProviderTab>("overview");
  const [providerId, setProviderId] = useState(provider?.id ?? "");
  const [api, setApi] = useState(provider?.api ?? "");
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? "");
  const [auth, setAuth] = useState<DeckGoModelProviderAuthMode>(provider?.auth ?? "api-key");
  const [authHeader, setAuthHeader] = useState(provider?.authHeader ?? false);
  const [injectNumCtx, setInjectNumCtx] = useState(provider?.injectNumCtxForOpenAICompat ?? false);
  const [secret, setSecret] = useState<SecretEditAction>({ kind: "preserve" });

  useEffect(() => {
    setTab("overview");
    setProviderId(provider?.id ?? "");
    setApi(provider?.api ?? "");
    setBaseUrl(provider?.baseUrl ?? "");
    setAuth(provider?.auth ?? "api-key");
    setAuthHeader(provider?.authHeader ?? false);
    setInjectNumCtx(provider?.injectNumCtxForOpenAICompat ?? false);
    setSecret({ kind: "preserve" });
  }, [provider, props.open]);

  const submit = async () => {
    if (!props.baseHash) {
      return;
    }
    if (!providerId.trim()) {
      return;
    }
    const request: DeckGoModelProviderUpsertRequest = {
      expectedBaseHash: props.baseHash,
      providerId: providerId.trim(),
      isCreate: props.isCreate,
      api: api.trim() || undefined,
      baseUrl: baseUrl.trim() || undefined,
      auth,
      authHeader,
      injectNumCtxForOpenAICompat: injectNumCtx,
    };
    if (secret.kind === "set-ref") {
      request.apiKey = {
        action: "set-ref",
        ref: secret.ref,
        refTemplate: secret.refTemplate,
      };
    } else if (secret.kind === "clear") {
      request.apiKey = { action: "clear" };
    } else {
      request.apiKey = { action: "preserve" };
    }
    await props.onSubmit(request);
  };

  return (
    <Drawer
      open={props.open}
      onClose={props.onClose}
      width={520}
      scrim
      aria-label={t("providerDrawer.title")}
    >
      <div className="models-drawer">
        <header className="models-drawer-head">
          <h3>
            {props.isCreate ? t("providerDrawer.titleCreate") : t("providerDrawer.titleEdit")}
          </h3>
          <Button variant="ghost" size="sm" onClick={props.onClose}>
            {t("actions.close")}
          </Button>
        </header>
        {props.conflict ? <Banner variant="warn">{t("conflict.baseHashStale")}</Banner> : null}
        {props.errorMessage ? <Banner variant="error">{props.errorMessage}</Banner> : null}
        <nav className="models-drawer-tabs" role="tablist">
          {PROVIDER_TABS.map((value) => (
            <Tab
              key={value}
              role="tab"
              aria-selected={tab === value}
              active={tab === value}
              onClick={() => setTab(value)}
            >
              {t(`providerDrawer.tabs.${value}`)}
            </Tab>
          ))}
        </nav>
        <section className="models-drawer-body" role="tabpanel">
          {tab === "overview" ? (
            <div className="models-form">
              <label>
                {t("providerDrawer.fields.providerId")}
                <Input
                  value={providerId}
                  onChange={(event) => setProviderId(event.target.value)}
                  disabled={!props.isCreate}
                  placeholder="openai"
                />
              </label>
              <p className="models-form-hint">{t("providerDrawer.hints.providerId")}</p>
            </div>
          ) : null}
          {tab === "identity" ? (
            <div className="models-form">
              <label>
                {t("providerDrawer.fields.api")}
                <Input
                  value={api}
                  onChange={(event) => setApi(event.target.value)}
                  placeholder="openai-responses"
                />
              </label>
              <label>
                {t("providerDrawer.fields.auth")}
                <Select
                  value={auth}
                  onChange={(event) => setAuth(event.target.value as DeckGoModelProviderAuthMode)}
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
                status={provider?.apiKeyStatus}
                action={secret}
                onChange={setSecret}
                description={t("providerDrawer.hints.apiKey")}
                testId="provider-api-key"
              />
            </div>
          ) : null}
          {tab === "networking" ? (
            <div className="models-form">
              <label>
                {t("providerDrawer.fields.baseUrl")}
                <Input
                  value={baseUrl}
                  onChange={(event) => setBaseUrl(event.target.value)}
                  placeholder="https://api.openai.com/v1"
                />
              </label>
              <div className="models-form-toggle">
                <Toggle
                  checked={authHeader}
                  onCheckedChange={setAuthHeader}
                  aria-label={t("providerDrawer.fields.authHeader")}
                />
                <span>{t("providerDrawer.fields.authHeader")}</span>
              </div>
              <div className="models-form-toggle">
                <Toggle
                  checked={injectNumCtx}
                  onCheckedChange={setInjectNumCtx}
                  aria-label={t("providerDrawer.fields.injectNumCtx")}
                />
                <span>{t("providerDrawer.fields.injectNumCtx")}</span>
              </div>
            </div>
          ) : null}
          {tab === "models" ? (
            <ul className="models-drawer-list">
              {!provider || provider.models.length === 0 ? (
                <li className="models-drawer-empty">{t("provider.noModels")}</li>
              ) : (
                provider.models.map((model) => (
                  <li key={model.id}>
                    <span>{model.name ?? model.id}</span>
                    <span className="models-drawer-list-meta">{model.id}</span>
                  </li>
                ))
              )}
            </ul>
          ) : null}
          {tab === "advanced" ? (
            <div className="models-form">
              <p className="models-form-hint">{t("providerDrawer.hints.advanced")}</p>
              <ul className="models-drawer-summary">
                <li>
                  {t("providerDrawer.summary.requestPresent", {
                    state: provider?.request.hasRequest ? "yes" : "no",
                  })}
                </li>
                <li>
                  {t("providerDrawer.summary.headersPresent", {
                    state: provider?.hasHeaders ? "yes" : "no",
                  })}
                </li>
                <li>
                  {t("providerDrawer.summary.modelCount", {
                    count: provider?.modelCount ?? 0,
                  })}
                </li>
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
            disabled={props.busy || !props.baseHash || !providerId.trim()}
          >
            {props.busy ? t("actions.saving") : t("actions.save")}
          </Button>
        </footer>
      </div>
    </Drawer>
  );
}
