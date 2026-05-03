export function BudgetMetric(props: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "warning" | "danger";
}) {
  return (
    <div className={`budget-panel__metric ${props.tone ? `is-${props.tone}` : ""}`}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}
