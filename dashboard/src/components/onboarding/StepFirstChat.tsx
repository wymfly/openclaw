"use client";

import { MessageCircle, Send, Loader2, CheckCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  return (
    <div className="space-y-4">
      <div className="mb-2 flex items-center gap-2">
        <MessageCircle size={16} className="text-primary" />
        <span className="text-sm font-semibold text-foreground">{t("stepChat")}</span>
      </div>

      {settingsSaved && (
        <div className="flex items-center gap-1 rounded-md bg-primary/10 p-2 text-xs text-primary">
          <CheckCircle size={12} />
          {t("settingsSaved") ?? "Settings saved"}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              void sendTest();
            }
          }}
          placeholder={t("chatPlaceholder")}
          className="flex-1 text-sm"
        />
        <Button
          size="icon"
          onClick={() => void sendTest()}
          disabled={sending || saving || !message.trim()}
        >
          {sending || saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </Button>
      </div>

      {reply && <div className="rounded-md bg-muted p-3 text-xs text-foreground">{reply}</div>}

      {error && (
        <div className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">{error}</div>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="outline" size="sm" onClick={onBack}>
          {t("back")}
        </Button>
        <Button size="sm" onClick={() => void handleComplete()} disabled={saving}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
          {t("finish")}
        </Button>
      </div>
    </div>
  );
}
