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
import type { ContentBlock } from "@/stores/chat-types";
import { ArtifactContext } from "../artifact-context";
import { ArtifactCard } from "../artifacts/ArtifactCard";
import { detectArtifact } from "../artifacts/detectArtifact";
import { BashResultView } from "./BashResultView";
import { DiffPreview } from "./DiffPreview";
import { FileBlock } from "./FileBlock";
import { HighlightedCodeView } from "./HighlightedCodeView";
import { ImageBlock } from "./ImageBlock";
import { ShowRawToggle } from "./ShowRawToggle";
import { ThinkingBlock } from "./ThinkingBlock";
import { ToolUseCard } from "./ToolUseCard";
import { UnknownBlockCard } from "./UnknownBlockCard";
import { VirtualScrollResult } from "./VirtualScrollResult";

const IMAGE_EXTENSIONS = new Set(["gif", "jpeg", "jpg", "png", "svg", "webp"]);

function renderNestedBlock(block: ContentBlock, index: number) {
  switch (block.type) {
    case "text":
      return (
        <pre className="deck-ui-tool-result-raw" key={`text-${index}`}>
          {block.text}
        </pre>
      );
    case "thinking":
      return <ThinkingBlock key={`thinking-${index}`} text={block.text} />;
    case "tool_use":
      return <ToolUseCard key={`tool-use-${index}`} name={block.name} input={block.input} />;
    case "tool_result":
      return (
        <ToolResultCard
          key={`tool-result-${index}`}
          content={block.content}
          isError={block.isError}
        />
      );
    case "image":
      return <ImageBlock key={`image-${index}`} {...block} />;
    case "file":
      return <FileBlock key={`file-${index}`} {...block} />;
    case "canvas":
      return (
        <iframe
          className="deck-ui-canvas-embed"
          key={`canvas-${index}`}
          src={block.url}
          title={block.title ?? "canvas"}
        />
      );
    case "unknown":
      return (
        <UnknownBlockCard
          key={`unknown-${index}`}
          rawType={block.rawType}
          summary={block.summary}
        />
      );
  }
  return null;
}

interface ToolResultCardProps {
  content: string | ContentBlock[];
  isError?: boolean;
  toolName?: string;
  toolInput?: Record<string, unknown>;
}

type ViewType = "raw" | "bash" | "read" | "diff";

export function ToolResultCard(props: ToolResultCardProps) {
  const { content, isError, toolName, toolInput } = props;
  const t = useTranslations("chat");
  const { onOpenArtifact } = useContext(ArtifactContext);
  const [showRaw, setShowRaw] = useState(false);
  const contentText = typeof content === "string" ? content : JSON.stringify(content, null, 2);
  const viewType = useMemo<ViewType>(() => {
    if (isError || typeof content !== "string") {
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
      return "diff";
    }
    return "raw";
  }, [content, isError, toolName]);
  const bashResult = useMemo(
    () => (viewType === "bash" ? parseBashResult(contentText) : null),
    [contentText, viewType],
  );
  const lineCount = useMemo(() => countLines(contentText), [contentText]);
  const hasEnhancedView = viewType !== "raw" || lineCount > 200 || typeof content !== "string";
  const artifact =
    !isError && typeof content === "string"
      ? detectArtifact(content, resolveToolContext(props))
      : null;
  const filePath = findFilePath(toolInput);
  const fileName = filePath?.split("/").pop() ?? filePath;
  const showDownload =
    !isError &&
    typeof content === "string" &&
    filePath &&
    (viewType === "diff" || (viewType === "read" && isImagePath(filePath)));

  return (
    <div className={`deck-ui-tool-result-card ${isError ? "is-error" : ""}`}>
      <div className="deck-ui-tool-result-head">
        <span className="deck-ui-tool-icon" aria-hidden="true">
          {isError ? "!" : "ok"}
        </span>
        <strong>{isError ? t("toolError") : t("toolResult")}</strong>
      </div>
      {hasEnhancedView ? (
        <ShowRawToggle isRaw={showRaw} onToggle={() => setShowRaw((current) => !current)} />
      ) : null}
      {showRaw ? (
        renderRawContent({ content: contentText, lineCount })
      ) : typeof content === "string" ? (
        <>
          {renderStringContent({
            bashResult,
            content,
            lineCount,
            t,
            toolInput,
            viewType,
          })}
          {artifact ? <ArtifactCard artifact={artifact} onOpen={onOpenArtifact} /> : null}
          {showDownload ? (
            <a
              className="deck-ui-tool-download"
              href={`/api/media?path=${encodeURIComponent(filePath)}&dl=1`}
              download={fileName}
            >
              {fileName}
            </a>
          ) : null}
        </>
      ) : (
        <div className="deck-ui-tool-result-structured">
          {content.map((block, index) => renderNestedBlock(block, index))}
        </div>
      )}
    </div>
  );
}

function renderStringContent({
  bashResult,
  content,
  lineCount,
  t,
  toolInput,
  viewType,
}: {
  bashResult: ReturnType<typeof parseBashResult>;
  content: string;
  lineCount: number;
  t: ReturnType<typeof useTranslations>;
  toolInput?: Record<string, unknown>;
  viewType: ViewType;
}) {
  const filePath = findFilePath(toolInput);

  if (viewType === "read" && isImagePath(filePath)) {
    const fileName = filePath?.split("/").pop() ?? "image";
    return (
      <div
        className="deck-ui-tool-result-media"
        data-tool-result-view="read"
        data-file-preview="image"
      >
        <img
          src={`/api/media?path=${encodeURIComponent(filePath ?? "")}`}
          alt={fileName}
          loading="lazy"
        />
      </div>
    );
  }

  if (viewType === "read" && isBinaryContent(content)) {
    return <div className="deck-ui-tool-result-binary">{t("binaryFile")}</div>;
  }

  if (viewType === "bash" && bashResult) {
    return <BashResultView result={bashResult} />;
  }

  if (viewType === "read") {
    const extension = getFileExtension(filePath);
    return <HighlightedCodeView content={content} extension={extension} />;
  }

  if (viewType === "diff") {
    return <DiffPreview content={content} />;
  }

  return renderRawContent({ content, lineCount });
}

function renderRawContent({ content, lineCount }: { content: string; lineCount: number }) {
  if (lineCount > 200) {
    return <VirtualScrollResult content={content} />;
  }

  return <pre className="deck-ui-tool-result-raw">{content}</pre>;
}

function resolveToolContext(
  props: ToolResultCardProps,
): { toolName?: string; filePath?: string } | undefined {
  if (!props.toolName && !props.toolInput) {
    return undefined;
  }

  return {
    toolName: props.toolName,
    filePath: findFilePath(props.toolInput),
  };
}

function findFilePath(input: Record<string, unknown> | undefined): string | undefined {
  if (!input) {
    return undefined;
  }
  for (const key of ["filePath", "file_path", "path", "filename", "file"]) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return undefined;
}

function isImagePath(filePath: string | undefined): boolean {
  if (!filePath) {
    return false;
  }
  return IMAGE_EXTENSIONS.has(getFileExtension(filePath));
}
