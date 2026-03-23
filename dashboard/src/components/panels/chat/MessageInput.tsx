"use client";

import { Send, Square, Paperclip } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useCallback } from "react";
import { useChatStore } from "@/stores/chat";
import { useActiveSessionKey, useSessionStreaming } from "@/stores/chat-hooks";

export function MessageInput() {
  const t = useTranslations("chat");
  const activeSessionKey = useActiveSessionKey();
  const { isStreaming } = useSessionStreaming();
  const activeAgentId = useChatStore((s) => s.activeAgentId);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) {
      return;
    }

    // Generate sessionKey for new conversations
    const agentId = activeAgentId || "main";
    let sessionKey = activeSessionKey;
    if (!sessionKey) {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      sessionKey = `agent:${agentId}:web-${suffix}`;
      useChatStore.getState().setActiveSession(sessionKey);
    }

    useChatStore.getState().addMessage(sessionKey, {
      id: `user-${Date.now()}`,
      role: "user",
      content: [{ type: "text" as const, text }],
      timestamp: Date.now(),
    });
    setInput("");
    useChatStore.getState().setSessionStreaming(sessionKey, true);
    useChatStore.getState().setSessionError(sessionKey, null);

    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          sessionKey,
          agentId,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        useChatStore.getState().setSessionError(sessionKey, data.error ?? t("error"));
        useChatStore.getState().setSessionStreaming(sessionKey, false);
      }
    } catch {
      useChatStore.getState().setSessionError(sessionKey, t("error"));
      useChatStore.getState().setSessionStreaming(sessionKey, false);
    }
  }, [input, isStreaming, activeSessionKey, activeAgentId, t]);

  const handleAbort = useCallback(async () => {
    await fetch("/api/chat/abort", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionKey: activeSessionKey ?? undefined,
        agentId: activeAgentId ?? undefined,
      }),
    });
    if (activeSessionKey) {
      useChatStore.getState().setSessionStreaming(activeSessionKey, false);
    }
  }, [activeSessionKey, activeAgentId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setFiles((prev) => [...prev, ...Array.from(e.dataTransfer.files)]);
  };

  return (
    <div
      className="border-t p-3"
      style={{ borderColor: "var(--border)" }}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {files.map((f, i) => (
            <span
              key={`${f.name}-${i}`}
              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded"
              style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)" }}
            >
              {f.name}
              <button
                onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}
                className="hover:opacity-60"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-1.5 rounded hover:opacity-80 transition-opacity shrink-0"
          style={{ color: "var(--text-secondary)" }}
        >
          <Paperclip size={16} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              setFiles((p) => [...p, ...Array.from(e.target.files!)]);
            }
          }}
        />
        <textarea
          data-chat-input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("placeholder")}
          rows={1}
          className="flex-1 resize-none text-sm rounded-lg px-3 py-2 outline-none"
          style={{
            backgroundColor: "var(--bg-secondary)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
            maxHeight: 120,
          }}
        />
        {isStreaming ? (
          <button
            onClick={() => void handleAbort()}
            className="p-2 rounded-lg shrink-0 hover:opacity-80 transition-opacity"
            style={{ backgroundColor: "var(--status-disconnected)", color: "var(--brand-fg)" }}
            title={t("abort")}
          >
            <Square size={16} />
          </button>
        ) : (
          <button
            onClick={() => void sendMessage()}
            disabled={!input.trim()}
            className="p-2 rounded-lg shrink-0 hover:opacity-80 transition-opacity disabled:opacity-40"
            style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}
            title={t("send")}
          >
            <Send size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
