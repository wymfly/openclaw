import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpIcon, PlusIcon, SquareIcon } from "@/deck-ui/icons";
import { useMention } from "@/hooks/useMention";
import { resolveSelectMode, useSlashCommand } from "@/hooks/useSlashCommand";
import { commandRegistry } from "@/lib/command-registry";
import type { RegisteredCommand } from "@/lib/command-types";
import { contextPct } from "@/lib/context-utils";
import { useApprovalsStore } from "@/stores/approvals";
import { useChatStore } from "@/stores/chat";
import { useActiveSessionKey, useSessionApproval, useSessionStreaming } from "@/stores/chat-hooks";
import { useNotificationsStore, type ToastType } from "@/stores/notifications";
import { useSessionsStore } from "@/stores/sessions";
import { ApprovalDialog } from "./ApprovalDialog";
import {
  abortChatRun,
  createChatSession,
  resolveInitialSessionSendPlan,
  sendChatMessage,
} from "./chat-api";
import { MentionPopover } from "./MentionPopover";
import {
  ArtifactToggle,
  CanvasToggle,
  FileAttachmentBar,
  MAX_ATTACHMENT_BYTES,
  attachmentType,
  formatSize,
  readFileAsBase64,
} from "./message-input-helpers";
import { PromptTemplateMenu } from "./PromptTemplateMenu";
import { executeSlashCommand, initializeLocalCommands } from "./slash-command-executor";
import { parseSlashCommand } from "./slash-commands";
import { SlashCommandPalette } from "./SlashCommandPalette";
import { useInputHistory } from "./useInputHistory";

export type MessageInputProps = {
  value?: string;
  onChange?: (value: string) => void;
  suggestedText?: string;
  onSuggestedTextConsumed?: () => void;
  onSendMessage?: () => void | Promise<void>;
  onAbortRun?: () => void | Promise<void>;
  sendDisabled?: boolean;
  abortDisabled?: boolean;
};

