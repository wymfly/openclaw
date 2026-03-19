"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ModelBadgesProps {
  reasoning?: boolean;
  input?: string[];
  className?: string;
}

/**
 * Inline capability badges for a model entry.
 * Always shows "Text"; conditionally shows "Reasoning" and "Vision".
 */
export function ModelBadges({ reasoning, input, className }: ModelBadgesProps) {
  const t = useTranslations("models");

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      <Badge variant="secondary" className="text-[10px] leading-tight px-1.5 py-0 h-4">
        {t("catalog.text")}
      </Badge>
      {reasoning && (
        <Badge variant="secondary" className="text-[10px] leading-tight px-1.5 py-0 h-4">
          {t("catalog.reasoning")}
        </Badge>
      )}
      {input?.includes("image") && (
        <Badge variant="secondary" className="text-[10px] leading-tight px-1.5 py-0 h-4">
          {t("catalog.vision")}
        </Badge>
      )}
    </span>
  );
}
