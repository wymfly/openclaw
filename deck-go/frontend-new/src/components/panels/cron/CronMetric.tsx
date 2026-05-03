export function CronMetric(props: {
  label: string;
  value: string | number;
  tone?: "positive" | "danger" | "warning";
}) {
  return (
    <div className={`cron-panel__metric ${props.tone ? `is-${props.tone}` : ""}`}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}
