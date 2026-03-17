"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { AlertAction, AlertRule } from "@/stores/alerts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        {rule ? t("editRule") : t("addRule")}
      </h3>

      {/* Name */}
      <div className="space-y-1">
        <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          {t("name")}
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-3 py-1.5 text-sm rounded-md border"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--bg-primary)",
            color: "var(--text-primary)",
          }}
        />
      </div>

      {/* Entity Type */}
      <div className="space-y-1">
        <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          {t("entityType")}
        </label>
        <select
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          className="w-full px-3 py-1.5 text-sm rounded-md border"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--bg-primary)",
            color: "var(--text-primary)",
          }}
        >
          {ENTITY_TYPES.map((et) => (
            <option key={et} value={et}>
              {et}
            </option>
          ))}
        </select>
      </div>

      {/* Condition */}
      <div className="space-y-1">
        <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          {t("condition")}
        </label>
        <input
          type="text"
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          required
          placeholder="e.g. cost > threshold"
          className="w-full px-3 py-1.5 text-sm rounded-md border"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--bg-primary)",
            color: "var(--text-primary)",
          }}
        />
      </div>

      {/* Threshold */}
      <div className="space-y-1">
        <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          {t("threshold")}
        </label>
        <input
          type="number"
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          required
          step="any"
          className="w-full px-3 py-1.5 text-sm rounded-md border"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--bg-primary)",
            color: "var(--text-primary)",
          }}
        />
      </div>

      {/* Action */}
      <div className="space-y-1">
        <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          {t("action")}
        </label>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value as AlertAction)}
          className="w-full px-3 py-1.5 text-sm rounded-md border"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--bg-primary)",
            color: "var(--text-primary)",
          }}
        >
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {t(a)}
            </option>
          ))}
        </select>
      </div>

      {/* Cooldown */}
      <div className="space-y-1">
        <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          {t("cooldown")} ({t("cooldownMinutes")})
        </label>
        <input
          type="number"
          value={cooldownMinutes}
          onChange={(e) => setCooldownMinutes(Number(e.target.value))}
          min={0}
          className="w-full px-3 py-1.5 text-sm rounded-md border"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--bg-primary)",
            color: "var(--text-primary)",
          }}
        />
      </div>

      {/* Enabled */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          id="rule-enabled"
          className="rounded"
        />
        <label
          htmlFor="rule-enabled"
          className="text-xs font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          {t("enabled")}
        </label>
      </div>

      {/* Buttons */}
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="px-4 py-1.5 text-xs font-medium rounded-md"
          style={{ backgroundColor: "var(--accent)", color: "#fff" }}
        >
          {rule ? t("editRule") : t("addRule")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-1.5 text-xs font-medium rounded-md border"
          style={{
            borderColor: "var(--border)",
            color: "var(--text-secondary)",
          }}
        >
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
