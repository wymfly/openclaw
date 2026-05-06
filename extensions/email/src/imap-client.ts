import { once } from "node:events";
import net from "node:net";
import tls from "node:tls";
import type { PluginLogger } from "openclaw/plugin-sdk/plugin-entry";
import { normalizeOptionalString } from "openclaw/plugin-sdk/text-runtime";
import type { ResolvedEmailAccountRuntimeConfig } from "./config.js";
import { parseRfc822Headers } from "./mime.js";

type SocketLike = net.Socket | tls.TLSSocket;

type ImapCommandResponse = {
  lines: string[];
  literals: Buffer[];
  taggedLine: string;
};

export type ImapMessageHeader = {
  uid: number;
  messageId?: string;
  subject?: string;
  from?: string;
  to?: string;
  date?: string;
  flags: string[];
  size?: number;
  hasAttachments: boolean;
};

export type ImapRawMessage = ImapMessageHeader & {
  raw: Buffer;
};

export class ImapClient {
  private readonly socket: SocketLike;
  private readonly reader: SocketReader;
  private readonly logger?: PluginLogger;
  private tagCounter = 0;
  private selectedMailbox?: string;

  private constructor(socket: SocketLike, reader: SocketReader, logger?: PluginLogger) {
    this.socket = socket;
    this.reader = reader;
    this.logger = logger;
  }

  static async connect(
    account: ResolvedEmailAccountRuntimeConfig,
    logger?: PluginLogger,
  ): Promise<ImapClient> {
    const socket = await connectSocket(account);
    const reader = new SocketReader(socket);
    const greeting = await reader.readLineUtf8();
    if (!greeting.startsWith("* OK")) {
      socket.destroy();
      throw new Error(`IMAP greeting failed: ${greeting}`);
    }
    const client = new ImapClient(socket, reader, logger);
    await client.exec(
      `LOGIN ${quoteImapString(account.user)} ${quoteImapString(account.password)}`,
    );
    return client;
  }

  async searchUids(params: {
    mailbox: string;
    unseenOnly?: boolean;
    since?: Date;
    before?: Date;
    messageId?: string;
    subject?: string;
    from?: string;
    to?: string;
  }): Promise<number[]> {
    await this.selectMailbox(params.mailbox);
    const criteria: string[] = [];
    if (params.messageId) {
      criteria.push("HEADER", "Message-ID", quoteImapString(params.messageId));
    } else {
      criteria.push(params.unseenOnly ? "UNSEEN" : "ALL");
      if (params.since) {
        criteria.push("SINCE", formatImapDate(params.since));
      }
      if (params.before) {
        criteria.push("BEFORE", formatImapDate(params.before));
      }
      if (params.subject) {
        criteria.push("SUBJECT", quoteImapString(params.subject));
      }
      if (params.from) {
        criteria.push("FROM", quoteImapString(params.from));
      }
      if (params.to) {
        criteria.push("TO", quoteImapString(params.to));
      }
    }
    const response = await this.exec(`UID SEARCH ${criteria.join(" ")}`);
    return parseSearchUids(response.lines);
  }

  async resolveUidByMessageId(mailbox: string, messageId: string): Promise<number | undefined> {
    const uids = await this.searchUids({ mailbox, messageId });
    return uids.at(-1);
  }

  async fetchMessageHeader(params: { mailbox: string; uid: number }): Promise<ImapMessageHeader> {
    await this.selectMailbox(params.mailbox);
    const response = await this.exec(
      `UID FETCH ${params.uid} (UID FLAGS INTERNALDATE RFC822.SIZE BODYSTRUCTURE BODY.PEEK[HEADER.FIELDS (SUBJECT FROM TO DATE MESSAGE-ID)])`,
    );
    return parseFetchMetadata(response.lines, response.literals[0], params.uid);
  }

