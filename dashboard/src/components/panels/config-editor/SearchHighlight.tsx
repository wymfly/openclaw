"use client";

import { useMemo } from "react";

interface SearchHighlightProps {
  text: string;
  query: string;
}

/**
 * Highlight search query matches within text using <mark> tags.
 *
 * When query is empty, renders plain text with no <mark> tags.
 * Uses `var(--primary-muted)` background per design spec.
 */
export function SearchHighlight({ text, query }: SearchHighlightProps) {
  const parts = useMemo(() => {
    if (!query) {
      return null;
    }

    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    return text.split(regex);
  }, [text, query]);

  if (!parts) {
    return <>{text}</>;
  }

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            style={{
              backgroundColor: "var(--primary-muted)",
              color: "inherit",
              borderRadius: "2px",
              padding: "0 1px",
            }}
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
