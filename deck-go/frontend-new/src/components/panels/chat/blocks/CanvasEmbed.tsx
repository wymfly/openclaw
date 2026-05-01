import type { ContentBlock } from "@/stores/chat-types";

type CanvasBlock = Extract<ContentBlock, { type: "canvas" }>;

export function CanvasEmbed({ block }: { block: CanvasBlock }) {
  return (
    <iframe
      className="ds-block ds-block--canvas ds-canvas-embed deck-ui-canvas-embed"
      src={block.url}
      title={block.title ?? "canvas"}
    />
  );
}
