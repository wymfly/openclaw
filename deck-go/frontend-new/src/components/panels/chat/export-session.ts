import { useChatStore } from "@/stores/chat";
import { getTextContent, getToolResultBlocks, getToolUseBlocks } from "@/stores/chat-types";

export function buildSessionMarkdown(sessionKey: string): string | null {
  const session = useChatStore.getState().sessions.get(sessionKey);
  if (!session) {
    return null;
  }

  const lines = ["# Session Export", ""];
  for (const message of session.messages) {
    const roleLabel =
      message.role === "user" ? "User" : message.role === "assistant" ? "Assistant" : "System";
    lines.push(`## ${roleLabel}`, "");

    const text = getTextContent(message);
    if (text) {
      lines.push(text, "");
    }

    for (const toolUse of getToolUseBlocks(message)) {
      lines.push(`### Tool: ${toolUse.name}`, "");
      lines.push("```json", JSON.stringify(toolUse.input, null, 2), "```", "");
    }

    for (const toolResult of getToolResultBlocks(message)) {
      const content =
        typeof toolResult.content === "string"
          ? toolResult.content
          : JSON.stringify(toolResult.content, null, 2);
      lines.push(`### Tool Result${toolResult.isError ? " (Error)" : ""}`, "");
      lines.push("```", content, "```", "");
    }

    lines.push("---", "");
  }

  return lines.join("\n");
}

export function exportSessionAsMarkdown(sessionKey: string): boolean {
  const markdown = buildSessionMarkdown(sessionKey);
  if (!markdown) {
    return false;
  }

  const blob = new Blob([markdown], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `session-${sessionKey.replace(/[^a-zA-Z0-9-]/g, "_")}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
}
