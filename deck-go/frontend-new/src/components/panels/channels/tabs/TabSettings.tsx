import { JsonDetails } from "../../../shared/ShellComponents";
import { AccountDmPolicyEditor } from "../AccountDmPolicyEditor";
import { ChannelSettingsEditor } from "../ChannelSettingsEditor";
import { displayAccountName } from "../lib/channel-selectors";
import type { ChannelActionState, ChannelInventoryItem, ChannelTranslator } from "../types";

export function TabSettings(props: {
  channel: ChannelInventoryItem;
  actionState: ChannelActionState;
  isWecomAccessChannel: boolean;
  configPatchResult: unknown;
  t: ChannelTranslator;
  onToggleEnabled: () => void;
  onSettingsSaved: (result: Record<string, unknown>) => Promise<void>;
  onAccountPolicySaved: (result: Record<string, unknown>) => Promise<void>;
}) {
  const {
    channel,
    actionState,
    isWecomAccessChannel,
    configPatchResult,
    t,
    onToggleEnabled,
    onSettingsSaved,
    onAccountPolicySaved,
  } = props;

  return (
    <section className="section">
      <header className="section__head">
        <div>
          <h2 className="section__title">{t("channelSettings")}</h2>
          <p className="section__hint">{t("settingsContractHint")}</p>
        </div>
        <button
          className="btn"
          type="button"
          disabled={actionState !== "idle"}
          onClick={onToggleEnabled}
        >
          {actionState === "toggling"
            ? t("savingConfig")
            : channel.enabled
              ? t("disableChannel")
              : t("enableChannel")}
        </button>
      </header>
      {!isWecomAccessChannel ? (
        <ChannelSettingsEditor
          channelId={channel.id}
          channel={channel.channel}
          onSaved={onSettingsSaved}
        />
      ) : (
        <div className="empty empty--compact">
          <strong>{t("wecomSettingsDelegated")}</strong>
          <span>{t("wecomSettingsDelegatedDescription")}</span>
        </div>
      )}
      {!isWecomAccessChannel && channel.accounts.length > 0 ? (
        <div className="acct-list">
          {channel.accounts.map((account) => (
            <article className="acct-row acct-row--stack" key={account.accountId}>
              <div>
                <strong>
                  {displayAccountName(account)} <small>{account.accountId}</small>
                </strong>
                <p>{account.diagnostic.description}</p>
              </div>
              <AccountDmPolicyEditor
                channelId={channel.id}
                accountId={account.accountId}
                accountPayload={account.payload}
                onSaved={onAccountPolicySaved}
              />
            </article>
          ))}
        </div>
      ) : null}
      <JsonDetails title={t("channelConfigPatchResult")} payload={configPatchResult} />
    </section>
  );
}
