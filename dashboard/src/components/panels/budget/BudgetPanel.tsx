"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useBudgetStore, type BudgetRule, type CreateRuleInput } from "@/stores/budget";
import { BudgetStatus } from "./BudgetStatus";
import { RuleForm } from "./RuleForm";
import { RuleList } from "./RuleList";

type ViewMode = "list" | "form";

export function BudgetPanel() {
  const t = useTranslations("budget");
  const tc = useTranslations("common");

  const {
    rules,
    evaluations,
    loading,
    error,
    fetchRules,
    createRule,
    updateRule,
    deleteRule,
    evaluateBudgets,
  } = useBudgetStore();

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<BudgetRule | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    void fetchRules();
    void evaluateBudgets();
  }, [fetchRules, evaluateBudgets]);

  const handleSelect = (rule: BudgetRule) => {
    setSelectedRuleId(rule.id);
    setEditingRule(rule);
    setViewMode("form");
  };

  const handleCreate = () => {
    setEditingRule(null);
    setSelectedRuleId(null);
    setViewMode("form");
  };

  const handleSave = async (input: CreateRuleInput) => {
    setSaving(true);
    if (editingRule) {
      await updateRule(editingRule.id, input);
    } else {
      await createRule(input);
    }
    setSaving(false);
    setViewMode("list");
    setEditingRule(null);
    void evaluateBudgets();
  };

  const handleDelete = async (id: string) => {
    await deleteRule(id);
    setConfirmDeleteId(null);
    setSelectedRuleId(null);
    setEditingRule(null);
    setViewMode("list");
    void evaluateBudgets();
  };

  return (
    <div
      className="flex h-full rounded-lg overflow-hidden border"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Left sidebar — rule list */}
      <div
        className="w-64 flex-shrink-0 flex flex-col border-r"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}
      >
        <div
          className="flex items-center justify-between px-3 py-3 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {t("title")}
          </h2>
          <button
            type="button"
            className="px-2 py-1 text-xs rounded-md font-medium"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-fg)" }}
            onClick={handleCreate}
          >
            + {tc("create")}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <p className="text-xs p-3" style={{ color: "var(--text-secondary)" }}>
              {tc("loading")}
            </p>
          )}

          {!loading && (
            <RuleList
              rules={rules}
              evaluations={evaluations}
              selectedRuleId={selectedRuleId}
              onSelect={handleSelect}
            />
          )}
        </div>
      </div>

      {/* Right detail area */}
      <div
        className="flex-1 flex flex-col overflow-hidden"
        style={{ backgroundColor: "var(--bg-primary)" }}
      >
        {error && (
          <div
            className="px-4 py-2 text-xs border-b"
            style={{
              borderColor: "var(--border)",
              color: "var(--danger)",
              backgroundColor: "var(--danger-muted)",
            }}
          >
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {viewMode === "form" && (
            <div className="flex flex-col gap-4">
              <RuleForm
                rule={editingRule}
                onSave={handleSave}
                onCancel={() => {
                  setViewMode("list");
                  setEditingRule(null);
                }}
                saving={saving}
              />

              {editingRule && (
                <div className="flex gap-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
                  {confirmDeleteId === editingRule.id ? (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="px-3 py-1 text-xs rounded-md font-medium"
                        style={{ backgroundColor: "var(--danger)", color: "var(--danger-fg)" }}
                        onClick={() => void handleDelete(editingRule.id)}
                      >
                        {t("confirmDelete")}
                      </button>
                      <button
                        type="button"
                        className="px-3 py-1 text-xs rounded-md border"
                        style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        {tc("cancel")}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="px-3 py-1 text-xs rounded-md border"
                      style={{ borderColor: "var(--border)", color: "var(--danger)" }}
                      onClick={() => setConfirmDeleteId(editingRule.id)}
                    >
                      {tc("delete")}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {viewMode === "list" && (
            <div className="flex flex-col gap-4">
              <BudgetStatus evaluations={evaluations} />
              {evaluations.length === 0 && !loading && (
                <div className="flex items-center justify-center py-8">
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    {t("noRules")}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
