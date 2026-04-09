"use client";

import { FileIcon, PanelRight, SquareCode, X } from "lucide-react";
import { useCallback, useContext, useEffect, useState } from "react";
import { useChatStore } from "@/stores/chat";
import { useActiveSessionKey, useSessionA2UI } from "@/stores/chat-hooks";
import { persistChatProjection } from "./chat-api";
import { ArtifactContext } from "./ChatPanel";

/** Max attachment size — matches macOS client (5MB). */
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

/** Read a File as base64 string (without data URL prefix). */
export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    });
    reader.addEventListener("error", () => reject(new Error(`Failed to read ${file.name}`)));
    reader.readAsDataURL(file);
  });
}

/** Determine attachment type from MIME. */
export function attachmentType(mime: string): string {
  if (mime.startsWith("image/")) {
    return "image";
  }
  return "file";
}

/** Format file size for display. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)}KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/** Image thumbnail preview with Object URL lifecycle management. */
export function ImagePreview({ file, onRemove }: { file: File; onRemove: () => void }) {
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
export function CanvasToggle({ label }: { label: string }) {
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
export function ArtifactToggle({ label }: { label: string }) {
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

/** File attachment bar — renders image previews and file chips with remove buttons. */
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
    <div className="flex flex-wrap gap-2 mb-2">
      {files.map((f, i) =>
        f.type.startsWith("image/") ? (
          <ImagePreview key={`${f.name}-${i}`} file={f} onRemove={() => onRemove(i)} />
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
              onClick={() => onRemove(i)}
              className="hover:opacity-60 shrink-0"
              style={{ color: "var(--muted-foreground)" }}
            >
              <X size={10} />
            </button>
          </span>
        ),
      )}
    </div>
  );
}
