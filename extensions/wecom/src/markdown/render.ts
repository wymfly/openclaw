const WECOM_MARKDOWN_MAX_BYTES = 2048;

export const WECOM_MARKDOWN_DEFAULT_BYTES = 1900;

function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function resolveLimit(maxBytes?: number): number {
  if (typeof maxBytes !== "number" || !Number.isFinite(maxBytes) || maxBytes <= 0) {
    return WECOM_MARKDOWN_DEFAULT_BYTES;
  }
  return Math.max(1, Math.min(Math.floor(maxBytes), WECOM_MARKDOWN_MAX_BYTES));
}

export function renderWecomMarkdownText(raw: string): string {
  const lines = raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => {
      if (/^\s*(?:`{3,}|~{3,})/.test(line)) {
        return "";
      }
      let out = line;
      while (/^\s*>\s?/.test(out)) {
        out = out.replace(/^(\s*)>\s?/, "$1");
      }
      return out;
    });

  return lines
    .join("\n")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/`+/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitByBytes(text: string, limit: number): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const char of Array.from(text)) {
    const next = current ? `${current}${char}` : char;
    if (byteLength(next) <= limit) {
      current = next;
      continue;
    }
    if (current) {
      chunks.push(current);
    }
    current = char;
  }

  if (current) {
    chunks.push(current);
  }
  return chunks;
}

function splitBlockByBytes(block: string, limit: number): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const line of block.split("\n")) {
    const next = current ? `${current}\n${line}` : line;
    if (byteLength(next) <= limit) {
      current = next;
      continue;
    }

    if (current) {
      chunks.push(current);
      current = "";
    }

    if (byteLength(line) <= limit) {
      current = line;
    } else {
      chunks.push(...splitByBytes(line, limit));
    }
  }

  if (current) {
    chunks.push(current);
  }
  return chunks;
}

export function chunkWecomMarkdownText(
  raw: string,
  opts?: {
    maxBytes?: number;
  },
): string[] {
  const limit = resolveLimit(opts?.maxBytes);
  const rendered = renderWecomMarkdownText(raw);
  if (!rendered) {
    return [];
  }
  if (byteLength(rendered) <= limit) {
    return [rendered];
  }

  const chunks: string[] = [];
  let current = "";

  for (const block of rendered.split(/\n{2,}/)) {
    if (!block.trim()) {
      continue;
    }
    const next = current ? `${current}\n\n${block}` : block;
    if (byteLength(next) <= limit) {
      current = next;
      continue;
    }

    if (current) {
      chunks.push(current);
      current = "";
    }

    if (byteLength(block) <= limit) {
      current = block;
    } else {
      chunks.push(...splitBlockByBytes(block, limit));
    }
  }

  if (current) {
    chunks.push(current);
  }
  return chunks;
}
