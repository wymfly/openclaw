import type { ResolvedAgentAccount } from "../../types/index.js";
import {
  downloadMedia as downloadLegacyMedia,
  getAccessToken as getLegacyAccessToken,
  sendMedia as sendLegacyMedia,
  sendText as sendLegacyText,
} from "./core.js";

export async function getAgentApiAccessToken(agent: ResolvedAgentAccount): Promise<string> {
  return getLegacyAccessToken(agent);
}

export async function sendAgentApiText(params: {
  agent: ResolvedAgentAccount;
  toUser?: string;
  toParty?: string;
  toTag?: string;
  chatId?: string;
  text: string;
}): Promise<void> {
  await sendLegacyText(params);
}

export async function sendAgentApiMedia(params: {
  agent: ResolvedAgentAccount;
  toUser?: string;
  toParty?: string;
  toTag?: string;
  chatId?: string;
  mediaId: string;
  mediaType: "image" | "voice" | "video" | "file";
  title?: string;
  description?: string;
}): Promise<void> {
  await sendLegacyMedia(params);
}

export async function downloadAgentApiMedia(params: {
  agent: ResolvedAgentAccount;
  mediaId: string;
  maxBytes?: number;
}): Promise<{ buffer: Buffer; contentType: string; filename?: string }> {
  return downloadLegacyMedia(params);
}
