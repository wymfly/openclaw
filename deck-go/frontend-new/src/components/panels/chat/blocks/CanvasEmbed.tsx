import type { ContentBlock } from "@/stores/chat-types";
import { resolveCanvasAssetUrl } from "../canvas-asset-config";

type CanvasBlock = Extract<ContentBlock, { type: "canvas" }>;

function resolveCanvasEmbedSrc(url: string) {
  return resolveCanvasAssetUrl(url);
}

export function CanvasEmbed({ block }: { block: CanvasBlock }) {
  return (
    <iframe
      className="ds-block ds-block--canvas ds-canvas-embed deck-ui-canvas-embed"
      height={block.preferredHeight}
      src={resolveCanvasEmbedSrc(block.url)}
      title={block.title ?? "canvas"}
    />
  );
}
