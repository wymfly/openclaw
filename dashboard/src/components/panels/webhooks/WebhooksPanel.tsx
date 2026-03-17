"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useCallback } from "react";
import { useWebhookStore, type Webhook, type CreateWebhookInput } from "@/stores/webhooks";
import { DeliveryHistory } from "./DeliveryHistory";
import { WebhookForm } from "./WebhookForm";

type ViewMode = "list" | "form" | "deliveries";

export function WebhooksPanel() {
  const t = useTranslations("webhooks");
  const tc = useTranslations("common");

  const {
    webhooks,
    selectedWebhookId,
    deliveries,
    loading,
    error,
    selectWebhook,
    fetchWebhooks,
    createWebhook,
    updateWebhook,
    deleteWebhook,
    fetchDeliveries,
    testWebhook,
  } = useWebhookStore();

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    void fetchWebhooks();
  }, [fetchWebhooks]);

  const selectedWebhook = webhooks.find((w) => w.id === selectedWebhookId) ?? null;

  const handleSelect = useCallback(
    (webhook: Webhook) => {
      selectWebhook(webhook.id);
      setViewMode("deliveries");
      void fetchDeliveries(webhook.id);
    },
    [selectWebhook, fetchDeliveries],
  );

  const handleCreate = () => {
    setEditingWebhook(null);
    setViewMode("form");
  };

  const handleEdit = () => {
    if (selectedWebhook) {
      setEditingWebhook(selectedWebhook);
      setViewMode("form");
    }
  };

  const handleSave = async (input: CreateWebhookInput) => {
    setSaving(true);
    if (editingWebhook) {
      await updateWebhook(editingWebhook.id, input);
    } else {
      await createWebhook(input);
    }
    setSaving(false);
    setViewMode("list");
    setEditingWebhook(null);
  };

  const handleDelete = async (id: string) => {
    await deleteWebhook(id);
    setConfirmDeleteId(null);
    setViewMode("list");
  };

  const handleTest = async () => {
    if (!selectedWebhookId) {
      return;
    }
    setTesting(true);
    await testWebhook(selectedWebhookId);
    setTesting(false);
  };

  return (
    <div
      className="flex h-full rounded-lg overflow-hidden border"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Left sidebar — webhook list */}
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

          {!loading && webhooks.length === 0 && (
            <p className="text-xs p-3 text-center" style={{ color: "var(--text-secondary)" }}>
              {t("noWebhooks")}
            </p>
          )}

          {webhooks.map((wh) => (
            <button
              key={wh.id}
              type="button"
              className="w-full text-left px-3 py-2.5 border-b transition-colors"
              style={{
                borderColor: "var(--border)",
                backgroundColor: selectedWebhookId === wh.id ? "var(--bg-primary)" : "transparent",
              }}
              onClick={() => handleSelect(wh)}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-sm font-medium truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {wh.name}
                </span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: wh.enabled ? "var(--success-muted)" : "var(--neutral-muted)",
                    color: wh.enabled ? "var(--success)" : "var(--neutral-muted-text)",
                  }}
                >
                  {wh.enabled ? t("enabled") : t("disabled")}
                </span>
              </div>
              <p className="text-xs truncate mt-0.5" style={{ color: "var(--text-secondary)" }}>
                {wh.url}
              </p>
            </button>
          ))}
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
            <WebhookForm
              webhook={editingWebhook}
              onSave={handleSave}
              onCancel={() => {
                setViewMode(selectedWebhookId ? "deliveries" : "list");
                setEditingWebhook(null);
              }}
              saving={saving}
            />
          )}

          {viewMode === "deliveries" && selectedWebhook && (
            <div className="flex flex-col gap-4">
              {/* Webhook detail header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    {selectedWebhook.name}
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                    {selectedWebhook.url}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="px-3 py-1 text-xs rounded-md border"
                    style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                    onClick={handleEdit}
                  >
                    {tc("edit")}
                  </button>
                  {confirmDeleteId === selectedWebhook.id ? (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="px-3 py-1 text-xs rounded-md font-medium"
                        style={{ backgroundColor: "var(--danger)", color: "var(--accent-fg)" }}
                        onClick={() => void handleDelete(selectedWebhook.id)}
                      >
                        {tc("delete")}
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
                      onClick={() => setConfirmDeleteId(selectedWebhook.id)}
                    >
                      {tc("delete")}
                    </button>
                  )}
                </div>
              </div>

              {/* Events badges */}
              <div className="flex flex-wrap gap-1">
                {selectedWebhook.events.map((ev) => (
                  <span
                    key={ev}
                    className="px-2 py-0.5 text-xs rounded-md border"
                    style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                  >
                    {ev}
                  </span>
                ))}
              </div>

              {/* Delivery history */}
              <DeliveryHistory deliveries={deliveries} onTest={handleTest} testing={testing} />
            </div>
          )}

          {viewMode === "list" && !selectedWebhookId && (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {t("noWebhooks")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
