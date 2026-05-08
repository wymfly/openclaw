import { useMemo } from "react";
import type { DeckGoRoutingBinding } from "../../../api";
import { useRoutingBindingsQuery } from "../../../data/modules/routing";
import { navigateToRouting } from "../../../deck-ui/panel-navigation";
import { useDeckUI } from "../../../deck-ui/ui-store";
import { useTranslations } from "../../../i18n/provider";

type PanelState = "idle" | "loading" | "ready";

function bindingTargetsAccount(binding: DeckGoRoutingBinding, accountId: string) {
  return !accountId || !binding.match.accountId || binding.match.accountId === accountId;
}

export function WecomRoutingSummary(props: { channelId: string; accountId: string }) {
  const t = useTranslations("channels");
  const ui = useDeckUI();
  const routingQuery = useRoutingBindingsQuery({
    channel: props.channelId,
    accountId: props.accountId,
  });
  const loadState: PanelState = routingQuery.isLoading
    ? "loading"
    : routingQuery.data
      ? "ready"
      : "idle";
  const bindings = routingQuery.data?.bindings ?? [];
  const error =
    routingQuery.error instanceof Error
      ? routingQuery.error.message
      : routingQuery.error
        ? t("routingBindingsFetchFailed")
        : "";

  const bindingCount = useMemo(
    () =>
      bindings.filter(
        (binding) =>
          binding.match.channel === props.channelId &&
          bindingTargetsAccount(binding, props.accountId),
      ).length,
    [bindings, props.accountId, props.channelId],
  );

  return (
    <div className="deckgo-surface-tile deck-ui-channels-surface">
      <div className="deckgo-card-header deck-ui-channels-surface-head">
        <div>
          <p className="deckgo-surface-label">{t("routingBindings")}</p>
          <p className="deckgo-note">
            {loadState === "loading"
              ? t("routingBindingsLoading")
              : t("routingBindingsCount", { count: bindingCount })}
          </p>
        </div>
        <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
          {t(loadState)}
        </span>
      </div>
      <div className="deckgo-actions deck-ui-channels-actions deck-ui-channels-actions-offset">
        <button
          className="deckgo-button deck-ui-channels-button"
          type="button"
          onClick={() =>
            navigateToRouting(ui, {
              channelId: props.channelId,
              accountId: props.accountId,
            })
          }
        >
          {t("openRoutingForWeCom")}
        </button>
      </div>
      {error ? <p className="deckgo-note deck-ui-channels-error">{error}</p> : null}
    </div>
  );
}
