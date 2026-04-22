import fs from "node:fs/promises";
import path from "node:path";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";
import {
  normalizeOptionalLowercaseString,
  normalizeOptionalString,
} from "openclaw/plugin-sdk/text-runtime";
import {
  assertInputFileAllowed,
  assertOutputDirAllowed,
  resolveEmailPluginConfig,
  resolveEmailAccountRuntimeConfig,
  resolveEmailSmtpRuntimeConfig,
  sanitizeAttachmentFilename,
} from "./config.js";
import { ImapClient } from "./imap-client.js";
import { parseMimeMessage } from "./mime.js";
import { SmtpClient } from "./smtp-client.js";

type JsonToolResult = AgentToolResult<unknown>;

type EmailListParams = {
  accountId?: unknown;
  mailbox?: unknown;
  limit?: unknown;
  unseenOnly?: unknown;
  since?: unknown;
};

type EmailReadParams = {
  accountId?: unknown;
  mailbox?: unknown;
  uid?: unknown;
  messageId?: unknown;
};

type EmailDownloadAttachmentsParams = EmailReadParams & {
  outputDir?: unknown;
  filename?: unknown;
};

type EmailSendParams = {
  accountId?: unknown;
  from?: unknown;
  to?: unknown;
  cc?: unknown;
  bcc?: unknown;
  replyTo?: unknown;
  subject?: unknown;
  text?: unknown;
  html?: unknown;
  attachments?: unknown;
};

export function createEmailListTool(api: OpenClawPluginApi) {
  return {
    name: "email_list",
    label: "Email List",
    description:
      "List IMAP mailbox messages with subject, sender, date, flags, and attachment hint.",
    parameters: Type.Object({
      accountId: Type.Optional(Type.String({ description: "Configured account id override." })),
      mailbox: Type.Optional(
        Type.String({ description: "Mailbox name override (default: account mailbox or INBOX)." }),
      ),
      limit: Type.Optional(
        Type.Integer({ minimum: 1, maximum: 50, description: "Maximum messages to return." }),
      ),
      unseenOnly: Type.Optional(Type.Boolean({ description: "Only return unread messages." })),
      since: Type.Optional(
        Type.String({
          description: "Only return messages since this date (ISO string or YYYY-MM-DD).",
        }),
      ),
    }),
    async execute(_id: string, params: EmailListParams) {
      const pluginConfig = resolveEmailPluginConfig(api.pluginConfig, api.config);
      const account = await resolveEmailAccountRuntimeConfig({
        config: api.config,
        pluginConfig,
        accountId: normalizeOptionalString(params.accountId),
      });
      const mailbox = normalizeOptionalString(params.mailbox) ?? account.mailbox;
      const client = await ImapClient.connect(account, api.logger);
      try {
        const since = parseSinceDate(params.since);
        const limit = clampLimit(params.limit);
        const uids = await client.searchUids({
          mailbox,
          unseenOnly: params.unseenOnly === true,
          since,
        });
        const selectedUids = uids.slice(-limit).toReversed();
        const messages = [];
        for (const uid of selectedUids) {
          messages.push(await client.fetchMessageHeader({ mailbox, uid }));
        }
        return jsonResult({
          accountId: account.id,
          mailbox,
          count: messages.length,
          messages,
        });
      } finally {
        await client.close();
      }
    },
  };
}

