import { PanelMetric, type PanelMetricTone } from "../../../design-system/patterns";

export function CronMetric(props: {
  label: string;
  value: string | number;
  tone?: PanelMetricTone;
}) {
  return <PanelMetric label={props.label} tone={props.tone} value={props.value} />;
}
