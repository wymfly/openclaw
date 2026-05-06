import type { ContentBlock } from "@/stores/chat-types";

type CanvasBlock = Extract<ContentBlock, { type: "canvas" }>;

function resolveCanvasEmbedSrc(url: string) {
  if (/^(https?:|data:|blob:)/.test(url)) {
    return url;
  }
  if (url.startsWith("/api/canvas/")) {
    return url;
  }
  if (url.startsWith("/__openclaw__/canvas/")) {
    return `/api/canvas/${url.slice("/__openclaw__/canvas/".length)}`;
  }
  if (url.startsWith("/__openclaw__/a2ui/")) {
    return `/api/canvas/${url.slice("/__openclaw__/a2ui/".length)}`;
  }
  return `/api/canvas/${url.replace(/^\/+/, "")}`;
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