export function createEmailReadTool(api: OpenClawPluginApi) {
  return {
    name: "email_read",
    label: "Email Read",
    description: "Read a single IMAP message and return a text preview plus attachment inventory.",
    parameters: Type.Object({
      accountId: Type.Optional(Type.String({ description: "Configured account id override." })),
      mailbox: Type.Optional(Type.String({ description: "Mailbox name override." })),
      uid: Type.Optional(Type.Integer({ minimum: 1, description: "Message UID." })),
      messageId: Type.Optional(Type.String({ description: "RFC822 Message-ID header value." })),
    }),
    async execute(_id: string, params: EmailReadParams) {
      const pluginConfig = resolveEmailPluginConfig(api.pluginConfig, api.config);
      const account = await resolveEmailAccountRuntimeConfig({
        config: api.config,
        pluginConfig,
        accountId: normalizeOptionalString(params.accountId),
      });
      const mailbox = normalizeOptionalString(params.mailbox) ?? account.mailbox;
      const client = await ImapClient.connect(account, api.logger);
      try {
        const uid = await resolveMessageUid(client, mailbox, params);
        const message = await client.fetchRawMessage({ mailbox, uid });
        const parsed = parseMimeMessage(message.raw);
        return jsonResult({
          accountId: account.id,
          mailbox,
          uid: message.uid,
          messageId: parsed.messageId ?? message.messageId,
          subject: parsed.subject ?? message.subject,
          from: parsed.from ?? message.from,
          date: parsed.date ?? message.date,
          flags: message.flags,
          size: message.size,
          hasAttachments: parsed.attachments.length > 0 || message.hasAttachments,
          preview: parsed.preview,
          attachments: parsed.attachments.map((attachment) => ({
            filename: attachment.filename,
            contentType: attachment.contentType,
            disposition: attachment.disposition,
            contentId: attachment.contentId,
            size: attachment.size,
          })),
        });
      } finally {
        await client.close();
      }
    },
  };
}

export function createEmailDownloadAttachmentsTool(api: OpenClawPluginApi) {
  return {
    name: "email_download_attachments",
    label: "Email Download Attachments",
    description:
      "Download one or all attachments from a single IMAP message into an allowed output directory.",
    parameters: Type.Object({
      accountId: Type.Optional(Type.String({ description: "Configured account id override." })),
      mailbox: Type.Optional(Type.String({ description: "Mailbox name override." })),
      uid: Type.Optional(Type.Integer({ minimum: 1, description: "Message UID." })),
      messageId: Type.Optional(Type.String({ description: "RFC822 Message-ID header value." })),
      outputDir: Type.String({ description: "Output directory for downloaded attachments." }),
      filename: Type.Optional(Type.String({ description: "Optional attachment filename filter." })),
    }),
    async execute(_id: string, params: EmailDownloadAttachmentsParams) {
      const pluginConfig = resolveEmailPluginConfig(api.pluginConfig, api.config);
      const account = await resolveEmailAccountRuntimeConfig({
        config: api.config,
        pluginConfig,
        accountId: normalizeOptionalString(params.accountId),
      });
      const mailbox = normalizeOptionalString(params.mailbox) ?? account.mailbox;
      const requestedOutputDir = normalizeOptionalString(params.outputDir);
      if (!requestedOutputDir) {
        throw new Error("outputDir is required");
      }

      const outputDir = assertOutputDirAllowed(
        requestedOutputDir,
        pluginConfig.downloadPolicy.allowedWriteRoots,
      );

      const client = await ImapClient.connect(account, api.logger);
      try {
        const uid = await resolveMessageUid(client, mailbox, params);
        const message = await client.fetchRawMessage({ mailbox, uid });
        const parsed = parseMimeMessage(message.raw);
        const targetFilename = normalizeOptionalLowercaseString(params.filename);
        const attachments = parsed.attachments.filter((attachment) =>
          targetFilename
            ? normalizeOptionalLowercaseString(attachment.filename) === targetFilename
            : true,
        );
        if (attachments.length === 0) {
          throw new Error(
            targetFilename
              ? `No attachment matched filename "${targetFilename}"`
              : "Message has no downloadable attachments",
          );
        }

        await fs.mkdir(outputDir, { recursive: true });
        const savedFiles = [];
        for (let index = 0; index < attachments.length; index += 1) {
          const attachment = attachments[index];
          const fallback = `attachment-${index + 1}.bin`;
          const safeName = sanitizeAttachmentFilename(attachment.filename, fallback);
          const targetPath = await resolveUniqueOutputPath(outputDir, safeName);
          await fs.writeFile(targetPath, attachment.content);
          savedFiles.push({
            filename: attachment.filename,
            savedAs: path.basename(targetPath),
            contentType: attachment.contentType,
            size: attachment.size,
            path: targetPath,
          });
        }

        return jsonResult({
          accountId: account.id,
          mailbox,
          uid: message.uid,
          messageId: parsed.messageId ?? message.messageId,
          outputDir,
          savedFiles,
        });
      } finally {
        await client.close();
      }
    },
  };
}

