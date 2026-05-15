import { useEffect, useState } from "react";
import type {
  DeckGoRuntimeCapabilities,
  DeckGoRuntimeEndpointPutRequest,
  DeckGoRuntimeEndpointResponse,
  DeckGoRuntimeEndpointTestRequest,
  DeckGoRuntimeEndpointTestResponse,
} from "../../../../contracts/generated/ts/deck-api.generated";
import { Badge, Button, Input, Toggle } from "../../design-system/atoms";
import { useTranslations } from "../../i18n/provider";
import { JsonDetails } from "../shared/ShellComponents";
import { ReadOnlyField } from "./ReadOnlyField";

const TOKEN_UNCHANGED_SENTINEL = "__unchanged__";

type EndpointSectionProps = {
  capabilities: DeckGoRuntimeCapabilities;
  value: DeckGoRuntimeEndpointResponse;
  onSave: (payload: DeckGoRuntimeEndpointPutRequest) => Promise<DeckGoRuntimeEndpointResponse>;
  onTest: (
    payload?: DeckGoRuntimeEndpointTestRequest,
  ) => Promise<DeckGoRuntimeEndpointTestResponse>;
};

function formatBool(value: boolean, labels: { yes: string; no: string }) {
  return value ? labels.yes : labels.no;
}

export function EndpointSection({ capabilities, value, onSave, onTest }: EndpointSectionProps) {
  const t = useTranslations("settings");
  const [url, setUrl] = useState(value.url);
  const [token, setToken] = useState("");
  const [tlsVerify, setTLSVerify] = useState(value.tlsVerify);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [testResult, setTestResult] = useState<DeckGoRuntimeEndpointTestResponse | null>(null);
  const locked = !capabilities.endpointMutable;
  const source = value.source?.trim();
  const sourceKey =
    source === "openclaw-state"
      ? "endpointSources.openclawState"
      : source === "env"
        ? "endpointSources.env"
        : source === "json"
          ? "endpointSources.json"
          : "";
  const sourceLabel = sourceKey && t.has(sourceKey) ? t(sourceKey) : source || t("notAvailable");
  const readOnlyBadge =
    source === "openclaw-state"
      ? t("setViaOpenClawState")
      : source === "env"
        ? t("setViaEnv")
        : sourceLabel;

  useEffect(() => {
    setUrl(value.url);
    setToken("");
    setTLSVerify(value.tlsVerify);
    setError("");
  }, [value.source, value.tlsVerify, value.url]);

  const buildPayload = (): DeckGoRuntimeEndpointPutRequest => ({
    url,
    token: token.trim() || (value.tokenConfigured ? TOKEN_UNCHANGED_SENTINEL : ""),
    tlsVerify,
  });

  const isDirty = url !== value.url || token !== "" || tlsVerify !== value.tlsVerify;

  const runSave = async () => {
    setSaving(true);
    setError("");
    try {
      const next = await onSave(buildPayload());
      setUrl(next.url);
      setToken("");
      setTLSVerify(next.tlsVerify);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t("endpointSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    setTesting(true);
    setError("");
    setTestResult(null);
    try {
      const result = await onTest(locked || !isDirty ? undefined : buildPayload());
      setTestResult(result);
    } catch (testError) {
      setTestResult({
        ok: false,
        tlsVerified: tlsVerify,
        error: testError instanceof Error ? testError.message : t("endpointTestFailed"),
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <section
      className="settings-surface settings-endpoint-section"
      data-testid="endpoint-section"
      aria-expanded={capabilities.endpointMutable && !capabilities.configured ? "true" : "false"}
    >
      <div className="settings-section-heading">
        <div>
          <h3>{t("endpointTitle")}</h3>
          <p>{t("endpointDescription")}</p>
        </div>
        <Badge>{t("endpointSource", { source: sourceLabel })}</Badge>
      </div>
      <div className="settings-status-row">
        <Badge variant={value.tokenConfigured ? "ok" : "neutral"}>
          {t("endpointTokenConfigured", {
            value: formatBool(value.tokenConfigured, { yes: t("yes"), no: t("no") }),
          })}
        </Badge>
        <Badge>{t("endpointTLSVerify")}</Badge>
        {locked ? <Badge>{readOnlyBadge}</Badge> : null}
      </div>

      {locked ? (
        <div className="settings-form-grid">
          <ReadOnlyField badge={readOnlyBadge} label={t("endpointUrl")} value={value.url} />
          <ReadOnlyField
            badge={readOnlyBadge}
            label={t("endpointToken")}
            value={value.tokenConfigured ? t("configured") : t("notConfigured")}
          />
          <ReadOnlyField
            badge={readOnlyBadge}
            label={t("endpointTLSVerify")}
            value={formatBool(value.tlsVerify, { yes: t("yes"), no: t("no") })}
          />
        </div>
      ) : (
        <>
          <div className="settings-form-grid">
            <label className="settings-label">
              <span className="settings-label__text">{t("endpointUrl")}</span>
              <Input
                className="settings-input"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
              />
            </label>
            <label className="settings-label">
              <span className="settings-label__text">{t("endpointToken")}</span>
              <Input
                className="settings-input"
                type="password"
                autoComplete="new-password"
                value={token}
                placeholder={
                  value.tokenConfigured ? t("tokenUnchangedPlaceholder") : t("endpointToken")
                }
                onChange={(event) => setToken(event.target.value)}
              />
            </label>
          </div>
          <label className="settings-toggle-field">
            <Toggle
              aria-label={t("endpointTLSVerify")}
              checked={tlsVerify}
              onCheckedChange={setTLSVerify}
            />
            <span>{t("endpointTLSVerify")}</span>
          </label>
        </>
      )}

      {capabilities.endpointMutable ? (
        <div className="settings-actions">
          <Button variant="primary" size="sm" disabled={saving} onClick={() => void runSave()}>
            {saving ? t("savingSettings") : t("saveEndpoint")}
          </Button>
          <Button size="sm" disabled={testing} onClick={() => void runTest()}>
            {testing ? t("testingConnection") : t("testEndpoint")}
          </Button>
        </div>
      ) : null}

      {error ? <p className="settings-panel__error">{error}</p> : null}
      {testResult ? (
        <JsonDetails title={t("endpointTestResult")} payload={{ url, ...testResult }} />
      ) : null}
    </section>
  );
}
