export function IdentityMetric(props: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "warning";
}) {
  return (
    <div className={`identity-panel__metric ${props.tone ? `is-${props.tone}` : ""}`}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}