export function MessageInput(props: MessageInputProps = {}) {
  const {
    value,
    onChange,
    suggestedText,
    onSuggestedTextConsumed,
    onSendMessage,
    onAbortRun,
    sendDisabled: sendDisabledProp,
    abortDisabled: abortDisabledProp,
  } = props;
  const t = useTranslations("chat");
  const hasTranslation = (key: string) => typeof t.has === "function" && t.has(key);
  const attachFilesLabel = hasTranslation("attachFiles") ? t("attachFiles") : "Attach";
  const fileAttachmentsLabel = hasTranslation("fileAttachments")
    ? t("fileAttachments")
    : "File attachments";
  const activeSessionKey = useActiveSessionKey();
  const activeApproval = useSessionApproval();
  const { isStreaming } = useSessionStreaming();
  const activeAgentId = useChatStore((state) => state.activeAgentId);
  const activeSessionMeta = useChatStore((state) =>
    activeSessionKey ? state.sessionMetas.find((item) => item.key === activeSessionKey) : undefined,
  );
  const activeSessionEntry = useSessionsStore((state) =>
    activeSessionKey ? state.sessions.find((item) => item.key === activeSessionKey) : undefined,
  );
  const hasMessages = useChatStore((state) => {
    if (!activeSessionKey) {
      return false;
    }
    return (state.sessions.get(activeSessionKey)?.messages?.length ?? 0) > 0;
  });
  const pendingApprovals = useApprovalsStore((state) => state.pending);
  const pendingCount = pendingApprovals.length;
  const removePending = useApprovalsStore((state) => state.removePending);
  const resolveApproval = useApprovalsStore((state) => state.resolveApproval);
  const [draftInput, setDraftInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const input = value ?? draftInput;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const slash = useSlashCommand(input);
  const mention = useMention();
  const history = useInputHistory();
  const contextWindow = activeSessionEntry?.contextTokens ?? activeSessionMeta?.contextTokens ?? 0;
  const contextUsed =
    activeSessionEntry?.totalTokens ??
    activeSessionMeta?.totalTokens ??
    (activeSessionEntry ? activeSessionEntry.tokensIn + activeSessionEntry.tokensOut : 0);
  const contextCritical =
    contextWindow > 0 &&
    contextPct({
      contextWindow,
      tokensIn: activeSessionEntry?.tokensIn ?? 0,
      tokensOut: activeSessionEntry?.tokensOut ?? 0,
      totalTokens: contextUsed,
    }) >= 95;

  const showToast = useCallback(
    (type: ToastType, key: string, value?: string) => {
      const message = value ? t(key, { value }) : t(key);
      useNotificationsStore.getState().addToast(type, message, 3000);
    },
    [t],
  );
  const showCommandError = useCallback(
    (commandName: string, error: unknown) => {
      const reason =
        error instanceof Error && error.message ? error.message : t("toastCommandFailed");
      useNotificationsStore.getState().addToast("error", `/${commandName}: ${reason}`, 3000);
    },
    [t],
  );

  useEffect(() => {
    initializeLocalCommands();
  }, []);

  const setInputValue = useCallback(
    (nextValue: string) => {
      if (value === undefined) {
        setDraftInput(nextValue);
      }
      onChange?.(nextValue);
    },
    [onChange, value],
  );

  useEffect(() => {
    if (!suggestedText) {
      return;
    }
    setInputValue(suggestedText);
    onSuggestedTextConsumed?.();
  }, [onSuggestedTextConsumed, setInputValue, suggestedText]);

  const handleInputChange = useCallback(
    (value: string) => {
      setInputValue(value);
      slash.handleSlashInput(value);
      mention.handleMentionInput(value, value.length);
      history.reset();
    },
    [history, mention, setInputValue, slash],
  );

  useEffect(() => {
    if (!activeApproval?.expiresAtMs) {
      return undefined;
    }
    const approvalId = activeApproval.id;
    const remaining = activeApproval.expiresAtMs - Date.now();
    if (remaining <= 0) {
      if (activeSessionKey) {
        useChatStore.getState().setActiveApproval(activeSessionKey, null);
      }
      removePending(approvalId);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      const currentApproval = activeSessionKey
        ? useChatStore.getState().sessions.get(activeSessionKey)?.activeApproval
        : null;
      if (activeSessionKey && currentApproval?.id === approvalId) {
        useChatStore.getState().setActiveApproval(activeSessionKey, null);
      }
      removePending(approvalId);
    }, remaining);
    return () => {
      window.clearTimeout(timer);
    };
  }, [activeApproval?.id, activeApproval?.expiresAtMs, activeSessionKey, removePending]);

  const handleResolveApproval = useCallback(
    async (id: string, decision: "allow-once" | "allow-always" | "deny") => {
      const ok = await resolveApproval(id, decision);
      if (!ok) {
        showToast("error", "toastCommandFailed");
        return;
      }
      if (activeSessionKey) {
        useChatStore.getState().setActiveApproval(activeSessionKey, null);
      }
    },
    [activeSessionKey, resolveApproval, showToast],
  );

  const addFiles = useCallback(
    (newFiles: File[]) => {
      const valid: File[] = [];
      for (const file of newFiles) {
        if (file.size > MAX_ATTACHMENT_BYTES) {
          if (activeSessionKey) {
            useChatStore
              .getState()
              .setSessionError(
                activeSessionKey,
                `${file.name} exceeds ${formatSize(MAX_ATTACHMENT_BYTES)} limit`,
              );
          }
          continue;
        }
        valid.push(file);
      }
      if (valid.length > 0) {
        setFiles((current) => [...current, ...valid]);
      }
    },
    [activeSessionKey],
  );

  const abortRun = useCallback(async () => {
    if (onAbortRun) {
      await onAbortRun();
      return;
    }
    if (!activeSessionKey) {
      showToast("error", "toastStopFailed");
      return;
    }
    try {
      await abortChatRun({ sessionKey: activeSessionKey });
      useChatStore.getState().setSessionStreaming(activeSessionKey, false);
      showToast("success", "toastStopped");
    } catch {
      showToast("error", "toastStopFailed");
    }
  }, [activeSessionKey, onAbortRun, showToast]);

  const handleSlashCommand = useCallback(
    async (cmd: RegisteredCommand, cmdArgs = "") => {
      slash.closePalette();
      setInputValue("");

      if (cmd.execMode === "remote") {
        const message = cmdArgs ? `/${cmd.name} ${cmdArgs}` : `/${cmd.name}`;
        let sessionKey: string | null = activeSessionKey;
        try {
          if (!sessionKey) {
            const agentId = activeAgentId || "main";
            const createData = await createChatSession({ agentId });
            sessionKey = createData.key ?? null;
            if (!sessionKey) {
              return;
            }
            useChatStore.getState().setActiveSession(sessionKey);
            const store = useChatStore.getState();
            store.setSessionMetas([
              { key: sessionKey, agentId, updatedAt: Date.now(), lastMessagePreview: message },
              ...store.sessionMetas,
            ]);
          }

          if (!sessionKey) {
            return;
          }

          useChatStore.getState().addMessage(sessionKey, {
            id: `user-${Date.now()}`,
            role: "user",
            content: [{ type: "text", text: message }],
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
          if (typeof sessionKey === "string") {
            useChatStore.getState().setSessionError(sessionKey, t("error"));
            useChatStore.getState().setSessionStreaming(sessionKey, false);
          }
        }
        return;
      }

      try {
        const result = await executeSlashCommand(activeSessionKey ?? "", cmd.name, cmdArgs);
        if (result.toastKey) {
          showToast(result.toastType ?? "info", result.toastKey, result.toastValue);
        }
        if ((result.action === "reset" || result.action === "clear") && activeSessionKey) {
          useChatStore.getState().resetSessionProjection(activeSessionKey);
        }
        if (result.action === "stop") {
          await abortRun();
        }
        if (result.action === "new-session") {
          const agentId = activeAgentId || "main";
          const createData = await createChatSession({ agentId });
          if (createData.key) {
            useChatStore.getState().setActiveSession(createData.key);
            showToast("success", "toastNewSession");
          }
        }
        if (result.configUpdate && activeSessionKey) {
          const store = useChatStore.getState();
          store.setSessionMetas(
            store.sessionMetas.map((meta) =>
              meta.key === activeSessionKey ? { ...meta, ...result.configUpdate } : meta,
            ),
          );
        }
        if (result.content && activeSessionKey) {
          useChatStore.getState().addMessage(activeSessionKey, {
            id: `system-cmd-${Date.now()}`,
            role: "system",
            content: [{ type: "text", text: result.content }],
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        showCommandError(cmd.name, error);
      }
    },
    [abortRun, activeAgentId, activeSessionKey, setInputValue, showCommandError, showToast, slash],
  );

  const handleCommandSelect = useCallback(
    (cmd: RegisteredCommand) => {
      const mode = resolveSelectMode(cmd);
      if (mode === "argOptions") {
        slash.enterArgOptionsMode(cmd);
        return;
      }
      if (mode === "tag") {
        slash.enterTagMode(cmd);
        setInputValue("");
        return;
      }
      if (mode === "immediate") {
        void handleSlashCommand(cmd);
      }
    },
    [handleSlashCommand, setInputValue, slash],
  );

  const handleArgOptionSelect = useCallback(
    (cmd: RegisteredCommand, arg: string) => {
      slash.closePalette();
      setInputValue("");
      void handleSlashCommand(cmd, arg);
    },
    [handleSlashCommand, setInputValue, slash],
  );

  const handleMentionSelect = useCallback(
    (agentName: string) => {
      setInputValue(mention.selectMention(agentName, input));
      mention.closeMention();
    },
    [input, mention, setInputValue],
  );

  const sendPlainMessage = useCallback(async () => {
    const message = input.trim();
    if (slash.activeTag) {
      if (!message) {
        return;
      }
      const command = slash.activeTag;
      slash.clearTag();
      setInputValue("");
      await handleSlashCommand(command, message);
      return;
    }

    const parsed = parseSlashCommand(message);
    if (parsed) {
      const command = commandRegistry.get(parsed.name);
      if (command && command.execMode !== "remote") {
        await handleSlashCommand(command, parsed.args);
        return;
      }
      if (!command && /^[a-z]/i.test(parsed.name)) {
        showToast("error", "toastUnknownCommand", parsed.name);
        return;
      }
    }

    const pendingFiles = [...files];
    if (!message && pendingFiles.length === 0) {
      return;
    }

    history.push(message);

    if (pendingFiles.length === 0 && onSendMessage) {
      await onSendMessage();
      return;
    }

    let sessionKey: string | null = activeSessionKey;
    const displayText = [message, pendingFiles.map((file) => `[${file.name}]`).join(" ")]
      .filter(Boolean)
      .join("\n");
    const messageText =
      message || (pendingFiles.length > 0 ? pendingFiles.map((file) => file.name).join(", ") : "");
    try {
      setIsSending(true);
      setInputValue("");
      setFiles([]);
      const attachments = await Promise.all(
        pendingFiles.map(async (file) => ({
          type: attachmentType(file.type),
          mimeType: file.type || "application/octet-stream",
          fileName: file.name,
          content: await readFileAsBase64(file),
        })),
      );
      const hasAttachments = attachments.length > 0;

      if (!sessionKey) {
        const agentId = activeAgentId || "main";
        const createData = await createChatSession({
          agentId,
          ...(!hasAttachments && messageText ? { message: messageText } : {}),
        });
        sessionKey = createData.key ?? null;
        if (!sessionKey) {
          setInputValue(message);
          setFiles(pendingFiles);
          return;
        }
        const store = useChatStore.getState();
        store.setActiveSession(sessionKey);
        store.setSessionMetas([
          { key: sessionKey, agentId, updatedAt: Date.now(), lastMessagePreview: displayText },
          ...store.sessionMetas,
        ]);
        store.mergeSessionPreviewOverlay(sessionKey, {
          text: displayText,
          updatedAt: Date.now(),
          source: "optimistic",
        });
        store.addMessage(sessionKey, {
          id: `user-${Date.now()}`,
          role: "user",
          content: [{ type: "text", text: displayText }],
          timestamp: Date.now(),
        });

        const sendPlan = resolveInitialSessionSendPlan({
          hasAttachments,
          runStarted: createData.runStarted,
          runError: createData.runError,
        });
        if (sendPlan.kind === "error") {
          store.setSessionError(sessionKey, sendPlan.error);
          store.setSessionStreaming(sessionKey, false);
          return;
        }
        store.setSessionError(sessionKey, null);
        store.setSessionStreaming(sessionKey, true);
        if (sendPlan.kind === "started") {
          return;
        }
        await sendChatMessage({
          message: messageText,
          sessionKey,
          ...(hasAttachments ? { attachments } : {}),
        });
        return;
      }

      useChatStore.getState().mergeSessionPreviewOverlay(sessionKey, {
        text: displayText,
        updatedAt: Date.now(),
        source: "optimistic",
      });
      useChatStore.getState().addMessage(sessionKey, {
        id: `user-${Date.now()}`,
        role: "user",
        content: [{ type: "text", text: displayText }],
        timestamp: Date.now(),
      });
      useChatStore.getState().setSessionStreaming(sessionKey, true);
      useChatStore.getState().setSessionError(sessionKey, null);
      await sendChatMessage({
        message: messageText,
        sessionKey,
        ...(hasAttachments ? { attachments } : {}),
      });
    } catch {
      if (typeof sessionKey === "string") {
        useChatStore.getState().setSessionError(sessionKey, t("error"));
        useChatStore.getState().setSessionStreaming(sessionKey, false);
      } else {
        setInputValue(message);
        setFiles(pendingFiles);
      }
    } finally {
      setIsSending(false);
    }
  }, [
    activeAgentId,
    activeSessionKey,
    files,
    handleSlashCommand,
    input,
    onSendMessage,
    setInputValue,
    showToast,
    slash,
    t,
  ]);

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      slash.handlePaletteKeyDown(
        event,
        (cmd) => handleCommandSelect(cmd),
        (cmd, arg) => handleArgOptionSelect(cmd, arg),
      )
    ) {
      return;
    }
    if (event.key === "Backspace" && slash.activeTag && !input) {
      event.preventDefault();
      slash.clearTag();
      return;
    }
    if (event.key === "ArrowUp" && !input.trim()) {
      const previous = history.up(input);
      if (previous !== null) {
        event.preventDefault();
        setInputValue(previous);
        return;
      }
    }
    if (event.key === "ArrowDown") {
      const next = history.down();
      if (next !== null) {
        event.preventDefault();
        setInputValue(next);
        return;
      }
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!sendDisabled) {
        void sendPlainMessage();
      }
    }
  };

  const defaultSendDisabled =
    isStreaming || isSending || (input.trim().length === 0 && files.length === 0);
  const controlledSendDisabled = sendDisabledProp ?? defaultSendDisabled;
  const sendDisabled =
    files.length > 0 && input.trim().length === 0 && sendDisabledProp
      ? isStreaming || isSending
      : controlledSendDisabled;
  const abortDisabled = abortDisabledProp ?? !activeSessionKey;

  return (
    <div
      className="deck-ui-message-input"
      onDrop={(event) => {
        event.preventDefault();
        addFiles(Array.from(event.dataTransfer.files));
      }}
      onDragOver={(event) => event.preventDefault()}
    >
      {activeApproval && pendingApprovals.some((approval) => approval.id === activeApproval.id) ? (
        <ApprovalDialog
          approval={activeApproval}
          pendingCount={pendingCount}
          onResolve={handleResolveApproval}
        />
      ) : null}
      {contextCritical ? (
        <div className="deck-ui-composer-warning" role="status">
          {t("contextWarning")}
        </div>
      ) : null}
      <FileAttachmentBar
        files={files}
        onRemove={(index) => setFiles((current) => current.filter((_, item) => item !== index))}
      />
      <button
        className="deck-ui-composer-action"
        type="button"
        aria-label={attachFilesLabel}
        title={attachFilesLabel}
        onClick={() => fileInputRef.current?.click()}
      >
        <PlusIcon />
        <span>{attachFilesLabel}</span>
      </button>
      <input
        ref={fileInputRef}
        className="deck-ui-file-input"
        type="file"
        multiple
        aria-label={fileAttachmentsLabel}
        onChange={(event) => {
          if (event.target.files) {
            addFiles(Array.from(event.target.files));
            event.target.value = "";
          }
        }}
      />
      <div className="deck-ui-composer-field">
        {slash.showPalette ? (
          <SlashCommandPalette
            filter={slash.slashFilter}
            selectedIndex={slash.argOptionsState?.selectedIndex ?? slash.paletteIndex}
            onSelectedIndexChange={slash.setPaletteIndex}
            onSelect={handleCommandSelect}
            onSelectWithArg={handleArgOptionSelect}
            onDismiss={slash.closePalette}
            navigableCommandsRef={slash.navigableCommandsRef}
            visibilityContext={{ isStreaming, hasMessages }}
            argOptionsState={slash.argOptionsState}
            onArgOptionsBack={slash.exitArgOptionsMode}
            onArgOptionsIndexChange={slash.setArgOptionsIndex}
          />
        ) : null}
        {mention.showMention ? (
          <MentionPopover
            filter={mention.mentionFilter}
            onSelect={handleMentionSelect}
            onDismiss={mention.closeMention}
          />
        ) : null}
        {slash.ghostHint ? <div className="deck-ui-ghost-hint">{slash.ghostHint}</div> : null}
        {slash.activeTag ? (
          <button
            className="deck-ui-command-tag"
            type="button"
            onClick={() => slash.clearTag()}
            title={t("cmdTagRemove")}
          >
            /{slash.activeTag.name}
          </button>
        ) : null}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(event) => handleInputChange(event.target.value)}
          onKeyDown={handleInputKeyDown}
          onPaste={(event) => {
            const pastedFiles = Array.from(event.clipboardData.files);
            if (pastedFiles.length > 0) {
              addFiles(pastedFiles);
            }
          }}
          placeholder={slash.activeTag ? t("cmdTagPlaceholder") : t("placeholder")}
        />
      </div>
      <PromptTemplateMenu onSelect={(template) => setInputValue(`${input}${template}`)} />
      <CanvasToggle label={t("canvasToggle")} />
      <ArtifactToggle label={t("artifactToggle")} />
      <button
        className="deck-ui-composer-send"
        type="button"
        disabled={sendDisabled}
        title={t("send")}
        onClick={() => void sendPlainMessage()}
      >
        <ArrowUpIcon />
        <span>{t("send")}</span>
      </button>
      <button
        className="deck-ui-composer-abort"
        type="button"
        disabled={abortDisabled}
        title={t("abort")}
        onClick={() => void abortRun()}
      >
        <SquareIcon />
        <span>{t("abort")}</span>
      </button>
    </div>
  );
}
