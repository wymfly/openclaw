"use client";

import type { ReactNode } from "react";
import { Streamdown } from "streamdown";
import type { ChatBlockPreferences } from "@/stores/chat-preferences";
import {
  getTextContent,
  getThinkingContent,
  getToolResultBlocks,
  getToolUseBlocks,
  type ChatMessage,
} from "@/stores/chat-types";
import { ToolResultCard } from "./blocks/ToolResultCard";
import { ToolUseCard } from "./blocks/ToolUseCard";
import { renderTranscriptBlock } from "./transcript-render-registry";

function CollapsedBlock({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <details className="my-1.5">
      <summary className="cursor-pointer text-[10px] px-2 py-1 rounded-md bg-[var(--muted)] text-[var(--muted-foreground)]">
        {label} ({count})
      </summary>
      <div className="mt-1">{children}</div>
    </details>
  );
}

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
  const textContent = getTextContent(message);
  const thinkingContent = getThinkingContent(message);
  const toolUseBlocks = getToolUseBlocks(message);
  const toolResultBlocks = getToolResultBlocks(message);
  const standaloneBlocks = message.content.filter((block) => {
    if (block.type === "text" || block.type === "thinking" || block.type === "tool_use") {
      return false;
    }
    if (block.type === "tool_result") {
      return !toolUseBlocks.some((toolUse) => toolUse.id === block.toolUseId);
    }
    return true;
  });

  return (
    <>
      {thinkingContent &&
        (blockPreferences?.showThinking === false ? (
          <CollapsedBlock label="Thinking" count={1}>
            {renderTranscriptBlock({ type: "thinking", text: thinkingContent }, "thinking")}
          </CollapsedBlock>
        ) : (
          renderTranscriptBlock({ type: "thinking", text: thinkingContent }, "thinking")
        ))}

      {toolUseBlocks.length > 0 &&
        (blockPreferences?.showToolUse === false ? (
          <CollapsedBlock label="Tools" count={toolUseBlocks.length}>
            {toolUseBlocks.map((toolUse) => {
              const result = toolResultBlocks.find((entry) => entry.toolUseId === toolUse.id);
              return (
                <div key={toolUse.id} className="flex flex-col gap-2">
                  <ToolUseCard name={toolUse.name} input={toolUse.input} defaultOpen={streaming} />
                  {result && (
                    <ToolResultCard
                      content={result.content}
                      isError={result.isError}
                      toolName={toolUse.name}
                      toolInput={toolUse.input}
                    />
                  )}
                </div>
              );
            })}
          </CollapsedBlock>
        ) : (
          toolUseBlocks.map((toolUse) => {
            const result = toolResultBlocks.find((entry) => entry.toolUseId === toolUse.id);
            return (
              <div key={toolUse.id} className="flex flex-col gap-2">
                <ToolUseCard name={toolUse.name} input={toolUse.input} defaultOpen={streaming} />
                {result && (
                  <ToolResultCard
                    content={result.content}
                    isError={result.isError}
                    toolName={toolUse.name}
                    toolInput={toolUse.input}
                  />
                )}
              </div>
            );
          })
        ))}

      {standaloneBlocks.map((block, index) => renderTranscriptBlock(block, `standalone-${index}`))}

      {textContent && (
        <div
          className={`rounded-lg text-sm ${isUser ? "px-3 py-2" : "px-4 py-3"}`}
          style={{
            backgroundColor: isUser ? "var(--primary)" : "var(--card)",
            color: isUser ? "var(--primary-foreground)" : "var(--foreground)",
          }}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{textContent}</p>
          ) : (
            <div className="chat-prose max-w-none text-sm">
              <Streamdown mode={streaming ? "streaming" : "static"} className="streamdown-chat">
                {textContent}
              </Streamdown>
            </div>
          )}
        </div>
      )}
    </>
  );
}
