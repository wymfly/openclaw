import { diagnosticClassName, displayAccountName } from "../lib/channel-selectors";
import { ChannelProbeResultBadge } from "../parts/ChannelProbeResultBadge";
import type {
  ChannelActionState,
  ChannelInventoryItem,
  ChannelTranslator,
  DeckGoChannelTestResponse,
} from "../types";

export function TabProbe(props: {
  channel: ChannelInventoryItem;
  probeResult: DeckGoChannelTestResponse | null;
  actionState: ChannelActionState;
  t: ChannelTranslator;
  onRunProbe: () => void;
}) {
  const { channel, probeResult, actionState, t, onRunProbe } = props;
  return (
    <section className="section">
      <header className="section__head">
        <div>
          <h2 className="section__title">{t("probeResult")}</h2>
          <p className="section__hint">{t("probeDescription")}</p>
        </div>
        <button
          className="btn btn--primary"
          type="button"
          disabled={actionState !== "idle"}
          onClick={onRunProbe}
        >
          {actionState === "testing" ? t("testingChannel") : t("testChannel")}
        </button>
      </header>
      {probeResult ? (
        <ChannelProbeResultBadge result={probeResult} t={t} />
      ) : (
        <div className="empty empty--compact">
          <strong>{t("noProbeResultTitle")}</strong>
          <span>{t("noProbeResultDescription")}</span>
        </div>
      )}
      <div className="acct-list">
        {channel.accounts.map((account) => (
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
  );
}
