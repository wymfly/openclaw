"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";

interface ConflictDialogProps {
  onReload: () => void;
  onCancel: () => void;
}

/**
 * Modal dialog shown when a save detects that the config was modified externally.
 * User can reload (discard local edits) or cancel (continue editing).
 */
export function ConflictDialog({ onReload, onCancel }: ConflictDialogProps) {
  const t = useTranslations("config");
  const tc = useTranslations("common");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
    >
      <div
        className="rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl"
        style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle size={20} style={{ color: "var(--status-disconnected)" }} />
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {t("conflict")}
          </h3>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancel}
            className="text-xs px-3 py-1.5 rounded"
            style={{
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
              backgroundColor: "var(--bg-secondary)",
            }}
          >
            {tc("cancel")}
          </button>
          <button
            onClick={onReload}
            className="text-xs px-3 py-1.5 rounded"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-fg)" }}
          >
            {t("reload")}
          </button>
        </div>
      </div>
    </div>
  );
}
