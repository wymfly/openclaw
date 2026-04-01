"use client";

import { Check, Download, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useContext, useMemo, useState } from "react";
import {
  countLines,
  getFileExtension,
  isBashTool,
  isBinaryContent,
  isFileOpTool,
  parseBashResult,
} from "@/lib/tool-result-parser";
import { cn } from "@/lib/utils";
import { ArtifactCard } from "../artifacts/ArtifactCard";
import { detectArtifact } from "../artifacts/detectArtifact";
import { ArtifactContext } from "../ChatPanel";
import { BashResultView } from "./BashResultView";
import { DiffPreview } from "./DiffPreview";
import { HighlightedCodeView } from "./HighlightedCodeView";
import { ShowRawToggle } from "./ShowRawToggle";
import { VirtualScrollResult } from "./VirtualScrollResult";

// ---------------------------------------------------------------------------
// ToolResultCard — routes tool results to specialised views based on tool type.
//
// Detection order:
//   1. Error → raw
//   2. Bash tool → BashResultView (if parseable) or raw fallback
//   3. File read → HighlightedCodeView (with extension hint)
//   4. File write/edit → DiffPreview (only when diff markers present) or raw
//   5. Default → raw
//
// Virtual scroll is applied to ALL view types when content exceeds 200 lines.
// A per-card "Show Raw" toggle lets the user switch back to raw at any time.
// ---------------------------------------------------------------------------

const VIRTUAL_SCROLL_THRESHOLD = 200;
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg"]);

/** Check if a file path points to an image. */
function isImagePath(filePath: unknown): boolean {
  if (typeof filePath !== "string") return false;
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTENSIONS.has(ext);
}

type ViewType = "raw" | "bash" | "read" | "diff";

interface ToolResultCardProps {
  content: string;
  isError?: boolean;
  /** Optional tool name for contextual routing and artifact detection. */
  toolName?: string;
  /** Tool input params — used to extract file_path for syntax hints. */
  toolInput?: Record<string, unknown>;
}

export function ToolResultCard({ content, isError, toolName, toolInput }: ToolResultCardProps) {
  const t = useTranslations("chat");
  const { onOpenArtifact } = useContext(ArtifactContext);
  const [showRaw, setShowRaw] = useState(false);

  const contentStr = typeof content === "string" ? content : JSON.stringify(content, null, 2);

  // --- View type detection ---------------------------------------------------

  const viewType = useMemo((): ViewType => {
    if (isError) {
      return "raw";
    }
    if (isBashTool(toolName)) {
      return "bash";
    }
    const fileOp = isFileOpTool(toolName);
    if (fileOp === "read") {
      return "read";
    }
    if (fileOp === "write" || fileOp === "edit") {
      // Route to DiffPreview — component handles both unified diff and plain content
      // (plain content rendered as "all added" block for new file / write results)
      return "diff";
    }
    return "raw";
  }, [toolName, isError, contentStr]);

  // --- Virtual scroll decision -----------------------------------------------

  const lineCount = useMemo(() => countLines(contentStr), [contentStr]);
  const useVirtualScroll = lineCount > VIRTUAL_SCROLL_THRESHOLD;

  // --- Show Raw toggle -------------------------------------------------------

  const hasEnhancedView = viewType !== "raw" || useVirtualScroll;

  // --- Bash parse (unconditional to satisfy React hook rules) -----------------

  const bashParsed = useMemo(
    () => (viewType === "bash" ? parseBashResult(contentStr) : null),
    [viewType, contentStr],
  );

  // --- File extension for read view ------------------------------------------

  const fileExtension = useMemo(() => {
    if (viewType !== "read") {
      return "";
    }
    const filePath = toolInput?.file_path;
    return getFileExtension(typeof filePath === "string" ? filePath : undefined);
  }, [viewType, toolInput]);

  // --- Artifact detection (preserved from original) --------------------------

  const filePath =
    typeof toolInput?.file_path === "string"
      ? toolInput.file_path
      : typeof toolInput?.path === "string"
        ? toolInput.path
        : typeof toolInput?.filePath === "string"
          ? toolInput.filePath
          : undefined;
  const artifact = !isError
    ? detectArtifact(contentStr, toolName ? { toolName, filePath } : undefined)
    : null;

  // --- Render helpers --------------------------------------------------------

  function renderRawContent() {
    if (useVirtualScroll) {
      return <VirtualScrollResult content={contentStr} />;
    }
    return (
      <pre className="px-2.5 py-2 text-xs whitespace-pre-wrap overflow-auto bg-[var(--background)] text-[var(--foreground)] max-h-[300px]">
        {contentStr}
      </pre>
    );
  }

  function renderContent() {
    // "Show Raw" override — always fallback to raw rendering
    if (showRaw) {
      return renderRawContent();
    }

    switch (viewType) {
      case "bash": {
        if (bashParsed) {
          return <BashResultView result={bashParsed} />;
        }
        // Bash tool but content doesn't match expected format → raw fallback
        return renderRawContent();
      }
      case "diff":
        return <DiffPreview content={contentStr} />;
      case "read": {
        // Image file: render as <img> via /api/media endpoint
        const readPath = toolInput?.file_path;
        if (isImagePath(readPath)) {
          return (
            <div className="p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/media?path=${encodeURIComponent(String(readPath))}`}
                alt={String(readPath).split("/").pop() ?? "image"}
                className="max-h-[300px] rounded-md"
                loading="lazy"
              />
            </div>
          );
        }
        if (isBinaryContent(contentStr)) {
          return (
            <div className="px-2.5 py-2 text-xs bg-[var(--muted)] text-[var(--muted-foreground)]">
              {t("binaryFile")}
            </div>
          );
        }
        return <HighlightedCodeView content={contentStr} extension={fileExtension} />;
      }
      default:
        return renderRawContent();
    }
  }

  return (
    <>
      <details
        className={cn(
          "my-1.5 text-xs rounded-lg border overflow-hidden",
          isError ? "border-[var(--destructive)]/30" : "border-[var(--border-subtle)]",
        )}
        open={isError}
      >
        <summary
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 cursor-pointer select-none",
            isError
              ? "bg-[var(--destructive-muted)] text-[var(--destructive-muted-text)]"
              : "bg-[var(--muted)] text-[var(--muted-foreground)]",
          )}
        >
          {isError ? <X size={12} /> : <Check size={12} />}
          <span className="font-medium">{isError ? t("toolError") : t("toolResult")}</span>
          {/* Show Raw toggle — rendered in the summary bar, right-aligned */}
          {hasEnhancedView && (
            <span
              className="ml-auto"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                }
              }}
            >
              <ShowRawToggle isRaw={showRaw} onToggle={() => setShowRaw((prev) => !prev)} />
            </span>
          )}
        </summary>
        {renderContent()}
      </details>
      {artifact && <ArtifactCard artifact={artifact} onOpen={onOpenArtifact} />}
      {/* Download button for file write operations */}
      {!isError &&
        toolInput?.file_path &&
        (viewType === "diff" || isImagePath(toolInput.file_path)) && (
          <a
            href={`/api/media?path=${encodeURIComponent(String(toolInput.file_path))}&dl=1`}
            download
            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 mt-0.5 rounded-md hover:opacity-80 transition-opacity"
            style={{
              backgroundColor: "var(--muted)",
              color: "var(--muted-foreground)",
            }}
          >
            <Download size={10} />
            {String(toolInput.file_path).split("/").pop()}
          </a>
        )}
    </>
  );
}
