import { useTranslations } from "next-intl";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { SegmentedControl } from "@/design-system/atoms/SegmentedControl";
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
import { ThinkingBlock } from "./ThinkingBlock";
import { ToolUseCard } from "./ToolUseCard";
import { UnknownBlockCard } from "./UnknownBlockCard";
import { VirtualScrollResult } from "./VirtualScrollResult";

const IMAGE_EXTENSIONS = new Set(["gif", "jpeg", "jpg", "png", "svg", "webp"]);

function renderNestedBlock(block: ContentBlock, index: number) {
  switch (block.type) {
    case "text":
      return (
        <pre className="ds-tool-result-raw deck-ui-tool-result-raw" key={`text-${index}`}>
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
          className="ds-canvas-embed deck-ui-canvas-embed"
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
  /** When rendered inside a `ToolPair`, suppress own border. */
  paired?: boolean;
}

type ViewType = "raw" | "bash" | "read" | "diff";
type ViewMode = ViewType | "structured";

export function ToolResultCard(props: ToolResultCardProps) {
  const { content, isError, toolName, toolInput, paired } = props;
  const t = useTranslations("chat");
  const { onOpenArtifact } = useContext(ArtifactContext);
  const [isOpen, setIsOpen] = useState(Boolean(isError));
  const previousIsError = useRef(Boolean(isError));
  const isStructuredContent = typeof content !== "string";
  const contentText = typeof content === "string" ? content : JSON.stringify(content, null, 2);
  const detectedView = useMemo<ViewMode>(() => {
    if (isStructuredContent) {
      // Structured arrays default to the per-item renderer (`renderNestedBlock`)
      // rather than JSON; user can click the raw tab to see the JSON form.
      return "structured";
    }
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
      return "diff";
    }
    return "raw";
  }, [isError, isStructuredContent, toolName]);
  const [activeView, setActiveView] = useState<ViewMode>(detectedView);
  useEffect(() => {
    setActiveView(detectedView);
  }, [detectedView]);
  const bashResult = useMemo(
    () => (detectedView === "bash" ? parseBashResult(contentText) : null),
    [contentText, detectedView],
  );
  const lineCount = useMemo(() => countLines(contentText), [contentText]);
  const hasEnhancedView = detectedView !== "raw" || lineCount > 200 || isStructuredContent;
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
    (detectedView === "diff" || (detectedView === "read" && isImagePath(filePath)));
  const title = isError ? t("toolError") : t("toolResult");
  const renderedContent = (() => {
    if (activeView === "raw") {
      return (
        <div className="ds-tool-use-body deck-ui-tool-use-body">
          {renderRawContent({ content: contentText, lineCount })}
        </div>
      );
    }
    if (isStructuredContent) {
      return (
        <div className="ds-tool-result-structured deck-ui-tool-result-structured">
          {content.map((block, index) => renderNestedBlock(block, index))}
        </div>
      );
    }
    return (
      <div className="ds-tool-use-body deck-ui-tool-use-body">
        {renderStringContent({
          bashResult,
          content: content,
          lineCount,
          t,
          toolInput,
          viewType: activeView as ViewType,
        })}
      </div>
    );
  })();

  useEffect(() => {
    if (isError && !previousIsError.current) {
      setIsOpen(true);
    }
    previousIsError.current = Boolean(isError);
  }, [isError]);

  // SegmentedControl tabs:
  //  - String content → raw / bash / read / diff (disabled-not-hidden; only the
  //    detected view + raw are enabled; raw fallback always available).
  //  - Structured (array) content → raw / structured (the per-item renderer).
  // bash/read/diff/structured are technical view-name identifiers (not translated).
  const viewTabs = useMemo<Array<{ value: ViewMode; label: string; disabled?: boolean }>>(() => {
    if (isStructuredContent) {
      return [
        { value: "raw", label: t("showRaw") },
        { value: "structured", label: "structured" },
      ];
    }
    return [
      { value: "raw", label: t("showRaw") },
      { value: "bash", label: "bash", disabled: detectedView !== "bash" },
      { value: "read", label: "read", disabled: detectedView !== "read" },
      { value: "diff", label: "diff", disabled: detectedView !== "diff" },
    ];
  }, [detectedView, isStructuredContent, t]);

  const wrapperClasses = ["deck-ui-tool-result-card", "ds-tool-result-card"];
  if (isError) {
    wrapperClasses.push("is-error");
    wrapperClasses.push("ds-tool-result-card--error");
  }
  if (paired) {
    wrapperClasses.push("ds-tool-result-card--paired");
  }

  return (
    <>
      <details
        className={wrapperClasses.join(" ")}
        open={isOpen}
        onToggle={(event) => setIsOpen(event.currentTarget.open)}
        data-tool-result-card="true"
        data-tool-error={isError ? "true" : undefined}
      >
        <summary className="deck-ui-tool-use-summary ds-tool-result-card__summary">
          <span className="ds-tool-icon deck-ui-tool-icon" aria-hidden="true">
            {isError ? "!" : "ok"}
          </span>
          <span className="ds-tool-label deck-ui-tool-label">{title}</span>
          {hasEnhancedView ? (
            <span
              className="deck-ui-tool-use-actions ds-tool-result-card__actions"
              onClick={(event) => event.stopPropagation()}
            >
              <SegmentedControl
                aria-label={t("toolResult")}
                controlSize="xs"
                items={viewTabs}
                value={activeView}
                onChange={(next) => setActiveView(next)}
              />
            </span>
          ) : null}
        </summary>
        {renderedContent}
      </details>
      {artifact ? <ArtifactCard artifact={artifact} onOpen={onOpenArtifact} /> : null}
      {showDownload ? (
        <a
          className="deck-ui-tool-download ds-tool-result-card__download"
          href={`/api/media?path=${encodeURIComponent(filePath)}&dl=1`}
          download={fileName}
        >
          {fileName}
        </a>
      ) : null}
    </>
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
        className="ds-tool-result-media deck-ui-tool-result-media"
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
    return <div className="ds-tool-result-binary">{t("binaryFile")}</div>;
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

  return <pre className="ds-tool-result-raw deck-ui-tool-result-raw">{content}</pre>;
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
