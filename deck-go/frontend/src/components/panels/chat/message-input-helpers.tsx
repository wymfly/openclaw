import { useCallback, useContext } from "react";
import { FileTextIcon, MonitorDotIcon, PlusIcon } from "@/deck-ui/icons";
import { Button } from "@/design-system/atoms/Button";
import { IconButton } from "@/design-system/atoms/IconButton";
import { useChatStore } from "@/stores/chat";
import { useActiveSessionKey, useSessionA2UI } from "@/stores/chat-hooks";
import { ArtifactContext } from "./artifact-context";
import { persistChatProjection } from "./chat-api";

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.includes(",") ? result.split(",")[1] : result);
    });
    reader.addEventListener("error", () => reject(new Error(`Failed to read ${file.name}`)));
    reader.readAsDataURL(file);
  });
}

export function attachmentType(mime: string) {
  return mime.startsWith("image/") ? "image" : "file";
}

export function formatSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes}B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)}KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function FileAttachmentBar({
  files,
  onRemove,
  onAdd,
  addLabel,
}: {
  files: File[];
  onRemove: (index: number) => void;
  onAdd?: () => void;
  addLabel?: string;
}) {
  if (files.length === 0) {
    return null;
  }

  return (
    <div className="ds-attachment-bar deck-ui-attachment-bar" aria-label="Attached files">
      {files.map((file, index) => (
        <span
          className="ds-attachment-bar__pill deck-ui-attachment-pill"
          key={`${file.name}-${index}`}
        >
          <span>{file.name}</span>
          <span>{formatSize(file.size)}</span>
          <IconButton
            size="sm"
            className="ds-attachment-bar__remove deck-ui-attachment-remove"
            aria-label={`Remove ${file.name}`}
            onClick={() => onRemove(index)}
          >
            x
          </IconButton>
        </span>
      ))}
      {onAdd ? (
        <button
          className="ds-attachment-bar__add"
          type="button"
          aria-label={addLabel ?? "Add"}
          title={addLabel ?? "Add"}
          onClick={onAdd}
        >
          <PlusIcon className="ds-attachment-bar__add-icon" aria-hidden="true" />
          <span>{addLabel ?? "add"}</span>
        </button>
      ) : null}
    </div>
  );
}

export function CanvasToggle({ label }: { label: string }) {
  const activeSessionKey = useActiveSessionKey();
  const a2uiState = useSessionA2UI();
  const canvasVisible = Boolean(a2uiState?.visible);

  const handleToggle = useCallback(() => {
    if (!activeSessionKey) {
      return;
    }
    useChatStore.getState().setA2UIState(activeSessionKey, { visible: !canvasVisible });
    void Promise.resolve(
      persistChatProjection({
        sessionKey: activeSessionKey,
        a2uiState: useChatStore.getState().sessions.get(activeSessionKey)?.a2uiState ?? null,
      }),
    ).catch(() => {});
  }, [activeSessionKey, canvasVisible]);

  return (
    <Button
      variant="ghost"
      size="sm"
      className="ds-message-input__action deck-ui-composer-action"
      aria-pressed={canvasVisible}
      title={label}
      onClick={handleToggle}
    >
      <MonitorDotIcon />
      <span>{label}</span>
    </Button>
  );
}

export function ArtifactToggle({ label }: { label: string }) {
  const { artifactPanelOpen, onToggleArtifactPanel } = useContext(ArtifactContext);
  return (
    <Button
      variant="ghost"
      size="sm"
      className="ds-message-input__action deck-ui-composer-action"
      aria-pressed={artifactPanelOpen}
      title={label}
      onClick={onToggleArtifactPanel}
    >
      <FileTextIcon />
      {label}
    </Button>
  );
}
