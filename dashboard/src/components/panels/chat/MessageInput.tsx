"use client";

import { AlertTriangle, Send, Square, Paperclip } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useCallback } from "react";
import { useMention } from "@/hooks/useMention";
import { resolveSelectMode, useSlashCommand } from "@/hooks/useSlashCommand";
import type { RegisteredCommand } from "@/lib/command-types";
import { useApprovalsStore } from "@/stores/approvals";
import { useChatStore } from "@/stores/chat";
import {
  useActiveSessionKey,
  useSessionApproval,
  useSessionMessages,
  useSessionStreaming,
} from "@/stores/chat-hooks";
import { useNotificationsStore } from "@/stores/notifications";
import { useSessionsStore } from "@/stores/sessions";
import { ApprovalDialog } from "./ApprovalDialog";
import {
  abortChatRun,
  createChatSession,
  resolveInitialSessionSendPlan,
  sendChatMessage,
} from "./chat-api";
import { exportSessionAsMarkdown } from "./export-session";
import { MentionPopover } from "./MentionPopover";
import {
  MAX_ATTACHMENT_BYTES,
  readFileAsBase64,
  attachmentType,
  formatSize,
  FileAttachmentBar,
  CanvasToggle,
  ArtifactToggle,
} from "./message-input-helpers";
import { PromptTemplateMenu } from "./PromptTemplateMenu";
import { executeSlashCommand } from "./slash-command-executor";
import { parseSlashCommand } from "./slash-commands";
import { SlashCommandPalette } from "./SlashCommandPalette";
import { useInputHistory } from "./useInputHistory";

interface MessageInputProps {
  suggestedText?: string;
  onSuggestedTextConsumed?: () => void;
}

