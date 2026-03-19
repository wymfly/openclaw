"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { BudgetRule, CreateRuleInput, BudgetDimension } from "@/stores/budget";

const DIMENSIONS: BudgetDimension[] = ["tokensIn", "tokensOut", "totalTokens", "cost"];
const SCOPES = ["global", "perAgent", "perTask"];
const PERIODS = ["daily", "weekly", "monthly"];

interface RuleFormProps {
  rule: BudgetRule | null;
  onSave: (input: CreateRuleInput) => void;
  onCancel: () => void;
  saving?: boolean;
}

export function RuleForm({ rule, onSave, onCancel, saving }: RuleFormProps) {
  const t = useTranslations("budget");
  const tc = useTranslations("common");

  const [name, setName] = useState("");
  const [scope, setScope] = useState("global");
  const [agentId, setAgentId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [dimension, setDimension] = useState<BudgetDimension>("totalTokens");
  const [warnThreshold, setWarnThreshold] = useState("");
  const [overThreshold, setOverThreshold] = useState("");
  const [period, setPeriod] = useState("monthly");
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (rule) {
      setName(rule.name);
      setScope(
        rule.scope === "global"
          ? "global"
          : rule.agentId
            ? "perAgent"
            : rule.taskId
              ? "perTask"
              : "global",
      );
      setAgentId(rule.agentId ?? "");
      setTaskId(rule.taskId ?? "");
      setDimension(rule.dimension);
      setWarnThreshold(rule.warnThreshold != null ? String(rule.warnThreshold) : "");
      setOverThreshold(rule.overThreshold != null ? String(rule.overThreshold) : "");
      setPeriod(rule.period);
      setEnabled(rule.enabled);
    } else {
      setName("");
      setScope("global");
      setAgentId("");
      setTaskId("");
      setDimension("totalTokens");
      setWarnThreshold("");
      setOverThreshold("");
      setPeriod("monthly");
      setEnabled(true);
    }
  }, [rule]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input: CreateRuleInput = {
      name,
      scope: scope === "perAgent" ? "agent" : scope === "perTask" ? "task" : "global",
      agentId: scope === "perAgent" ? agentId || undefined : undefined,
      taskId: scope === "perTask" ? taskId || undefined : undefined,
      dimension,
      warnThreshold: warnThreshold ? Number(warnThreshold) : undefined,
      overThreshold: overThreshold ? Number(overThreshold) : undefined,
      period,
      enabled,
    };
    onSave(input);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-foreground">
        {rule ? t("editRule") : t("addRule")}
      </h3>

      {/* Name */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">{t("name")}</Label>
        <Input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>

      {/* Scope */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">{t("scope")}</Label>
        <div className="flex gap-1">
          {SCOPES.map((s) => (
            <Button
              key={s}
              type="button"
              variant="outline"
              size="xs"
              className={cn(
                scope === s &&
                  "bg-primary text-primary-foreground border-primary hover:bg-primary/80 hover:text-primary-foreground",
              )}
              onClick={() => setScope(s)}
            >
              {t(s)}
            </Button>
          ))}
        </div>
      </div>

      {/* Agent ID (conditional) */}
      {scope === "perAgent" && (
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("agentId")}</Label>
          <Input type="text" value={agentId} onChange={(e) => setAgentId(e.target.value)} />
        </div>
      )}

      {/* Task ID (conditional) */}
      {scope === "perTask" && (
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("taskId")}</Label>
          <Input type="text" value={taskId} onChange={(e) => setTaskId(e.target.value)} />
        </div>
      )}

      {/* Dimension */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">{t("dimension")}</Label>
        <div className="flex gap-1 flex-wrap">
          {DIMENSIONS.map((d) => (
            <Button
              key={d}
              type="button"
              variant="outline"
              size="xs"
              className={cn(
                dimension === d &&
                  "bg-primary text-primary-foreground border-primary hover:bg-primary/80 hover:text-primary-foreground",
              )}
              onClick={() => setDimension(d)}
            >
              {t(d)}
            </Button>
          ))}
        </div>
      </div>

      {/* Thresholds */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("warnThreshold")}</Label>
          <Input
            type="number"
            min="0"
            step="any"
            value={warnThreshold}
            onChange={(e) => setWarnThreshold(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("overThreshold")}</Label>
          <Input
            type="number"
            min="0"
            step="any"
            value={overThreshold}
            onChange={(e) => setOverThreshold(e.target.value)}
          />
        </div>
      </div>

      {/* Period */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">{t("period")}</Label>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <Button
              key={p}
              type="button"
              variant="outline"
              size="xs"
              className={cn(
                period === p &&
                  "bg-primary text-primary-foreground border-primary hover:bg-primary/80 hover:text-primary-foreground",
              )}
              onClick={() => setPeriod(p)}
            >
              {t(p)}
            </Button>
          ))}
        </div>
      </div>

      {/* Enabled toggle */}
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">{t("enabledToggle")}</Label>
        <button
          type="button"
          className={cn(
            "w-10 h-5 rounded-full transition-colors relative",
            enabled ? "bg-primary" : "bg-input",
          )}
          onClick={() => setEnabled(!enabled)}
        >
          <span
            className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
            style={{ left: enabled ? "calc(100% - 18px)" : "2px" }}
          />
        </button>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={saving} size="sm">
          {tc("save")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          {tc("cancel")}
        </Button>
      </div>
    </form>
  );
}
