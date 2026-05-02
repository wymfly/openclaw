import { useEffect, useState } from "react";
import { patchChannelConfig } from "../../../api";
import { useTranslations } from "../../../i18n/provider";

type ChannelDmPolicy = "pairing" | "allowlist" | "open" | "disabled";

const CHANNEL_DM_POLICIES: ChannelDmPolicy[] = ["pairing", "allowlist", "open", "disabled"];
const DEFAULT_RETRY = {
  attempts: 3,
  minDelayMs: 1_000,
  maxDelayMs: 30_000,
  jitter: 0.2,
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numberValue(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readChannelDmPolicy(channel: Record<string, unknown>): ChannelDmPolicy {
  const value = channel.dmPolicy;
  return CHANNEL_DM_POLICIES.includes(value as ChannelDmPolicy)
    ? (value as ChannelDmPolicy)
    : "pairing";
}

function readRetrySettings(channel: Record<string, unknown>) {
  const retry = asRecord(channel.retry);
  return {
    attempts: numberValue(retry, "attempts") ?? DEFAULT_RETRY.attempts,
    minDelayMs: numberValue(retry, "minDelayMs") ?? DEFAULT_RETRY.minDelayMs,
    maxDelayMs: numberValue(retry, "maxDelayMs") ?? DEFAULT_RETRY.maxDelayMs,
    jitter: numberValue(retry, "jitter") ?? DEFAULT_RETRY.jitter,
  };
}

function retryEquals(left: typeof DEFAULT_RETRY, right: typeof DEFAULT_RETRY) {
  return (
    left.attempts === right.attempts &&
    left.minDelayMs === right.minDelayMs &&
    left.maxDelayMs === right.maxDelayMs &&
    left.jitter === right.jitter
  );
}

function parseJsonPatch(draft: string, objectMessage: string): Record<string, unknown> {
  const parsed = JSON.parse(draft) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(objectMessage);
  }
  return parsed as Record<string, unknown>;
}

function isEmptyRecord(record: Record<string, unknown>) {
  return Object.keys(record).length === 0;
}

export function ChannelSettingsEditor(props: {
  channelId: string;
  channel: Record<string, unknown>;
  onSaved: (result: Record<string, unknown>) => Promise<void>;
}) {
  const t = useTranslations("channels");
  const [dmPolicy, setDmPolicy] = useState<ChannelDmPolicy>(() =>
    readChannelDmPolicy(props.channel),
  );
  const [retry, setRetry] = useState(() => readRetrySettings(props.channel));
  const [initialDmPolicy, setInitialDmPolicy] = useState<ChannelDmPolicy>(() =>
    readChannelDmPolicy(props.channel),
  );
  const [initialRetry, setInitialRetry] = useState(() => readRetrySettings(props.channel));
  const [jsonPatchDraft, setJsonPatchDraft] = useState("{}");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const nextDmPolicy = readChannelDmPolicy(props.channel);
    const nextRetry = readRetrySettings(props.channel);
    setDmPolicy(nextDmPolicy);
    setRetry(nextRetry);
    setInitialDmPolicy(nextDmPolicy);
    setInitialRetry(nextRetry);
    setJsonPatchDraft("{}");
    setError("");
  }, [props.channel, props.channelId]);

  const dirty = dmPolicy !== initialDmPolicy || !retryEquals(retry, initialRetry);

  const saveSettings = async () => {
    const patch: Record<string, unknown> = {};
    if (dmPolicy !== initialDmPolicy) {
      patch.dmPolicy = dmPolicy;
    }
    if (!retryEquals(retry, initialRetry)) {
      patch.retry = retry;
    }
    if (Object.keys(patch).length === 0) {
      return;
    }
    setSaving(true);
    try {
      const result = await patchChannelConfig(props.channelId, patch);
      setError("");
      setInitialDmPolicy(dmPolicy);
      setInitialRetry(retry);
      await props.onSaved(result);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t("channelSettingsSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const applyJsonPatch = async () => {
    setSaving(true);
    try {
      const patch = parseJsonPatch(jsonPatchDraft, t("channelJsonPatchObject"));
      if (isEmptyRecord(patch)) {
        setError(t("channelJsonPatchEmpty"));
        return;
      }
      const result = await patchChannelConfig(props.channelId, patch);
      setError("");
      setJsonPatchDraft("{}");
      await props.onSaved(result);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t("channelJsonPatchFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="deckgo-surface-tile deck-ui-channels-surface">
      <p className="deckgo-surface-label">{t("channelSettings")}</p>
      <p className="deckgo-note">{t("channelSettingsDescription")}</p>
      <div className="deckgo-grid deckgo-grid-2 deck-ui-channels-form-grid">
        <label className="deckgo-label">
          <span>{t("dmPolicy")}</span>
          <select
            aria-label="channel dm policy"
            className="deckgo-input deck-ui-channels-input"
            value={dmPolicy}
            onChange={(event) => setDmPolicy(event.target.value as ChannelDmPolicy)}
          >
            {CHANNEL_DM_POLICIES.map((policy) => (
              <option key={policy} value={policy}>
                {policy}
              </option>
            ))}
          </select>
        </label>
        <label className="deckgo-label">
          <span>{t("attempts")}</span>
          <input
            className="deckgo-input deck-ui-channels-input"
            inputMode="numeric"
            value={retry.attempts}
            onChange={(event) =>
              setRetry((current) => ({
                ...current,
                attempts: Number(event.target.value) || DEFAULT_RETRY.attempts,
              }))
            }
            placeholder={t("retryAttemptsPlaceholder")}
          />
        </label>
        <label className="deckgo-label">
          <span>{t("minDelayMs")}</span>
          <input
            className="deckgo-input deck-ui-channels-input"
            inputMode="numeric"
            value={retry.minDelayMs}
            onChange={(event) =>
              setRetry((current) => ({
                ...current,
                minDelayMs: Number(event.target.value) || DEFAULT_RETRY.minDelayMs,
              }))
            }
            placeholder={t("retryMinDelayPlaceholder")}
          />
        </label>
        <label className="deckgo-label">
          <span>{t("maxDelayMs")}</span>
          <input
            className="deckgo-input deck-ui-channels-input"
            inputMode="numeric"
            value={retry.maxDelayMs}
            onChange={(event) =>
              setRetry((current) => ({
                ...current,
                maxDelayMs: Number(event.target.value) || DEFAULT_RETRY.maxDelayMs,
              }))
            }
            placeholder={t("retryMaxDelayPlaceholder")}
          />
        </label>
        <label className="deckgo-label">
          <span>{t("jitter")}</span>
          <input
            className="deckgo-input deck-ui-channels-input"
            inputMode="decimal"
            value={retry.jitter}
            onChange={(event) =>
              setRetry((current) => ({
                ...current,
                jitter: Number(event.target.value) || DEFAULT_RETRY.jitter,
              }))
            }
            placeholder={t("retryJitterPlaceholder")}
          />
        </label>
      </div>
      <div className="deckgo-actions deck-ui-channels-actions deck-ui-channels-actions-offset">
        <button
          className="deckgo-button is-primary deck-ui-channels-button"
          type="button"
          disabled={!dirty || saving}
          onClick={() => void saveSettings()}
        >
          {saving ? t("savingSettings") : t("saveChannelSettings")}
        </button>
      </div>
      <label className="deckgo-label deck-ui-channels-label-offset">
        <span>{t("channelJsonPatch")}</span>
        <textarea
          aria-label="channel json patch"
          className="deckgo-input deckgo-json-textarea deck-ui-channels-input deck-ui-channels-textarea"
          value={jsonPatchDraft}
          onChange={(event) => setJsonPatchDraft(event.target.value)}
          placeholder='{"webhook": {"enabled": true}}'
          rows={6}
        />
      </label>
      <div className="deckgo-actions deck-ui-channels-actions deck-ui-channels-actions-offset">
        <button
          className="deckgo-button deck-ui-channels-button"
          type="button"
          disabled={saving}
          onClick={() => void applyJsonPatch()}
        >
          {saving ? t("applyingPatch") : t("applyJsonPatch")}
        </button>
      </div>
      {error ? <p className="deckgo-note deck-ui-channels-error">{error}</p> : null}
    </div>
  );
}
