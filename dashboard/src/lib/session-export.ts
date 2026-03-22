import type { SessionEntry, HistoryMessage } from "@/stores/sessions";

/**
 * Export session data as formatted JSON string.
 */
export function exportAsJson(session: SessionEntry, messages: HistoryMessage[]): string {
  return JSON.stringify(
    {
      session: {
        key: session.key,
        kind: session.kind,
        model: session.model,
        tokensIn: session.tokensIn,
        tokensOut: session.tokensOut,
        contextWindow: session.contextWindow,
        compactionCount: session.compactionCount,
        updatedAt: session.updatedAt,
      },
      messages,
      exportedAt: new Date().toISOString(),
    },
    null,
    2,
  );
}

/**
 * Export session data as Markdown string.
 */
export function exportAsMarkdown(session: SessionEntry, messages: HistoryMessage[]): string {
  const lines: string[] = [];

  lines.push(`# Session: ${session.key}`);
  lines.push("");
  lines.push("## Metadata");
  lines.push("");
  lines.push(`- **Model:** ${session.model}`);
  lines.push(`- **Kind:** ${session.kind}`);
  lines.push(`- **Tokens In:** ${session.tokensIn}`);
  lines.push(`- **Tokens Out:** ${session.tokensOut}`);
  lines.push(`- **Context Window:** ${session.contextWindow}`);
  lines.push(`- **Compaction Count:** ${session.compactionCount}`);
  lines.push(`- **Last Updated:** ${new Date(session.updatedAt).toISOString()}`);
  lines.push("");

  if (messages.length > 0) {
    lines.push("## Messages");
    lines.push("");

    for (const msg of messages) {
      const label =
        msg.role === "user" ? "User" : msg.role === "assistant" ? "Assistant" : "System";
      lines.push(`**${label}:**`);
      lines.push("");
      lines.push(msg.content);
      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * Trigger a browser file download from in-memory content.
 */
export function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // Delay revoke to ensure download completes
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
