import type { SendMsgBody, WSClient } from "@wecom/aibot-node-sdk";

function readCompatErrorText(error: unknown): string {
  if (error instanceof Error) {
    return error.message.toLowerCase();
  }
  if (error && typeof error === "object") {
    const err = error as { errmsg?: unknown; message?: unknown };
    if (typeof err.errmsg === "string") {
      return err.errmsg.toLowerCase();
    }
    if (typeof err.message === "string") {
      return err.message.toLowerCase();
    }
  }
  return "";
}

function isMarkdownCompatError(error: unknown): boolean {
  const text = readCompatErrorText(error);
  if (text.includes("markdown_v2")) {
    return true;
  }
  const mentionsMarkdown = text.includes("markdown");
  const mentionsCompat =
    text.includes("unsupported") ||
    text.includes("not support") ||
    text.includes("invalid") ||
    text.includes("msgtype") ||
    text.includes("message type");
  return mentionsMarkdown && mentionsCompat;
}

export async function sendBotWsMarkdown(params: {
  client: Pick<WSClient, "sendMessage">;
  chatId: string;
  content: string;
}): Promise<void> {
  try {
    await params.client.sendMessage(params.chatId, {
      msgtype: "markdown_v2",
      markdown_v2: { content: params.content },
    } as unknown as SendMsgBody);
  } catch (error) {
    if (!isMarkdownCompatError(error)) {
      throw error;
    }
    await params.client.sendMessage(params.chatId, {
      msgtype: "markdown",
      markdown: { content: params.content },
    });
  }
}
