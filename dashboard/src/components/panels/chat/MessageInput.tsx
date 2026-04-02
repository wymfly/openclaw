"use client";

import { Send, Square, Paperclip, X, FileIcon, PanelRight, SquareCode } from "lucide-react";
import { useTranslations } from "next-intl";
import { useContext, useEffect, useRef, useState, useCallback, useMemo } from "react";
import { commandRegistry } from "@/lib/command-registry";
import type { RegisteredCommand } from "@/lib/command-types";
import { useApprovalsStore } from "@/stores/approvals";
import { useChatStore } from "@/stores/chat";
import {
  useActiveSessionKey,
  useSessionApproval,
  useSessionA2UI,
  useSessionMessages,
  useSessionStreaming,
} from "@/stores/chat-hooks";
import { useNotificationsStore } from "@/stores/notifications";
import { ApprovalDialog } from "./ApprovalDialog";
import {
  abortChatRun,
  createChatSession,
  persistChatProjection,
  resolveInitialSessionSendPlan,
  sendChatMessage,
} from "./chat-api";
import { ArtifactContext } from "./ChatPanel";
import { exportSessionAsMarkdown } from "./export-session";
import { executeSlashCommand } from "./slash-command-executor";
import { parseSlashCommand } from "./slash-commands";
import { SlashCommandPalette, type PaletteCommand } from "./SlashCommandPalette";
import { useInputHistory } from "./useInputHistory";

/** Max attachment size — matches macOS client (5MB). */
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

/** Read a File as base64 string (without data URL prefix). */
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const result = reader.result as string;
      // Strip "data:...;base64," prefix
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    });
    reader.addEventListener("error", () => reject(new Error(`Failed to read ${file.name}`)));
    reader.readAsDataURL(file);
  });
}

/** Determine attachment type from MIME. */
function attachmentType(mime: string): string {
  if (mime.startsWith("image/")) {
    return "image";
  }
  return "file";
}

