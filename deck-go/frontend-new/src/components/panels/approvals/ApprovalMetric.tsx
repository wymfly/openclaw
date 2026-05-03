import type { ReactNode } from "react";

export function ApprovalMetric(props: { label: string; value: ReactNode }) {
  return (
    <div className="approvals-panel__metric">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}
