/**
 * WeCom reasoning visibility control.
 *
 * Ported from vendor/OpenClaw-Wechat/src/wecom/reasoning-visibility.js
 * to TypeScript with strict typing and zero external dependencies.
 */

export type ReasoningMode = "separate" | "append" | "hidden";

export interface ReasoningPolicy {
  mode: ReasoningMode;
  title: string;
  maxChars: number;
  sendThinkingMessage: boolean;
  includeInFinalAnswer: boolean;
}

export interface ReasoningPolicyInput {
  mode?: string;
  title?: string;
  maxChars?: number;
}

export interface ApplyReasoningInput {
  text?: string;
  thinkingContent?: string;
  policy?: ReasoningPolicyInput;
  transport?: string;
  phase?: string;
}

export interface ApplyReasoningResult {
  text: string;
  thinkingContent: string;
  effectiveMode: ReasoningMode;
}

function normalizeReasoningMode(value?: string): ReasoningMode {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (normalized === "append" || normalized === "hidden" || normalized === "separate") {
    return normalized;
  }
  return "separate";
}

function trimReasoningText(value: string, maxChars: number): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "";
  const limit = Math.max(64, Number(maxChars) || 1200);
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

export function normalizeWecomReasoningPolicy(policy?: ReasoningPolicyInput): ReasoningPolicy {
  const title = String(policy?.title ?? "").trim() || "思考过程";
  const mode = normalizeReasoningMode(policy?.mode);
  const maxChars = Math.max(64, Number(policy?.maxChars) || 1200);
  return {
    mode,
    title,
    maxChars,
    sendThinkingMessage: mode === "separate",
    includeInFinalAnswer: mode === "append",
  };
}

export function buildWecomReasoningMergedText(opts?: {
  text?: string;
  thinkingContent?: string;
  title?: string;
}): string {
  const visibleText = String(opts?.text ?? "").trim();
  const reasoning = String(opts?.thinkingContent ?? "").trim();
  if (!reasoning) return visibleText;
  const heading = `${String(opts?.title ?? "").trim() || "思考过程"}：`;
  if (!visibleText) {
    return `${heading}\n${reasoning}`.trim();
  }
  return `${heading}\n${reasoning}\n\n${visibleText}`.trim();
}

export function applyWecomReasoningPolicy(opts?: ApplyReasoningInput): ApplyReasoningResult {
  const normalizedPolicy = normalizeWecomReasoningPolicy(opts?.policy);
  const visibleText = String(opts?.text ?? "").trim();
  const reasoning = trimReasoningText(opts?.thinkingContent ?? "", normalizedPolicy.maxChars);

  if (!reasoning) {
    return {
      text: visibleText,
      thinkingContent: "",
      effectiveMode: normalizedPolicy.mode,
    };
  }

  const transport = String(opts?.transport ?? "")
    .trim()
    .toLowerCase();

  if (opts?.phase === "stream") {
    return {
      text: visibleText,
      thinkingContent: normalizedPolicy.mode === "separate" && transport === "bot" ? reasoning : "",
      effectiveMode:
        normalizedPolicy.mode === "separate" && transport === "bot"
          ? "separate"
          : normalizedPolicy.mode === "hidden"
            ? "hidden"
            : "append",
    };
  }

  if (normalizedPolicy.mode === "hidden") {
    return {
      text: visibleText,
      thinkingContent: "",
      effectiveMode: "hidden",
    };
  }

  if (normalizedPolicy.mode === "append" || transport === "agent") {
    return {
      text: buildWecomReasoningMergedText({
        text: visibleText,
        thinkingContent: reasoning,
        title: normalizedPolicy.title,
      }),
      thinkingContent: "",
      effectiveMode: "append",
    };
  }

  return {
    text: visibleText,
    thinkingContent: reasoning,
    effectiveMode: "separate",
  };
}
