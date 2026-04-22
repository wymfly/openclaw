"use client";

import { useCallback, useState } from "react";

export interface MentionState {
  showMention: boolean;
  mentionFilter: string;
  /** Call when the input value changes — detects `@` trigger. */
  handleMentionInput: (value: string, cursorPos: number) => void;
  /** Insert the selected agent name at the trigger position. */
  selectMention: (agentName: string, inputValue: string) => string;
  closeMention: () => void;
}

/**
 * Manages @mention state: detects `@` trigger after whitespace or
 * at the beginning of input, filters agent list, and inserts selection.
 */
export function useMention(): MentionState {
  const [showMention, setShowMention] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [triggerPos, setTriggerPos] = useState(-1);

  const handleMentionInput = useCallback((value: string, cursorPos: number) => {
    // Find the @ trigger: must be at start or after whitespace
    const before = value.slice(0, cursorPos);
    const atIdx = before.lastIndexOf("@");
    if (atIdx < 0) {
      setShowMention(false);
      return;
    }
    // @ must be at position 0 or preceded by whitespace
    if (atIdx > 0 && before[atIdx - 1] !== " " && before[atIdx - 1] !== "\n") {
      setShowMention(false);
      return;
    }
    // No space between @ and cursor (still typing the name)
    const partial = before.slice(atIdx + 1);
    if (partial.includes(" ")) {
      setShowMention(false);
      return;
    }
    // Don't trigger if input starts with / (slash command mode)
    if (value.startsWith("/")) {
      setShowMention(false);
      return;
    }
    setShowMention(true);
    setMentionFilter(partial);
    setTriggerPos(atIdx);
  }, []);

  const selectMention = useCallback(
    (agentName: string, inputValue: string): string => {
      setShowMention(false);
      if (triggerPos < 0) {
        return inputValue;
      }
      // Replace @partial with @agentName + space
      const before = inputValue.slice(0, triggerPos);
      // Find end of the partial mention text
      const afterTrigger = inputValue.slice(triggerPos + 1);
      const spaceIdx = afterTrigger.search(/\s/);
      const after = spaceIdx >= 0 ? afterTrigger.slice(spaceIdx) : "";
      return `${before}@${agentName} ${after}`;
    },
    [triggerPos],
  );

  const closeMention = useCallback(() => setShowMention(false), []);

  return { showMention, mentionFilter, handleMentionInput, selectMention, closeMention };
}
