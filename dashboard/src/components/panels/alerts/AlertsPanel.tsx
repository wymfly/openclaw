"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
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

  const TABS: { key: Tab; label: string }[] = [
    { key: "rules", label: t("title") },
    { key: "fired", label: t("firedAlerts") },
  ];

  return (
    <div
      className="flex flex-col h-full rounded-lg overflow-hidden border"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--card)",
        }}
      >
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className="px-3 py-1 text-xs rounded-md font-medium transition-colors"
              style={{
                backgroundColor: tab === t.key ? "var(--primary)" : "transparent",
                color: tab === t.key ? "var(--primary-foreground)" : "var(--muted-foreground)",
              }}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === "rules" && !showForm && (
          <button
            type="button"
            onClick={() => {
              setEditingRule(undefined);
              setShowForm(true);
            }}
            className="px-3 py-1 text-xs font-medium rounded-md"
            style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            {t("addRule")}
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4" style={{ backgroundColor: "var(--background)" }}>
        {loading && (
          <div
            className="flex items-center justify-center py-12"
            style={{ color: "var(--muted-foreground)" }}
          >
            <p className="text-sm">{tc("loading")}</p>
          </div>
        )}

        {error && !loading && (
          <div
            className="flex items-center justify-center py-12"
            style={{ color: "var(--muted-foreground)" }}
          >
            <p className="text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && tab === "rules" && (
          <>
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
          </>
        )}

        {!loading && !error && tab === "fired" && <FiredAlertsList alerts={firedAlerts} />}
      </div>
    </div>
  );
}
