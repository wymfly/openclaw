/**
 * Shared types for WeCom capability tools.
 * Eliminates `: any` in tool registration callbacks.
 */

export type WecomToolContext = Record<string, unknown> & {
  accountId?: string;
  senderId?: string;
};

export type WecomToolResult = {
  content: Array<{ type: "text"; text: string }>;
  details: Record<string, unknown>;
  isError?: boolean;
};

export function buildToolResult(payload: Record<string, unknown>): WecomToolResult {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

export function buildToolError(action: string | undefined, err: unknown): WecomToolResult {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            ok: false,
            action,
            error: err instanceof Error ? err.message : String(err),
          },
          null,
          2,
        ),
      },
    ],
    details: {},
    isError: true,
  };
}
