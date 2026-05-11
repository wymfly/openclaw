import { generateReqId } from "@wecom/aibot-node-sdk";
import { resolveWecomEgressProxyUrlFromNetwork } from "../../config/index.js";
import { wecomFetch } from "../../http.js";
import { getAccountRuntime, getBotWsPushHandle } from "../../runtime.js";

const HTTP_REQUEST_TIMEOUT_MS = 30_000;
const MCP_CONFIG_FETCH_TIMEOUT_MS = 15_000;
const MCP_GET_CONFIG_CMD = "aibot_get_mcp_config";
const MCP_PLUGIN_VERSION = "wecom-dual-plane";
const LOG_TAG = "[wecom-mcp]";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface McpSession {
  sessionId: string | null;
  initialized: boolean;
  stateless: boolean;
}

const CACHE_CLEAR_ERROR_CODES = new Set([-32001, -32002, -32003]);

const mcpConfigCache = new Map<string, Record<string, unknown>>();
const mcpSessionCache = new Map<string, McpSession>();
const statelessKeys = new Set<string>();
const inflightInitRequests = new Map<string, Promise<McpSession>>();

export interface SendJsonRpcOptions {
  timeoutMs?: number;
}

function cacheKey(accountId: string, category: string): string {
  return `${accountId}::${category}`;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

export class McpRpcError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = "McpRpcError";
  }
}

export class McpHttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "McpHttpError";
  }
}

async function fetchMcpConfig(
  accountId: string,
  category: string,
): Promise<Record<string, unknown>> {
  const handle = getBotWsPushHandle(accountId);
  if (!handle?.isConnected()) {
    throw new Error(`当前企微账号 MCP 服务未就绪：account=${accountId} 的 Bot WS 未连接。`);
  }

  if (!handle.replyCommand) {
    throw new Error(`当前企微账号 MCP 服务不支持 replyCommand：account=${accountId}`);
  }

  const response = await withTimeout(
    handle.replyCommand({
      cmd: MCP_GET_CONFIG_CMD,
      body: {
        biz_type: category,
        plugin_version: MCP_PLUGIN_VERSION,
      },
      headers: {
        req_id: generateReqId("mcp_config"),
      },
    }),
    MCP_CONFIG_FETCH_TIMEOUT_MS,
    `MCP config fetch timed out after ${MCP_CONFIG_FETCH_TIMEOUT_MS}ms`,
  );

  const responseBody = response as {
    errcode?: number;
    errmsg?: string;
    body?: { url?: string };
  };
  const errcode = responseBody.errcode ?? 0;
  if (errcode !== 0) {
    throw new Error(
      `MCP 配置请求失败: errcode=${String(responseBody.errcode)} errmsg=${responseBody.errmsg ?? "unknown"}`,
    );
  }

  const body = responseBody.body;
  if (typeof body?.url !== "string" || !body.url) {
    throw new Error(`MCP 配置响应缺少 url 字段 (account=${accountId}, category=${category})`);
  }

  getAccountRuntime(accountId)?.log.info?.(
    `${LOG_TAG} config ready account=${accountId} category=${category} url=${body.url}`,
  );
  return body as Record<string, unknown>;
}

async function getMcpUrl(accountId: string, category: string): Promise<string> {
  const key = cacheKey(accountId, category);
  const cached = mcpConfigCache.get(key);
  if (typeof cached?.url === "string" && cached.url) {
    return cached.url;
  }
  const body = await fetchMcpConfig(accountId, category);
  mcpConfigCache.set(key, body);
  return String(body.url);
}

async function sendRawJsonRpc(
  url: string,
  session: McpSession,
  body: JsonRpcRequest,
  proxyUrl?: string,
  options?: SendJsonRpcOptions,
): Promise<{ rpcResult: unknown; newSessionId: string | null }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (session.sessionId) {
    headers["Mcp-Session-Id"] = session.sessionId;
  }

  const response = await wecomFetch(
    url,
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    },
    { proxyUrl, timeoutMs: options?.timeoutMs ?? HTTP_REQUEST_TIMEOUT_MS },
  );
  const newSessionId = response.headers.get("mcp-session-id");

  if (!response.ok) {
    throw new McpHttpError(
      response.status,
      `MCP HTTP 请求失败: ${response.status} ${response.statusText}`,
    );
  }

  const contentLength = response.headers.get("content-length");
  if (response.status === 204 || contentLength === "0") {
    return { rpcResult: undefined, newSessionId };
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/event-stream")) {
    return {
      rpcResult: await parseSseResponse(response),
      newSessionId,
    };
  }

  const text = await response.text();
  if (!text.trim()) {
    return { rpcResult: undefined, newSessionId };
  }

  const rpc = JSON.parse(text) as JsonRpcResponse;
  if (rpc.error) {
    throw new McpRpcError(
      rpc.error.code,
      `MCP 调用错误 [${rpc.error.code}]: ${rpc.error.message}`,
      rpc.error.data,
    );
  }
  return { rpcResult: rpc.result, newSessionId };
}

function resolveProxyUrlForAccount(accountId: string): string | undefined {
  const runtime = getAccountRuntime(accountId);
  return resolveWecomEgressProxyUrlFromNetwork(runtime?.resolved.account.agent?.network);
}

