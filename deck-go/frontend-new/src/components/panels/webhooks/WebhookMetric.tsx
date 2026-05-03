import type { ReactNode } from "react";

export function WebhookMetric(props: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="webhooks-panel__metric">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}
