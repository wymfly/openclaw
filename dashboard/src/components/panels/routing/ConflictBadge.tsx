"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ConflictBadgeProps {
  conflicts: Array<{ bindingId: string; overlapType: string }>;
}

/** Amber warning badge shown next to bindings involved in a routing conflict. */
export function ConflictBadge({ conflicts }: ConflictBadgeProps) {
  const t = useTranslations("routing");

  if (conflicts.length === 0) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger render={<span />} className="inline-flex items-center">
        <AlertTriangle size={14} className="text-[var(--warning)]" />
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-1">
          <p className="font-medium text-xs">{t("conflictDetected")}</p>
          {conflicts.map((c) => (
            <p key={c.bindingId} className="text-[10px] opacity-80">
              {c.overlapType === "exact" ? t("overlapExact") : t("overlapSubset")}
              {" — "}
              {c.bindingId.slice(0, 8)}
            </p>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
