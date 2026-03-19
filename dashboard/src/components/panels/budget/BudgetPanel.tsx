"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
    <div className="flex h-full rounded-lg overflow-hidden border">
      {/* Left sidebar — rule list */}
      <div className="w-64 flex-shrink-0 flex flex-col border-r bg-card">
        <div className="flex items-center justify-between px-3 py-3 border-b">
          <h2 className="text-sm font-semibold text-foreground">{t("title")}</h2>
          <Button size="xs" onClick={handleCreate}>
            + {tc("create")}
          </Button>
        </div>

        <ScrollArea className="flex-1">
          {loading && <p className="text-xs p-3 text-muted-foreground">{tc("loading")}</p>}

          {!loading && (
            <RuleList
              rules={rules}
              evaluations={evaluations}
              selectedRuleId={selectedRuleId}
              onSelect={handleSelect}
            />
          )}
        </ScrollArea>
      </div>

      {/* Right detail area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        {error && (
          <div className="px-4 py-2 text-xs border-b text-destructive bg-[var(--danger-muted)]">
            {error}
          </div>
        )}

        <ScrollArea className="flex-1">
          <div className="p-4">
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
                  <div className="flex gap-2 border-t pt-3">
                    {confirmDeleteId === editingRule.id ? (
                      <div className="flex gap-1">
                        <Button
                          variant="destructive"
                          size="xs"
                          onClick={() => void handleDelete(editingRule.id)}
                        >
                          {t("confirmDelete")}
                        </Button>
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          {tc("cancel")}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="xs"
                        className="text-destructive"
                        onClick={() => setConfirmDeleteId(editingRule.id)}
                      >
                        {tc("delete")}
                      </Button>
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
                    <p className="text-sm text-muted-foreground">{t("noRules")}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
