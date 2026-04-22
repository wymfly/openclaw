"use client";

import { Loader2, Search, CheckCircle, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ProbeResult } from "@/stores/models";

interface ProbeButtonProps {
  provider: string;
  result?: ProbeResult;
  onProbe: () => void;
  loading: boolean;
}

/**
 * Diagnostic probe button — fires a lightweight test request to validate
 * provider auth and connectivity. Shows latency or error inline after run.
 */
export function ProbeButton({ result, onProbe, loading }: ProbeButtonProps) {
  const t = useTranslations("models");

  return (
    <div className="flex items-center gap-3">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              onClick={onProbe}
              disabled={loading}
              className="gap-1.5"
            />
          }
        >
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              {t("auth.probing")}
            </>
          ) : (
            <>
              <Search size={14} />
              {t("auth.probe")}
            </>
          )}
        </TooltipTrigger>
        <TooltipContent>{t("auth.probeHint")}</TooltipContent>
      </Tooltip>

      {/* Inline result after probe completes */}
      {!loading && result && (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-xs font-mono transition-opacity",
            result.status === "ok"
              ? "text-[var(--success-muted-text)]"
              : "text-[var(--destructive-muted-text)]",
          )}
        >
          {result.status === "ok" ? <CheckCircle size={14} /> : <XCircle size={14} />}
          <span>
            {result.status === "ok"
              ? `ok \u00B7 ${result.latencyMs}ms`
              : `${result.status} \u00B7 ${result.error ?? "unknown"}`}
          </span>
        </span>
      )}
    </div>
  );
}
