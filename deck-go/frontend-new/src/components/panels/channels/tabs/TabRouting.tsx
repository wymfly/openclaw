import { IconArrowR } from "../../../../design-system/icons";
import { JsonDetails } from "../../../shared/ShellComponents";
import type {
  ChannelTranslator,
  DeckGoRoutingBinding,
  DeckGoRoutingListResponse,
  PanelState,
} from "../types";

export function TabRouting(props: {
  channelId: string;
  accountId: string;
  routing: DeckGoRoutingListResponse | null;
  loadState: PanelState;
  error: string;
  t: ChannelTranslator;
  onOpenRouting: (params: { channelId: string; accountId: string }) => void;
}) {
  const { channelId, accountId, routing, loadState, error, t, onOpenRouting } = props;
  const bindings = routing?.bindings ?? [];

  return (
    <section className="section">
      <header className="section__head">
        <div>
          <h2 className="section__title">{t("routingBindings")}</h2>
          <p className="section__hint">
            {loadState === "loading"
              ? t("routingBindingsLoading")
              : t("routingBindingsCount", { count: bindings.length })}
          </p>
        </div>
        <button
          className="btn"
          type="button"
          onClick={() => onOpenRouting({ channelId, accountId })}
        >
          {t("openRouting")}
          <IconArrowR />
        </button>
      </header>
      {error ? <p className="deckgo-note deck-ui-channels-error">{error}</p> : null}
      {bindings.length === 0 ? (
        <div className="empty empty--compact">
          <strong>{t("noRoutingBindings")}</strong>
          <span>{t("noRoutingBindingsDescription")}</span>
        </div>
      ) : (
        <div className="routing-list">
          {bindings.map((binding: DeckGoRoutingBinding) => (
            <article className="routing-row" key={binding.id}>
              <div>
                <strong>{binding.agentId}</strong>
                <p>
                  {binding.tier} / {binding.match.channel}
                  {binding.match.accountId ? ` / ${binding.match.accountId}` : ""}
                </p>
              </div>
              <span className="deckgo-pill">{binding.match.peer?.kind ?? t("notAvailable")}</span>
            </article>
          ))}
        </div>
      )}
      <JsonDetails title={t("routingPayload")} payload={routing} />
    </section>
  );
}
