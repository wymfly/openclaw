import { useEffect, useState } from "react";
import type {
  DeckGoRuntimeCapabilities,
  DeckGoRuntimeEndpointPutRequest,
  DeckGoRuntimeEndpointResponse,
  DeckGoRuntimeEndpointTestRequest,
  DeckGoRuntimeEndpointTestResponse,
} from "../../../../contracts/generated/ts/deck-api.generated";
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
      className="deckgo-surface-tile deck-ui-settings-surface"
      data-testid="endpoint-section"
      aria-expanded={capabilities.endpointMutable && !capabilities.configured ? "true" : "false"}
    >
      <p className="deckgo-surface-label">{t("endpointTitle")}</p>
      <p className="deckgo-note">{t("endpointDescription")}</p>
      <div className="deckgo-pill-row deck-ui-settings-status-row">
        <span className="deckgo-pill">
          {t("endpointSource", { source: value.source || t("notAvailable") })}
        </span>
        <span className={`deckgo-pill ${value.tokenConfigured ? "is-positive" : "is-muted"}`}>
          {t("endpointTokenConfigured", {
            value: formatBool(value.tokenConfigured, { yes: t("yes"), no: t("no") }),
          })}
        </span>
        {locked ? <span className="deckgo-pill">{t("setViaEnv")}</span> : null}
      </div>

      {locked ? (
        <div className="deckgo-form-row deck-ui-settings-form-row">
          <ReadOnlyField badge={t("setViaEnv")} label={t("endpointUrl")} value={value.url} />
          <ReadOnlyField
            badge={t("setViaEnv")}
            label={t("endpointToken")}
            value={value.tokenConfigured ? t("configured") : t("notConfigured")}
          />
          <ReadOnlyField
            badge={t("setViaEnv")}
            label={t("endpointTLSVerify")}
            value={formatBool(value.tlsVerify, { yes: t("yes"), no: t("no") })}
          />
        </div>
      ) : (
        <>
          <div className="deckgo-form-row deck-ui-settings-form-row">
            <label className="deckgo-label deck-ui-settings-label">
              <span>{t("endpointUrl")}</span>
              <input
                className="deckgo-input deck-ui-settings-input"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
              />
            </label>
            <label className="deckgo-label deck-ui-settings-label">
              <span>{t("endpointToken")}</span>
              <input
                className="deckgo-input deck-ui-settings-input"
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
          <label className="deckgo-checkbox-row deck-ui-settings-check">
            <input
              type="checkbox"
              checked={tlsVerify}
              onChange={(event) => setTLSVerify(event.target.checked)}
            />
            <span>{t("endpointTLSVerify")}</span>
          </label>
        </>
      )}

      <div className="deckgo-actions deck-ui-settings-actions">
        {capabilities.endpointMutable ? (
          <button
            className="deckgo-button deck-ui-settings-button is-primary"
            type="button"
            disabled={saving}
            onClick={() => void runSave()}
          >
            {saving ? t("savingSettings") : t("saveEndpoint")}
          </button>
        ) : null}
        <button
          className="deckgo-button deck-ui-settings-button"
          type="button"
          disabled={testing}
          onClick={() => void runTest()}
        >
          {testing ? t("testingConnection") : t("testEndpoint")}
        </button>
      </div>

      {error ? <p className="deckgo-note deck-ui-settings-error">{error}</p> : null}
      {testResult ? (
        <JsonDetails title={t("endpointTestResult")} payload={{ url, ...testResult }} />
      ) : null}
    </section>
  );
}
