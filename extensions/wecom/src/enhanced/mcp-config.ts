/**
 * MCP config auto-fetch module.
 *
 * After WebSocket authentication, automatically sends `aibot_get_mcp_config`
 * to retrieve MCP server configuration and persists it per-account.
 *
 * Failures are logged but NEVER thrown — MCP fetch must not block messaging.
 */

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { generateReqId } from "@wecom/aibot-node-sdk";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MCP_GET_CONFIG_CMD = "aibot_get_mcp_config";
const MCP_CONFIG_KEY = "doc";
const DEFAULT_MCP_TRANSPORT = "streamable-http";
const DEFAULT_TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal subset of WSClient needed for MCP config fetch. */
export interface McpWsClient {
  reply(
    frame: { headers: { req_id: string } },
    body: Record<string, unknown>,
    cmd: string,
  ): Promise<McpRawResponse>;
}

interface McpRawResponse {
  errcode?: number;
  errmsg?: string;
  body?: {
    url?: string;
    type?: string;
    transport_type?: string;
    transportType?: string;
    config_type?: string;
    configType?: string;
    is_authed?: boolean;
    biz_type?: string;
  };
}

export interface McpConfig {
  key: string;
  url: string;
  type: string;
  isAuthed: boolean | undefined;
}

interface McpLogSink {
  info?: (msg: string) => void;
  warn?: (msg: string) => void;
  error?: (msg: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Race a promise against a timeout. */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  if (!timeoutMs || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise;
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  // Suppress unhandled rejection from the losing race branch.
  promise.catch(() => {});

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Resolve MCP transport type from potentially aliased response fields.
 * Falls back to "streamable-http" when no known field is present.
 */
function resolveMcpTransport(body: McpRawResponse["body"] = {}): string {
  const candidate = String(
    body?.transport_type ??
      body?.transportType ??
      body?.config_type ??
      body?.configType ??
      body?.type ??
      "",
  )
    .trim()
    .toLowerCase();

  return candidate || DEFAULT_MCP_TRANSPORT;
}

/** Per-account config file path: `~/.openclaw/wecomConfig/{accountId}/config.json` */
function getConfigPath(accountId: string): string {
  return path.join(os.homedir(), ".openclaw", "wecomConfig", accountId, "config.json");
}

// Serialize writes per-account to avoid torn config files.
const writeQueues = new Map<string, Promise<void>>();

async function readJsonFile(filePath: string): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

async function writeJsonFileAtomically(filePath: string, value: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  await mkdir(dir, { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);
}

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Send `aibot_get_mcp_config` and return the parsed config.
 * Throws on protocol errors, timeout, or missing url.
 */
export async function fetchMcpConfig(
  client: McpWsClient,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<McpConfig> {
  const reqId = generateReqId("mcp_config");

  const response = await withTimeout(
    client.reply({ headers: { req_id: reqId } }, { biz_type: MCP_CONFIG_KEY }, MCP_GET_CONFIG_CMD),
    timeoutMs,
    `MCP config fetch timed out after ${timeoutMs}ms`,
  );

  if (response?.errcode && response.errcode !== 0) {
    throw new Error(
      `MCP config request failed: errcode=${response.errcode}, errmsg=${response.errmsg ?? "unknown"}`,
    );
  }

  const body = response?.body;
  if (!body?.url) {
    throw new Error("MCP config response missing required 'url' field");
  }

  return {
    key: MCP_CONFIG_KEY,
    type: resolveMcpTransport(body),
    url: body.url,
    isAuthed: body.is_authed,
  };
}

/**
 * Persist an MCP config to the per-account config file.
 * Writes are serialized per-account via a queue to avoid torn files.
 */
async function saveMcpConfig(config: McpConfig, accountId: string): Promise<void> {
  const configPath = getConfigPath(accountId);

  const prev = writeQueues.get(accountId) ?? Promise.resolve();
  const task = prev.then(async () => {
    const current = await readJsonFile(configPath);
    if (!current.mcpConfig || typeof current.mcpConfig !== "object") {
      current.mcpConfig = {};
    }

    (current.mcpConfig as Record<string, unknown>)[config.key || MCP_CONFIG_KEY] = {
      type: config.type,
      url: config.url,
    };

    await writeJsonFileAtomically(configPath, current);
  });

  writeQueues.set(
    accountId,
    task.catch(() => {}),
  );
  return task;
}

/**
 * Fetch MCP config from the WS server and persist it locally.
 *
 * **Failures are logged but never thrown** — this must not block the messaging path.
 */
export async function fetchAndSaveMcpConfig(
  client: McpWsClient,
  accountId: string,
  log: McpLogSink,
  timeoutMs?: number,
): Promise<void> {
  try {
    log.info?.(`[wecom-mcp] Fetching MCP config for account=${accountId}...`);

    const config = await fetchMcpConfig(client, timeoutMs);

    log.info?.(
      `[wecom-mcp] MCP config fetched: url=${config.url}, type=${config.type}, is_authed=${config.isAuthed ?? "N/A"}`,
    );

    if (config.isAuthed === false) {
      log.warn?.(
        `[wecom-mcp] MCP config not authorized for account=${accountId} — config saved, user needs to authorize`,
      );
    }

    await saveMcpConfig(config, accountId);
    log.info?.(`[wecom-mcp] MCP config saved to ${getConfigPath(accountId)}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log.warn?.(`[wecom-mcp] MCP config fetch failed for account=${accountId}: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Test helpers (exported for tests only)
// ---------------------------------------------------------------------------

export const mcpConfigTestHelpers = {
  getConfigPath,
  resetWriteQueue() {
    writeQueues.clear();
  },
};
