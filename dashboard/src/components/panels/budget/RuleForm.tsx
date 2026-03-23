"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
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

  const inputStyle = {
    backgroundColor: "var(--bg-primary)",
    borderColor: "var(--border)",
    color: "var(--text-primary)",
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        {rule ? t("editRule") : t("addRule")}
      </h3>

      {/* Name */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          {t("name")}
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="px-3 py-2 text-sm rounded-md border"
          style={inputStyle}
          required
        />
      </div>

      {/* Scope */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          {t("scope")}
        </label>
        <div className="flex gap-1">
          {SCOPES.map((s) => (
            <button
              key={s}
              type="button"
              className="px-3 py-1 text-xs rounded-md border transition-colors"
              style={{
                backgroundColor: scope === s ? "var(--accent)" : "transparent",
                color: scope === s ? "var(--accent-fg)" : "var(--text-secondary)",
                borderColor: scope === s ? "var(--accent)" : "var(--border)",
              }}
              onClick={() => setScope(s)}
            >
              {t(s)}
            </button>
          ))}
        </div>
      </div>

      {/* Agent ID (conditional) */}
      {scope === "perAgent" && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            {t("agentId")}
          </label>
          <input
            type="text"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="px-3 py-2 text-sm rounded-md border"
            style={inputStyle}
          />
        </div>
      )}

      {/* Task ID (conditional) */}
      {scope === "perTask" && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            {t("taskId")}
          </label>
          <input
            type="text"
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            className="px-3 py-2 text-sm rounded-md border"
            style={inputStyle}
          />
        </div>
      )}

      {/* Dimension */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          {t("dimension")}
        </label>
        <div className="flex gap-1 flex-wrap">
          {DIMENSIONS.map((d) => (
            <button
              key={d}
              type="button"
              className="px-3 py-1 text-xs rounded-md border transition-colors"
              style={{
                backgroundColor: dimension === d ? "var(--accent)" : "transparent",
                color: dimension === d ? "var(--accent-fg)" : "var(--text-secondary)",
                borderColor: dimension === d ? "var(--accent)" : "var(--border)",
              }}
              onClick={() => setDimension(d)}
            >
              {t(d)}
            </button>
          ))}
        </div>
      </div>

      {/* Thresholds */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            {t("warnThreshold")}
          </label>
          <input
            type="number"
            min="0"
            step="any"
            value={warnThreshold}
            onChange={(e) => setWarnThreshold(e.target.value)}
            className="px-3 py-2 text-sm rounded-md border"
            style={inputStyle}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            {t("overThreshold")}
          </label>
          <input
            type="number"
            min="0"
            step="any"
            value={overThreshold}
            onChange={(e) => setOverThreshold(e.target.value)}
            className="px-3 py-2 text-sm rounded-md border"
            style={inputStyle}
          />
        </div>
      </div>

      {/* Period */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          {t("period")}
        </label>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              className="px-3 py-1 text-xs rounded-md border transition-colors"
              style={{
                backgroundColor: period === p ? "var(--accent)" : "transparent",
                color: period === p ? "var(--accent-fg)" : "var(--text-secondary)",
                borderColor: period === p ? "var(--accent)" : "var(--border)",
              }}
              onClick={() => setPeriod(p)}
            >
              {t(p)}
            </button>
          ))}
        </div>
      </div>

      {/* Enabled toggle */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          {t("enabledToggle")}
        </label>
        <button
          type="button"
          className="w-10 h-5 rounded-full transition-colors relative"
          style={{ backgroundColor: enabled ? "var(--accent)" : "var(--border)" }}
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
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-xs rounded-md font-medium transition-colors"
          style={{ backgroundColor: "var(--accent)", color: "var(--accent-fg)" }}
        >
          {tc("save")}
        </button>
        <button
          type="button"
          className="px-4 py-2 text-xs rounded-md font-medium transition-colors border"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          onClick={onCancel}
        >
          {tc("cancel")}
        </button>
      </div>
    </form>
  );
}
