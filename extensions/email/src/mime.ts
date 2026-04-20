import { normalizeOptionalString } from "openclaw/plugin-sdk/text-runtime";

export type ParsedEmailAttachment = {
  filename: string;
  contentType: string;
  disposition: string;
  contentId?: string;
  size: number;
  content: Buffer;
};

export type ParsedEmailMessage = {
  headers: Record<string, string>;
  subject?: string;
  from?: string;
  date?: string;
  messageId?: string;
  textBody?: string;
  htmlBody?: string;
  preview?: string;
  attachments: ParsedEmailAttachment[];
};

export function parseRfc822Headers(raw: string): Record<string, string> {
  const normalized = raw.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const unfolded: string[] = [];
  for (const line of lines) {
    if (/^[ \t]/.test(line) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] = `${unfolded[unfolded.length - 1]} ${line.trim()}`;
      continue;
    }
    unfolded.push(line);
  }
  const headers: Record<string, string> = {};
  for (const line of unfolded) {
    const separator = line.indexOf(":");
    if (separator <= 0) {
      continue;
    }
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (!key) {
      continue;
    }
    headers[key] = headers[key] ? `${headers[key]}, ${value}` : value;
  }
  return headers;
}

export function parseMimeMessage(raw: Buffer): ParsedEmailMessage {
  const { headers, body } = splitEntity(raw);
  const attachments: ParsedEmailAttachment[] = [];
  const textParts: string[] = [];
  const htmlParts: string[] = [];
  walkEntity(headers, body, { attachments, textParts, htmlParts });
  const textBody = normalizeOptionalString(textParts.join("\n\n"));
  const htmlBody = normalizeOptionalString(htmlParts.join("\n\n"));
  const previewSource = textBody ?? (htmlBody ? stripHtml(htmlBody) : undefined);
  return {
    headers,
    subject: headers.subject,
    from: headers.from,
    date: headers.date,
    messageId: headers["message-id"],
    textBody,
    htmlBody,
    preview: truncatePreview(previewSource),
    attachments,
  };
}

function walkEntity(
  headers: Record<string, string>,
  body: Buffer,
  collector: {
    attachments: ParsedEmailAttachment[];
    textParts: string[];
    htmlParts: string[];
  },
): void {
  const contentType = normalizeOptionalString(headers["content-type"]) ?? "text/plain";
  const transferEncoding = normalizeOptionalString(headers["content-transfer-encoding"]) ?? "";
  const disposition = normalizeOptionalString(headers["content-disposition"]) ?? "";
  const boundary = getMimeParameter(contentType, "boundary");
  const mediaType = contentType.split(";")[0]?.trim().toLowerCase() ?? "text/plain";

  if (mediaType.startsWith("multipart/") && boundary) {
    for (const part of splitMultipartBody(body, boundary)) {
      const { headers: partHeaders, body: partBody } = splitEntity(part);
      walkEntity(partHeaders, partBody, collector);
    }
    return;
  }

  const decoded = decodeTransferEncoding(body, transferEncoding);
  const filename =
    getMimeParameter(disposition, "filename") ?? getMimeParameter(contentType, "name") ?? undefined;
  const contentId = normalizeOptionalString(headers["content-id"])?.replace(/^<|>$/g, "");
  const looksLikeAttachment =
    disposition.toLowerCase().includes("attachment") ||
    Boolean(filename) ||
    mediaType === "application/octet-stream";

  if (looksLikeAttachment) {
    collector.attachments.push({
      filename: filename ?? "attachment.bin",
      contentType: mediaType,
      disposition: disposition || "attachment",
      contentId,
      size: decoded.length,
      content: decoded,
    });
    return;
  }

  if (mediaType === "text/plain") {
    collector.textParts.push(decodeText(decoded, getMimeParameter(contentType, "charset")));
    return;
  }

  if (mediaType === "text/html") {
    collector.htmlParts.push(decodeText(decoded, getMimeParameter(contentType, "charset")));
  }
}

function splitEntity(raw: Buffer): { headers: Record<string, string>; body: Buffer } {
  const separator = findHeaderBodySeparator(raw);
  if (separator < 0) {
    return {
      headers: {},
      body: raw,
    };
  }
  const headerText = raw.subarray(0, separator).toString("utf8");
  const bodyStart = raw[separator] === 13 ? separator + 4 : separator + 2;
  return {
    headers: parseRfc822Headers(headerText),
    body: raw.subarray(bodyStart),
  };
}

function findHeaderBodySeparator(raw: Buffer): number {
  for (let index = 0; index < raw.length - 3; index += 1) {
    if (
      raw[index] === 13 &&
      raw[index + 1] === 10 &&
      raw[index + 2] === 13 &&
      raw[index + 3] === 10
    ) {
      return index;
    }
  }
  for (let index = 0; index < raw.length - 1; index += 1) {
    if (raw[index] === 10 && raw[index + 1] === 10) {
      return index;
    }
  }
  return -1;
}

function getMimeParameter(headerValue: string | undefined, name: string): string | undefined {
  const raw = normalizeOptionalString(headerValue);
  if (!raw) {
    return undefined;
  }
  const direct = raw.match(new RegExp(`${name}\\*?=(?:"([^"]+)"|([^;]+))`, "i"));
  if (!direct) {
    return undefined;
  }
  const value = normalizeOptionalString(direct[1] ?? direct[2]);
  if (!value) {
    return undefined;
  }
  if (value.includes("''")) {
    return decodeURIComponentSafe(value.split("''").slice(1).join("''"));
  }
  return value;
}

function splitMultipartBody(body: Buffer, boundary: string): Buffer[] {
  const marker = `--${boundary}`;
  const raw = body.toString("latin1");
  const segments = raw.split(marker);
  const parts: Buffer[] = [];
  for (const segment of segments.slice(1)) {
    if (segment.startsWith("--")) {
      break;
    }
    const trimmed = segment.replace(/^\r?\n/, "").replace(/\r?\n$/, "");
    if (!trimmed) {
      continue;
    }
    parts.push(Buffer.from(trimmed, "latin1"));
  }
  return parts;
}

function decodeTransferEncoding(body: Buffer, transferEncoding: string): Buffer {
  const normalized = transferEncoding.trim().toLowerCase();
  if (normalized === "base64") {
    return Buffer.from(body.toString("latin1").replace(/\s+/g, ""), "base64");
  }
  if (normalized === "quoted-printable") {
    return decodeQuotedPrintable(body);
  }
  return body;
}

function decodeQuotedPrintable(body: Buffer): Buffer {
  const input = body.toString("latin1").replace(/=\r?\n/g, "");
  const bytes: number[] = [];
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === "=" && /^[0-9A-Fa-f]{2}$/.test(input.slice(index + 1, index + 3))) {
      bytes.push(Number.parseInt(input.slice(index + 1, index + 3), 16));
      index += 2;
      continue;
    }
    bytes.push(char.charCodeAt(0));
  }
  return Buffer.from(bytes);
}

function decodeText(content: Buffer, charset: string | undefined): string {
  const normalizedCharset = charset?.trim().toLowerCase();
  if (normalizedCharset === "latin1" || normalizedCharset === "iso-8859-1") {
    return content.toString("latin1");
  }
  return content.toString("utf8");
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function truncatePreview(text: string | undefined, maxLength = 4_000): string | undefined {
  const normalized = normalizeOptionalString(text);
  if (!normalized) {
    return undefined;
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