export function MessageInput({ suggestedText, onSuggestedTextConsumed }: MessageInputProps = {}) {
  const t = useTranslations("chat");
  const activeSessionKey = useActiveSessionKey();
  const activeApproval = useSessionApproval();
  const messages = useSessionMessages();
  const { isStreaming } = useSessionStreaming();
  const hasMessages = messages.length > 0;
  const activeAgentId = useChatStore((s) => s.activeAgentId);
  const pendingApprovals = useApprovalsStore((s) => s.pending);
  const pendingCount = pendingApprovals.length;
  const removePending = useApprovalsStore((s) => s.removePending);
  const resolveApproval = useApprovalsStore((s) => s.resolveApproval);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const slash = useSlashCommand(input);
  const mention = useMention();
  const history = useInputHistory();

  // Context pressure detection — warn before user sends into a near-full window.
  // Use chat store sessionMetas (always populated) merged with sessions store (SSE-driven).
  const chatMeta = useChatStore((s) =>
    activeSessionKey ? s.sessionMetas.find((m) => m.key === activeSessionKey) : undefined,
  );
  const sessionEntry = useSessionsStore((s) =>
    activeSessionKey ? s.sessions.find((e) => e.key === activeSessionKey) : undefined,
  );
  const ctxWindow = sessionEntry?.contextWindow ?? chatMeta?.contextTokens ?? 0;
  const ctxUsed = sessionEntry?.totalTokens ?? chatMeta?.totalTokens ?? 0;
  const pct = ctxWindow > 0 ? Math.min(100, Math.round((ctxUsed / ctxWindow) * 100)) : 0;
  const contextCritical = pct >= 95;

  useEffect(() => {
    if (suggestedText) {
      setInput(suggestedText);
      onSuggestedTextConsumed?.();
    }
  }, [suggestedText, onSuggestedTextConsumed]);

  useEffect(() => {
    if (!activeApproval?.expiresAtMs) {
      return;
    }
    const approvalId = activeApproval.id;
    const remaining = activeApproval.expiresAtMs - Date.now();
    if (remaining <= 0) {
      if (activeSessionKey) {
        useChatStore.getState().setActiveApproval(activeSessionKey, null);
      }
      removePending(approvalId);
      return;
    }
    const timer = setTimeout(() => {
      const current = activeSessionKey
        ? useChatStore.getState().sessions.get(activeSessionKey)?.activeApproval
        : null;
      if (current?.id === approvalId && activeSessionKey) {
        useChatStore.getState().setActiveApproval(activeSessionKey, null);
      }
      removePending(approvalId);
    }, remaining);
    return () => clearTimeout(timer);
  }, [activeApproval?.id, activeApproval?.expiresAtMs, activeSessionKey, removePending]);

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

  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value);
      slash.handleSlashInput(value);
      // Detect @mention (cursor position approximated as end of value)
      mention.handleMentionInput(value, value.length);
      history.reset();
    },
    [slash, mention, history],
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
  }, [activeSessionKey, t]);

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

  const handleSlashCommand = useCallback(
    async (cmd: RegisteredCommand, cmdArgs = "") => {
      slash.closePalette();
      setInput("");
      if (cmd.name === "stop") {
        void handleAbort();
        return;
      }

      if (cmd.execMode === "remote") {
        const message = cmdArgs ? `/${cmd.name} ${cmdArgs}` : `/${cmd.name}`;
        let sessionKey = activeSessionKey;
        try {
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
          useChatStore.getState().mergeSessionPreviewOverlay(sessionKey, {
            text: message,
            updatedAt: Date.now(),
            source: "optimistic",
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

        if (result.toastKey) {
          const msg = result.toastValue
            ? t(result.toastKey, { value: result.toastValue })
            : t(result.toastKey);
          toast(result.toastType ?? "info", msg, 3000);
        }

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

        const action = result.action;
        if (action === "new-session") {
          const agentId = activeAgentId || "main";
          const data = await createChatSession({ agentId });
          useChatStore.getState().setActiveSession(data.key);
          toast("success", t("toastNewSession"), 3000);
        } else if (action === "reset" || action === "clear") {
          if (activeSessionKey) {
            useChatStore.getState().resetSessionProjection(activeSessionKey);
          }
        } else if (action === "stop") {
          void handleAbort();
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
    [activeSessionKey, activeAgentId, handleAbort, t, slash],
  );

  /** Route command selection based on its type: immediate / argOptions / tag. */
  const handleCommandSelect = useCallback(
    (cmd: RegisteredCommand) => {
      const mode = resolveSelectMode(cmd);
      if (mode === "argOptions") {
        slash.enterArgOptionsMode(cmd);
        return;
      }
      if (mode === "tag") {
        slash.enterTagMode(cmd);
        setInput("");
        return;
      }
      // immediate
      void handleSlashCommand(cmd);
    },
    [slash, handleSlashCommand],
  );

  /** Execute a command with a specific arg (from argOptions panel). */
  const handleArgOptionSelect = useCallback(
    (cmd: RegisteredCommand, arg: string) => {
      slash.closePalette();
      setInput("");
      void handleSlashCommand(cmd, arg);
    },
    [slash, handleSlashCommand],
  );

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    // When tag is active, combine tag command with text and send
    if (slash.activeTag) {
      if (!text) {
        return;
      }
      const cmd = slash.activeTag;
      slash.clearTag();
      setInput("");
      await handleSlashCommand(cmd, text);
      return;
    }

    if ((!text && files.length === 0) || isStreaming || isSending) {
      return;
    }

    const parsed = parseSlashCommand(text);
    if (parsed) {
      const { commandRegistry } = await import("@/lib/command-registry");
      const command = commandRegistry.get(parsed.name);
      if (command) {
        if (command.execMode !== "remote") {
          await handleSlashCommand(command, parsed.args);
          return;
        }
      } else if (/^[a-z]/i.test(parsed.name)) {
        useNotificationsStore
          .getState()
          .addToast("error", t("toastUnknownCommand", { value: parsed.name }), 3000);
        return;
      }
    }

    history.push(text);
    const agentId = activeAgentId || "main";
    let sessionKey = activeSessionKey;
    const fileNames = files.map((f) => `[${f.name}]`).join(" ");
    const displayText = [text, fileNames].filter(Boolean).join("\n");
    const pendingFiles = [...files];
    setInput("");
    setFiles([]);
    setIsSending(true);

    try {
      const attachments = await Promise.all(
        pendingFiles.map(async (f) => ({
          type: attachmentType(f.type),
          mimeType: f.type || "application/octet-stream",
          fileName: f.name,
          content: await readFileAsBase64(f),
        })),
      );

      if (!sessionKey) {
        const hasAttachments = attachments.length > 0;
        const messageText =
          text || (pendingFiles.length > 0 ? pendingFiles.map((f) => f.name).join(", ") : "");
        const createData = await createChatSession({
          agentId,
          ...(!hasAttachments && messageText ? { message: messageText } : {}),
        });
        if (!createData.key) {
          setInput(text);
          setFiles(pendingFiles);
          return;
        }
        sessionKey = createData.key;
        useChatStore.getState().setActiveSession(sessionKey);
        useChatStore
          .getState()
          .setSessionMetas([
            { key: sessionKey, agentId, updatedAt: Date.now(), lastMessagePreview: displayText },
            ...useChatStore.getState().sessionMetas,
          ]);
        useChatStore.getState().mergeSessionPreviewOverlay(sessionKey, {
          text: displayText,
          updatedAt: Date.now(),
          source: "optimistic",
        });
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
          useChatStore.getState().setSessionStreaming(sessionKey, true);
        }
      } else {
        useChatStore.getState().mergeSessionPreviewOverlay(sessionKey, {
          text: displayText,
          updatedAt: Date.now(),
          source: "optimistic",
        });
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
    slash,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      slash.handlePaletteKeyDown(
        e,
        (cmd) => handleCommandSelect(cmd),
        (cmd, arg) => handleArgOptionSelect(cmd, arg),
      )
    ) {
      return;
    }
    // Backspace on empty input clears active tag
    if (e.key === "Backspace" && slash.activeTag && !input) {
      e.preventDefault();
      slash.clearTag();
      return;
    }
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const handleMentionSelect = useCallback(
    (agentName: string) => {
      const newValue = mention.selectMention(agentName, input);
      setInput(newValue);
      mention.closeMention();
    },
    [mention, input],
  );

  return (
    <div
      className="border-t p-3"
      style={{ borderColor: "var(--border)" }}
      onDrop={(e) => {
        e.preventDefault();
        addFiles(Array.from(e.dataTransfer.files));
      }}
      onDragOver={(e) => e.preventDefault()}
    >
      {activeApproval && pendingApprovals.some((p) => p.id === activeApproval.id) && (
        <ApprovalDialog
          approval={activeApproval}
          pendingCount={pendingCount}
          onResolve={handleResolveApproval}
        />
      )}
      {contextCritical && (
        <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-md text-xs bg-[var(--warning-muted)] text-[var(--warning-muted-text)]">
          <AlertTriangle size={12} className="shrink-0" />
          <span>{t("contextOverflowWarning")}</span>
        </div>
      )}
      <FileAttachmentBar
        files={files}
        onRemove={(i) => setFiles((p) => p.filter((_, j) => j !== i))}
      />
      <div className="flex items-end gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach files"
          className="p-1.5 rounded hover:opacity-80 transition-opacity shrink-0"
          style={{ color: "var(--muted-foreground)" }}
        >
          <Paperclip size={16} />
        </button>
        <CanvasToggle label={t("canvasToggle")} />
        <ArtifactToggle label={t("artifactToggle")} />
        <PromptTemplateMenu onSelect={(tmpl) => setInput((prev) => prev + tmpl)} />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              addFiles(Array.from(e.target.files));
              e.target.value = "";
            }
          }}
        />
        <div className="relative flex-1">
          {slash.showPalette && (
            <SlashCommandPalette
              filter={slash.slashFilter}
              selectedIndex={slash.argOptionsState?.selectedIndex ?? slash.paletteIndex}
              onSelectedIndexChange={slash.setPaletteIndex}
              onSelect={(cmd) => handleCommandSelect(cmd)}
              onSelectWithArg={(cmd, arg) => handleArgOptionSelect(cmd, arg)}
              onDismiss={slash.closePalette}
              navigableCommandsRef={slash.navigableCommandsRef}
              visibilityContext={{ isStreaming, hasMessages }}
              argOptionsState={slash.argOptionsState}
              onArgOptionsBack={slash.exitArgOptionsMode}
              onArgOptionsIndexChange={slash.setArgOptionsIndex}
            />
          )}
          {mention.showMention && (
            <MentionPopover
              filter={mention.mentionFilter}
              onSelect={handleMentionSelect}
              onDismiss={mention.closeMention}
            />
          )}
          {slash.ghostHint && (
            <div className="pointer-events-none absolute inset-0 z-20 px-3 py-2 text-sm whitespace-pre-wrap">
              <span className="invisible">{input}</span>
              <span style={{ color: "var(--muted-foreground)" }}>{slash.ghostHint}</span>
            </div>
          )}
          <div
            className="relative z-10 flex items-start gap-0 w-full rounded-lg"
            style={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
            }}
          >
            {slash.activeTag && (
              <span
                className="inline-flex items-center gap-1 shrink-0 ml-2 mt-2 px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80"
                style={{
                  backgroundColor:
                    "var(--primary-muted, color-mix(in srgb, var(--primary) 15%, transparent))",
                  color: "var(--primary)",
                }}
                onClick={() => slash.clearTag()}
                title={t("cmdTagRemove")}
              >
                /{slash.activeTag.name}
                <span className="text-[10px] opacity-60">×</span>
              </span>
            )}
            <textarea
              ref={textareaRef}
              data-chat-input
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={(e) => {
                const pf = Array.from(e.clipboardData.files);
                if (pf.length > 0) {
                  addFiles(pf);
                }
              }}
              placeholder={slash.activeTag ? t("cmdTagPlaceholder") : t("placeholder")}
              rows={3}
              className="flex-1 resize-none text-sm px-3 py-2 outline-none bg-transparent"
              style={{
                color: "var(--foreground)",
                maxHeight: 200,
              }}
            />
          </div>
        </div>
        {isStreaming ? (
          <button
            onClick={() => void handleAbort()}
            aria-label={t("abort")}
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
            aria-label={t("send")}
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
