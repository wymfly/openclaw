/**
 * Export current session messages as a downloadable Markdown file.
 */
import { useChatStore } from "@/stores/chat";
import { getTextContent, getToolUseBlocks, getToolResultBlocks } from "@/stores/chat-types";

export function exportSessionAsMarkdown(sessionKey: string): void {
  const state = useChatStore.getState();
  const session = state.sessions.get(sessionKey);
  if (!session) return;

  const lines: string[] = [`# Session Export\n`];

  for (const msg of session.messages) {
    const roleLabel =
      msg.role === "user" ? "User" : msg.role === "assistant" ? "Assistant" : "System";
    lines.push(`## ${roleLabel}\n`);

    const text = getTextContent(msg);
    if (text) lines.push(text + "\n");

    const toolUses = getToolUseBlocks(msg);
    for (const tu of toolUses) {
      lines.push(`### Tool: ${tu.name}\n`);
      lines.push("```json\n" + JSON.stringify(tu.input, null, 2) + "\n```\n");
    }

    const toolResults = getToolResultBlocks(msg);
    for (const tr of toolResults) {
      const content = typeof tr.content === "string" ? tr.content : JSON.stringify(tr.content);
      lines.push(`### Tool Result${tr.isError ? " (Error)" : ""}\n`);
      lines.push("```\n" + content + "\n```\n");
    }

    lines.push("---\n");
  }

  const markdown = lines.join("\n");
  const blob = new Blob([markdown], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `session-${sessionKey.replace(/[^a-zA-Z0-9-]/g, "_")}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
