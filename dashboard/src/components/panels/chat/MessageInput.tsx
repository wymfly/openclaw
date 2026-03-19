"use client";

import { Send, Square, Paperclip, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/stores/chat";

export function MessageInput() {
  const t = useTranslations("chat");
  const { isStreaming, activeSessionId, activeAgentId, addMessage, setIsStreaming, setError } =
    useChatStore();
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) {
      return;
    }
    addMessage({ id: `user-${Date.now()}`, role: "user", content: text, timestamp: Date.now() });
    setInput("");
    setIsStreaming(true);
    setError(null);
    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          sessionKey: activeSessionId ?? "agent:main:main",
          agentId: activeAgentId ?? undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? t("error"));
        setIsStreaming(false);
      }
    } catch {
      setError(t("error"));
      setIsStreaming(false);
    }
  }, [input, isStreaming, activeSessionId, activeAgentId, addMessage, setIsStreaming, setError, t]);

  const handleAbort = useCallback(async () => {
    await fetch("/api/chat/abort", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionKey: activeSessionId ?? "agent:main:main",
        agentId: activeAgentId ?? undefined,
      }),
    });
    setIsStreaming(false);
  }, [activeSessionId, activeAgentId, setIsStreaming]);

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
      className="border-t border-[var(--border)] p-3"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {/* File attachments */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {files.map((f, i) => (
            <span
              key={`${f.name}-${i}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-[var(--bg-tertiary)] text-[var(--text-secondary)] ring-1 ring-[var(--border-subtle)]"
            >
              {f.name}
              <button
                onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}
                className="hover:text-[var(--danger)] transition-colors cursor-pointer"
                aria-label={`Remove ${f.name}`}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2">
        {/* Attach button */}
        <button
          className="flex items-center justify-center w-8 h-8 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer shrink-0"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach file"
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

        {/* Textarea */}
        <textarea
          data-chat-input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("placeholder")}
          rows={1}
          className={cn(
            "flex-1 resize-none text-sm rounded-xl px-3.5 py-2 max-h-[120px]",
            "bg-[var(--bg-tertiary)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]",
            "border border-[var(--border-subtle)]",
            "outline-none transition-shadow duration-150",
            "focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 focus:shadow-[var(--accent-glow)]",
          )}
        />

        {/* Send / Abort */}
        {isStreaming ? (
          <Button
            variant="destructive"
            size="icon-sm"
            className="shrink-0 rounded-xl"
            onClick={() => void handleAbort()}
            title={t("abort")}
          >
            <Square size={14} />
          </Button>
        ) : (
          <button
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-xl shrink-0 transition-all duration-150 cursor-pointer",
              input.trim()
                ? "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] shadow-[var(--accent-glow)]"
                : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] cursor-not-allowed",
            )}
            onClick={() => void sendMessage()}
            disabled={!input.trim()}
            title={t("send")}
          >
            <Send size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
