"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
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
    <div className="flex h-full overflow-hidden rounded-lg border border-border">
      {/* Left sidebar — webhook list */}
      <div className="w-64 shrink-0 flex flex-col border-r border-border bg-secondary">
        <div className="flex items-center justify-between px-3 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">{t("title")}</h2>
          <Button size="xs" onClick={handleCreate}>
            + {tc("create")}
          </Button>
        </div>

        <ScrollArea className="flex-1">
          {loading && <p className="text-xs p-3 text-muted-foreground">{tc("loading")}</p>}

          {!loading && webhooks.length === 0 && (
            <p className="text-xs p-3 text-center text-muted-foreground">{t("noWebhooks")}</p>
          )}

          {webhooks.map((wh) => (
            <button
              key={wh.id}
              type="button"
              className={cn(
                "w-full text-left px-3 py-2.5 border-b border-border transition-colors cursor-pointer",
                selectedWebhookId === wh.id ? "bg-background" : "hover:bg-muted/50",
              )}
              onClick={() => handleSelect(wh)}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium truncate text-foreground">{wh.name}</span>
                <Badge variant={wh.enabled ? "default" : "secondary"} className="text-[10px] h-4">
                  {wh.enabled ? t("enabled") : t("disabled")}
                </Badge>
              </div>
              <p className="text-xs truncate mt-0.5 text-muted-foreground">{wh.url}</p>
            </button>
          ))}
        </ScrollArea>
      </div>

      {/* Right detail area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        {error && (
          <div className="px-4 py-2 text-xs border-b border-border text-destructive bg-destructive/10">
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
                  <h3 className="text-sm font-semibold text-foreground">{selectedWebhook.name}</h3>
                  <p className="text-xs mt-0.5 text-muted-foreground">{selectedWebhook.url}</p>
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
                      className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => setConfirmDeleteId(selectedWebhook.id)}
                    >
                      {tc("delete")}
                    </Button>
                  )}
                </div>
              </div>

              {/* Events badges */}
              <div className="flex flex-wrap gap-1">
                {selectedWebhook.events.map((ev) => (
                  <Badge key={ev} variant="outline" className="text-xs">
                    {ev}
                  </Badge>
                ))}
              </div>

              {/* Delivery history */}
              <DeliveryHistory deliveries={deliveries} onTest={handleTest} testing={testing} />
            </div>
          )}

          {viewMode === "list" && !selectedWebhookId && (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-foreground">{t("noWebhooks")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
