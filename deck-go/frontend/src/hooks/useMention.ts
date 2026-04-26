import { useCallback, useState } from "react";

export interface MentionState {
  showMention: boolean;
  mentionFilter: string;
  handleMentionInput: (value: string, cursorPosition: number) => void;
  selectMention: (agentName: string, inputValue: string) => string;
  closeMention: () => void;
}

export function useMention(): MentionState {
  const [showMention, setShowMention] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [triggerPosition, setTriggerPosition] = useState(-1);

  const handleMentionInput = useCallback((inputValue: string, cursorPosition: number) => {
    const beforeCursor = inputValue.slice(0, cursorPosition);
    const atIndex = beforeCursor.lastIndexOf("@");
    if (atIndex < 0) {
      setShowMention(false);
      return;
    }

    if (atIndex > 0 && beforeCursor[atIndex - 1] !== " " && beforeCursor[atIndex - 1] !== "\n") {
      setShowMention(false);
      return;
    }

    const partial = beforeCursor.slice(atIndex + 1);
    if (partial.includes(" ") || inputValue.startsWith("/")) {
      setShowMention(false);
      return;
    }

    setShowMention(true);
    setMentionFilter(partial);
    setTriggerPosition(atIndex);
  }, []);

  const selectMention = useCallback(
    (agentName: string, inputValue: string) => {
      setShowMention(false);
      if (triggerPosition < 0) {
        return inputValue;
      }

      const before = inputValue.slice(0, triggerPosition);
      const afterTrigger = inputValue.slice(triggerPosition + 1);
      const spaceIndex = afterTrigger.search(/\s/u);
      const after = spaceIndex >= 0 ? afterTrigger.slice(spaceIndex) : "";
      return `${before}@${agentName} ${after}`;
    },
    [triggerPosition],
  );

  const closeMention = useCallback(() => {
    setShowMention(false);
  }, []);

  return {
    showMention,
    mentionFilter,
    handleMentionInput,
    selectMention,
    closeMention,
  };
}