async function initializeSession(
  accountId: string,
  category: string,
  url: string,
  proxyUrl?: string,
): Promise<McpSession> {
  const key = cacheKey(accountId, category);
  const session: McpSession = { sessionId: null, initialized: false, stateless: false };

  const initializeRequest: JsonRpcRequest = {
    jsonrpc: "2.0",
    id: generateReqId("mcp_init"),
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "wecom_mcp", version: MCP_PLUGIN_VERSION },
    },
  };

  const initResult = await sendRawJsonRpc(url, session, initializeRequest, proxyUrl);
  if (initResult.newSessionId) {
    session.sessionId = initResult.newSessionId;
  }
  if (!session.sessionId) {
    session.stateless = true;
    session.initialized = true;
    statelessKeys.add(key);
    mcpSessionCache.set(key, session);
    return session;
  }

  const notifyRequest: JsonRpcRequest = {
    jsonrpc: "2.0",
    method: "notifications/initialized",
  };
  const notifyResult = await sendRawJsonRpc(url, session, notifyRequest, proxyUrl);
  if (notifyResult.newSessionId) {
    session.sessionId = notifyResult.newSessionId;
  }
  session.initialized = true;
  mcpSessionCache.set(key, session);
  return session;
}

async function getOrCreateSession(
  accountId: string,
  category: string,
  url: string,
): Promise<McpSession> {
  const key = cacheKey(accountId, category);
  if (statelessKeys.has(key)) {
    const cached = mcpSessionCache.get(key);
    if (cached) {
      return cached;
    }
  }

  const cached = mcpSessionCache.get(key);
  if (cached?.initialized) {
    return cached;
  }

  const inflight = inflightInitRequests.get(key);
  if (inflight) {
    return inflight;
  }

  const proxyUrl = resolveProxyUrlForAccount(accountId);
  const promise = initializeSession(accountId, category, url, proxyUrl).finally(() => {
    inflightInitRequests.delete(key);
  });
  inflightInitRequests.set(key, promise);
  return promise;
}

async function rebuildSession(
  accountId: string,
  category: string,
  url: string,
): Promise<McpSession> {
  const key = cacheKey(accountId, category);
  const inflight = inflightInitRequests.get(key);
  if (inflight) {
    return inflight;
  }
  const proxyUrl = resolveProxyUrlForAccount(accountId);
  const promise = initializeSession(accountId, category, url, proxyUrl).finally(() => {
    inflightInitRequests.delete(key);
  });
  inflightInitRequests.set(key, promise);
  return promise;
}

async function parseSseResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  const lines = text.split("\n");
  let currentParts: string[] = [];
  let lastEventData = "";

  for (const line of lines) {
    if (line.startsWith("data: ")) {
      currentParts.push(line.slice(6));
      continue;
    }
    if (line.startsWith("data:")) {
      currentParts.push(line.slice(5));
      continue;
    }
    if (line.trim() === "" && currentParts.length > 0) {
      lastEventData = currentParts.join("\n").trim();
      currentParts = [];
    }
  }
  if (currentParts.length > 0) {
    lastEventData = currentParts.join("\n").trim();
  }
  if (!lastEventData) {
    throw new Error("SSE 响应中未包含有效数据");
  }

  const rpc = JSON.parse(lastEventData) as JsonRpcResponse;
  if (rpc.error) {
    throw new McpRpcError(
      rpc.error.code,
      `MCP 调用错误 [${rpc.error.code}]: ${rpc.error.message}`,
      rpc.error.data,
    );
  }
  return rpc.result;
}

export function clearWecomMcpCategoryCache(accountId: string, category: string): void {
  const key = cacheKey(accountId, category);
  getAccountRuntime(accountId)?.log.info?.(
    `${LOG_TAG} clear cache account=${accountId} category=${category}`,
  );
  mcpConfigCache.delete(key);
  mcpSessionCache.delete(key);
  statelessKeys.delete(key);
  inflightInitRequests.delete(key);
}

export function clearWecomMcpAccountCache(accountId: string): void {
  const prefix = `${accountId}::`;
  for (const key of Array.from(mcpConfigCache.keys())) {
    if (key.startsWith(prefix)) {
      mcpConfigCache.delete(key);
    }
  }
  for (const key of Array.from(mcpSessionCache.keys())) {
    if (key.startsWith(prefix)) {
      mcpSessionCache.delete(key);
    }
  }
  for (const key of Array.from(statelessKeys)) {
    if (key.startsWith(prefix)) {
      statelessKeys.delete(key);
    }
  }
  for (const key of Array.from(inflightInitRequests.keys())) {
    if (key.startsWith(prefix)) {
      inflightInitRequests.delete(key);
    }
  }
}

export interface McpToolInfo {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export async function sendJsonRpc(
  accountId: string,
  category: string,
  method: string,
  params?: Record<string, unknown>,
  options?: SendJsonRpcOptions,
): Promise<unknown> {
  const url = await getMcpUrl(accountId, category);
  const proxyUrl = resolveProxyUrlForAccount(accountId);
  const body: JsonRpcRequest = {
    jsonrpc: "2.0",
    id: generateReqId("mcp_rpc"),
    method,
    ...(params !== undefined ? { params } : {}),
  };

  let session = await getOrCreateSession(accountId, category, url);

  try {
    const result = await sendRawJsonRpc(url, session, body, proxyUrl, options);
    if (result.newSessionId) {
      session.sessionId = result.newSessionId;
    }
    return result.rpcResult;
  } catch (error) {
    if (error instanceof McpRpcError && CACHE_CLEAR_ERROR_CODES.has(error.code)) {
      clearWecomMcpCategoryCache(accountId, category);
    }
    if (session.stateless) {
      throw error;
    }
    if (error instanceof McpHttpError && error.statusCode === 404) {
      mcpSessionCache.delete(cacheKey(accountId, category));
      session = await rebuildSession(accountId, category, url);
      const result = await sendRawJsonRpc(url, session, body, proxyUrl, options);
      if (result.newSessionId) {
        session.sessionId = result.newSessionId;
      }
      return result.rpcResult;
    }
    getAccountRuntime(accountId)?.log.error?.(
      `${LOG_TAG} rpc failed account=${accountId} category=${category} method=${method} error=${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
}