  async fetchRawMessage(params: { mailbox: string; uid: number }): Promise<ImapRawMessage> {
    await this.selectMailbox(params.mailbox);
    const response = await this.exec(
      `UID FETCH ${params.uid} (UID FLAGS RFC822 RFC822.SIZE BODYSTRUCTURE)`,
    );
    const metadata = parseFetchMetadata(response.lines, undefined, params.uid);
    const raw = response.literals[0];
    if (!raw) {
      throw new Error(`UID FETCH ${params.uid}: server did not return RFC822 literal`);
    }
    const parsedHeaders = parseRfc822Headers(extractHeaderBlock(raw));
    return {
      ...metadata,
      messageId: parsedHeaders["message-id"] ?? metadata.messageId,
      subject: parsedHeaders.subject ?? metadata.subject,
      from: parsedHeaders.from ?? metadata.from,
      to: parsedHeaders.to ?? metadata.to,
      date: parsedHeaders.date ?? metadata.date,
      raw,
    };
  }

  async close(): Promise<void> {
    if (this.socket.destroyed) {
      return;
    }
    try {
      await this.exec("LOGOUT");
    } catch (error) {
      this.logger?.debug?.(
        `email: IMAP LOGOUT failed (${error instanceof Error ? error.message : String(error)})`,
      );
    } finally {
      this.socket.destroy();
    }
  }

  private async selectMailbox(mailbox: string): Promise<void> {
    if (this.selectedMailbox === mailbox) {
      return;
    }
    await this.exec(`SELECT ${quoteImapString(mailbox)}`);
    this.selectedMailbox = mailbox;
  }

  private async exec(command: string): Promise<ImapCommandResponse> {
    const tag = `A${String(++this.tagCounter).padStart(4, "0")}`;
    this.socket.write(`${tag} ${command}\r\n`);
    const lines: string[] = [];
    const literals: Buffer[] = [];
    while (true) {
      const line = await this.reader.readLineUtf8();
      lines.push(line);
      const literalLength = parseLiteralLength(line);
      if (literalLength !== undefined) {
        literals.push(await this.reader.readBytes(literalLength));
      }
      if (line.startsWith(`${tag} `)) {
        if (!/\bOK\b/i.test(line)) {
          throw new Error(`IMAP ${command} failed: ${line}`);
        }
        return { lines, literals, taggedLine: line };
      }
    }
  }
}

export function parseSearchUids(lines: string[]): number[] {
  const searchLine = lines.find((line) => line.startsWith("* SEARCH"));
  if (!searchLine) {
    return [];
  }
  return searchLine
    .replace(/^\* SEARCH\s*/i, "")
    .trim()
    .split(/\s+/)
    .map((token) => Number.parseInt(token, 10))
    .filter((value) => Number.isFinite(value));
}

export function parseFetchMetadata(
  lines: string[],
  headerLiteral: Buffer | undefined,
  fallbackUid: number,
): ImapMessageHeader {
  const joined = lines.join("\n");
  const uid = matchNumber(joined, /\bUID (\d+)/i) ?? fallbackUid;
  const size = matchNumber(joined, /\bRFC822\.SIZE (\d+)/i);
  const flags = matchFlags(joined);
  const headers = headerLiteral ? parseRfc822Headers(headerLiteral.toString("utf8")) : {};
  return {
    uid,
    messageId: headers["message-id"],
    subject: headers.subject,
    from: headers.from,
    to: headers.to,
    date: headers.date,
    flags,
    size,
    hasAttachments: detectAttachmentHint(joined),
  };
}

function connectSocket(account: ResolvedEmailAccountRuntimeConfig): Promise<SocketLike> {
  return new Promise((resolve, reject) => {
    const onReady = (socket: SocketLike) => {
      socket.setTimeout(30_000, () => {
        socket.destroy(new Error("IMAP socket timeout"));
      });
      socket.removeListener("error", onError);
      resolve(socket);
    };
    const onError = (error: Error) => {
      reject(error);
    };

    const socket: SocketLike = account.secure
      ? tls.connect({
          host: account.host,
          port: account.port,
          servername: account.host,
          rejectUnauthorized: account.tls.rejectUnauthorized,
        })
      : net.createConnection({
          host: account.host,
          port: account.port,
        });

    socket.once("error", onError);
    if (account.secure) {
      void once(socket, "secureConnect")
        .then(() => onReady(socket))
        .catch((error) => reject(error instanceof Error ? error : new Error(String(error))));
      return;
    }
    void once(socket, "connect")
      .then(() => onReady(socket))
      .catch((error) => reject(error instanceof Error ? error : new Error(String(error))));
  });
}

