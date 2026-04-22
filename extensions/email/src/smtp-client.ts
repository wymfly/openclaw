import { once } from "node:events";
import net from "node:net";
import tls from "node:tls";
import type { PluginLogger } from "openclaw/plugin-sdk/plugin-entry";
import type { ResolvedEmailSmtpRuntimeConfig } from "./config.js";

type SocketLike = net.Socket | tls.TLSSocket;

type SmtpResponse = {
  code: number;
  lines: string[];
};

export type SmtpSendRequest = {
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  replyTo?: string;
  subject: string;
  text?: string;
  html?: string;
  attachments: Array<{
    filename: string;
    contentType: string;
    content: Buffer;
    inline?: boolean;
    contentId?: string;
  }>;
};

export class SmtpClient {
  private socket: SocketLike;
  private reader: SocketReader;

  private constructor(
    socket: SocketLike,
    reader: SocketReader,
    private readonly config: ResolvedEmailSmtpRuntimeConfig,
    private readonly logger?: PluginLogger,
  ) {
    this.socket = socket;
    this.reader = reader;
  }

  static async connect(
    config: ResolvedEmailSmtpRuntimeConfig,
    logger?: PluginLogger,
  ): Promise<SmtpClient> {
    const socket = await connectSocket(config);
    const reader = new SocketReader(socket);
    const client = new SmtpClient(socket, reader, config, logger);
    const greeting = await client.readResponse();
    client.expectCode(greeting, 220, "SMTP greeting");
    return client;
  }

  async sendMail(request: SmtpSendRequest): Promise<void> {
    const capabilities = await this.ehlo("openclaw.local");
    if (!this.config.secure && this.config.startTls && capabilities.some((line) => /STARTTLS/i.test(line))) {
      const startTls = await this.exec("STARTTLS");
      this.expectCode(startTls, 220, "STARTTLS");
      await this.upgradeToTls();
      await this.ehlo("openclaw.local");
    }

    await this.authenticate();
    const envelopeRecipients = [...request.to, ...request.cc, ...request.bcc];
    if (envelopeRecipients.length === 0) {
      throw new Error("SMTP send requires at least one recipient");
    }
    this.expectCode(await this.exec(`MAIL FROM:<${request.from}>`), 250, "MAIL FROM");
    for (const recipient of envelopeRecipients) {
      this.expectCode(await this.exec(`RCPT TO:<${recipient}>`), 250, `RCPT TO ${recipient}`);
    }
    this.expectCode(await this.exec("DATA"), 354, "DATA");
    await this.writeData(buildMessageData(request));
    this.expectCode(await this.readResponse(), 250, "message body");
  }

  async close(): Promise<void> {
    if (this.socket.destroyed) {
      return;
    }
    try {
      const response = await this.exec("QUIT");
      this.expectCode(response, 221, "QUIT");
    } catch (error) {
      this.logger?.debug?.(
        `email: SMTP QUIT failed (${error instanceof Error ? error.message : String(error)})`,
      );
    } finally {
      this.socket.destroy();
    }
  }

  private async authenticate(): Promise<void> {
    if (this.config.authMethod === "plain") {
      const payload = Buffer.from(`\u0000${this.config.user}\u0000${this.config.password}`, "utf8").toString(
        "base64",
      );
      this.expectCode(await this.exec(`AUTH PLAIN ${payload}`), 235, "AUTH PLAIN");
      return;
    }

    this.expectCode(await this.exec("AUTH LOGIN"), 334, "AUTH LOGIN");
    this.expectCode(
      await this.exec(Buffer.from(this.config.user, "utf8").toString("base64"), false),
      334,
      "AUTH LOGIN username",
    );
    this.expectCode(
      await this.exec(Buffer.from(this.config.password, "utf8").toString("base64"), false),
      235,
      "AUTH LOGIN password",
    );
  }

  private async ehlo(identity: string): Promise<string[]> {
    const response = await this.exec(`EHLO ${identity}`);
    this.expectCode(response, 250, "EHLO");
    return response.lines;
  }

  private async upgradeToTls(): Promise<void> {
    const upgraded = tls.connect({
      socket: this.socket,
      servername: this.config.host,
      rejectUnauthorized: this.config.tls.rejectUnauthorized,
    });
    await once(upgraded, "secureConnect");
    this.socket = upgraded;
    this.reader = new SocketReader(upgraded);
  }

  private async exec(command: string, appendCrLf = true): Promise<SmtpResponse> {
    this.socket.write(appendCrLf ? `${command}\r\n` : `${command}\r\n`);
    return this.readResponse();
  }

  private async readResponse(): Promise<SmtpResponse> {
    const lines: string[] = [];
    let finalCode = 0;
    while (true) {
      const line = await this.reader.readLineUtf8();
      lines.push(line);
      const matched = line.match(/^(\d{3})([\s-])(.*)$/);
      if (!matched) {
        throw new Error(`SMTP protocol error: ${line}`);
      }
      finalCode = Number.parseInt(matched[1] ?? "0", 10);
      if ((matched[2] ?? " ") === " ") {
        return { code: finalCode, lines };
      }
    }
  }

  private async writeData(payload: string): Promise<void> {
    this.socket.write(`${payload}\r\n.\r\n`);
  }

