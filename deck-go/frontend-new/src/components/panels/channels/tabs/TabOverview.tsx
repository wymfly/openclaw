import { IconArrowR } from "../../../../design-system/icons";
import { PanelMetric } from "../../../../design-system/patterns";
import {
  channelProbeLabel,
  diagnosticClassName,
  displayAccountName,
} from "../lib/channel-selectors";
import type {
  ChannelInventoryItem,
  ChannelTabId,
  ChannelTranslator,
  DeckGoChannelTestResponse,
  ThroughputWindow,
} from "../types";

export function TabOverview(props: {
  channel: ChannelInventoryItem;
  probeResult: DeckGoChannelTestResponse | null;
  channelLatencyMs: number | undefined;
  throughputMessagesIn: number;
  throughputMessagesOut: number;
  throughputWindow: ThroughputWindow;
  pluginId: string | undefined;
  t: ChannelTranslator;
  onOpenPlugin: (pluginId: string) => void;
  onSwitchTab: (tab: ChannelTabId) => void;
}) {
  const {
    channel,
    probeResult,
    channelLatencyMs,
    throughputMessagesIn,
    throughputMessagesOut,
    throughputWindow,
    pluginId,
    t,
    onOpenPlugin,
    onSwitchTab,
  } = props;

  const alerts = channel.accounts.filter(
    (account) => account.diagnostic.tone === "warning" || account.diagnostic.tone === "error",
  );

  return (
    <>
      <section className="section">
        <header className="section__head">
          <div>
            <h2 className="section__title">{t("inventorySnapshot")}</h2>
            <p className="section__hint">{t("inventorySnapshotHint")}</p>
          </div>
        </header>
        <div className="tile-row">
          <PanelMetric
            label={t("messagesInStat")}
            value={throughputMessagesIn}
            hint={throughputWindow}
          />
          <PanelMetric
            label={t("messagesOutStat")}
            value={throughputMessagesOut}
            hint={throughputWindow}
          />
          <PanelMetric
            label={t("probeLatencyStat")}
            value={channelLatencyMs != null ? `${channelLatencyMs}ms` : t("notAvailable")}
            hint={probeResult ? channelProbeLabel(probeResult, t) : t("probeResult")}
          />
          <PanelMetric
            label={t("accountsStat")}
            value={channel.accounts.length}
            hint={t("alertsBadge", { count: alerts.length })}
          />
        </div>
      </section>

      {alerts.length > 0 ? (
        <section className="section">
          <header className="section__head">
            <div>
              <h2 className="section__title">{t("accountAlerts")}</h2>
              <p className="section__hint">{t("accountAlertsHint")}</p>
            </div>
          </header>
          <div className="acct-list">
            {alerts.map((account) => (
              <article
                className="acct-row"
                data-health={account.diagnostic.tone}
                key={account.accountId}
              >
                <span className="acct-row__indicator" />
                <div>
                  <strong>
                    {displayAccountName(account)} <small>{account.accountId}</small>
                  </strong>
                  <p>{account.diagnostic.description}</p>
                  <p>{t("nextStep", { step: account.diagnostic.nextStep })}</p>
                </div>
                <span className={`deckgo-pill ${diagnosticClassName(account.diagnostic.tone)}`}>
                  {account.diagnostic.title}
                </span>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="section">
        <header className="section__head">
          <h2 className="section__title">{t("quickLinks")}</h2>
        </header>
        <div className="hero__actions">
          {pluginId ? (
            <button className="btn" type="button" onClick={() => onOpenPlugin(pluginId)}>
              {t("openChannelPlugin")}
              <IconArrowR />
            </button>
          ) : null}
          <button className="btn" type="button" onClick={() => onSwitchTab("routing")}>
            {t("routingBindings")}
          </button>
          <button className="btn" type="button" onClick={() => onSwitchTab("settings")}>
            {t("channelSettings")}
          </button>
        </div>
      </section>
    </>
  );
}
