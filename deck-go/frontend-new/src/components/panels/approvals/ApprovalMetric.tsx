import type { ReactNode } from "react";
import { PanelMetric } from "../../../design-system/patterns";

export function ApprovalMetric(props: { label: string; value: ReactNode }) {
  return <PanelMetric label={props.label} value={props.value} />;
}
