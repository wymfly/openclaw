import type { ContentBlock } from "@/stores/chat-types";

type CanvasBlock = Extract<ContentBlock, { type: "canvas" }>;

export function CanvasEmbed({ block }: { block: CanvasBlock }) {
  return (
    <iframe className="deck-ui-canvas-embed" src={block.url} title={block.title ?? "canvas"} />
  );
}
