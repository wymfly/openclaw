import { Fragment, createElement, type ReactNode } from "react";

type MarkdownRendererProps = {
  content: string;
  className?: string;
  mode?: "static" | "streaming";
};

type MarkdownBlock =
  | { type: "blockquote"; blocks: MarkdownBlock[] }
  | { type: "code"; language: string; value: string }
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; text: string }
  | { type: "hr" }
  | { type: "list"; items: MarkdownListItem[]; ordered: boolean; start: number | null }
  | { type: "paragraph"; text: string }
  | { type: "table"; header: string[]; rows: string[][] };

type MarkdownListItem = {
  blocks: MarkdownBlock[];
};

type ListMarker = {
  ordered: boolean;
  start: number | null;
  text: string;
};

export function MarkdownRenderer({ content, className, mode }: MarkdownRendererProps) {
  return (
    <div className={className} data-markdown-mode={mode}>
      {parseMarkdownBlocks(content).map((block, index) => (
        <Fragment key={index}>{renderBlock(block, `block-${index}`)}</Fragment>
      ))}
    </div>
  );
}

export function MarkdownViewer({ content }: { content: string }) {
  return (
    <div className="ds-artifact-body__markdown">
      <MarkdownRenderer className="deck-ui-markdown" content={content} mode="static" />
    </div>
  );
}

function parseMarkdownBlocks(text: string): MarkdownBlock[] {
  return parseBlocks(text.replace(/\r\n?/g, "\n").split("\n"));
}

