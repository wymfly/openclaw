"use client";

import { useTranslations } from "next-intl";
import { DmPolicySelector } from "../DmPolicySelector";

interface DmPolicyStepProps {
  value: string;
  onChange: (policy: string) => void;
}

/**
 * Reusable wizard step wrapping DmPolicySelector for wizard flow.
 */
export function DmPolicyStep({ value, onChange }: DmPolicyStepProps) {
  const t = useTranslations("wizard");

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--muted-foreground)]">{t("dmPolicy.description")}</p>
      <DmPolicySelector value={value} onChange={onChange} />
    </div>
  );
}
