"use client";

import { Send, Square, Paperclip, X, FileIcon, ImageIcon, Loader2, PanelRight, SquareCode } from "lucide-react";
import { useTranslations } from "next-intl";
import { useContext, useEffect, useRef, useState, useCallback } from "react";
import { useChatStore } from "@/stores/chat";
import { useActiveSessionKey, useSessionStreaming } from "@/stores/chat-hooks";
import { useUIStore } from "@/stores/ui";
import { ArtifactContext } from "./ChatPanel";

/** Max attachment size — matches macOS client (5MB). */
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

/** Read a File as base64 string (without data URL prefix). */
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip "data:...;base64," prefix
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

/** Determine attachment type from MIME. */
function attachmentType(mime: string): string {
  if (mime.startsWith("image/")) return "image";
  return "file";
}

/** Format file size for display. */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/** Image thumbnail preview with Object URL lifecycle management. */
function ImagePreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return (
    <div
      className="relative group rounded-md overflow-hidden"
      style={{ border: "1px solid var(--border-subtle)" }}
    >
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={file.name} className="h-16 w-auto max-w-[120px] object-cover" />
      )}
      <button
        onClick={onRemove}
        className="absolute top-0.5 right-0.5 p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "#fff" }}
      >
        <X size={10} />
      </button>
      <div
        className="absolute bottom-0 left-0 right-0 text-[9px] px-1 py-0.5 truncate"
        style={{ backgroundColor: "rgba(0,0,0,0.5)", color: "#fff" }}
      >
        {file.name}
      </div>
    </div>
  );
}

/** Isolated canvas toggle — subscribes to canvasVisible for reactive color. */
function CanvasToggle({ label }: { label: string }) {
  const canvasVisible = useUIStore((s) => s.canvasVisible);
  return (
    <button
      onClick={() => useUIStore.getState().setCanvasVisible(!canvasVisible)}
      className="p-1.5 rounded hover:opacity-80 transition-opacity shrink-0 cursor-pointer"
      style={{ color: canvasVisible ? "var(--primary)" : "var(--muted-foreground)" }}
      title={label}
    >
      <PanelRight size={16} />
    </button>
  );
}

/** Artifact panel toggle — uses ArtifactContext from ChatPanel. */
function ArtifactToggle({ label }: { label: string }) {
  const { onToggleArtifactPanel, artifactPanelOpen } = useContext(ArtifactContext);
  return (
    <button
      onClick={onToggleArtifactPanel}
      className="p-1.5 rounded hover:opacity-80 transition-opacity shrink-0 cursor-pointer"
      style={{ color: artifactPanelOpen ? "var(--primary)" : "var(--muted-foreground)" }}
      title={label}
    >
      <SquareCode size={16} />
    </button>
  );
}