function parseBlocks(lines: string[]): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (line.trim() === "") {
      index += 1;
      continue;
    }

    const fencedCode = matchFencedCode(line);
    if (fencedCode) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !matchFencedCode(lines[index] ?? "")) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      blocks.push({
        type: "code",
        language: fencedCode.language,
        value: codeLines.join("\n"),
      });
      continue;
    }

    const blockquote = parseBlockquote(lines, index);
    if (blockquote) {
      blocks.push(blockquote.block);
      index = blockquote.nextIndex;
      continue;
    }

    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length as 1 | 2 | 3 | 4 | 5 | 6,
        text: heading[2],
      });
      index += 1;
      continue;
    }

    if (isHorizontalRule(line)) {
      blocks.push({ type: "hr" });
      index += 1;
      continue;
    }

    const table = parseTable(lines, index);
    if (table) {
      blocks.push(table.block);
      index = table.nextIndex;
      continue;
    }

    const list = parseList(lines, index);
    if (list) {
      blocks.push(list.block);
      index = list.nextIndex;
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const currentLine = lines[index] ?? "";
      if (currentLine.trim() === "") {
        break;
      }
      if (
        paragraphLines.length > 0 &&
        (matchFencedCode(currentLine) ||
          parseBlockquote(lines, index) ||
          isHorizontalRule(currentLine) ||
          parseTable(lines, index) ||
          parseList(lines, index) ||
          currentLine.match(/^\s{0,3}(#{1,6})\s+/))
      ) {
        break;
      }
      paragraphLines.push(currentLine.trim());
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
  }

  return blocks;
}

function parseBlockquote(lines: string[], startIndex: number) {
  const quoteLines: string[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (line.trim() === "") {
      quoteLines.push("");
      index += 1;
      continue;
    }
    const match = line.match(/^\s{0,3}>\s?(.*)$/);
    if (!match) {
      break;
    }
    quoteLines.push(match[1]);
    index += 1;
  }

  if (quoteLines.length === 0) {
    return null;
  }

  return {
    block: { type: "blockquote", blocks: parseBlocks(quoteLines) } as const,
    nextIndex: index,
  };
}

function parseList(lines: string[], startIndex: number) {
  const firstItem = parseListMarker(lines[startIndex] ?? "");
  if (!firstItem) {
    return null;
  }

  const listIndent = countIndent(lines[startIndex] ?? "");
  const items: MarkdownListItem[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (line.trim() === "") {
      break;
    }

    const marker = parseListMarker(line);
    if (!marker || countIndent(line) !== listIndent || marker.ordered !== firstItem.ordered) {
      break;
    }

    const itemLines = marker.text.length > 0 ? [marker.text] : [];
    index += 1;

    while (index < lines.length) {
      const nextLine = lines[index] ?? "";
      if (nextLine.trim() === "") {
        itemLines.push("");
        index += 1;
        continue;
      }

      const nextIndent = countIndent(nextLine);
      const nextMarker = parseListMarker(nextLine);
      if (nextMarker && nextIndent === listIndent) {
        break;
      }
      if (nextIndent <= listIndent) {
        break;
      }

      itemLines.push(nextLine.slice(Math.min(nextIndent, listIndent + 2)));
      index += 1;
    }

    items.push({
      blocks: itemLines.length > 0 ? parseBlocks(itemLines) : [{ type: "paragraph", text: "" }],
    });
  }

  return {
    block: {
      type: "list",
      items,
      ordered: firstItem.ordered,
      start: firstItem.ordered ? firstItem.start : null,
    } as const,
    nextIndex: index,
  };
}

function parseTable(lines: string[], startIndex: number) {
  const headerLine = lines[startIndex] ?? "";
  const separatorLine = lines[startIndex + 1] ?? "";
  if (!isTableRow(headerLine) || !isTableSeparator(separatorLine)) {
    return null;
  }

  const header = splitTableRow(headerLine);
  if (header.length === 0) {
    return null;
  }

  const rows: string[][] = [];
  let index = startIndex + 2;
  while (index < lines.length && isTableRow(lines[index] ?? "")) {
    rows.push(splitTableRow(lines[index] ?? ""));
    index += 1;
  }

  return {
    block: { type: "table", header, rows } as const,
    nextIndex: index,
  };
}

function renderBlock(block: MarkdownBlock, key: string): ReactNode {
  switch (block.type) {
    case "blockquote":
      return (
        <blockquote key={key}>
          {block.blocks.map((child, index) => (
            <Fragment key={`${key}-quote-${index}`}>
              {renderBlock(child, `${key}-quote-${index}`)}
            </Fragment>
          ))}
        </blockquote>
      );
    case "code":
      return (
        <div key={key} className="overflow-x-auto rounded-md">
          <pre data-language={block.language}>
            <code>{block.value}</code>
          </pre>
        </div>
      );
    case "heading":
      return createElement(`h${block.level}`, { key }, renderInline(block.text, `${key}-heading`));
    case "hr":
      return <hr key={key} />;
    case "list":
      return block.ordered ? (
        <ol key={key} start={block.start ?? undefined}>
          {block.items.map((item, index) => (
            <li key={`${key}-item-${index}`}>{renderListItem(item, `${key}-item-${index}`)}</li>
          ))}
        </ol>
      ) : (
        <ul key={key}>
          {block.items.map((item, index) => (
            <li key={`${key}-item-${index}`}>{renderListItem(item, `${key}-item-${index}`)}</li>
          ))}
        </ul>
      );
    case "paragraph":
      return <p key={key}>{renderInline(block.text, `${key}-paragraph`)}</p>;
    case "table":
      return (
        <div key={key} className="overflow-x-auto rounded-md">
          <table>
            <thead>
              <tr>
                {block.header.map((cell, index) => (
                  <th key={`${key}-head-${index}`}>{renderInline(cell, `${key}-head-${index}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={`${key}-row-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={`${key}-row-${rowIndex}-cell-${cellIndex}`}>
                      {renderInline(cell, `${key}-row-${rowIndex}-cell-${cellIndex}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default: {
      const _exhaustive: never = block;
      return _exhaustive;
    }
  }
}

function renderListItem(item: MarkdownListItem, key: string): ReactNode {
  if (
    item.blocks.length === 1 &&
    item.blocks[0]?.type === "paragraph" &&
    !item.blocks[0].text.includes("\n")
  ) {
    return renderInline(item.blocks[0].text, `${key}-inline`);
  }

  return item.blocks.map((block, index) => (
    <Fragment key={`${key}-block-${index}`}>{renderBlock(block, `${key}-block-${index}`)}</Fragment>
  ));
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let index = 0;
  let plainTextStart = 0;
  let tokenIndex = 0;

  const pushPlainText = (endIndex: number) => {
    if (endIndex > plainTextStart) {
      nodes.push(text.slice(plainTextStart, endIndex));
    }
  };

  while (index < text.length) {
    const image = tryParseLinkOrImage(text, index, true);
    if (image) {
      pushPlainText(index);
      const src = safeHref(image.destination);
      if (src) {
        nodes.push(
          <img key={`${keyPrefix}-img-${tokenIndex}`} alt={image.label} loading="lazy" src={src} />,
        );
      } else {
        nodes.push(image.label);
      }
      index = image.nextIndex;
      plainTextStart = index;
      tokenIndex += 1;
      continue;
    }

    const link = tryParseLinkOrImage(text, index, false);
    if (link) {
      pushPlainText(index);
      const href = safeHref(link.destination);
      const children = renderInline(link.label, `${keyPrefix}-link-${tokenIndex}`);
      nodes.push(
        href ? (
          <a key={`${keyPrefix}-link-${tokenIndex}`} href={href}>
            {children}
          </a>
        ) : (
          <Fragment key={`${keyPrefix}-link-${tokenIndex}`}>{children}</Fragment>
        ),
      );
      index = link.nextIndex;
      plainTextStart = index;
      tokenIndex += 1;
      continue;
    }

    const inlineCode = tryParseDelimited(text, index, "`");
    if (inlineCode) {
      pushPlainText(index);
      nodes.push(<code key={`${keyPrefix}-code-${tokenIndex}`}>{inlineCode.content}</code>);
      index = inlineCode.nextIndex;
      plainTextStart = index;
      tokenIndex += 1;
      continue;
    }

    const strong = tryParseStrong(text, index);
    if (strong) {
      pushPlainText(index);
      nodes.push(
        <strong key={`${keyPrefix}-strong-${tokenIndex}`}>
          {renderInline(strong.content, `${keyPrefix}-strong-${tokenIndex}`)}
        </strong>,
      );
      index = strong.nextIndex;
      plainTextStart = index;
      tokenIndex += 1;
      continue;
    }

    const emphasis = tryParseEmphasis(text, index);
    if (emphasis) {
      pushPlainText(index);
      nodes.push(
        <em key={`${keyPrefix}-em-${tokenIndex}`}>
          {renderInline(emphasis.content, `${keyPrefix}-em-${tokenIndex}`)}
        </em>,
      );
      index = emphasis.nextIndex;
      plainTextStart = index;
      tokenIndex += 1;
      continue;
    }

    index += 1;
  }

  pushPlainText(text.length);
  return nodes;
}

function tryParseLinkOrImage(text: string, startIndex: number, image: boolean) {
  const prefix = image ? "![" : "[";
  if (!text.startsWith(prefix, startIndex)) {
    return null;
  }

  const labelStart = startIndex + prefix.length;
  const labelEnd = text.indexOf("]", labelStart);
  if (labelEnd === -1 || text[labelEnd + 1] !== "(") {
    return null;
  }

  const destinationEnd = text.indexOf(")", labelEnd + 2);
  if (destinationEnd === -1) {
    return null;
  }

  return {
    label: text.slice(labelStart, labelEnd),
    destination: text.slice(labelEnd + 2, destinationEnd).trim(),
    nextIndex: destinationEnd + 1,
  };
}

function tryParseDelimited(text: string, startIndex: number, delimiter: string) {
  if (!text.startsWith(delimiter, startIndex)) {
    return null;
  }
  const endIndex = text.indexOf(delimiter, startIndex + delimiter.length);
  if (endIndex === -1) {
    return null;
  }
  return {
    content: text.slice(startIndex + delimiter.length, endIndex),
    nextIndex: endIndex + delimiter.length,
  };
}

function tryParseStrong(text: string, startIndex: number) {
  const delimiter = text.startsWith("**", startIndex)
    ? "**"
    : text.startsWith("__", startIndex)
      ? "__"
      : null;
  if (!delimiter) {
    return null;
  }
  if (!canOpenDelimitedSpan(text, startIndex, delimiter.length)) {
    return null;
  }
  let endIndex = text.indexOf(delimiter, startIndex + delimiter.length);
  while (endIndex !== -1) {
    if (canCloseDelimitedSpan(text, endIndex, delimiter.length)) {
      return {
        content: text.slice(startIndex + delimiter.length, endIndex),
        nextIndex: endIndex + delimiter.length,
      };
    }
    endIndex = text.indexOf(delimiter, endIndex + delimiter.length);
  }
  return null;
}

function tryParseEmphasis(text: string, startIndex: number) {
  const delimiter = text[startIndex];
  if (delimiter !== "*" && delimiter !== "_") {
    return null;
  }
  if (text.startsWith(delimiter.repeat(2), startIndex)) {
    return null;
  }
  if (!canOpenDelimitedSpan(text, startIndex, 1)) {
    return null;
  }
  let endIndex = text.indexOf(delimiter, startIndex + 1);
  while (endIndex !== -1) {
    if (canCloseDelimitedSpan(text, endIndex, 1)) {
      return {
        content: text.slice(startIndex + 1, endIndex),
        nextIndex: endIndex + 1,
      };
    }
    endIndex = text.indexOf(delimiter, endIndex + 1);
  }
  return null;
}

function matchFencedCode(line: string) {
  const match = line.match(/^\s{0,3}```([A-Za-z0-9_-]*)\s*$/);
  if (!match) {
    return null;
  }
  return { language: match[1] ?? "" };
}

function parseListMarker(line: string): ListMarker | null {
  const match = line.match(/^(\s*)([-*]|\d+\.)\s+(.+)$/);
  if (!match) {
    return null;
  }
  const ordered = match[2].endsWith(".");
  return {
    ordered,
    start: ordered ? Number.parseInt(match[2], 10) : null,
    text: match[3],
  };
}

function canOpenDelimitedSpan(text: string, startIndex: number, delimiterLength: number): boolean {
  const previousChar = text[startIndex - 1] ?? "";
  const nextChar = text[startIndex + delimiterLength] ?? "";
  return !isWhitespace(nextChar) && !isWordChar(previousChar);
}

function canCloseDelimitedSpan(text: string, startIndex: number, delimiterLength: number): boolean {
  const previousChar = text[startIndex - 1] ?? "";
  const nextChar = text[startIndex + delimiterLength] ?? "";
  return !isWhitespace(previousChar) && !isWordChar(nextChar);
}

function isWhitespace(value: string): boolean {
  return value.length > 0 && /\s/.test(value);
}

function isWordChar(value: string): boolean {
  return value.length > 0 && /[A-Za-z0-9]/.test(value);
}

function countIndent(line: string): number {
  const match = line.match(/^\s*/);
  return match?.[0].length ?? 0;
}

function isHorizontalRule(line: string): boolean {
  const trimmed = line.trim();
  return /^([-*_])(?:\s*\1){2,}$/.test(trimmed);
}

function isTableRow(line: string): boolean {
  if (!line.includes("|")) {
    return false;
  }
  const cells = splitTableRow(line);
  return cells.length > 1;
}

function isTableSeparator(line: string): boolean {
  const cells = splitTableRow(line);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
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
