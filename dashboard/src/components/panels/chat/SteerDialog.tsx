"use client";

import { Navigation } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { deckFetch } from "@/lib/deck-client";
import { useChatStore } from "@/stores/chat";

/**
 * Inline steer dialog — allows the user to inject a steering instruction
 * into a running session to change its execution direction.
 *
 * Visible only when the active session is streaming.
 */
export function SteerDialog() {
  const t = useTranslations("chat");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeSessionKey = useChatStore((s) => s.activeSessionKey);
  const isStreaming = useChatStore(
    (s) => (activeSessionKey ? s.sessions.get(activeSessionKey)?.isStreaming : false) ?? false,
  );

  if (!isStreaming || !activeSessionKey) {
    return null;
  }

  const handleSteer = async () => {
    const trimmed = message.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await deckFetch("/api/chat/steer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionKey: activeSessionKey, message: trimmed }),
      });
      setMessage("");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 border-t"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--muted)" }}
    >
      <Navigation size={14} style={{ color: "var(--primary)", flexShrink: 0 }} />
      <input
        ref={inputRef}
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void handleSteer();
          }
        }}
        placeholder={t("steerPlaceholder")}
        className="flex-1 text-xs bg-transparent outline-none"
        style={{ color: "var(--foreground)" }}
        disabled={sending}
      />
      <button
        type="button"
        onClick={() => void handleSteer()}
        disabled={!message.trim() || sending}
        className="text-xs px-2 py-0.5 rounded font-medium transition-opacity disabled:opacity-40"
        style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
      >
        {t("steer")}
      </button>
    </div>
  );
}
