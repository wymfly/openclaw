"use client";

import { Bell, Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AlertRule } from "@/stores/alerts";

type RuleListProps = {
  rules: AlertRule[];
  onEdit: (rule: AlertRule) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
};

export function RuleList({ rules, onEdit, onDelete, onToggle }: RuleListProps) {
  const t = useTranslations("alerts");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (rules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-[var(--text-secondary)]">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--bg-tertiary)] ring-1 ring-[var(--border-subtle)]">
          <Bell size={20} className="text-[var(--accent)]" />
        </div>
        <p className="text-sm font-medium text-[var(--text-primary)]">{t("noRules")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rules.map((rule) => (
        <Card key={rule.id} size="sm" className="card-hover py-3">
          <CardContent className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate text-[var(--text-primary)]">
                  {rule.name}
                </span>
                <Badge
                  className={
                    rule.enabled
                      ? "bg-[var(--success-muted)] text-[var(--success-muted-text)] border-transparent"
                      : "bg-[var(--neutral-muted)] text-[var(--neutral-muted-text)] border-transparent"
                  }
                >
                  {rule.enabled ? t("enabled") : t("disabled")}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-xs text-[var(--text-secondary)]">
                  {rule.entityType} | {rule.condition} &ge; {rule.threshold}
                </span>
                <span className="text-xs text-[var(--text-secondary)]">
                  {t("action")}: {t(rule.action)}
                </span>
                <span className="text-xs text-[var(--text-secondary)] font-mono">
                  {t("cooldown")}: {Math.round(rule.cooldownMs / 60000)}
                  {t("cooldownMinutes")}
                </span>
                <span className="text-xs text-[var(--text-secondary)]">
                  {t("lastFired")}: {rule.lastFiredAt ?? t("never")}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 ml-4">
              <Button
                variant="outline"
                size="xs"
                className="gap-1 transition-colors duration-150"
                onClick={() => onToggle(rule.id, !rule.enabled)}
              >
                {rule.enabled ? <PowerOff size={12} /> : <Power size={12} />}
                {rule.enabled ? t("disabled") : t("enabled")}
              </Button>
              <Button
                variant="outline"
                size="xs"
                className="gap-1 transition-colors duration-150"
                onClick={() => onEdit(rule)}
              >
                <Pencil size={12} />
                {t("editRule")}
              </Button>
              {confirmDeleteId === rule.id ? (
                <div className="flex gap-1">
                  <Button
                    variant="destructive"
                    size="xs"
                    onClick={() => {
                      onDelete(rule.id);
                      setConfirmDeleteId(null);
                    }}
                  >
                    {t("confirmDelete")}
                  </Button>
                  <Button variant="outline" size="xs" onClick={() => setConfirmDeleteId(null)}>
                    ✕
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="xs"
                  className="text-[var(--danger)] hover:text-[var(--danger)] gap-1 transition-colors duration-150"
                  onClick={() => setConfirmDeleteId(rule.id)}
                >
                  <Trash2 size={12} />
                  {t("deleteRule")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
