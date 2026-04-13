"use client";

import type { ReactNode } from "react";
import { Streamdown } from "streamdown";
import type { ContentBlock } from "@/stores/chat-types";
import { CanvasEmbed } from "./blocks/CanvasEmbed";
import { FileBlock } from "./blocks/FileBlock";
import { ImageBlock } from "./blocks/ImageBlock";
import { ThinkingBlock } from "./blocks/ThinkingBlock";
import { ToolResultCard } from "./blocks/ToolResultCard";
import { ToolUseCard } from "./blocks/ToolUseCard";
import { UnknownBlockCard } from "./blocks/UnknownBlockCard";

type RendererProps<T extends ContentBlock> = {
  block: T;
  keyValue: string;
};

type TranscriptRenderRegistry = {
  [K in ContentBlock["type"]]: (
    props: RendererProps<Extract<ContentBlock, { type: K }>>,
  ) => ReactNode;
};

const textRenderer = ({
  block,
  keyValue,
}: RendererProps<Extract<ContentBlock, { type: "text" }>>) => (
  <div key={keyValue} className="chat-prose max-w-none text-sm">
    <Streamdown mode="static" className="streamdown-chat">
      {block.text}
    </Streamdown>
  </div>
);

const transcriptRenderRegistry = {
  text: textRenderer,
  thinking: ({ block, keyValue }: RendererProps<Extract<ContentBlock, { type: "thinking" }>>) => (
    <ThinkingBlock key={keyValue} text={block.text} />
  ),
  tool_use: ({ block, keyValue }: RendererProps<Extract<ContentBlock, { type: "tool_use" }>>) => (
    <ToolUseCard key={keyValue} name={block.name} input={block.input} />
  ),
  tool_result: ({
    block,
    keyValue,
  }: RendererProps<Extract<ContentBlock, { type: "tool_result" }>>) => (
    <ToolResultCard key={keyValue} content={block.content} isError={block.isError} />
  ),
  image: ({ block, keyValue }: RendererProps<Extract<ContentBlock, { type: "image" }>>) => (
    <ImageBlock key={keyValue} {...block} />
  ),
  file: ({ block, keyValue }: RendererProps<Extract<ContentBlock, { type: "file" }>>) => (
    <FileBlock key={keyValue} {...block} />
  ),
  canvas: ({ block, keyValue }: RendererProps<Extract<ContentBlock, { type: "canvas" }>>) => (
    <CanvasEmbed key={keyValue} block={block} />
  ),
  unknown: ({ block, keyValue }: RendererProps<Extract<ContentBlock, { type: "unknown" }>>) => (
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

  const unreachable: never = block;
  return unreachable;
}