export function createEmailSendTool(api: OpenClawPluginApi) {
  return {
    name: "email_send",
    label: "Email Send",
    description: "Send an email over the configured SMTP account.",
    parameters: Type.Object({
      accountId: Type.Optional(Type.String({ description: "Configured account id override." })),
      from: Type.Optional(Type.String({ description: "Optional envelope/header sender override." })),
      to: Type.Array(Type.String({ description: "Primary recipient email address." }), {
        minItems: 1,
        description: "Primary recipients.",
      }),
      cc: Type.Optional(Type.Array(Type.String({ description: "CC recipient email address." }))),
      bcc: Type.Optional(Type.Array(Type.String({ description: "BCC recipient email address." }))),
      replyTo: Type.Optional(Type.String({ description: "Optional Reply-To address." })),
      subject: Type.String({ description: "Email subject line." }),
      text: Type.Optional(Type.String({ description: "Plain-text email body." })),
      html: Type.Optional(Type.String({ description: "HTML email body." })),
      attachments: Type.Optional(
        Type.Array(
          Type.Object({
            path: Type.String({ description: "Local file path for the attachment." }),
            filename: Type.Optional(
              Type.String({ description: "Optional filename override exposed in the message." }),
            ),
            contentType: Type.Optional(
              Type.String({ description: "Optional MIME type override." }),
            ),
            inline: Type.Optional(Type.Boolean({ description: "Mark the attachment as inline." })),
            contentId: Type.Optional(
              Type.String({ description: "Optional Content-ID for inline HTML usage." }),
            ),
          }),
        ),
      ),
    }),
    async execute(_id: string, params: EmailSendParams) {
      const pluginConfig = resolveEmailPluginConfig(api.pluginConfig, api.config);
      const smtp = await resolveEmailSmtpRuntimeConfig({
        config: api.config,
        pluginConfig,
        accountId: normalizeOptionalString(params.accountId),
      });
      const from = normalizeOptionalString(params.from) ?? smtp.from;
      if (!from) {
        throw new Error("SMTP send requires a from address");
      }
      const to = normalizeEmailList(params.to, "to");
      const cc = normalizeEmailList(params.cc, "cc", true);
      const bcc = normalizeEmailList(params.bcc, "bcc", true);
      const subject = normalizeOptionalString(params.subject);
      if (!subject) {
        throw new Error("subject is required");
      }
      const text = normalizeOptionalString(params.text);
      const html = normalizeOptionalString(params.html);
      if (!text && !html) {
        throw new Error("email_send requires text, html, or both");
      }
      const attachments = await normalizeAttachmentInputs(
        params.attachments,
        pluginConfig.sendPolicy.allowedReadRoots,
      );

      const client = await SmtpClient.connect(smtp, api.logger);
      try {
        await client.sendMail({
          from,
          to,
          cc,
          bcc,
          replyTo: normalizeOptionalString(params.replyTo),
          subject,
          text,
          html,
          attachments,
        });
        return jsonResult({
          accountId: normalizeOptionalString(params.accountId) ?? pluginConfig.defaultAccountId,
          from,
          to,
          cc,
          bcc,
          subject,
          attachments: attachments.map((attachment) => ({
            filename: attachment.filename,
            contentType: attachment.contentType,
            inline: attachment.inline === true,
            contentId: attachment.contentId,
            size: attachment.content.length,
          })),
          transport: {
            host: smtp.host,
            port: smtp.port,
            secure: smtp.secure,
            startTls: smtp.startTls,
            authMethod: smtp.authMethod,
          },
          status: "sent",
        });
      } finally {
        await client.close();
      }
    },
  };
}