/** Format file size for display. */
function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)}KB`;
  }
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

/** Session-scoped canvas toggle — persisted with the active session projection. */
function CanvasToggle({ label }: { label: string }) {
  const activeSessionKey = useActiveSessionKey();
  const a2uiState = useSessionA2UI();
  const canvasVisible = Boolean(a2uiState?.visible);

  const handleToggle = useCallback(() => {
    if (!activeSessionKey) {
      return;
    }
    useChatStore.getState().setA2UIState(activeSessionKey, { visible: !canvasVisible });
    void persistChatProjection({
      sessionKey: activeSessionKey,
      a2uiState: useChatStore.getState().sessions.get(activeSessionKey)?.a2uiState ?? null,
    }).catch(() => {});
  }, [activeSessionKey, canvasVisible]);

  return (
    <button
      onClick={handleToggle}
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
  const activeApproval = useSessionApproval();
  const messages = useSessionMessages();
  const { isStreaming } = useSessionStreaming();
  const hasMessages = messages.length > 0;
  const activeAgentId = useChatStore((s) => s.activeAgentId);
  const resolveApproval = useApprovalsStore((s) => s.resolveApproval);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Slash command state ──
  const [showPalette, setShowPalette] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [paletteIndex, setPaletteIndex] = useState(0);
  const navigableCommandsRef = useRef<PaletteCommand[]>([]);

  // ── Input history ──
  const history = useInputHistory();

  const ghostHint = useMemo(() => {
    const match = /^\/([a-z0-9_-]+)\s+$/iu.exec(input);
    if (!match) {
      return "";
    }
    const cmd = commandRegistry.get(match[1].toLowerCase());
    if (!cmd?.args) {
      return "";
    }
    return cmd.args;
  }, [input]);

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

  // ── Slash command input detection ──
  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value);
      // Show palette when input starts with `/` and no spaces yet (still typing command name)
      if (value.startsWith("/") && !value.includes(" ")) {
        setShowPalette(true);
        setSlashFilter(value.slice(1));
        setPaletteIndex(0);
      } else {
        setShowPalette(false);
      }
      history.reset();
    },
    [history],
  );

  const handleAbort = useCallback(async (): Promise<boolean> => {
    try {
      if (!activeSessionKey) {
        useNotificationsStore.getState().addToast("error", t("toastStopFailed"), 3000);
        return false;
      }
      await abortChatRun({ sessionKey: activeSessionKey });
      if (activeSessionKey) {
        useChatStore.getState().setSessionStreaming(activeSessionKey, false);
      }
      useNotificationsStore.getState().addToast("success", t("toastStopped"), 3000);
      return true;
    } catch (err) {
      console.error("[abort] network error:", err);
      useNotificationsStore.getState().addToast("error", t("toastStopFailed"), 3000);
      return false;
    }
  }, [activeSessionKey]);

  const handleResolveApproval = useCallback(
    async (id: string, decision: "allow-once" | "allow-always" | "deny") => {
      const ok = await resolveApproval(id, decision);
      if (!ok) {
        useNotificationsStore.getState().addToast("error", t("toastCommandFailed"), 3000);
        return;
      }
      if (activeSessionKey) {
        useChatStore.getState().setActiveApproval(activeSessionKey, null);
      }
    },
    [activeSessionKey, resolveApproval, t],
  );

  // ── Slash command execution ──
  const handleSlashCommand = useCallback(
    async (cmd: RegisteredCommand, cmdArgs = "") => {
      setShowPalette(false);
      setInput("");

      if (cmd.name === "stop") {
        void handleAbort();
        return;
      }

      // Remote commands (builtin/skill/plugin): send as normal chat message so the
      // response appears through the standard chat flow (user message → streaming →
      // assistant message), instead of fire-and-forget with toast-only feedback.
      if (cmd.execMode === "remote") {
        const message = cmdArgs ? `/${cmd.name} ${cmdArgs}` : `/${cmd.name}`;
        let sessionKey = activeSessionKey;
        try {
          // Create session if none exists (same as sendMessage flow)
          if (!sessionKey) {
            const agentId = activeAgentId || "main";
            const createData = await createChatSession({ agentId });
            sessionKey = createData.key;
            useChatStore.getState().setActiveSession(sessionKey);
            const store = useChatStore.getState();
            store.setSessionMetas([
              { key: sessionKey, agentId, updatedAt: Date.now(), lastMessagePreview: message },
              ...store.sessionMetas,
            ]);
          }
          useChatStore.getState().addMessage(sessionKey, {
            id: `user-${Date.now()}`,
            role: "user",
            content: [{ type: "text" as const, text: message }],
            timestamp: Date.now(),
          });
          useChatStore.getState().setSessionStreaming(sessionKey, true);
          useChatStore.getState().setSessionError(sessionKey, null);
          await sendChatMessage({ message, sessionKey });
        } catch {
          if (sessionKey) {
            useChatStore.getState().setSessionError(sessionKey, t("error"));
            useChatStore.getState().setSessionStreaming(sessionKey, false);
          }
        }
        return;
      }

      const addSystemMsg = (text: string) => {
        if (activeSessionKey) {
          useChatStore.getState().addMessage(activeSessionKey, {
            id: `system-cmd-${Date.now()}`,
            role: "system",
            content: [{ type: "text" as const, text }],
            timestamp: Date.now(),
          });
        }
      };

      const toast = useNotificationsStore.getState().addToast;

      try {
        const result = await executeSlashCommand(activeSessionKey ?? "", cmd.name, cmdArgs);

        // ── Toast feedback (D4: executor returns i18n key, caller resolves via t()) ──
        if (result.toastKey) {
          const msg = result.toastValue
            ? t(result.toastKey, { value: result.toastValue })
            : t(result.toastKey);
          toast(result.toastType ?? "info", msg, 3000);
        }

        // ── Optimistic config update (D1: write store immediately) ──
        if (result.configUpdate && activeSessionKey) {
          useChatStore.setState((s) => {
            const idx = s.sessionMetas.findIndex((m) => m.key === activeSessionKey);
            if (idx < 0) {
              return {};
            }
            const metas = [...s.sessionMetas];
            metas[idx] = { ...metas[idx], ...result.configUpdate };
            return { sessionMetas: metas, sessionMeta: metas };
          });
        }

        // ── Handle side-effect actions ──
        const action = result.action;
        if (action === "new-session") {
          const agentId = activeAgentId || "main";
          const data = await createChatSession({ agentId });
          useChatStore.getState().setActiveSession(data.key);
          toast("success", t("toastNewSession"), 3000);
        } else if (action === "reset") {
          if (activeSessionKey) {
            const store = useChatStore.getState();
            store.resetSessionProjection(activeSessionKey);
          }
        } else if (action === "stop") {
          void handleAbort();
        } else if (action === "clear") {
          if (activeSessionKey) {
            useChatStore.getState().resetSessionProjection(activeSessionKey);
          }
        } else if (action === "export") {
          if (activeSessionKey) {
            try {
              exportSessionAsMarkdown(activeSessionKey);
              toast("success", t("toastExported"), 3000);
            } catch {
              toast("error", t("toastExportFailed"), 3000);
            }
          }
        }
        // "refresh": no-op — SSE events will push updated state (D1 optimistic update above handles immediate feedback)

        // Display command output as system message (query commands: /help, /usage, /agents, /model no-args)
        if (result.content) {
          addSystemMsg(result.content);
        }
      } catch (err) {
        console.error(`[/${cmd.name}]`, err);
        useNotificationsStore
          .getState()
          .addToast(
            "error",
            `/${cmd.name}: ${err instanceof Error ? err.message : t("toastCommandFailed")}`,
            3000,
          );
      }
    },
    [activeSessionKey, activeAgentId, handleAbort, t],
  );

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if ((!text && files.length === 0) || isStreaming || isSending) {
      return;
    }

    // Check for slash command — only treat /alphabetic as a command attempt.
    // This lets messages like "/2 + 3" pass through as normal messages.
    const parsed = parseSlashCommand(text);
    if (parsed) {
      const command = commandRegistry.get(parsed.name);
      if (command) {
        if (command.execMode === "remote") {
          // Remote commands (builtin/skill/plugin) fall through to normal send.
          // Gateway's auto-reply pipeline processes the /command and the response
          // appears as an assistant message through the standard chat flow.
        } else {
          await handleSlashCommand(command, parsed.args);
          return;
        }
      } else if (/^[a-z]/i.test(parsed.name)) {
        // Only block if the name looks like a command (alphabetic), not /2, /= etc.
        useNotificationsStore
          .getState()
          .addToast("error", t("toastUnknownCommand", { value: parsed.name }), 3000);
        return;
      }
      // Non-alphabetic /prefix or remote command — fall through and send as regular message
    }

    // Push to input history
    history.push(text);

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
        const createData = await createChatSession({
          agentId,
          ...(!hasAttachments && messageText ? { message: messageText } : {}),
        });
        if (!createData.key) {
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

        const sendPlan = resolveInitialSessionSendPlan({
          hasAttachments,
          runStarted: createData.runStarted,
          runError: createData.runError,
        });

        if (sendPlan.kind === "send") {
          // Send message+attachments via sessions.steer (create didn't include the message)
          useChatStore.getState().setSessionStreaming(sessionKey, true);
          try {
            await sendChatMessage({
              message: messageText,
              sessionKey,
              ...(hasAttachments ? { attachments } : {}),
            });
          } catch {
            useChatStore.getState().setSessionError(sessionKey, t("error"));
            useChatStore.getState().setSessionStreaming(sessionKey, false);
          }
        } else if (sendPlan.kind === "error") {
          useChatStore.getState().setSessionError(sessionKey, sendPlan.error);
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

        try {
          await sendChatMessage({
            message:
              text || (pendingFiles.length > 0 ? pendingFiles.map((f) => f.name).join(", ") : ""),
            sessionKey,
            ...(attachments.length > 0 ? { attachments } : {}),
          });
        } catch {
          useChatStore.getState().setSessionError(sessionKey, t("error"));
          useChatStore.getState().setSessionStreaming(sessionKey, false);
        }
      }
    } catch {
      if (sessionKey) {
        useChatStore.getState().setSessionError(sessionKey, t("error"));
        useChatStore.getState().setSessionStreaming(sessionKey, false);
      } else {
        setInput(text);
        setFiles(pendingFiles);
      }
    } finally {
      setIsSending(false);
    }
  }, [
    input,
    files,
    isStreaming,
    isSending,
    activeSessionKey,
    activeAgentId,
    t,
    handleSlashCommand,
    history,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Priority 1: Slash command palette (when open, it owns ArrowUp/Down/Enter/Escape)
    if (showPalette) {
      const commands = navigableCommandsRef.current;
      if (commands.length > 0 && e.key === "ArrowDown") {
        e.preventDefault();
        setPaletteIndex((prev) => (prev + 1) % commands.length);
        return;
      }
      if (commands.length > 0 && e.key === "ArrowUp") {
        e.preventDefault();
        setPaletteIndex((prev) => (prev - 1 + commands.length) % commands.length);
        return;
      }
      if (e.key === "Enter" && commands.length > 0) {
        e.preventDefault();
        const selected = commands[paletteIndex] ?? commands[0];
        if (selected) {
          void handleSlashCommand(selected.command);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowPalette(false);
        return;
      }
    }

    // Priority 2: Input history (ArrowUp/Down when input is empty)
    if (e.key === "ArrowUp" && !input.trim()) {
      const prev = history.up(input);
      if (prev !== null) {
        e.preventDefault();
        setInput(prev);
        return;
      }
    }
    if (e.key === "ArrowDown") {
      const next = history.down();
      if (next !== null) {
        e.preventDefault();
        setInput(next);
        return;
      }
    }

    // Priority 3: Send on Enter
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
      {activeApproval && (
        <ApprovalDialog approval={activeApproval} onResolve={handleResolveApproval} />
      )}
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
              addFiles(Array.from(e.target.files));
              e.target.value = ""; // Reset so same file can be re-selected
            }
          }}
        />
        <div className="relative flex-1">
          {showPalette && (
            <SlashCommandPalette
              filter={slashFilter}
              selectedIndex={paletteIndex}
              onSelectedIndexChange={setPaletteIndex}
              onSelect={(cmd) => void handleSlashCommand(cmd)}
              onDismiss={() => setShowPalette(false)}
              navigableCommandsRef={navigableCommandsRef}
              visibilityContext={{ isStreaming, hasMessages }}
            />
          )}
          {ghostHint && (
            <div className="pointer-events-none absolute inset-0 z-20 px-3 py-2 text-sm whitespace-pre-wrap">
              <span className="invisible">{input}</span>
              <span style={{ color: "var(--muted-foreground)" }}>{ghostHint}</span>
            </div>
          )}
          <textarea
            data-chat-input
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={t("placeholder")}
            rows={1}
            className="relative z-10 w-full resize-none text-sm rounded-lg px-3 py-2 outline-none"
            style={{
              backgroundColor: "var(--card)",
              color: "var(--foreground)",
              border: "1px solid var(--border)",
              maxHeight: 120,
            }}
          />
        </div>
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
