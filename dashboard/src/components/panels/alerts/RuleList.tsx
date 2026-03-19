"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm">{t("noRules")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rules.map((rule) => (
        <Card key={rule.id} size="sm" className="py-3">
          <CardContent className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate text-foreground">{rule.name}</span>
                <Badge variant={rule.enabled ? "default" : "secondary"}>
                  {rule.enabled ? t("enabled") : t("disabled")}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-muted-foreground">
                  {rule.entityType} | {rule.condition} &ge; {rule.threshold}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("action")}: {t(rule.action)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("cooldown")}: {Math.round(rule.cooldownMs / 60000)}
                  {t("cooldownMinutes")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("lastFired")}: {rule.lastFiredAt ?? t("never")}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 ml-4">
              <Button variant="outline" size="xs" onClick={() => onToggle(rule.id, !rule.enabled)}>
                {rule.enabled ? t("disabled") : t("enabled")}
              </Button>
              <Button variant="outline" size="xs" onClick={() => onEdit(rule)}>
                {t("editRule")}
              </Button>
              <Button
                variant="destructive"
                size="xs"
                onClick={() => {
                  if (confirm(t("confirmDelete"))) {
                    onDelete(rule.id);
                  }
                }}
              >
                {t("deleteRule")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
