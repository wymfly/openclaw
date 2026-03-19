"use client";

import { Plus, Webhook } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  useWebhookStore,
  type Webhook as WebhookType,
  type CreateWebhookInput,
} from "@/stores/webhooks";
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
  const [editingWebhook, setEditingWebhook] = useState<WebhookType | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    void fetchWebhooks();
  }, [fetchWebhooks]);

  const selectedWebhook = webhooks.find((w) => w.id === selectedWebhookId) ?? null;

  const handleSelect = useCallback(
    (webhook: WebhookType) => {
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
    <div className="flex h-full overflow-hidden rounded-xl bg-[var(--bg-secondary)] ring-1 ring-[var(--border)]">
      {/* Left sidebar — webhook list */}
      <aside className="w-64 shrink-0 flex flex-col border-r border-[var(--border)] h-full">
        {/* Create button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCreate}
          className="justify-start gap-1.5 rounded-none border-b border-[var(--border-subtle)] text-[var(--accent)] hover:bg-[var(--accent-muted)] hover:text-[var(--accent)]"
        >
          <Plus size={14} />
          {tc("create")}
        </Button>

        <ScrollArea className="flex-1">
          {loading && <p className="text-xs p-3 text-[var(--text-secondary)]">{tc("loading")}</p>}

          {!loading && webhooks.length === 0 && (
            <p className="text-xs p-3 text-center text-[var(--text-secondary)]">
              {t("noWebhooks")}
            </p>
          )}

          <div className="p-1.5 space-y-0.5">
            {webhooks.map((wh) => {
              const isActive = selectedWebhookId === wh.id;
              return (
                <button
                  key={wh.id}
                  type="button"
                  className={cn(
                    "relative w-full text-left px-3 py-2.5 rounded-lg transition-colors duration-150 cursor-pointer",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50",
                    isActive
                      ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                      : "text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]",
                  )}
                  onClick={() => handleSelect(wh)}
                >
                  {/* Active indicator */}
                  {isActive && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]"
                      aria-hidden
                    />
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium truncate">{wh.name}</span>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[10px] h-4",
                        wh.enabled
                          ? "bg-[var(--success-muted)] text-[var(--success-muted-text)]"
                          : "bg-[var(--neutral-muted)] text-[var(--neutral-muted-text)]",
                      )}
                    >
                      {wh.enabled ? t("enabled") : t("disabled")}
                    </Badge>
                  </div>
                  <p className="text-[10px] truncate mt-0.5 font-mono text-[var(--text-secondary)]">
                    {wh.url}
                  </p>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </aside>

      {/* Right detail area */}
      <div className="flex-1 flex flex-col min-w-0">
        {error && (
          <div className="px-4 py-2 text-xs border-b border-[var(--border)] bg-[var(--danger-muted)] text-[var(--danger-muted-text)]">
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
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    {selectedWebhook.name}
                  </h3>
                  <p className="text-xs mt-0.5 font-mono text-[var(--text-secondary)]">
                    {selectedWebhook.url}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleEdit}>
                    {tc("edit")}
                  </Button>
                  {confirmDeleteId === selectedWebhook.id ? (
                    <div className="flex gap-1">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => void handleDelete(selectedWebhook.id)}
                      >
                        {tc("delete")}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setConfirmDeleteId(null)}>
                        {tc("cancel")}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[var(--danger)] border-[var(--danger)]/30 hover:bg-[var(--danger-muted)]"
                      onClick={() => setConfirmDeleteId(selectedWebhook.id)}
                    >
                      {tc("delete")}
                    </Button>
                  )}
                </div>
              </div>

              {/* Events badges */}
              <div className="flex flex-wrap gap-1.5">
                {selectedWebhook.events.map((ev) => (
                  <Badge
                    key={ev}
                    variant="secondary"
                    className="text-xs bg-[var(--accent-muted)] text-[var(--accent)]"
                  >
                    {ev}
                  </Badge>
                ))}
              </div>

              {/* Delivery history */}
              <DeliveryHistory deliveries={deliveries} onTest={handleTest} testing={testing} />
            </div>
          )}

          {viewMode === "list" && !selectedWebhookId && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--text-secondary)]">
              <div className="w-12 h-12 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center ring-1 ring-[var(--border-subtle)]">
                <Webhook size={20} className="text-[var(--accent)]" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-[var(--text-primary)]">{t("noWebhooks")}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
