import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertOutputDirAllowed,
  resolveEmailPluginConfig,
  sanitizeAttachmentFilename,
} from "./config.js";
import { ImapClient, parseFetchMetadata, parseSearchUids } from "./imap-client.js";
import { parseMimeMessage } from "./mime.js";
import {
  createEmailDownloadAttachmentsTool,
  createEmailDownloadMatchingAttachmentsTool,
  createEmailReadTool,
  createEmailSearchTool,
} from "./tools.js";

const createdDirs: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  while (createdDirs.length > 0) {
    const dir = createdDirs.pop();
    if (dir) {
      await fs.rm(dir, { recursive: true, force: true });
    }
  }
});

describe("email config", () => {
  it("normalizes defaults and allowed roots", () => {
    const config = resolveEmailPluginConfig(
      {
        accounts: [
          {
            id: "main",
            host: "imap.example.com",
            user: "alice@example.com",
            password: "secret",
          },
        ],
      },
      {
        agents: {
          defaults: {
            workspace: "/tmp/workspace-root",
          },
        },
      } as never,
    );
    expect(config.defaultAccountId).toBe("main");
    expect(config.accounts[0]).toMatchObject({
      id: "main",
      secure: true,
      port: 993,
      mailbox: "INBOX",
    });
    expect(config.downloadPolicy.allowedWriteRoots).toEqual(["/tmp/workspace-root"]);
  });

  it("blocks output directories outside allowed roots", () => {
    expect(() => assertOutputDirAllowed("/tmp/allowed/subdir", ["/tmp/allowed"])).not.toThrow();
    expect(() => assertOutputDirAllowed("/tmp/other", ["/tmp/allowed"])).toThrow(
      /outside allowed roots/,
    );
  });

  it("sanitizes unsafe attachment filenames", () => {
    expect(sanitizeAttachmentFilename("../../secrets.txt", "attachment.bin")).toBe("secrets.txt");
  });
});

describe("email MIME parsing", () => {
  it("extracts preview text and attachments", () => {
    const raw = Buffer.from(
      [
        "Subject: Test subject",
        "From: Sender <sender@example.com>",
        "Date: Sun, 20 Apr 2026 12:34:56 +0000",
        "Message-ID: <msg-1@example.com>",
        'Content-Type: multipart/mixed; boundary="mix"',
        "",
        "--mix",
        'Content-Type: text/plain; charset="utf-8"',
        "",
        "hello from the inbox",
        "--mix",
        'Content-Type: application/pdf; name="invoice.pdf"',
        "Content-Transfer-Encoding: base64",
        'Content-Disposition: attachment; filename="invoice.pdf"',
        "",
        Buffer.from("pdf-data").toString("base64"),
        "--mix--",
        "",
      ].join("\r\n"),
      "utf8",
    );

    const parsed = parseMimeMessage(raw);
    expect(parsed.subject).toBe("Test subject");
    expect(parsed.preview).toContain("hello from the inbox");
    expect(parsed.attachments).toHaveLength(1);
    expect(parsed.attachments[0]).toMatchObject({
      filename: "invoice.pdf",
      contentType: "application/pdf",
    });
    expect(parsed.attachments[0]?.content.toString("utf8")).toBe("pdf-data");
  });

  it("decodes RFC 2047 header and attachment filename words", () => {
    const encodedFilename = "=?utf-8?B?UlRJVzI0MDg2NDUwMCAgIEZDLVdXMjQwOC0xMzg2LnBkZg==?=";
    const raw = Buffer.from(
      [
        `Subject: ${encodedFilename}`,
        'Content-Type: multipart/mixed; boundary="mix"',
        "",
        "--mix",
        `Content-Type: application/pdf; name="${encodedFilename}"`,
        "Content-Transfer-Encoding: base64",
        `Content-Disposition: attachment; filename="${encodedFilename}"`,
        "",
        Buffer.from("pdf-data").toString("base64"),
        "--mix--",
        "",
      ].join("\r\n"),
      "utf8",
    );

    const parsed = parseMimeMessage(raw);
    expect(parsed.subject).toBe("RTIW240864500   FC-WW2408-1386.pdf");
    expect(parsed.attachments[0]?.filename).toBe("RTIW240864500   FC-WW2408-1386.pdf");
  });
});

describe("email IMAP parsing", () => {
  it("parses SEARCH uid results", () => {
    expect(parseSearchUids(["* SEARCH 41 42 43", "A0001 OK SEARCH completed"])).toEqual([
      41, 42, 43,
    ]);
  });

  it("parses FETCH metadata and header literal", () => {
    const metadata = parseFetchMetadata(
      [
        '* 23 FETCH (UID 42 FLAGS (\\Seen) RFC822.SIZE 120 BODYSTRUCTURE (("TEXT" "PLAIN") "ATTACHMENT"))',
        "A0002 OK FETCH completed",
      ],
      Buffer.from(
        "Subject: Test subject\r\nFrom: Sender <sender@example.com>\r\nMessage-ID: <m@example.com>\r\nDate: Sun, 20 Apr 2026 12:34:56 +0000\r\n",
        "utf8",
      ),
      42,
    );
    expect(metadata).toMatchObject({
      uid: 42,
      subject: "Test subject",
      from: "Sender <sender@example.com>",
      messageId: "<m@example.com>",
      hasAttachments: true,
    });
    expect(metadata.flags).toEqual(["\\Seen"]);
  });
});

