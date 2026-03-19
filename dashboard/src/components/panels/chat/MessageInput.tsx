"use client";

import { Send, Square, Paperclip } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
          sessionKey: activeSessionId ?? undefined,
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
        sessionKey: activeSessionId ?? undefined,
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
    <div className="border-t p-3" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {files.map((f, i) => (
            <Badge key={`${f.name}-${i}`} variant="secondary" className="gap-1">
              {f.name}
              <button
                onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}
                className="hover:opacity-60"
              >
                &times;
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <Button variant="ghost" size="icon-xs" onClick={() => fileInputRef.current?.click()}>
          <Paperclip size={16} />
        </Button>
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
          className="flex-1 resize-none text-sm rounded-lg px-3 py-2 outline-none max-h-[120px] border border-input bg-transparent text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        {isStreaming ? (
          <Button
            variant="destructive"
            size="icon-sm"
            onClick={() => void handleAbort()}
            title={t("abort")}
          >
            <Square size={16} />
          </Button>
        ) : (
          <Button
            size="icon-sm"
            onClick={() => void sendMessage()}
            disabled={!input.trim()}
            title={t("send")}
          >
            <Send size={16} />
          </Button>
        )}
      </div>
    </div>
  );
}
