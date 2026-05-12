import type { DeckGoCronStatus } from "../../../api";
import { KpiStrip, PanelSectionHeader, PanelSurface } from "../../../design-system/patterns";
import { useTranslations } from "../../../i18n/provider";
import { formatCronDate } from "./cron-model";
import { CronMetric } from "./CronMetric";
import { NextExecutionCountdown } from "./NextExecutionCountdown";

export function HeartbeatConfig(props: { status: DeckGoCronStatus | null }) {
  const t = useTranslations("scheduler");

  return (
    <PanelSurface>
      <PanelSectionHeader
        title={t("heartbeat")}
        headingLevel={3}
        meta={
          <NextExecutionCountdown
            nextRunAtMs={props.status?.nextRunAtMs}
            disabled={!props.status}
          />
        }
      />
      <p className="cron-panel__note">{t("heartbeatUnavailable")}</p>
      <KpiStrip columns={2}>
        <CronMetric label={t("nextExecution")} value={formatCronDate(props.status?.nextRunAtMs)} />
        <CronMetric label={t("globalConfig")} value={t("readOnly")} />
      </KpiStrip>
    </PanelSurface>
  );
}
