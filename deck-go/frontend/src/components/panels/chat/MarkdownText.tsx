import { createElement, Fragment, type ReactNode } from "react";

export function MarkdownText({ text, streaming }: { text: string; streaming?: boolean }) {
  return (
    <div className="deck-ui-markdown" data-markdown-mode={streaming ? "streaming" : "static"}>
      {renderBlocks(text).map((block, index) => (
        <Fragment key={index}>{block}</Fragment>
      ))}
    </div>
  );
}

function renderBlocks(text: string): ReactNode[] {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let codeFence: { language: string; lines: string[] } | null = null;
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) {
      return;
    }
    const value = paragraph.join("\n");
    paragraph = [];
    blocks.push(<p>{renderInline(value)}</p>);
  };
  const flushList = () => {
    if (!list) {
      return;
    }
    const items = list.items.map((item, index) => <li key={index}>{renderInline(item)}</li>);
    blocks.push(list.ordered ? <ol>{items}</ol> : <ul>{items}</ul>);
    list = null;
  };

  for (const line of lines) {
    const fenceMatch = line.match(/^```([A-Za-z0-9_-]*)\s*$/);
    if (fenceMatch) {
      if (codeFence) {
        blocks.push(
          <pre data-language={codeFence.language}>
            <code>{codeFence.lines.join("\n")}</code>
          </pre>,
        );
        codeFence = null;
      } else {
        flushParagraph();
        flushList();
        codeFence = { language: fenceMatch[1] ?? "", lines: [] };
      }
      continue;
    }

    if (codeFence) {
      codeFence.lines.push(line);
      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const tagName = `h${headingMatch[1].length}`;
      blocks.push(createElement(tagName, null, renderInline(headingMatch[2])));
      continue;
    }

    const listMatch = line.match(/^(\d+\.|[-*])\s+(.+)$/);
    if (listMatch) {
      flushParagraph();
      const ordered = listMatch[1].endsWith(".");
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push(listMatch[2]);
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  if (codeFence) {
    blocks.push(
      <pre data-language={codeFence.language}>
        <code>{codeFence.lines.join("\n")}</code>
      </pre>,
    );
  }
  flushList();
  flushParagraph();

  return blocks;
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\[([^\]]+)\]\(([^)\s]+)\)|`([^`]+)`|\*\*([^*]+)\*\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[2] !== undefined && match[3] !== undefined) {
      const href = safeHref(match[3]);
      nodes.push(
        href ? (
          <a key={`link-${match.index}`} href={href}>
            {match[2]}
          </a>
        ) : (
          match[2]
        ),
      );
    } else if (match[4] !== undefined) {
      nodes.push(<code key={`code-${match.index}`}>{match[4]}</code>);
    } else if (match[5] !== undefined) {
      nodes.push(<strong key={`strong-${match.index}`}>{match[5]}</strong>);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function safeHref(value: string): string | null {
  if (
    value.startsWith("https://") ||
    value.startsWith("http://") ||
    value.startsWith("mailto:") ||
    value.startsWith("/") ||
    value.startsWith("#")
  ) {
    return value;
  }

  return null;
}
