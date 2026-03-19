"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAlertsStore, type AlertRule, type AlertAction } from "@/stores/alerts";
import { FiredAlertsList } from "./FiredAlertsList";
import { RuleForm } from "./RuleForm";
import { RuleList } from "./RuleList";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = "rules" | "fired";

type RuleFormData = {
  name: string;
  entityType: string;
  condition: string;
  threshold: number;
  action: AlertAction;
  cooldownMs: number;
  enabled: boolean;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AlertsPanel() {
  const t = useTranslations("alerts");
  const tc = useTranslations("common");

  const { rules, firedAlerts, loading, error, fetchRules, createRule, updateRule, deleteRule } =
    useAlertsStore();

  const [tab, setTab] = useState<Tab>("rules");
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | undefined>();

  useEffect(() => {
    void fetchRules();
  }, [fetchRules]);

  const handleCreate = (data: RuleFormData) => {
    void createRule(data);
    setShowForm(false);
  };

  const handleUpdate = (data: RuleFormData) => {
    if (editingRule) {
      void updateRule(editingRule.id, data);
      setEditingRule(undefined);
      setShowForm(false);
    }
  };

  const handleEdit = (rule: AlertRule) => {
    setEditingRule(rule);
    setShowForm(true);
  };

  const handleToggle = (id: string, enabled: boolean) => {
    void updateRule(id, { enabled } as Partial<AlertRule>);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingRule(undefined);
  };

  return (
    <div className="flex flex-col h-full rounded-lg overflow-hidden border border-border">
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <TabsList>
            <TabsTrigger value="rules">{t("title")}</TabsTrigger>
            <TabsTrigger value="fired">{t("firedAlerts")}</TabsTrigger>
          </TabsList>
          {tab === "rules" && !showForm && (
            <Button
              size="xs"
              onClick={() => {
                setEditingRule(undefined);
                setShowForm(true);
              }}
            >
              {t("addRule")}
            </Button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 bg-background">
          {loading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <p className="text-sm">{tc("loading")}</p>
            </div>
          )}

          {error && !loading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <p className="text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && (
            <>
              <TabsContent value="rules">
                {showForm ? (
                  <RuleForm
                    rule={editingRule}
                    onSubmit={editingRule ? handleUpdate : handleCreate}
                    onCancel={handleCancel}
                  />
                ) : (
                  <RuleList
                    rules={rules}
                    onEdit={handleEdit}
                    onDelete={(id) => void deleteRule(id)}
                    onToggle={handleToggle}
                  />
                )}
              </TabsContent>

              <TabsContent value="fired">
                <FiredAlertsList alerts={firedAlerts} />
              </TabsContent>
            </>
          )}
        </div>
      </Tabs>
    </div>
  );
}
