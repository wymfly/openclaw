"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { AlertAction, AlertRule } from "@/stores/alerts";

type RuleFormData = {
  name: string;
  entityType: string;
  condition: string;
  threshold: number;
  action: AlertAction;
  cooldownMs: number;
  enabled: boolean;
};

type RuleFormProps = {
  rule?: AlertRule;
  onSubmit: (data: RuleFormData) => void;
  onCancel: () => void;
};

const ENTITY_TYPES = ["usage", "cron", "approval", "agent"] as const;
const ACTIONS: AlertAction[] = ["toast", "activity", "webhook"];

export function RuleForm({ rule, onSubmit, onCancel }: RuleFormProps) {
  const t = useTranslations("alerts");

  const [name, setName] = useState(rule?.name ?? "");
  const [entityType, setEntityType] = useState(rule?.entityType ?? "usage");
  const [condition, setCondition] = useState(rule?.condition ?? "");
  const [threshold, setThreshold] = useState(rule?.threshold ?? 0);
  const [action, setAction] = useState<AlertAction>(rule?.action ?? "toast");
  const [cooldownMinutes, setCooldownMinutes] = useState(
    rule ? Math.round(rule.cooldownMs / 60000) : 5,
  );
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      entityType,
      condition,
      threshold,
      action,
      cooldownMs: cooldownMinutes * 60000,
      enabled,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">
        {rule ? t("editRule") : t("addRule")}
      </h3>

      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="rule-name" className="text-xs text-[var(--text-secondary)]">
          {t("name")}
        </Label>
        <Input
          id="rule-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      {/* Entity Type */}
      <div className="space-y-1.5">
        <Label className="text-xs text-[var(--text-secondary)]">{t("entityType")}</Label>
        <Select
          value={entityType}
          onValueChange={(v) => {
            if (v) {
              setEntityType(v);
            }
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ENTITY_TYPES.map((et) => (
              <SelectItem key={et} value={et}>
                {et}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Condition */}
      <div className="space-y-1.5">
        <Label htmlFor="rule-condition" className="text-xs text-[var(--text-secondary)]">
          {t("condition")}
        </Label>
        <Input
          id="rule-condition"
          type="text"
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          required
          placeholder="e.g. cost > threshold"
        />
      </div>

      {/* Threshold */}
      <div className="space-y-1.5">
        <Label htmlFor="rule-threshold" className="text-xs text-[var(--text-secondary)]">
          {t("threshold")}
        </Label>
        <Input
          id="rule-threshold"
          type="number"
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          required
          step="any"
        />
      </div>

      {/* Action */}
      <div className="space-y-1.5">
        <Label className="text-xs text-[var(--text-secondary)]">{t("action")}</Label>
        <Select
          value={action}
          onValueChange={(v) => {
            if (v) {
              setAction(v as AlertAction);
            }
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTIONS.map((a) => (
              <SelectItem key={a} value={a}>
                {t(a)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Cooldown */}
      <div className="space-y-1.5">
        <Label htmlFor="rule-cooldown" className="text-xs text-[var(--text-secondary)]">
          {t("cooldown")} ({t("cooldownMinutes")})
        </Label>
        <Input
          id="rule-cooldown"
          type="number"
          value={cooldownMinutes}
          onChange={(e) => setCooldownMinutes(Number(e.target.value))}
          min={0}
        />
      </div>

      {/* Enabled */}
      <div className="flex items-center gap-2">
        <Switch id="rule-enabled" checked={enabled} onCheckedChange={setEnabled} />
        <Label htmlFor="rule-enabled" className="text-xs text-[var(--text-secondary)]">
          {t("enabled")}
        </Label>
      </div>

      {/* Buttons */}
      <div className="flex gap-2 pt-2">
        <Button type="submit" size="sm">
          {rule ? t("editRule") : t("addRule")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
