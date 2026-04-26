import type { ChatBlockPreferences } from "@/stores/chat-preferences";
import { getToolResultBlocks, type ChatMessage } from "@/stores/chat-types";
import { ToolResultCard } from "./blocks/ToolResultCard";
import { ToolUseCard } from "./blocks/ToolUseCard";
import { MarkdownText } from "./MarkdownText";
import { renderTranscriptBlock } from "./transcript-render-registry";

export function TranscriptBlocks({
  message,
  isUser,
  streaming,
  blockPreferences,
}: {
  message: ChatMessage;
  isUser: boolean;
  streaming?: boolean;
  blockPreferences?: ChatBlockPreferences;
}) {
  const toolResultBlocks = getToolResultBlocks(message);
  const consumedToolResults = new Set<string>();
  const textIndices = message.content
    .map((block, index) => (block.type === "text" ? index : -1))
    .filter((index) => index >= 0);
  const lastTextIndex = textIndices.at(-1) ?? -1;

  return (
    <>
      {message.content.map((block, index) => {
        if (block.type === "thinking") {
          if (blockPreferences?.showThinking === false) {
            return null;
          }
          return renderTranscriptBlock(block, `thinking-${index}`);
        }

        if (block.type === "tool_use") {
          if (blockPreferences?.showToolUse === false) {
            return null;
          }
          const result = toolResultBlocks.find((entry) => entry.toolUseId === block.id);
          if (result) {
            consumedToolResults.add(result.toolUseId);
          }
          return (
            <div className="deck-ui-transcript-tool-pair" key={`tool-${block.id}-${index}`}>
              <ToolUseCard name={block.name} input={block.input} defaultOpen={streaming} />
              {result && blockPreferences?.showToolResult !== false && (
                <ToolResultCard
                  content={result.content}
                  isError={result.isError}
                  toolName={block.name}
                  toolInput={block.input}
                />
              )}
            </div>
          );
        }

        if (block.type === "tool_result") {
          if (
            blockPreferences?.showToolResult === false ||
            consumedToolResults.has(block.toolUseId)
          ) {
            return null;
          }
          return (
            <ToolResultCard
              key={`tool-result-${block.toolUseId}-${index}`}
              content={block.content}
              isError={block.isError}
            />
          );
        }

        if (block.type === "text") {
          return (
            <div className="deck-ui-transcript-text" key={`text-${index}`}>
              {isUser ? (
                <p>{block.text}</p>
              ) : (
                <MarkdownText text={block.text} streaming={streaming && index === lastTextIndex} />
              )}
            </div>
          );
        }

        return renderTranscriptBlock(block, `standalone-${index}`);
      })}
    </>
  );
}
