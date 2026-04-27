import type { DeckGoCronStatus } from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import { ShellStat } from "../../shared/ShellComponents";
import { formatCronDate } from "./cron-model";
import { NextExecutionCountdown } from "./NextExecutionCountdown";

export function HeartbeatConfig(props: { status: DeckGoCronStatus | null }) {
  const t = useTranslations("scheduler");

  return (
    <section className="deckgo-surface-tile deck-ui-cron-surface deck-ui-cron-heartbeat">
      <div className="deckgo-card-header">
        <h3 className="deckgo-card-title">{t("heartbeat")}</h3>
        <NextExecutionCountdown nextRunAtMs={props.status?.nextRunAtMs} disabled={!props.status} />
      </div>
      <p className="deckgo-note">{t("heartbeatUnavailable")}</p>
      <div className="deckgo-grid deckgo-grid-2 deck-ui-cron-detail-stats">
        <ShellStat label={t("nextExecution")} value={formatCronDate(props.status?.nextRunAtMs)} />
        <ShellStat label={t("globalConfig")} value={t("readOnly")} />
      </div>
    </section>
  );
}
