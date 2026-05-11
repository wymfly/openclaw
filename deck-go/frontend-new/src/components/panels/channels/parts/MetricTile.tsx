export function MetricTile(props: { hint?: string; label: string; value: string | number }) {
  return (
    <article className="kpi">
      <span className="kpi__label">{props.label}</span>
      <span className="kpi__value">{props.value}</span>
      {props.hint ? <span className="kpi__hint">{props.hint}</span> : null}
    </article>
  );
}