function quoteImapString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function formatImapDate(value: Date): string {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${value.getDate()}-${months[value.getMonth()] ?? "Jan"}-${value.getFullYear()}`;
}

function matchNumber(input: string, pattern: RegExp): number | undefined {
  const matched = input.match(pattern);
  if (!matched || !matched[1]) {
    return undefined;
  }
  const parsed = Number.parseInt(matched[1], 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function matchFlags(input: string): string[] {
  const matched = input.match(/\bFLAGS \(([^)]*)\)/i);
  if (!matched || !matched[1]) {
    return [];
  }
  return matched[1]
    .split(/\s+/)
    .map((flag) => normalizeOptionalString(flag))
    .filter((flag): flag is string => Boolean(flag));
}

function detectAttachmentHint(fetchMetadata: string): boolean {
  return /\bBODYSTRUCTURE\b[\s\S]*(?:"ATTACHMENT"|"FILENAME"|"NAME")/i.test(fetchMetadata);
}

function parseLiteralLength(line: string): number | undefined {
  const matched = line.match(/\{(\d+)\}$/);
  if (!matched || !matched[1]) {
    return undefined;
  }
  const parsed = Number.parseInt(matched[1], 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function extractHeaderBlock(raw: Buffer): string {
  const marker = raw.indexOf("\r\n\r\n");
  if (marker >= 0) {
    return raw.subarray(0, marker).toString("utf8");
  }
  const lfMarker = raw.indexOf("\n\n");
  if (lfMarker >= 0) {
    return raw.subarray(0, lfMarker).toString("utf8");
  }
  return raw.toString("utf8");
}

class SocketReader {
  private buffer = Buffer.alloc(0);
  private readonly waiters: Array<
    | {
        kind: "line";
        resolve: (value: string) => void;
        reject: (error: Error) => void;
      }
    | {
        kind: "bytes";
        length: number;
        resolve: (value: Buffer) => void;
        reject: (error: Error) => void;
      }
  > = [];
  private terminalError: Error | null = null;

  constructor(private readonly socket: SocketLike) {
    socket.on("data", (chunk: Buffer) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.flush();
    });
    socket.on("error", (error) => {
      this.finish(error instanceof Error ? error : new Error(String(error)));
    });
    socket.on("end", () => {
      this.finish(new Error("IMAP socket ended"));
    });
    socket.on("close", () => {
      if (!this.terminalError && this.waiters.length > 0) {
        this.finish(new Error("IMAP socket closed"));
      }
    });
  }

  readLineUtf8(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.waiters.push({ kind: "line", resolve, reject });
      this.flush();
    });
  }

  readBytes(length: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      this.waiters.push({ kind: "bytes", length, resolve, reject });
      this.flush();
    });
  }

  private flush(): void {
    if (this.terminalError) {
      this.rejectAll(this.terminalError);
      return;
    }
    while (this.waiters.length > 0) {
      const next = this.waiters[0];
      if (next.kind === "line") {
        const marker = this.buffer.indexOf("\r\n");
        if (marker < 0) {
          return;
        }
        const line = this.buffer.subarray(0, marker).toString("utf8");
        this.buffer = this.buffer.subarray(marker + 2);
        this.waiters.shift();
        next.resolve(line);
        continue;
      }
      if (this.buffer.length < next.length) {
        return;
      }
      const data = this.buffer.subarray(0, next.length);
      this.buffer = this.buffer.subarray(next.length);
      this.waiters.shift();
      next.resolve(data);
    }
  }

  private finish(error: Error): void {
    if (this.terminalError) {
      return;
    }
    this.terminalError = error;
    this.rejectAll(error);
  }

  private rejectAll(error: Error): void {
    while (this.waiters.length > 0) {
      const waiter = this.waiters.shift();
      waiter?.reject(error);
    }
  }
}
