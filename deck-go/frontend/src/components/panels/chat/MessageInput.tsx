import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpIcon, PlusIcon, SlashIcon, SquareIcon, XIcon, ZapIcon } from "@/deck-ui/icons";
import { Button } from "@/design-system/atoms/Button";
import { IconButton } from "@/design-system/atoms/IconButton";
import { Textarea } from "@/design-system/atoms/Textarea";
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
import "./message-input.css";
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
import { useComposerState } from "./useComposerState";
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
  const composer = useComposerState(value, onChange);
  const {
    input,
    setInput,
    files,
    addFiles: appendFiles,
    removeFile,
    setFiles,
    isSending,
  } = composer;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [dragOver, setDragOver] = useState(false);
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

  useEffect(() => {
    if (!suggestedText) {
      return;
    }
    setInput(suggestedText);
    onSuggestedTextConsumed?.();
  }, [onSuggestedTextConsumed, setInput, suggestedText]);

  const handleInputChange = useCallback(
    (next: string) => {
      setInput(next);
      slash.handleSlashInput(next);
      mention.handleMentionInput(next, next.length);
      history.reset();
    },
    [history, mention, setInput, slash],
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
        appendFiles(valid);
      }
    },
    [activeSessionKey, appendFiles],
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
      setInput("");

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
    [abortRun, activeAgentId, activeSessionKey, setInput, showCommandError, showToast, slash, t],
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
        setInput("");
        return;
      }
      if (mode === "immediate") {
        void handleSlashCommand(cmd);
      }
    },
    [handleSlashCommand, setInput, slash],
  );

  const handleArgOptionSelect = useCallback(
    (cmd: RegisteredCommand, arg: string) => {
      slash.closePalette();
      setInput("");
      void handleSlashCommand(cmd, arg);
    },
    [handleSlashCommand, setInput, slash],
  );

  const handleMentionSelect = useCallback(
    (agentName: string) => {
      setInput(mention.selectMention(agentName, input));
      mention.closeMention();
    },
    [input, mention, setInput],
  );

  const sendPlainMessage = useCallback(async () => {
    const message = input.trim();
    if (slash.activeTag) {
      if (!message) {
        return;
      }
      const command = slash.activeTag;
      slash.clearTag();
      setInput("");
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
      composer.setIsSending(true);
      setInput("");
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
          setInput(message);
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
        setInput(message);
        setFiles(pendingFiles);
      }
    } finally {
      composer.setIsSending(false);
    }
  }, [
    activeAgentId,
    activeSessionKey,
    composer,
    files,
    handleSlashCommand,
    history,
    input,
    onSendMessage,
    setFiles,
    setInput,
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
        setInput(previous);
        return;
      }
    }
    if (event.key === "ArrowDown") {
      const next = history.down();
      if (next !== null) {
        event.preventDefault();
        setInput(next);
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

  const charCountHint = `${input.length} ch · ⌘↵ ${t("send")}`;

  return (
    <div
      className={
        "ds-message-input deck-ui-message-input" + (dragOver ? " ds-message-input--drag-over" : "")
      }
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        addFiles(Array.from(event.dataTransfer.files));
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!dragOver) {
          setDragOver(true);
        }
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) {
          setDragOver(false);
        }
      }}
    >
      {activeApproval && pendingApprovals.some((approval) => approval.id === activeApproval.id) ? (
        <ApprovalDialog
          approval={activeApproval}
          pendingCount={pendingCount}
          onResolve={handleResolveApproval}
        />
      ) : null}
      {contextCritical ? (
        <div className="ds-message-input__warning deck-ui-composer-warning" role="status">
          <ZapIcon className="ds-message-input__warning-icon" aria-hidden="true" />
          <span className="ds-message-input__warning-text">{t("contextWarning")}</span>
        </div>
      ) : null}
      <FileAttachmentBar
        files={files}
        onRemove={removeFile}
        onAdd={() => fileInputRef.current?.click()}
        addLabel={hasTranslation("attachAdd") ? t("attachAdd") : "add"}
      />
      <input
        ref={fileInputRef}
        className="ds-message-input__file-input deck-ui-file-input"
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
      <div className="ds-message-input__field deck-ui-composer-field">
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
        <IconButton
          className="ds-message-input__attach"
          aria-label={attachFilesLabel}
          title={attachFilesLabel}
          onClick={() => fileInputRef.current?.click()}
        >
          <PlusIcon />
        </IconButton>
        <div className="ds-message-input__ta-wrap">
          {slash.ghostHint ? (
            <div className="ds-message-input__ghost deck-ui-ghost-hint">
              <span className="ds-message-input__ghost-prefix">/{slash.slashFilter} </span>
              <span className="ds-message-input__ghost-rest">{slash.ghostHint}</span>
            </div>
          ) : null}
          {slash.activeTag ? (
            <span className="ds-message-input__tag deck-ui-command-tag">
              <SlashIcon className="ds-message-input__tag-icon" aria-hidden="true" />
              <span className="ds-message-input__tag-name">{slash.activeTag.name}</span>
              <IconButton
                className="ds-message-input__tag-close"
                aria-label={t("cmdTagRemove")}
                title={t("cmdTagRemove")}
                onClick={() => slash.clearTag()}
              >
                <XIcon />
              </IconButton>
            </span>
          ) : null}
          <Textarea
            ref={textareaRef}
            value={input}
            noResize
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
        <PromptTemplateMenu onSelect={(template) => setInput(`${input}${template}`)} />
      </div>
      <div className="ds-message-input__toolbar">
        <CanvasToggle label={t("canvasToggle")} />
        <ArtifactToggle label={t("artifactToggle")} />
        <span className="ds-message-input__hint" aria-hidden="true">
          {charCountHint}
        </span>
        {isStreaming ? (
          <Button
            variant="danger"
            size="sm"
            className="ds-message-input__abort deck-ui-composer-abort"
            disabled={abortDisabled}
            title={t("abort")}
            onClick={() => void abortRun()}
          >
            <SquareIcon />
            <span>{t("abort")}</span>
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            className="ds-message-input__send deck-ui-composer-send"
            disabled={sendDisabled}
            title={t("send")}
            onClick={() => void sendPlainMessage()}
          >
            <ArrowUpIcon />
            <span>{t("send")}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
