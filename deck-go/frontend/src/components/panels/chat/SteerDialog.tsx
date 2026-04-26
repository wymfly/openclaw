import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useChatStore } from "@/stores/chat";
import { steerChatSession } from "./chat-api";

export function SteerDialog() {
  const t = useTranslations("chat");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const refocusAfterSendRef = useRef(false);
  const activeSessionKey = useChatStore((state) => state.activeSessionKey);
  const isStreaming = useChatStore((state) =>
    activeSessionKey ? (state.sessions.get(activeSessionKey)?.isStreaming ?? false) : false,
  );

  useEffect(() => {
    if (sending || !refocusAfterSendRef.current) {
      return;
    }
    refocusAfterSendRef.current = false;
    inputRef.current?.focus();
  }, [sending]);

  if (!activeSessionKey || !isStreaming) {
    return null;
  }

  const handleSteer = async () => {
    const trimmed = message.trim();
    if (!trimmed || sending) {
      return;
    }
    setSending(true);
    try {
      await steerChatSession({ sessionKey: activeSessionKey, message: trimmed });
      setMessage("");
    } catch {
      useChatStore.getState().setSessionError(activeSessionKey, t("error"));
    } finally {
      refocusAfterSendRef.current = true;
      setSending(false);
    }
  };

  return (
    <div className="deck-ui-context-strip">
      <label className="deck-ui-inline-input">
        <span>{t("steer")}</span>
        <input
          ref={inputRef}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void handleSteer();
            }
          }}
          placeholder={t("steerPlaceholder")}
          disabled={sending}
        />
      </label>
      <button
        className="deck-ui-context-button"
        type="button"
        onClick={() => void handleSteer()}
        disabled={!message.trim() || sending}
      >
        {t("steer")}
      </button>
    </div>
  );
}
