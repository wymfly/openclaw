"use client";

import { Code, FileText } from "lucide-react";
import { useTranslations } from "next-intl";

// ---------------------------------------------------------------------------
// ShowRawToggle — compact toggle between raw and formatted content views.
//
// When `isRaw` is true, shows "Show Formatted" (FileText icon).
// When `isRaw` is false, shows "Show Raw" (Code icon).
// ---------------------------------------------------------------------------

interface ShowRawToggleProps {
  isRaw: boolean;
  onToggle: () => void;
}

export function ShowRawToggle({ isRaw, onToggle }: ShowRawToggleProps) {
  const t = useTranslations("chat");

  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
    >
      {isRaw ? (
        <>
          <FileText size={10} />
          {t("showFormatted")}
        </>
      ) : (
        <>
          <Code size={10} />
          {t("showRaw")}
        </>
      )}
    </button>
  );
}
