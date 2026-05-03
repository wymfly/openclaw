import type { DeckGoCronStatus } from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import { formatCronDate } from "./cron-model";
import { CronMetric } from "./CronMetric";
import { NextExecutionCountdown } from "./NextExecutionCountdown";

export function HeartbeatConfig(props: { status: DeckGoCronStatus | null }) {
  const t = useTranslations("scheduler");

  return (
    <section className="cron-panel__surface">
      <div className="cron-panel__card-head">
        <h3 className="cron-panel__card-title">{t("heartbeat")}</h3>
        <NextExecutionCountdown nextRunAtMs={props.status?.nextRunAtMs} disabled={!props.status} />
      </div>
      <p className="cron-panel__note">{t("heartbeatUnavailable")}</p>
      <div className="cron-panel__metrics is-two">
        <CronMetric label={t("nextExecution")} value={formatCronDate(props.status?.nextRunAtMs)} />
        <CronMetric label={t("globalConfig")} value={t("readOnly")} />
      </div>
    </section>
  );
}