export function MessageInput() {
  const t = useTranslations("chat");
  const activeSessionKey = useActiveSessionKey();
  const { isStreaming } = useSessionStreaming();
  const activeAgentId = useChatStore((s) => s.activeAgentId);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (newFiles: File[]) => {
      const valid = newFiles.filter((f) => {
        if (f.size > MAX_ATTACHMENT_BYTES) {
          useChatStore
            .getState()
            .setSessionError(
              activeSessionKey ?? "",
              `${f.name} exceeds ${formatSize(MAX_ATTACHMENT_BYTES)} limit`,
            );
          return false;
        }
        return true;
      });
      if (valid.length > 0) {
        setFiles((prev) => [...prev, ...valid]);
      }
    },
    [activeSessionKey],
  );

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if ((!text && files.length === 0) || isStreaming || isSending) {
      return;
    }

    const agentId = activeAgentId || "main";
    let sessionKey = activeSessionKey;

    // Build user message preview (text + file name indicators)
    const fileNames = files.map((f) => `[${f.name}]`).join(" ");
    const displayText = [text, fileNames].filter(Boolean).join("\n");

    const pendingFiles = [...files];
    setInput("");
    setFiles([]);
    setIsSending(true);

    try {
      // Encode files as base64 attachments (same format as macOS ChatViewModel)
      const attachments = await Promise.all(
        pendingFiles.map(async (f) => ({
          type: attachmentType(f.type),
          mimeType: f.type || "application/octet-stream",
          fileName: f.name,
          content: await readFileAsBase64(f),
        })),
      );

      if (!sessionKey) {
        // First message — create session via Gateway (key generated server-side)
        const hasAttachments = attachments.length > 0;
        const messageText =
          text || (pendingFiles.length > 0 ? pendingFiles.map((f) => f.name).join(", ") : "");

        // Create session (with message only if no attachments — attachments
        // are not supported by sessions.create, so we send them via steer)
        const createRes = await fetch("/api/chat/sessions/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId,
            ...(!hasAttachments && messageText ? { message: messageText } : {}),
          }),
        });
        const createData = (await createRes.json()) as {
          key?: string;
          runStarted?: boolean;
          runError?: string;
          error?: string;
        };
        if (!createRes.ok || !createData.key) {
          // Restore input on failure so the user doesn't lose their message
          setInput(text);
          setFiles(pendingFiles);
          return;
        }
        sessionKey = createData.key;
        useChatStore.getState().setActiveSession(sessionKey);
        const store = useChatStore.getState();
        store.setSessionMetas([
          {
            key: sessionKey,
            agentId,
            updatedAt: Date.now(),
            lastMessagePreview: displayText,
          },
          ...store.sessionMetas,
        ]);

        // Add user message to local store
        useChatStore.getState().addMessage(sessionKey, {
          id: `user-${Date.now()}`,
          role: "user",
          content: [{ type: "text" as const, text: displayText }],
          timestamp: Date.now(),
        });

        if (hasAttachments || !createData.runStarted) {
          // Send message+attachments via sessions.steer (create didn't include the message)
          useChatStore.getState().setSessionStreaming(sessionKey, true);
          const sendRes = await fetch("/api/chat/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: messageText,
              sessionKey,
              ...(hasAttachments ? { attachments } : {}),
            }),
          });
          if (!sendRes.ok) {
            const data = (await sendRes.json()) as { error?: string };
            useChatStore.getState().setSessionError(sessionKey, data.error ?? t("error"));
            useChatStore.getState().setSessionStreaming(sessionKey, false);
          }
        } else if (createData.runError) {
          // Handle runError from create
          useChatStore.getState().setSessionError(sessionKey, createData.runError);
        } else {
          // Message was sent via sessions.create, run started — done
          useChatStore.getState().setSessionStreaming(sessionKey, true);
        }
      } else {
        // Existing session — add user message then send via sessions.steer
        useChatStore.getState().addMessage(sessionKey, {
          id: `user-${Date.now()}`,
          role: "user",
          content: [{ type: "text" as const, text: displayText }],
          timestamp: Date.now(),
        });
        useChatStore.getState().setSessionStreaming(sessionKey, true);
        useChatStore.getState().setSessionError(sessionKey, null);

        const res = await fetch("/api/chat/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message:
              text ||
              (pendingFiles.length > 0 ? pendingFiles.map((f) => f.name).join(", ") : ""),
            sessionKey,
            ...(attachments.length > 0 ? { attachments } : {}),
          }),
        });
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          useChatStore.getState().setSessionError(sessionKey, data.error ?? t("error"));
          useChatStore.getState().setSessionStreaming(sessionKey, false);
        }
      }
    } catch {
      if (sessionKey) {
        useChatStore.getState().setSessionError(sessionKey, t("error"));
        useChatStore.getState().setSessionStreaming(sessionKey, false);
      }
    } finally {
      setIsSending(false);
    }
  }, [input, files, isStreaming, isSending, activeSessionKey, activeAgentId, t]);

  const handleAbort = useCallback(async () => {
    await fetch("/api/chat/abort", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionKey: activeSessionKey ?? undefined,
      }),
    });
    if (activeSessionKey) {
      useChatStore.getState().setSessionStreaming(activeSessionKey, false);
    }
  }, [activeSessionKey]);

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

  const handlePaste = (e: React.ClipboardEvent) => {
    const pastedFiles = Array.from(e.clipboardData.files);
    if (pastedFiles.length > 0) {
      addFiles(pastedFiles);
    }
  };

  return (
    <div
      className="border-t p-3"
      style={{ borderColor: "var(--border)" }}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {files.map((f, i) =>
            f.type.startsWith("image/") ? (
              <ImagePreview
                key={`${f.name}-${i}`}
                file={f}
                onRemove={() => setFiles((p) => p.filter((_, j) => j !== i))}
              />
            ) : (
              <span
                key={`${f.name}-${i}`}
                className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md"
                style={{
                  backgroundColor: "var(--muted)",
                  color: "var(--foreground)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <FileIcon size={12} style={{ color: "var(--muted-foreground)" }} />
                <span className="truncate max-w-[120px]">{f.name}</span>
                <span style={{ color: "var(--muted-foreground)" }}>{formatSize(f.size)}</span>
                <button
                  onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}
                  className="hover:opacity-60 shrink-0"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  <X size={10} />
                </button>
              </span>
            ),
          )}
        </div>
      )}
      <div className="flex items-end gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-1.5 rounded hover:opacity-80 transition-opacity shrink-0"
          style={{ color: "var(--muted-foreground)" }}
        >
          <Paperclip size={16} />
        </button>
        <CanvasToggle label={t("canvasToggle")} />
        <ArtifactToggle label={t("artifactToggle")} />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              addFiles(Array.from(e.target.files!));
              e.target.value = ""; // Reset so same file can be re-selected
            }
          }}
        />
        <textarea
          data-chat-input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={t("placeholder")}
          rows={1}
          className="flex-1 resize-none text-sm rounded-lg px-3 py-2 outline-none"
          style={{
            backgroundColor: "var(--card)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
            maxHeight: 120,
          }}
        />
        {isStreaming ? (
          <button
            onClick={() => void handleAbort()}
            className="p-2 rounded-lg shrink-0 hover:opacity-80 transition-opacity"
            style={{
              backgroundColor: "var(--status-disconnected)",
              color: "var(--primary-foreground)",
            }}
            title={t("abort")}
          >
            <Square size={16} />
          </button>
        ) : (
          <button
            onClick={() => void sendMessage()}
            disabled={!input.trim() && files.length === 0}
            className="p-2 rounded-lg shrink-0 hover:opacity-80 transition-opacity disabled:opacity-40"
            style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
            title={t("send")}
          >
            <Send size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
