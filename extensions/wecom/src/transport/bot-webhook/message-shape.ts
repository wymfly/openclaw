import type {
  WecomBotInboundMessage as WecomInboundMessage,
  WecomInboundQuote,
} from "../../types/index.js";

export type BotInboundProcessDecision = {
  shouldProcess: boolean;
  reason: string;
  senderUserId?: string;
  chatId?: string;
};

export function resolveWecomSenderUserId(msg: WecomInboundMessage): string | undefined {
  const direct = msg.from?.userid?.trim();
  if (direct) return direct;
  const msgRecord = msg as unknown as Record<string, unknown>;
  const legacy = String(
    msgRecord.fromuserid ?? msgRecord.from_userid ?? msgRecord.fromUserId ?? "",
  ).trim();
  return legacy || undefined;
}

export function shouldProcessBotInboundMessage(
  msg: WecomInboundMessage,
): BotInboundProcessDecision {
  const senderUserId = resolveWecomSenderUserId(msg)?.trim();
  if (!senderUserId) {
    return { shouldProcess: false, reason: "missing_sender" };
  }
  if (senderUserId.toLowerCase() === "sys") {
    return { shouldProcess: false, reason: "system_sender" };
  }

  const chatType = String(msg.chattype ?? "")
    .trim()
    .toLowerCase();
  if (chatType === "group") {
    const chatId = msg.chatid?.trim();
    if (!chatId) {
      return { shouldProcess: false, reason: "missing_chatid", senderUserId };
    }
    return { shouldProcess: true, reason: "user_message", senderUserId, chatId };
  }

  return { shouldProcess: true, reason: "user_message", senderUserId, chatId: senderUserId };
}

function formatQuote(quote: WecomInboundQuote): string {
  const type = quote.msgtype ?? "";
  if (type === "text") return quote.text?.content || "";
  if (type === "image") return `[引用: 图片] ${quote.image?.url || ""}`;
  if (type === "mixed" && quote.mixed?.msg_item) {
    const items = quote.mixed.msg_item
      .map((item) => {
        if (item.msgtype === "text") return item.text?.content;
        if (item.msgtype === "image") return `[图片] ${item.image?.url || ""}`;
        return "";
      })
      .filter(Boolean)
      .join(" ");
    return `[引用: 图文] ${items}`;
  }
  if (type === "voice") return `[引用: 语音] ${quote.voice?.content || ""}`;
  if (type === "file") return `[引用: 文件] ${quote.file?.url || ""}`;
  return "";
}

export function buildInboundBody(msg: WecomInboundMessage): string {
  let body = "";
  const msgtype = String(msg.msgtype ?? "").toLowerCase();
  const m = msg as unknown as Record<string, Record<string, unknown> | undefined>;

  if (msgtype === "text") body = (m.text?.content as string) || "";
  else if (msgtype === "voice") body = (m.voice?.content as string) || "[voice]";
  else if (msgtype === "mixed") {
    const items = (m.mixed?.msg_item as unknown[]) ?? undefined;
    if (Array.isArray(items)) {
      body = items
        .map((rawItem) => {
          const item = rawItem as Record<string, unknown>;
          const t = String(item?.msgtype ?? "").toLowerCase();
          if (t === "text") return (item?.text as Record<string, unknown>)?.content || "";
          if (t === "image")
            return `[image] ${(item?.image as Record<string, unknown>)?.url || ""}`;
          return `[${t || "item"}]`;
        })
        .filter(Boolean)
        .join("\n");
    } else body = "[mixed]";
  } else if (msgtype === "image") body = `[image] ${(m.image?.url as string) || ""}`;
  else if (msgtype === "file") body = `[file] ${(m.file?.url as string) || ""}`;
  else if (msgtype === "event") body = `[event] ${(m.event?.eventtype as string) || ""}`;
  else if (msgtype === "stream") body = `[stream_refresh] ${(m.stream?.id as string) || ""}`;
  else body = msgtype ? `[${msgtype}]` : "";

  const quote = m.quote as WecomInboundQuote | undefined;
  if (quote) {
    const quoteText = formatQuote(quote).trim();
    if (quoteText) body += `\n\n> ${quoteText}`;
  }
  return body;
}
