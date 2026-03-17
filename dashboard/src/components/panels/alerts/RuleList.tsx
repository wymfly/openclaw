"use client";

import { useTranslations } from "next-intl";
import type { AlertRule } from "@/stores/alerts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RuleListProps = {
  rules: AlertRule[];
  onEdit: (rule: AlertRule) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RuleList({ rules, onEdit, onDelete, onToggle }: RuleListProps) {
  const t = useTranslations("alerts");

  if (rules.length === 0) {
    return (
      <div
        className="flex items-center justify-center py-12"
        style={{ color: "var(--text-secondary)" }}
      >
        <p className="text-sm">{t("noRules")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rules.map((rule) => (
        <div
          key={rule.id}
          className="flex items-center justify-between px-4 py-3 rounded-lg border"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--bg-secondary)",
          }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="text-sm font-medium truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {rule.name}
              </span>
              <span
                className="px-2 py-0.5 text-xs rounded-full"
                style={{
                  backgroundColor: rule.enabled ? "var(--accent)" : "var(--border)",
                  color: rule.enabled ? "#fff" : "var(--text-secondary)",
                }}
              >
                {rule.enabled ? t("enabled") : t("disabled")}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {rule.entityType} | {rule.condition} &ge; {rule.threshold}
              </span>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {t("action")}: {t(rule.action)}
              </span>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {t("cooldown")}: {Math.round(rule.cooldownMs / 60000)}
                {t("cooldownMinutes")}
              </span>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {t("lastFired")}: {rule.lastFiredAt ?? t("never")}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 ml-4">
            <button
              type="button"
              onClick={() => onToggle(rule.id, !rule.enabled)}
              className="px-2 py-1 text-xs rounded border"
              style={{
                borderColor: "var(--border)",
                color: "var(--text-secondary)",
              }}
            >
              {rule.enabled ? t("disabled") : t("enabled")}
            </button>
            <button
              type="button"
              onClick={() => onEdit(rule)}
              className="px-2 py-1 text-xs rounded border"
              style={{
                borderColor: "var(--border)",
                color: "var(--text-secondary)",
              }}
            >
              {t("editRule")}
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm(t("confirmDelete"))) {
                  onDelete(rule.id);
                }
              }}
              className="px-2 py-1 text-xs rounded border"
              style={{
                borderColor: "var(--border)",
                color: "var(--danger, #ef4444)",
              }}
            >
              {t("deleteRule")}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
