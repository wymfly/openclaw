"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
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

  const inputStyle = {
    backgroundColor: "var(--bg-primary)",
    borderColor: "var(--border)",
    color: "var(--text-primary)",
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        {webhook ? t("editWebhook") : t("addWebhook")}
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

      {/* URL */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          {t("url")}
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="px-3 py-2 text-sm rounded-md border"
          style={inputStyle}
          placeholder="https://example.com/webhook"
          required
        />
      </div>

      {/* Secret */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          {t("secret")}
        </label>
        <div className="flex gap-2">
          <input
            type={showSecret ? "text" : "password"}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className="flex-1 px-3 py-2 text-sm rounded-md border"
            style={inputStyle}
          />
          <button
            type="button"
            className="px-3 py-2 text-xs rounded-md border"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            onClick={() => setShowSecret(!showSecret)}
          >
            {showSecret ? t("hide") : t("show")}
          </button>
        </div>
      </div>

      {/* Events multi-select */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          {t("events")}
        </label>
        <div className="flex flex-wrap gap-1.5">
          {AVAILABLE_EVENTS.map((event) => (
            <button
              key={event}
              type="button"
              className="px-2 py-1 text-xs rounded-md border transition-colors"
              style={{
                backgroundColor: events.includes(event) ? "var(--accent)" : "transparent",
                color: events.includes(event) ? "var(--accent-fg)" : "var(--text-secondary)",
                borderColor: events.includes(event) ? "var(--accent)" : "var(--border)",
              }}
              onClick={() => toggleEvent(event)}
            >
              {event}
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
