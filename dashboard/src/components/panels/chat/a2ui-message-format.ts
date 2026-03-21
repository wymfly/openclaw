/**
 * A2UI agent message formatting utilities.
 * Ported from OpenClawCanvasA2UIAction (Swift/Kotlin) for Deck parity.
 */

export function sanitizeTagValue(value: string): string {
  const trimmed = value.trim() || "-";
  return trimmed.replace(/ /g, "_").replace(/[^a-zA-Z0-9_\-.:]/g, "_");
}

export function extractActionName(userAction: Record<string, unknown>): string | null {
  for (const key of ["name", "action"]) {
    const val = typeof userAction[key] === "string" ? userAction[key].trim() : "";
    if (val) {
      return val;
    }
  }
  return null;
}

export function formatA2UIAgentMessage(opts: {
  actionName: string;
  sessionKey: string;
  surfaceId: string;
  sourceComponentId: string;
  contextJson?: string;
}): string {
  const ctx = opts.contextJson ? ` ctx=${opts.contextJson}` : "";
  return [
    "CANVAS_A2UI",
    `action=${sanitizeTagValue(opts.actionName)}`,
    `session=${sanitizeTagValue(opts.sessionKey)}`,
    `surface=${sanitizeTagValue(opts.surfaceId)}`,
    `component=${sanitizeTagValue(opts.sourceComponentId)}`,
    "host=Deck",
    `instance=deck${ctx}`,
    "default=update_canvas",
  ].join(" ");
}

/** Extract the A2UI action type from a Gateway broadcast payload. */
export function extractA2UIActionType(payload: Record<string, unknown>): string {
  for (const key of ["surfaceUpdate", "beginRendering", "dataModelUpdate", "deleteSurface"]) {
    if (key in payload) {
      return key;
    }
  }
  return "unknown";
}

/** Generate a human-readable summary of an A2UI event payload. */
export function summarizeA2UIEvent(payload: Record<string, unknown>): string {
  const action = extractA2UIActionType(payload);
  if (action === "surfaceUpdate") {
    const update = payload.surfaceUpdate as Record<string, unknown> | undefined;
    const surfaceId = (update?.surfaceId as string) ?? "?";
    const components = Array.isArray(update?.components) ? update.components.length : 0;
    return `surface=${surfaceId}, ${components} components`;
  }
  if (action === "beginRendering") {
    const data = payload.beginRendering as Record<string, unknown> | undefined;
    return `surface=${(data?.surfaceId as string) ?? "?"}, root=${(data?.root as string) ?? "?"}`;
  }
  if (action === "deleteSurface") {
    const data = payload.deleteSurface as Record<string, unknown> | undefined;
    return `surface=${(data?.surfaceId as string) ?? "?"}`;
  }
  return JSON.stringify(payload).slice(0, 80);
}
