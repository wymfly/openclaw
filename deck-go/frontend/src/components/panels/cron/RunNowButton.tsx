import { useTranslations } from "../../../i18n/provider";
import type { CronActionState } from "./cron-model";

export function RunNowButton(props: {
  disabled: boolean;
  actionState: CronActionState;
  onRun: () => void;
}) {
  const t = useTranslations("cron");
  return (
    <button
      className="deckgo-button deck-ui-cron-button is-primary"
      type="button"
      onClick={props.onRun}
      disabled={props.disabled || props.actionState !== "idle"}
    >
      {props.actionState === "running" ? t("running") : t("runNow")}
    </button>
  );
}
