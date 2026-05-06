import {
  normalizeOptionalLowercaseString,
  normalizeOptionalString,
} from "openclaw/plugin-sdk/text-runtime";
import { ImapClient } from "./imap-client.js";
import { parseMimeMessage } from "./mime.js";

export type EmailMailboxSearchParams = {
  limit?: unknown;
  unseenOnly?: unknown;
  since?: unknown;
  before?: unknown;
  onDate?: unknown;
  subjectContains?: unknown;
  fromContains?: unknown;
  toContains?: unknown;
  attachmentFilenameContains?: unknown;
  includeAttachmentInventory?: unknown;
  maxScanMessages?: unknown;
};

export type MailboxSearchFilters = {
  since?: Date;
  before?: Date;
  unseenOnly: boolean;
  subjectContains?: string;
  fromContains?: string;
  toContains?: string;
  attachmentFilenameContains?: string;
  maxScanMessages: number;
  limit: number;
};

type SearchMailboxMessagesOptions = {
  includeAttachmentInventory: boolean;
  requireAttachmentFilenameMatch: boolean;
};

export async function searchMailboxMessages(
  client: ImapClient,
  mailbox: string,
  filters: MailboxSearchFilters,
  options: SearchMailboxMessagesOptions,
) {
  const candidateUids = await client.searchUids({
    mailbox,
    unseenOnly: filters.unseenOnly,
    since: filters.since,
    before: filters.before,
  });
  const scanUids = candidateUids.slice(-filters.maxScanMessages).toReversed();
  const messages = [];
  for (const uid of scanUids) {
    const header = await client.fetchMessageHeader({ mailbox, uid });
    if (!matchesMessageHeader(header, filters)) {
      continue;
    }
    if (options.includeAttachmentInventory || options.requireAttachmentFilenameMatch) {
      const message = await client.fetchRawMessage({ mailbox, uid });
      const parsed = parseMimeMessage(message.raw);
      const attachments = parsed.attachments.map((attachment) => ({
        filename: attachment.filename,
        contentType: attachment.contentType,
        disposition: attachment.disposition,
        contentId: attachment.contentId,
        size: attachment.size,
      }));
      if (
        options.requireAttachmentFilenameMatch &&
        !attachments.some((attachment) =>
          normalizeOptionalLowercaseString(attachment.filename)?.includes(
            filters.attachmentFilenameContains ?? "",
          ),
        )
      ) {
        continue;
      }
      messages.push({
        ...header,
        messageId: parsed.messageId ?? header.messageId,
        subject: parsed.subject ?? header.subject,
        from: parsed.from ?? header.from,
        to: parsed.headers.to ?? header.to,
        date: parsed.date ?? header.date,
        hasAttachments: attachments.length > 0,
        attachments,
      });
    } else {
      messages.push(header);
    }
    if (messages.length >= filters.limit) {
      break;
    }
  }
  return {
    count: messages.length,
    scannedMessages: scanUids.length,
    candidateMessages: candidateUids.length,
    truncatedScan: candidateUids.length > scanUids.length,
    messages,
  };
}

export function normalizeMailboxSearchFilters(
  params: EmailMailboxSearchParams,
): MailboxSearchFilters {
  const window = parseSearchDateWindow(params);
  return {
    ...window,
    unseenOnly: params.unseenOnly === true,
    subjectContains: normalizeOptionalLowercaseString(params.subjectContains),
    fromContains: normalizeOptionalLowercaseString(params.fromContains),
    toContains: normalizeOptionalLowercaseString(params.toContains),
    attachmentFilenameContains: normalizeOptionalLowercaseString(params.attachmentFilenameContains),
    maxScanMessages: clampInteger(params.maxScanMessages, 200, 1, 1000),
    limit: clampInteger(params.limit, 50, 1, 500),
  };
}

export function describeMailboxFilters(filters: MailboxSearchFilters) {
  return {
    since: filters.since?.toISOString(),
    before: filters.before?.toISOString(),
    unseenOnly: filters.unseenOnly,
    subjectContains: filters.subjectContains,
    fromContains: filters.fromContains,
    toContains: filters.toContains,
    attachmentFilenameContains: filters.attachmentFilenameContains,
    maxScanMessages: filters.maxScanMessages,
    limit: filters.limit,
  };
}

export function parseOptionalDate(value: unknown, field: string): Date | undefined {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return undefined;
  }
  return parseLocalDateToken(normalized, field);
}

function matchesMessageHeader(
  header: {
    subject?: string;
    from?: string;
    to?: string;
  },
  filters: MailboxSearchFilters,
): boolean {
  return (
    containsNormalized(header.subject, filters.subjectContains) &&
    containsNormalized(header.from, filters.fromContains) &&
    containsNormalized(header.to, filters.toContains)
  );
}

function parseSearchDateWindow(params: EmailMailboxSearchParams): {
  since?: Date;
  before?: Date;
} {
  const onDate = normalizeOptionalString(params.onDate);
  if (onDate) {
    const since = parseLocalDateToken(onDate, "onDate");
    return { since, before: addDays(since, 1) };
  }
  return {
    since: parseOptionalDate(params.since, "since"),
    before: parseOptionalDate(params.before, "before"),
  };
}

function parseLocalDateToken(value: string, field: string): Date {
  const lowered = value.toLowerCase();
  if (lowered === "today") {
    return startOfLocalDay(new Date());
  }
  if (lowered === "yesterday") {
    return addDays(startOfLocalDay(new Date()), -1);
  }
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const year = Number.parseInt(dateOnly[1] ?? "", 10);
    const month = Number.parseInt(dateOnly[2] ?? "", 10);
    const day = Number.parseInt(dateOnly[3] ?? "", 10);
    return new Date(year, month - 1, day);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${field} date "${value}"`);
  }
  return parsed;
}

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value === "number" && Number.isInteger(value) && value >= min) {
    return Math.min(value, max);
  }
  return fallback;
}

function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function containsNormalized(value: string | undefined, filter: string | undefined): boolean {
  if (!filter) {
    return true;
  }
  return normalizeOptionalLowercaseString(value)?.includes(filter) === true;
}