  private expectCode(response: SmtpResponse, expected: number, label: string): void {
    if (response.code !== expected) {
      throw new Error(`SMTP ${label} failed: ${response.lines.join(" | ")}`);
    }
  }
}

function connectSocket(config: ResolvedEmailSmtpRuntimeConfig): Promise<SocketLike> {
  return new Promise((resolve, reject) => {
    const onReady = (socket: SocketLike) => {
      socket.setTimeout(30_000, () => {
        socket.destroy(new Error("SMTP socket timeout"));
      });
      socket.removeListener("error", onError);
      resolve(socket);
    };
    const onError = (error: Error) => {
      reject(error);
    };

    const socket: SocketLike = config.secure
      ? tls.connect({
          host: config.host,
          port: config.port,
          servername: config.host,
          rejectUnauthorized: config.tls.rejectUnauthorized,
        })
      : net.createConnection({
          host: config.host,
          port: config.port,
        });
    socket.once("error", onError);
    const event = config.secure ? "secureConnect" : "connect";
    void once(socket, event)
      .then(() => onReady(socket))
      .catch((error) => reject(error instanceof Error ? error : new Error(String(error))));
  });
}

function buildMessageData(request: SmtpSendRequest): string {
  const headers = [
    `From: ${request.from}`,
    `To: ${request.to.join(", ")}`,
    ...(request.cc.length > 0 ? [`Cc: ${request.cc.join(", ")}`] : []),
    ...(request.replyTo ? [`Reply-To: ${request.replyTo}`] : []),
    `Subject: ${request.subject}`,
    "MIME-Version: 1.0",
  ];

  if (request.attachments.length > 0) {
    const mixedBoundary = `openclaw-mixed-${Date.now().toString(36)}`;
    headers.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);
    return [
      ...headers,
      "",
      ...buildMultipartBody({
        boundary: mixedBoundary,
        parts: [
          buildBodyPart(request),
          ...request.attachments.map((attachment) => buildAttachmentPart(attachment)),
        ],
      }),
    ].join("\r\n");
  }

  const bodyPart = buildBodyPart(request);
  return [...headers, "", ...bodyPart].join("\r\n");
}

function dotStuffBody(body: string): string {
  return body.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
}

function buildBodyPart(request: SmtpSendRequest): string[] {
  if (request.html && request.text) {
    const boundary = `openclaw-alt-${Date.now().toString(36)}`;
    return [
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      ...buildMultipartBody({
        boundary,
        parts: [
          buildTextLeaf("text/plain", request.text),
          buildTextLeaf("text/html", request.html),
        ],
      }),
    ];
  }

  const body = request.html ?? request.text ?? "";
  return buildTextLeaf(request.html ? "text/html" : "text/plain", body);
}

function buildTextLeaf(contentType: "text/plain" | "text/html", body: string): string[] {
  return [
    `Content-Type: ${contentType}; charset="utf-8"`,
    "Content-Transfer-Encoding: 8bit",
    "",
    dotStuffBody(body),
  ];
}

function buildAttachmentPart(attachment: SmtpSendRequest["attachments"][number]): string[] {
  const disposition = attachment.inline ? "inline" : "attachment";
  return [
    `Content-Type: ${attachment.contentType}; name="${escapeHeaderParameter(attachment.filename)}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: ${disposition}; filename="${escapeHeaderParameter(attachment.filename)}"`,
    ...(attachment.contentId ? [`Content-ID: <${attachment.contentId}>`] : []),
    "",
    wrapBase64(attachment.content.toString("base64")),
  ];
}

function buildMultipartBody(params: {
  boundary: string;
  parts: string[][];
}): string[] {
  const lines: string[] = [];
  for (const part of params.parts) {
    lines.push(`--${params.boundary}`, ...part);
  }
  lines.push(`--${params.boundary}--`);
  return lines;
}

function wrapBase64(value: string): string {
  return value.replace(/.{1,76}/g, "$&\r\n").replace(/\r\n$/, "");
}

function escapeHeaderParameter(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

class SocketReader {
  private buffer = Buffer.alloc(0);
  private readonly waiters: Array<{
    resolve: (value: string) => void;
    reject: (error: Error) => void;
  }> = [];
  private terminalError: Error | null = null;

  constructor(socket: SocketLike) {
    socket.on("data", (chunk: Buffer) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.flush();
    });
    socket.on("error", (error) => {
      this.finish(error instanceof Error ? error : new Error(String(error)));
    });
    socket.on("end", () => {
      this.finish(new Error("SMTP socket ended"));
    });
    socket.on("close", () => {
      if (!this.terminalError && this.waiters.length > 0) {
        this.finish(new Error("SMTP socket closed"));
      }
    });
  }

  readLineUtf8(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.waiters.push({ resolve, reject });
      this.flush();
    });
  }

  private flush(): void {
    if (this.terminalError) {
      this.rejectAll(this.terminalError);
      return;
    }
    while (this.waiters.length > 0) {
      const marker = this.buffer.indexOf("\r\n");
      if (marker < 0) {
        return;
      }
      const line = this.buffer.subarray(0, marker).toString("utf8");
      this.buffer = this.buffer.subarray(marker + 2);
      const waiter = this.waiters.shift();
      waiter?.resolve(line);
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
      this.waiters.shift()?.reject(error);
    }
  }
}