async function resolveMessageUid(
  client: ImapClient,
  mailbox: string,
  params: { uid?: unknown; messageId?: unknown },
): Promise<number> {
  if (typeof params.uid === "number" && Number.isInteger(params.uid) && params.uid > 0) {
    return params.uid;
  }
  const messageId = normalizeOptionalString(params.messageId);
  if (!messageId) {
    throw new Error("Either uid or messageId is required");
  }
  const resolvedUid = await client.resolveUidByMessageId(mailbox, messageId);
  if (!resolvedUid) {
    throw new Error(`No message matched Message-ID "${messageId}"`);
  }
  return resolvedUid;
}

function clampLimit(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1) {
    return Math.min(value, 50);
  }
  return 10;
}

function parseSinceDate(value: unknown): Date | undefined {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return undefined;
  }
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid since date "${normalized}"`);
  }
  return parsed;
}

async function resolveUniqueOutputPath(outputDir: string, filename: string): Promise<string> {
  const extension = path.extname(filename);
  const basename = extension ? filename.slice(0, -extension.length) : filename;
  for (let counter = 0; counter < 1_000; counter += 1) {
    const candidate =
      counter === 0
        ? path.join(outputDir, filename)
        : path.join(outputDir, `${basename}-${counter}${extension}`);
    try {
      await fs.access(candidate);
    } catch {
      return candidate;
    }
  }
  throw new Error(`Could not allocate output filename for "${filename}"`);
}

function jsonResult(payload: unknown): JsonToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: undefined,
  };
}

function normalizeEmailList(value: unknown, field: string, optional = false): string[] {
  if (value === undefined || value === null) {
    if (optional) {
      return [];
    }
    throw new Error(`${field} is required`);
  }
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array of email addresses`);
  }
  const normalized = value
    .map((entry) => normalizeOptionalString(typeof entry === "string" ? entry : undefined))
    .filter((entry): entry is string => Boolean(entry));
  if (!optional && normalized.length === 0) {
    throw new Error(`${field} must include at least one email address`);
  }
  return normalized;
}

async function normalizeAttachmentInputs(
  value: unknown,
  allowedReadRoots: string[],
): Promise<
  Array<{
    filename: string;
    contentType: string;
    content: Buffer;
    inline?: boolean;
    contentId?: string;
  }>
> {
  if (!Array.isArray(value) || value.length === 0) {
    return [];
  }

  const attachments = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("attachments entries must be objects");
    }
    const rawPath = normalizeOptionalString("path" in entry ? (entry.path as string | undefined) : undefined);
    if (!rawPath) {
      throw new Error("attachments entries require a path");
    }
    const resolvedPath = assertInputFileAllowed(rawPath, allowedReadRoots);
    const stat = await fs.stat(resolvedPath);
    if (!stat.isFile()) {
      throw new Error(`attachment path "${resolvedPath}" is not a file`);
    }
    const filenameOverride = normalizeOptionalString(
      "filename" in entry ? (entry.filename as string | undefined) : undefined,
    );
    const filename = sanitizeAttachmentFilename(
      filenameOverride ?? path.basename(resolvedPath),
      path.basename(resolvedPath) || "attachment.bin",
    );
    const contentTypeOverride = normalizeOptionalString(
      "contentType" in entry ? (entry.contentType as string | undefined) : undefined,
    );
    const inline = "inline" in entry ? entry.inline === true : false;
    const contentId = normalizeOptionalString(
      "contentId" in entry ? (entry.contentId as string | undefined) : undefined,
    );
    attachments.push({
      filename,
      contentType: contentTypeOverride ?? guessAttachmentContentType(filename),
      content: await fs.readFile(resolvedPath),
      ...(inline ? { inline: true } : {}),
      ...(contentId ? { contentId } : {}),
    });
  }
  return attachments;
}

function guessAttachmentContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case ".txt":
    case ".log":
      return "text/plain";
    case ".html":
    case ".htm":
      return "text/html";
    case ".csv":
      return "text/csv";
    case ".json":
      return "application/json";
    case ".pdf":
      return "application/pdf";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    case ".zip":
      return "application/zip";
    default:
      return "application/octet-stream";
  }
}
