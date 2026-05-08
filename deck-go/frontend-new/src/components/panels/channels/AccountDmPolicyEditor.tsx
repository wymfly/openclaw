import { useEffect, useState } from "react";
import { usePatchChannelConfigMutation } from "../../../data/modules/channels";
import { useTranslations } from "../../../i18n/provider";

type DmPolicy = "pairing" | "allowlist" | "open" | "disabled";

const DM_POLICIES: DmPolicy[] = ["pairing", "allowlist", "open", "disabled"];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readAccountPolicy(payload: Record<string, unknown>): DmPolicy {
  const direct = payload.dmPolicy;
  if (DM_POLICIES.includes(direct as DmPolicy)) {
    return direct as DmPolicy;
  }
  const dm = asRecord(payload.dm);
  const nested = dm.policy;
  return DM_POLICIES.includes(nested as DmPolicy) ? (nested as DmPolicy) : "pairing";
}

export function AccountDmPolicyEditor(props: {
  channelId: string;
  accountId: string;
  accountPayload: Record<string, unknown>;
  onSaved: (result: Record<string, unknown>) => Promise<void>;
}) {
  const t = useTranslations("channels");
  const [policy, setPolicy] = useState<DmPolicy>(() => readAccountPolicy(props.accountPayload));
  const [initialPolicy, setInitialPolicy] = useState<DmPolicy>(() =>
    readAccountPolicy(props.accountPayload),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const patchChannelConfigMutation = usePatchChannelConfigMutation();

  useEffect(() => {
    const nextPolicy = readAccountPolicy(props.accountPayload);
    setPolicy(nextPolicy);
    setInitialPolicy(nextPolicy);
    setError("");
  }, [props.accountId, props.accountPayload]);

  const savePolicy = async () => {
    if (policy === initialPolicy) {
      return;
    }
    setSaving(true);
    try {
      const result = await patchChannelConfigMutation.mutateAsync({
        channelId: props.channelId,
        patch: {
          accounts: {
            [props.accountId]: {
              dm: { policy },
            },
          },
        },
      });
      setInitialPolicy(policy);
      setError("");
      await props.onSaved(result);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t("accountPolicySaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="deckgo-form-grid deck-ui-channels-form-grid deck-ui-channels-actions-offset">
      <label className="deckgo-label">
        <span>{t("accountDmOverride")}</span>
        <select
          aria-label={`account dm policy ${props.accountId}`}
          className="deckgo-input deck-ui-channels-input"
          value={policy}
          onChange={(event) => setPolicy(event.target.value as DmPolicy)}
        >
          {DM_POLICIES.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>
      </label>
      <div className="deckgo-actions deck-ui-channels-actions">
        <button
          className="deckgo-button deck-ui-channels-button"
          type="button"
          disabled={policy === initialPolicy || saving}
          onClick={() => void savePolicy()}
        >
          {saving ? t("savingAccountPolicy") : t("saveAccountPolicy")}
        </button>
      </div>
      {error ? <p className="deckgo-note deck-ui-channels-error">{error}</p> : null}
    </div>
  );
}
