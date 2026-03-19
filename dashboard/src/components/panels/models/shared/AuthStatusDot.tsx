"use client";

import { useTranslations } from "next-intl";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type AuthStatus = "ready" | "warning" | "missing" | "unknown";

interface AuthStatusDotProps {
  status: AuthStatus;
  size?: "sm" | "md";
  className?: string;
}

const statusStyles: Record<AuthStatus, string> = {
  ready: "bg-green-500 dark:shadow-[0_0_4px_theme(colors.green.500)]",
  warning: "bg-yellow-500",
  missing: "bg-red-500",
  unknown: "bg-gray-500",
};

const sizeStyles: Record<"sm" | "md", string> = {
  sm: "w-2 h-2",
  md: "w-2.5 h-2.5",
};

/**
 * Colored status dot indicating provider auth health.
 * Wraps in a tooltip that surfaces the localized status label.
 */
export function AuthStatusDot({ status, size = "sm", className }: AuthStatusDotProps) {
  const t = useTranslations("models");

  const labelKey = `auth.${status}` as const;

  return (
    <Tooltip>
      <TooltipTrigger className={cn("inline-flex items-center justify-center", className)}>
        <span
          aria-label={t(labelKey)}
          className={cn(
            "inline-block shrink-0 rounded-full transition-colors",
            statusStyles[status],
            sizeStyles[size],
          )}
        />
      </TooltipTrigger>
      <TooltipContent>{t(labelKey)}</TooltipContent>
    </Tooltip>
  );
}
