import type { ReactNode } from "react";

export function SkillMetric(props: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="skills-panel__metric">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}
