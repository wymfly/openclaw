/**
 * Embed shortcode parser for `[embed ...]` tags in assistant messages.
 *
 * Ported from upstream `src/chat/canvas-render.ts` + `src/markdown/fences.ts`
 * to respect dashboard import boundary (no `src/` imports).
 */

import type { ContentBlock } from "@/stores/chat-types";

// ---------------------------------------------------------------------------
// Canvas preview type (subset of upstream CanvasPreview aligned with ContentBlock)
// ---------------------------------------------------------------------------

export type CanvasPreview = Extract<ContentBlock, { type: "canvas" }>;

// ---------------------------------------------------------------------------
// Fence span detection — prevents parsing embeds inside code blocks
// Ported from src/markdown/fences.ts:parseFenceSpans
// ---------------------------------------------------------------------------

interface FenceSpan {
  start: number;
  end: number;
}

function parseFenceSpans(buffer: string): FenceSpan[] {
  const spans: FenceSpan[] = [];
  let open: { start: number; markerChar: string; markerLen: number } | undefined;

  let offset = 0;
  while (offset <= buffer.length) {
    const nextNewline = buffer.indexOf("\n", offset);
    const lineEnd = nextNewline === -1 ? buffer.length : nextNewline;
    const line = buffer.slice(offset, lineEnd);

    const match = line.match(/^( {0,3})(`{3,}|~{3,})(.*)$/);
    if (match) {
      const marker = match[2];
      const markerChar = marker[0];
      const markerLen = marker.length;
      if (!open) {
        open = { start: offset, markerChar, markerLen };
      } else if (open.markerChar === markerChar && markerLen >= open.markerLen) {
        spans.push({ start: open.start, end: lineEnd });
        open = undefined;
      }
    }

    if (nextNewline === -1) {
      break;
    }
    offset = nextNewline + 1;
  }

  if (open) {
    spans.push({ start: open.start, end: buffer.length });
  }

  return spans;
}

// ---------------------------------------------------------------------------
// Attribute parser — extracts key="value" pairs from shortcode attributes
// Ported from src/chat/canvas-render.ts:parseCanvasAttributes
// ---------------------------------------------------------------------------

function parseCanvasAttributes(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([A-Za-z_][A-Za-z0-9_-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw))) {
    const key = match[1]?.trim().toLowerCase();
    const value = (match[2] ?? match[3] ?? "").trim();
    if (key && value) {
      attrs[key] = value;
    }
  }
  return attrs;
}

// ---------------------------------------------------------------------------
// Preview builder — converts parsed attributes to CanvasPreview
// Ported from src/chat/canvas-render.ts:previewFromShortcode
// ---------------------------------------------------------------------------

function defaultCanvasEntryUrl(ref: string): string {
  const encoded = encodeURIComponent(ref.trim());
  return `/__openclaw__/canvas/documents/${encoded}/index.html`;
}

function clampHeight(n: number): number {
  return Math.max(100, Math.min(1200, Math.round(n)));
}

function previewFromShortcode(attrs: Record<string, string>): CanvasPreview | undefined {
  const target = attrs.target?.trim().toLowerCase();
  if (target && target !== "assistant_message") {
    return undefined;
  }
  const title = attrs.title?.trim() || undefined;
  const rawHeight = attrs.height ? Number(attrs.height) : NaN;
  const preferredHeight = Number.isFinite(rawHeight) ? clampHeight(rawHeight) : undefined;
  const ref = attrs.ref?.trim();
  const url = attrs.url?.trim();

  if (url || ref) {
    return {
      type: "canvas",
      kind: "canvas",
      surface: "assistant_message",
      render: "url",
      url: url ?? defaultCanvasEntryUrl(ref),
      ...(ref ? { viewId: ref } : {}),
      ...(title ? { title } : {}),
      ...(preferredHeight ? { preferredHeight } : {}),
    };
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Main export — extract embed shortcodes from text
// Ported from src/chat/canvas-render.ts:extractCanvasShortcodes
// ---------------------------------------------------------------------------

export function extractCanvasShortcodes(text: string | undefined): {
  text: string;
  previews: CanvasPreview[];
} {
  if (!text?.trim() || !text.toLowerCase().includes("[embed")) {
    return { text: text ?? "", previews: [] };
  }

  const fenceSpans = parseFenceSpans(text);
  const matches: Array<{ start: number; end: number; attrs: Record<string, string> }> = [];

  const blockRe = /\[embed\s+([^\]]*?)\]([\s\S]*?)\[\/embed\]/gi;
  const selfClosingRe = /\[embed\s+([^\]]*?)\/\]/gi;

  for (const re of [blockRe, selfClosingRe]) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(text))) {
      const start = match.index ?? 0;
      if (fenceSpans.some((span) => start >= span.start && start < span.end)) {
        continue;
      }
      matches.push({
        start,
        end: start + match[0].length,
        attrs: parseCanvasAttributes(match[1] ?? ""),
      });
    }
  }

  if (matches.length === 0) {
    return { text, previews: [] };
  }

  matches.sort((a, b) => a.start - b.start);

  const previews: CanvasPreview[] = [];
  let cursor = 0;
  let stripped = "";

  for (const match of matches) {
    if (match.start < cursor) {
      continue;
    }
    stripped += text.slice(cursor, match.start);
    const preview = previewFromShortcode(match.attrs);
    if (!preview) {
      stripped += text.slice(match.start, match.end);
    } else {
      previews.push(preview);
    }
    cursor = match.end;
  }

  stripped += text.slice(cursor);

  return {
    text: stripped.replace(/\n{3,}/g, "\n\n").trim(),
    previews,
  };
}