describe("email tools", () => {
  it("reads a message through the native tool surface", async () => {
    const raw = Buffer.from(
      [
        "Subject: Tool subject",
        "From: Tool Sender <tool@example.com>",
        "Date: Sun, 20 Apr 2026 12:34:56 +0000",
        "Message-ID: <tool@example.com>",
        "",
        "tool preview body",
      ].join("\r\n"),
      "utf8",
    );
    const fakeClient = {
      fetchRawMessage: vi.fn(async () => ({
        uid: 77,
        subject: "Tool subject",
        from: "Tool Sender <tool@example.com>",
        date: "Sun, 20 Apr 2026 12:34:56 +0000",
        messageId: "<tool@example.com>",
        flags: ["\\Seen"],
        size: raw.length,
        hasAttachments: false,
        raw,
      })),
      resolveUidByMessageId: vi.fn(async () => 77),
      close: vi.fn(async () => {}),
    } as unknown as ImapClient;
    vi.spyOn(ImapClient, "connect").mockResolvedValue(fakeClient);

    const tool = createEmailReadTool(fakeApi());
    const result = await tool.execute("call-1", { uid: 77 });
    const payload = JSON.parse(readToolText(result));
    expect(payload).toMatchObject({
      uid: 77,
      subject: "Tool subject",
      messageId: "<tool@example.com>",
    });
    expect(payload.preview).toContain("tool preview body");
  });

  it("downloads attachments into an allowed output directory", async () => {
    const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-email-"));
    createdDirs.push(outputRoot);
    const raw = Buffer.from(
      [
        "Subject: Download me",
        "From: Sender <sender@example.com>",
        "Date: Sun, 20 Apr 2026 12:34:56 +0000",
        "Message-ID: <download@example.com>",
        'Content-Type: multipart/mixed; boundary="mix"',
        "",
        "--mix",
        'Content-Type: text/plain; charset="utf-8"',
        "",
        "download attachment body",
        "--mix",
        'Content-Type: text/plain; name="note.txt"',
        "Content-Transfer-Encoding: base64",
        'Content-Disposition: attachment; filename="note.txt"',
        "",
        Buffer.from("attachment-text").toString("base64"),
        "--mix--",
        "",
      ].join("\r\n"),
      "utf8",
    );
    const fakeClient = {
      fetchRawMessage: vi.fn(async () => ({
        uid: 88,
        subject: "Download me",
        from: "Sender <sender@example.com>",
        date: "Sun, 20 Apr 2026 12:34:56 +0000",
        messageId: "<download@example.com>",
        flags: [],
        size: raw.length,
        hasAttachments: true,
        raw,
      })),
      resolveUidByMessageId: vi.fn(async () => 88),
      close: vi.fn(async () => {}),
    } as unknown as ImapClient;
    vi.spyOn(ImapClient, "connect").mockResolvedValue(fakeClient);

    const tool = createEmailDownloadAttachmentsTool(
      fakeApi({
        downloadPolicy: {
          allowedWriteRoots: [outputRoot],
        },
      }),
    );
    const result = await tool.execute("call-2", {
      uid: 88,
      outputDir: outputRoot,
    });
    const payload = JSON.parse(readToolText(result));
    expect(payload.savedFiles).toHaveLength(1);
    const savedPath = payload.savedFiles[0]?.path;
    expect(typeof savedPath).toBe("string");
    expect(await fs.readFile(savedPath, "utf8")).toBe("attachment-text");
  });

  it("searches mailbox messages with header and attachment filename filters", async () => {
    const raw = Buffer.from(
      [
        "Subject: Daily invoice",
        "From: Vendor <vendor@example.com>",
        "To: Ops <ops@example.com>",
        "Date: Mon, 27 Apr 2026 09:00:00 +0000",
        "Message-ID: <invoice@example.com>",
        'Content-Type: multipart/mixed; boundary="mix"',
        "",
        "--mix",
        'Content-Type: text/csv; name="invoice.csv"',
        "Content-Transfer-Encoding: base64",
        'Content-Disposition: attachment; filename="invoice.csv"',
        "",
        Buffer.from("invoice-data").toString("base64"),
        "--mix--",
        "",
      ].join("\r\n"),
      "utf8",
    );
    const fakeClient = {
      searchUids: vi.fn(async () => [10, 11, 12]),
      fetchMessageHeader: vi.fn(async (_params: { mailbox: string; uid: number }) => ({
        uid: _params.uid,
        subject: _params.uid === 11 ? "Daily invoice" : "Other message",
        from: "Vendor <vendor@example.com>",
        to: "Ops <ops@example.com>",
        date: "Mon, 27 Apr 2026 09:00:00 +0000",
        messageId: `<${_params.uid}@example.com>`,
        flags: [],
        size: raw.length,
        hasAttachments: _params.uid === 11,
      })),
      fetchRawMessage: vi.fn(async () => ({
        uid: 11,
        subject: "Daily invoice",
        from: "Vendor <vendor@example.com>",
        to: "Ops <ops@example.com>",
        date: "Mon, 27 Apr 2026 09:00:00 +0000",
        messageId: "<invoice@example.com>",
        flags: [],
        size: raw.length,
        hasAttachments: true,
        raw,
      })),
      close: vi.fn(async () => {}),
    } as unknown as ImapClient;
    vi.spyOn(ImapClient, "connect").mockResolvedValue(fakeClient);

    const tool = createEmailSearchTool(fakeApi());
    const result = await tool.execute("call-3", {
      onDate: "2026-04-27",
      subjectContains: "invoice",
      attachmentFilenameContains: "invoice",
      includeAttachmentInventory: true,
      maxScanMessages: 10,
    });
    const payload = JSON.parse(readToolText(result));
    expect(payload).toMatchObject({
      count: 1,
      scannedMessages: 3,
      candidateMessages: 3,
    });
    expect(payload.messages[0]).toMatchObject({
      uid: 11,
      subject: "Daily invoice",
      hasAttachments: true,
    });
    expect(payload.messages[0].attachments[0]).toMatchObject({
      filename: "invoice.csv",
    });
    expect(fakeClient.searchUids).toHaveBeenCalledWith(
      expect.objectContaining({
        since: new Date(2026, 3, 27),
        before: new Date(2026, 3, 28),
      }),
    );
  });

  it("downloads attachments from matching mailbox messages", async () => {
    const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-email-bulk-"));
    createdDirs.push(outputRoot);
    const raw = Buffer.from(
      [
        "Subject: Daily report",
        "From: Reports <reports@example.com>",
        "To: Ops <ops@example.com>",
        "Date: Mon, 27 Apr 2026 09:00:00 +0000",
        "Message-ID: <report@example.com>",
        'Content-Type: multipart/mixed; boundary="mix"',
        "",
        "--mix",
        'Content-Type: text/csv; name="report.csv"',
        "Content-Transfer-Encoding: base64",
        'Content-Disposition: attachment; filename="report.csv"',
        "",
        Buffer.from("report-data").toString("base64"),
        "--mix--",
        "",
      ].join("\r\n"),
      "utf8",
    );
    const fakeClient = {
      searchUids: vi.fn(async () => [21, 22]),
      fetchMessageHeader: vi.fn(async (_params: { mailbox: string; uid: number }) => ({
        uid: _params.uid,
        subject: _params.uid === 22 ? "Daily report" : "Other message",
        from: "Reports <reports@example.com>",
        to: "Ops <ops@example.com>",
        date: "Mon, 27 Apr 2026 09:00:00 +0000",
        messageId: `<${_params.uid}@example.com>`,
        flags: [],
        size: raw.length,
        hasAttachments: _params.uid === 22,
      })),
      fetchRawMessage: vi.fn(async () => ({
        uid: 22,
        subject: "Daily report",
        from: "Reports <reports@example.com>",
        to: "Ops <ops@example.com>",
        date: "Mon, 27 Apr 2026 09:00:00 +0000",
        messageId: "<report@example.com>",
        flags: [],
        size: raw.length,
        hasAttachments: true,
        raw,
      })),
      close: vi.fn(async () => {}),
    } as unknown as ImapClient;
    vi.spyOn(ImapClient, "connect").mockResolvedValue(fakeClient);

    const tool = createEmailDownloadMatchingAttachmentsTool(
      fakeApi({
        downloadPolicy: {
          allowedWriteRoots: [outputRoot],
        },
      }),
    );
    const result = await tool.execute("call-4", {
      outputDir: outputRoot,
      onDate: "2026-04-27",
      subjectContains: "report",
      attachmentFilenameContains: "report",
    });
    const payload = JSON.parse(readToolText(result));
    expect(payload).toMatchObject({
      matchedMessages: 1,
      downloadedMessages: 1,
      downloadedFiles: 1,
      failedCount: 0,
    });
    const savedPath = payload.downloaded[0]?.savedFiles[0]?.path;
    expect(typeof savedPath).toBe("string");
    expect(await fs.readFile(savedPath, "utf8")).toBe("report-data");
  });
});

function fakeApi(overrideConfig?: Record<string, unknown>): OpenClawPluginApi {
  return {
    pluginConfig: {
      accounts: [
        {
          id: "main",
          host: "imap.example.com",
          user: "alice@example.com",
          password: "secret",
        },
      ],
      ...overrideConfig,
    },
    config: {
      secrets: {},
    },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  } as unknown as OpenClawPluginApi;
}

function readToolText(result: { content: Array<{ type: string; text?: string }> }): string {
  const first = result.content[0];
  if (!first || first.type !== "text" || typeof first.text !== "string") {
    throw new Error("Expected text tool result");
  }
  return first.text;
}
