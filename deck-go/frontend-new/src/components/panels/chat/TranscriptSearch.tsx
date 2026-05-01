import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { ChevronDownIcon, ChevronUpIcon, SearchIcon, XIcon } from "@/deck-ui/icons";
import { IconButton } from "@/design-system/atoms/IconButton";
import { Input } from "@/design-system/atoms/Input";
import type { ChatMessage, ContentBlock } from "@/stores/chat-types";
import "./chat-widgets.css";

function blockSearchText(block: ContentBlock): string {
  switch (block.type) {
    case "text":
    case "thinking":
      return block.text;
    case "tool_use":
      return `${block.name} ${JSON.stringify(block.input)}`;
    case "tool_result":
      return typeof block.content === "string"
        ? block.content
        : block.content.map(blockSearchText).join(" ");
    case "image":
    case "file":
      return [block.fileName, block.mimeType].filter(Boolean).join(" ");
    case "canvas":
      return [block.title, block.url, block.viewId].filter(Boolean).join(" ");
    case "unknown":
      return `${block.rawType} ${JSON.stringify(block.summary)}`;
    default:
      return "";
  }
}

export function extractTranscriptSearchText(message: ChatMessage): string {
  return [message.id, message.role, ...message.content.map(blockSearchText)].join(" ");
}

export function messageMatchesTranscriptSearch(message: ChatMessage, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return extractTranscriptSearchText(message).toLowerCase().includes(normalized);
}

export function TranscriptSearch({
  messages,
  query,
  onQueryChange,
  inputRef,
  onClose,
}: {
  messages: ChatMessage[];
  query: string;
  onQueryChange: (query: string) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  onClose?: () => void;
}) {
  const t = useTranslations("chat");
  const [currentIdx, setCurrentIdx] = useState(0);
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const resolvedInputRef = inputRef ?? fallbackInputRef;

  const matches = useMemo(() => {
    const normalized = query.trim();
    if (!normalized) {
      return [];
    }
    return messages
      .map((message, messageIdx) => ({
        messageIdx,
        matches: messageMatchesTranscriptSearch(message, normalized),
      }))
      .filter((match) => match.matches);
  }, [messages, query]);

  useEffect(() => {
    setCurrentIdx(0);
  }, [query]);

  useEffect(() => {
    if (matches.length === 0) {
      return;
    }
    if (currentIdx >= matches.length) {
      setCurrentIdx(0);
      return;
    }
    const match = matches[currentIdx];
    const el = document.querySelector(`[data-message-idx="${match.messageIdx}"]`);
    el?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }, [currentIdx, matches]);

  const navigate = (direction: 1 | -1) => {
    if (matches.length === 0) {
      return;
    }
    setCurrentIdx((prev) => (prev + direction + matches.length) % matches.length);
  };

  return (
    <div className="ds-transcript-search" role="search">
      <SearchIcon className="ds-transcript-search__icon" />
      <label className="ds-transcript-search__field">
        <span>{t("searchTranscript")}</span>
        <Input
          ref={resolvedInputRef}
          inputSize="sm"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              if (query.trim()) {
                onQueryChange("");
              } else {
                onClose?.();
              }
            }
            if (event.key === "Enter") {
              navigate(event.shiftKey ? -1 : 1);
            }
          }}
          placeholder={t("searchTranscript")}
        />
      </label>
      <div className="ds-transcript-search__controls">
        {query.trim() ? (
          <span className="ds-transcript-search__count">
            {matches.length > 0
              ? `${Math.min(currentIdx + 1, matches.length)}/${matches.length}`
              : t("noSearchResults")}
          </span>
        ) : null}
        <IconButton
          size="sm"
          aria-label={t("searchPrev")}
          disabled={matches.length === 0}
          title={t("searchPrev")}
          onClick={() => navigate(-1)}
        >
          <ChevronUpIcon />
        </IconButton>
        <IconButton
          size="sm"
          aria-label={t("searchNext")}
          disabled={matches.length === 0}
          title={t("searchNext")}
          onClick={() => navigate(1)}
        >
          <ChevronDownIcon />
        </IconButton>
        <IconButton
          size="sm"
          aria-label={t("searchClose")}
          title={t("searchClose")}
          onClick={onClose}
        >
          <XIcon />
        </IconButton>
      </div>
    </div>
  );
}
