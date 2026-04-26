import type { ReactNode } from "react";
import type { ContentBlock } from "@/stores/chat-types";
import { CanvasEmbed } from "./blocks/CanvasEmbed";
import { FileBlock } from "./blocks/FileBlock";
import { ImageBlock } from "./blocks/ImageBlock";
import { ThinkingBlock } from "./blocks/ThinkingBlock";
import { ToolResultCard } from "./blocks/ToolResultCard";
import { ToolUseCard } from "./blocks/ToolUseCard";
import { UnknownBlockCard } from "./blocks/UnknownBlockCard";
import { MarkdownText } from "./MarkdownText";

type RendererProps<T extends ContentBlock> = {
  block: T;
  keyValue: string;
};

type TranscriptRenderRegistry = {
  [K in ContentBlock["type"]]: (
    props: RendererProps<Extract<ContentBlock, { type: K }>>,
  ) => ReactNode;
};

const transcriptRenderRegistry = {
  text: ({ block, keyValue }) => (
    <div key={keyValue}>
      <MarkdownText text={block.text} />
    </div>
  ),
  thinking: ({ block, keyValue }) => <ThinkingBlock key={keyValue} text={block.text} />,
  tool_use: ({ block, keyValue }) => (
    <ToolUseCard key={keyValue} name={block.name} input={block.input} />
  ),
  tool_result: ({ block, keyValue }) => (
    <ToolResultCard key={keyValue} content={block.content} isError={block.isError} />
  ),
  image: ({ block, keyValue }) => <ImageBlock key={keyValue} {...block} />,
  file: ({ block, keyValue }) => <FileBlock key={keyValue} {...block} />,
  canvas: ({ block, keyValue }) => <CanvasEmbed key={keyValue} block={block} />,
  unknown: ({ block, keyValue }) => (
    <UnknownBlockCard key={keyValue} rawType={block.rawType} summary={block.summary} />
  ),
} satisfies TranscriptRenderRegistry;

export function renderTranscriptBlock(block: ContentBlock, keyValue: string) {
  switch (block.type) {
    case "text":
      return transcriptRenderRegistry.text({ block, keyValue });
    case "thinking":
      return transcriptRenderRegistry.thinking({ block, keyValue });
    case "tool_use":
      return transcriptRenderRegistry.tool_use({ block, keyValue });
    case "tool_result":
      return transcriptRenderRegistry.tool_result({ block, keyValue });
    case "image":
      return transcriptRenderRegistry.image({ block, keyValue });
    case "file":
      return transcriptRenderRegistry.file({ block, keyValue });
    case "canvas":
      return transcriptRenderRegistry.canvas({ block, keyValue });
    case "unknown":
      return transcriptRenderRegistry.unknown({ block, keyValue });
  }
  return null;
}
