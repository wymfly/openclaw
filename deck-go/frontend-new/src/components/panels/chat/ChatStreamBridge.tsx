import { useChatSSE } from "./useChatSSE";

export function ChatStreamBridge() {
  useChatSSE();
  return null;
}
