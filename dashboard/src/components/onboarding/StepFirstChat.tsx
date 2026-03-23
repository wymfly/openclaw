"use client";

import { MessageCircle, Send, Loader2, CheckCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useCallback, useRef } from "react";
import type { OnboardingData } from "./OnboardingWizard";

type Props = { data: OnboardingData; onComplete: () => void; onBack: () => void };

/**
 * Onboarding Step 3: First Chat.
 *
 * Correct order:
 *   1. Save settings (so the runtime initializes and Gateway connects)
 *   2. Wait briefly for the adapter to connect
 *   3. Then allow sending a test message
 */
export function StepFirstChat({ data, onComplete, onBack }: Props) {
  const t = useTranslations("onboarding");
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedRef = useRef(false);

  /** Save configuration first, then the runtime can initialize. */
  const ensureSettingsSaved = useCallback(async (): Promise<boolean> => {
    if (savedRef.current) {
      return true;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/save-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        setError(((await res.json()) as { error?: string }).error ?? t("saveError"));
        return false;
      }
      savedRef.current = true;
      setSettingsSaved(true);
      // Brief delay to let the adapter start connecting.
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return true;
    } catch {
      setError(t("saveError"));
      return false;
    } finally {
      setSaving(false);
    }
  }, [data, t]);

  const sendTest = useCallback(async () => {
    const text = message.trim();
    if (!text) {
      return;
    }

    // Ensure settings are saved and runtime is initialized before sending.
    const ok = await ensureSettingsSaved();
    if (!ok) {
      return;
    }

    setSending(true);
    setError(null);
    setReply(null);
    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionKey: "main" }),
      });
      if (!res.ok) {
        setError(((await res.json()) as { error?: string }).error ?? t("chatError"));
        return;
      }
      // chat.send returns { runId, status: "started" } — the actual
      // response will arrive via SSE. Show a confirmation for now.
      setReply(t("chatSuccess"));
    } catch {
      setError(t("chatError"));
    } finally {
      setSending(false);
    }
  }, [message, t, ensureSettingsSaved]);

  const handleComplete = useCallback(async () => {
    const ok = await ensureSettingsSaved();
    if (ok) {
      onComplete();
    }
  }, [ensureSettingsSaved, onComplete]);

  const iStyle = {
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <MessageCircle size={16} style={{ color: "var(--accent)" }} />
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {t("stepChat")}
        </span>
      </div>
      {settingsSaved && (
        <div
          className="text-xs p-2 rounded flex items-center gap-1"
          style={{
            backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)",
            color: "var(--accent)",
          }}
        >
          <CheckCircle size={12} />
          {t("settingsSaved") ?? "Settings saved"}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              void sendTest();
            }
          }}
          placeholder={t("chatPlaceholder")}
          className="flex-1 text-sm rounded px-3 py-2"
          style={iStyle}
        />
        <button
          onClick={() => void sendTest()}
          disabled={sending || saving || !message.trim()}
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded hover:opacity-80 transition-opacity disabled:opacity-40"
          style={{ backgroundColor: "var(--accent)", color: "#fff" }}
        >
          {sending || saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </div>
      {reply && (
        <div
          className="text-xs p-3 rounded"
          style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
        >
          {reply}
        </div>
      )}
      {error && (
        <div
          className="text-xs p-2 rounded"
          style={{ backgroundColor: "var(--status-disconnected)", color: "#fff" }}
        >
          {error}
        </div>
      )}
      <div className="flex justify-between pt-2">
        <button
          onClick={onBack}
          className="text-xs px-4 py-2 rounded hover:opacity-80 transition-opacity"
          style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
        >
          {t("back")}
        </button>
        <button
          onClick={() => void handleComplete()}
          disabled={saving}
          className="flex items-center gap-1.5 text-xs px-4 py-2 rounded hover:opacity-80 transition-opacity disabled:opacity-40"
          style={{ backgroundColor: "var(--accent)", color: "#fff" }}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
          {t("finish")}
        </button>
      </div>
    </div>
  );
}
