"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";

interface PanelErrorProps {
  error: string;
  onRetry?: () => void;
}

export function PanelError({ error, onRetry }: PanelErrorProps) {
  const t = useTranslations("panelError");

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-3 p-6 text-center">
      <div className="text-[var(--destructive)]">
        <AlertTriangle size={36} strokeWidth={1.5} />
      </div>
      <h3 className="text-sm font-medium text-[var(--foreground)]">{t("loadFailed")}</h3>
      <p className="text-xs text-[var(--muted-foreground)] max-w-[320px] break-words">{error}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors hover:bg-[var(--accent)]"
          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          <RotateCcw size={12} />
          {t("retry")}
        </button>
      )}
    </div>
  );
}
