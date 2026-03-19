"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Webhook, CreateWebhookInput } from "@/stores/webhooks";

// Available event types for the multi-select
const AVAILABLE_EVENTS = [
  "*",
  "chat",
  "agent",
  "agent.updated",
  "cron.run.complete",
  "approval.pending",
  "approval.resolved",
  "budget.warn",
  "budget.over",
  "alert.fired",
];

interface WebhookFormProps {
  webhook: Webhook | null;
  onSave: (input: CreateWebhookInput) => void;
  onCancel: () => void;
  saving?: boolean;
}

export function WebhookForm({ webhook, onSave, onCancel, saving }: WebhookFormProps) {
  const t = useTranslations("webhooks");
  const tc = useTranslations("common");

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [events, setEvents] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (webhook) {
      setName(webhook.name);
      setUrl(webhook.url);
      setSecret(webhook.secret ?? "");
      setEvents(webhook.events);
      setEnabled(webhook.enabled);
    } else {
      setName("");
      setUrl("");
      setSecret("");
      setEvents([]);
      setEnabled(true);
    }
  }, [webhook]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input: CreateWebhookInput = {
      name,
      url,
      secret: secret || undefined,
      events,
      enabled,
    };
    onSave(input);
  };

  const toggleEvent = (event: string) => {
    setEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-foreground">
        {webhook ? t("editWebhook") : t("addWebhook")}
      </h3>

      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">{t("name")}</Label>
        <Input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>

      {/* URL */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">{t("url")}</Label>
        <Input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/webhook"
          required
        />
      </div>

      {/* Secret */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">{t("secret")}</Label>
        <div className="flex gap-2">
          <Input
            type={showSecret ? "text" : "password"}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowSecret(!showSecret)}
          >
            {showSecret ? t("hide") : t("show")}
          </Button>
        </div>
      </div>

      {/* Events multi-select */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">{t("events")}</Label>
        <div className="flex flex-wrap gap-1.5">
          {AVAILABLE_EVENTS.map((event) => (
            <Button
              key={event}
              type="button"
              variant={events.includes(event) ? "default" : "outline"}
              size="xs"
              onClick={() => toggleEvent(event)}
            >
              {event}
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
            "w-10 h-5 rounded-full transition-colors relative cursor-pointer",
            enabled ? "bg-primary" : "bg-input",
          )}
          onClick={() => setEnabled(!enabled)}
        >
          <span
            className={cn(
              "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
              enabled ? "left-[calc(100%-18px)]" : "left-0.5",
            )}
          />
        </button>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button type="submit" size="sm" disabled={saving}>
          {tc("save")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          {tc("cancel")}
        </Button>
      </div>
    </form>
  );
}
