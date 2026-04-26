import { useCallback, useContext } from "react";
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
}: {
  files: File[];
  onRemove: (index: number) => void;
}) {
  if (files.length === 0) {
    return null;
  }

  return (
    <div className="deck-ui-attachment-bar" aria-label="Attached files">
      {files.map((file, index) => (
        <span className="deck-ui-attachment-pill" key={`${file.name}-${index}`}>
          <span>{file.name}</span>
          <span>{formatSize(file.size)}</span>
          <button
            className="deck-ui-attachment-remove"
            type="button"
            onClick={() => onRemove(index)}
            aria-label={`Remove ${file.name}`}
          >
            x
          </button>
        </span>
      ))}
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
    <button
      className="deck-ui-composer-action"
      type="button"
      aria-pressed={canvasVisible}
      title={label}
      onClick={handleToggle}
    >
      {label}
    </button>
  );
}

export function ArtifactToggle({ label }: { label: string }) {
  const { artifactPanelOpen, onToggleArtifactPanel } = useContext(ArtifactContext);
  return (
    <button
      className="deck-ui-composer-action"
      type="button"
      aria-pressed={artifactPanelOpen}
      title={label}
      onClick={onToggleArtifactPanel}
    >
      {label}
    </button>
  );
}
