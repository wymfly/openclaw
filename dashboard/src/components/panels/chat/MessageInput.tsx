"use client";

import { Send, Square, Paperclip, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useChatStore, type ContentBlock } from "@/stores/chat";
import { useActiveSessionKey, useSessionStreaming } from "@/stores/chat-hooks";
import { useNotificationsStore } from "@/stores/notifications";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PendingAttachment {
  id: string;
  file: File;
  preview?: string;
  type: "image" | "file";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_FILE_COUNT = 10;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const result = reader.result as string;
      // Strip data URL prefix: "data:image/jpeg;base64,XXXX" → "XXXX"
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64 ?? "");
    });
    reader.addEventListener("error", reject);
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MessageInput() {
  const t = useTranslations("chat");
  const activeSessionKey = useActiveSessionKey();
  const { isStreaming } = useSessionStreaming();
  const activeAgentId = useChatStore((s) => s.activeAgentId);
  const addToast = useNotificationsStore((s) => s.addToast);

  const [input, setInput] = useState("");
  const [files, setFiles] = useState<PendingAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------------------
  // File management
  // -------------------------------------------------------------------------

  const addFiles = useCallback(
    (newFiles: File[]) => {
      for (const f of newFiles) {
        if (f.size > MAX_FILE_SIZE) {
          addToast("error", t("fileTooLarge", { name: f.name }));
          return;
        }
      }
      if (files.length + newFiles.length > MAX_FILE_COUNT) {
        addToast("error", t("tooManyFiles"));
        return;
      }
      const pending: PendingAttachment[] = newFiles.map((file) => ({
        id: crypto.randomUUID(),
        file,
        type: file.type.startsWith("image/") ? ("image" as const) : ("file" as const),
        preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      }));
      setFiles((prev) => [...prev, ...pending]);
    },
    [files.length, addToast, t],
  );

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.preview) {
        URL.revokeObjectURL(target.preview);
      }
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  // -------------------------------------------------------------------------
  // Send
  // -------------------------------------------------------------------------

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text && files.length === 0) {
      return;
    }
    if (isStreaming) {
      return;
    }

    // Build content blocks for local optimistic display
    const userContent: ContentBlock[] = [];

    // Encode files to base64 and build attachment payload
    const attachments: Array<{
      type: string;
      mimeType: string;
      fileName: string;
      content: string;
    }> = [];
    for (const pending of files) {
      let base64: string;
      try {
        base64 = await fileToBase64(pending.file);
      } catch {
        addToast("error", t("uploadFailed"));
        return;
      }
      const mimeType = pending.file.type || "application/octet-stream";
      if (pending.type === "image") {
        userContent.push({ type: "image", data: base64, mimeType, fileName: pending.file.name });
      } else {
        userContent.push({
          type: "file",
          data: base64,
          mimeType,
          fileName: pending.file.name,
          size: pending.file.size,
        });
      }
      attachments.push({
        type: pending.type,
        mimeType,
        fileName: pending.file.name,
        content: base64,
      });
    }
    if (text) {
      userContent.push({ type: "text", text });
    }

    // Optimistic local display
    const sessionKey = activeSessionKey || `agent:${activeAgentId || "main"}:main`;
    useChatStore.getState().addMessage(sessionKey, {
      id: `user-${Date.now()}`,
      role: "user",
      content: userContent,
      timestamp: Date.now(),
    });

    // Clear input and revoke object URLs before async work
    setInput("");
    const capturedFiles = files;
    setFiles([]);
    capturedFiles.forEach((f) => {
      if (f.preview) {
        URL.revokeObjectURL(f.preview);
      }
    });

    useChatStore.getState().setStreaming(sessionKey, true);
    useChatStore.getState().setError(sessionKey, null);

    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text || undefined,
          sessionKey,
          agentId: activeAgentId ?? undefined,
          attachments: attachments.length > 0 ? attachments : undefined,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        useChatStore.getState().setError(sessionKey, data.error ?? t("error"));
        useChatStore.getState().setStreaming(sessionKey, false);
      }
    } catch {
      useChatStore.getState().setError(sessionKey, t("error"));
      useChatStore.getState().setStreaming(sessionKey, false);
    }
  }, [input, files, isStreaming, activeSessionKey, activeAgentId, addToast, t]);

  // -------------------------------------------------------------------------
  // Abort
  // -------------------------------------------------------------------------

  const handleAbort = useCallback(async () => {
    const sessionKey = activeSessionKey ?? "agent:main:main";
    await fetch("/api/chat/abort", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionKey,
        agentId: activeAgentId ?? undefined,
      }),
    });
    useChatStore.getState().setStreaming(sessionKey, false);
  }, [activeSessionKey, activeAgentId]);

  // -------------------------------------------------------------------------
  // Event handlers
  // -------------------------------------------------------------------------

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    addFiles(Array.from(e.dataTransfer.files));
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      className="border-t border-[var(--border)] p-3"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {/* Attachment preview strip */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {files.map((f) => (
            <span
              key={f.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-[var(--bg-tertiary)] text-[var(--text-secondary)] ring-1 ring-[var(--border-subtle)]"
            >
              {f.preview && (
                <img
                  src={f.preview}
                  alt={f.file.name}
                  className="w-5 h-5 rounded object-cover shrink-0"
                />
              )}
              <span className="truncate max-w-[100px]">{f.file.name}</span>
              <button
                onClick={() => removeFile(f.id)}
                className="hover:text-[var(--danger)] transition-colors cursor-pointer shrink-0"
                aria-label={`Remove ${f.file.name}`}
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
          aria-label={t("attachFile")}
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
              addFiles(Array.from(e.target.files));
              // Reset so the same file can be re-selected
              e.target.value = "";
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
              input.trim() || files.length > 0
                ? "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] shadow-[var(--accent-glow)]"
                : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] cursor-not-allowed",
            )}
            onClick={() => void sendMessage()}
            disabled={!input.trim() && files.length === 0}
            title={t("send")}
          >
            <Send size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
