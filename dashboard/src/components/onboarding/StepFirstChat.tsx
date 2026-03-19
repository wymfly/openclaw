"use client";

import { MessageCircle, Send, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
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
      <div className="flex items-center gap-2.5 mb-1">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--accent-muted)]">
          <MessageCircle size={14} className="text-[var(--accent)]" />
        </div>
        <span className="text-sm font-semibold text-[var(--text-primary)]">{t("stepChat")}</span>
      </div>

      {/* Settings saved indicator */}
      {settingsSaved && (
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium bg-[var(--success-muted)] text-[var(--success-muted-text)] ring-1 ring-[var(--success)]/20 transition-panel">
          <CheckCircle size={12} />
          {t("settingsSaved") ?? "Settings saved"}
        </div>
      )}

      {/* Chat input */}
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
          className="flex-1 h-9 text-sm focus-glow"
        />
        <Button
          size="icon"
          onClick={() => void sendTest()}
          disabled={sending || saving || !message.trim()}
          className="w-9 h-9 shrink-0"
        >
          {sending || saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </Button>
      </div>

      {/* Reply */}
      {reply && (
        <div className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs bg-[var(--bg-tertiary)] text-[var(--text-primary)] ring-1 ring-[var(--border-subtle)] transition-panel">
          <CheckCircle size={12} className="text-[var(--success)] shrink-0" />
          {reply}
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium transition-panel",
            "bg-[var(--danger-muted)] text-[var(--danger-muted-text)] ring-1 ring-[var(--danger)]/20",
          )}
        >
          <AlertCircle size={12} />
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between pt-2 border-t border-[var(--border-subtle)]">
        <Button variant="outline" size="sm" onClick={onBack} className="text-xs">
          {t("back")}
        </Button>
        <Button
          size="sm"
          onClick={() => void handleComplete()}
          disabled={saving}
          className="gap-1.5 text-xs"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
          {t("finish")}
        </Button>
      </div>
    </div>
  );
}
