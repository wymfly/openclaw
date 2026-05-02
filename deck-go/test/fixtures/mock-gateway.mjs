import fs from "node:fs";
import http from "node:http";
import { WebSocketServer } from "ws";

const protocolVersion = 3;
const defaultToken = "mock-gateway-token";

function response(id, payload) {
  return { type: "res", id, payload };
}

function responseError(id, code, message) {
  return { type: "res", id, error: { code, message } };
}

function defaultMethods() {
  return {
    "gateway.describe": () => ({
      version: "mock-gateway",
      gatewayVersion: "mock-gateway",
      protocol: protocolVersion,
    }),
    health: () => ({ status: "healthy" }),
    status: () => ({ status: "running", health: "healthy" }),
    "sessions.create": (params) => ({
      key: params?.sessionKey ?? "session:mock:1",
      sessionKey: params?.sessionKey ?? "session:mock:1",
      sessionId: params?.sessionKey ?? "session:mock:1",
      message: params?.message ?? "",
      runStarted: true,
      runId: "run:mock:1",
      status: "started",
    }),
    "sessions.send": (params) => ({
      sessionKey: params?.sessionKey ?? "session:mock:1",
      runId: "run:mock:2",
      status: "started",
      blocks: [
        {
          type: "text",
          text: `mock reply: ${params?.message ?? ""}`,
        },
      ],
    }),
    "sessions.list": () => ({
      count: 1,
      defaults: { contextTokens: 4096, model: "gpt-5.4", modelProvider: "openai" },
      path: "/tmp/mock-sessions.json",
      sessions: [
        {
          key: "session:mock:1",
          kind: "direct",
          label: "Mock session",
          lastMessagePreview: "hello",
          status: "idle",
          updatedAt: Date.now(),
        },
      ],
      ts: Date.now(),
    }),
    "agents.list": () => ({
      agents: [
        {
          id: "main",
          name: "Main",
          identity: { emoji: "M", name: "Main" },
          workspace: "/tmp/openclaw-main",
          model: { primary: "gpt-5.4", fallbacks: ["sonnet-4.6"] },
        },
      ],
      defaultId: "main",
      mainKey: "main",
      scope: "local",
    }),
    "deck.agents.detail": () => ({
      id: "main",
      name: "Main",
      workspace: "/tmp/openclaw-main",
      model: "gpt-5.4",
      isDefault: true,
      bindingCount: 1,
      sessionCount: 1,
      activeSubagentCount: 0,
      skillMode: "enabled",
      effectiveSkills: [],
      totalAvailableSkills: 0,
      subagents: {},
      identityExists: true,
      fallbackModels: ["sonnet-4.6"],
    }),
    "usage.cost": () => ({
      updatedAt: Date.now(),
      days: 7,
      daily: [
        {
          date: "2026-05-01",
          input: 10,
          inputCost: 0.1,
          output: 5,
          outputCost: 0.2,
          cacheRead: 2,
          cacheReadCost: 0.01,
          cacheWrite: 1,
          cacheWriteCost: 0.02,
          totalTokens: 18,
          totalCost: 0.33,
          missingCostEntries: 0,
        },
      ],
      totals: {
        input: 10,
        inputCost: 0.1,
        output: 5,
        outputCost: 0.2,
        cacheRead: 2,
        cacheReadCost: 0.01,
        cacheWrite: 1,
        cacheWriteCost: 0.02,
        totalTokens: 18,
        totalCost: 0.33,
        missingCostEntries: 0,
      },
    }),
    "usage.status": () => ({
      updatedAt: Date.now(),
      providers: [
        {
          provider: "openai",
          displayName: "OpenAI",
          plan: "team",
          windows: [{ label: "daily", usedPercent: 12 }],
        },
      ],
    }),
    "sessions.usage": () => ({
      updatedAt: Date.now(),
      startDate: "2026-05-01",
      endDate: "2026-05-01",
      totals: {
        input: 10,
        output: 5,
        cacheRead: 2,
        cacheWrite: 1,
        totalTokens: 18,
        totalCost: 0.33,
      },
      aggregates: { byAgent: [{ agentId: "main", totals: { totalTokens: 18, totalCost: 0.33 } }] },
      sessions: [
        {
          key: "session:mock:1",
          label: "Mock session",
          sessionId: "session:mock:1",
          updatedAt: Date.now(),
          agentId: "main",
          channel: "web",
          usage: { totalTokens: 18, totalCost: 0.33 },
        },
      ],
    }),
    "sessions.usage.logs": () => ({
      logs: [
        {
          timestamp: Date.now(),
          role: "assistant",
          content: "mock usage log",
          tokens: 18,
          cost: 0.33,
        },
      ],
    }),
    "sessions.usage.timeseries": () => ({
      sessionId: "session:mock:1",
      points: [
        {
          timestamp: Date.now(),
          input: 10,
          output: 5,
          cacheRead: 2,
          cacheWrite: 1,
          totalTokens: 18,
          cost: 0.33,
          cumulativeTokens: 18,
          cumulativeCost: 0.33,
        },
      ],
    }),
    "exec.approvals.get": () => ({
      exists: true,
      hash: "hash-1",
      path: "/tmp/mock-approvals.json",
      file: {
        version: 1,
        defaults: { security: "on-request", ask: "auto", autoAllowSkills: true },
        agents: {},
      },
    }),
    "exec.approval.list": () => [
      {
        id: "approval-1",
        createdAtMs: Date.now(),
        expiresAtMs: Date.now() + 60_000,
        request: {
          command: "npm test",
          commandArgv: ["npm", "test"],
          agentId: "main",
          sessionKey: "session:mock:1",
          runId: "run:mock:1",
          cwd: "/tmp/openclaw-main",
        },
      },
    ],
  };
}

export async function startMockGateway(options = {}) {
  const token = options.token ?? defaultToken;
  const methods = { ...defaultMethods(), ...options.methods };
  const requestLog = options.requestLog ?? process.env.MOCK_GATEWAY_REQUEST_LOG ?? "";
  const requests = [];
  const recordRequest = (entry) => {
    requests.push(entry);
    if (requestLog) {
      fs.appendFileSync(requestLog, JSON.stringify(entry) + "\n");
    }
  };
  const server = http.createServer((_, res) => {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(
      JSON.stringify({ code: "not_found", message: "mock gateway only serves WebSocket RPC" }),
    );
  });
  const wss = new WebSocketServer({ server });

  wss.on("connection", (socket) => {
    socket.send(
      JSON.stringify({
        type: "event",
        event: "connect.challenge",
        payload: { nonce: "mock-nonce" },
      }),
    );

    socket.on("message", (raw) => {
      let frame;
      try {
        const text =
          typeof raw === "string" ? raw : Buffer.isBuffer(raw) ? raw.toString("utf-8") : "";
        frame = JSON.parse(text);
      } catch {
        socket.send(JSON.stringify(responseError("", "invalid_json", "invalid JSON frame")));
        return;
      }
      if (frame.type !== "req") {
        return;
      }
      recordRequest({ method: frame.method, params: frame.params });
      if (frame.method === "connect") {
        const suppliedToken = frame.params?.auth?.token;
        if (suppliedToken !== token) {
          socket.send(JSON.stringify(responseError(frame.id, "unauthorized", "invalid token")));
          return;
        }
        socket.send(JSON.stringify(response(frame.id, { ok: true, protocol: protocolVersion })));
        return;
      }
      const handler = methods[frame.method];
      if (!handler) {
        socket.send(
          JSON.stringify(
            responseError(frame.id, "method_not_found", `unknown method: ${frame.method}`),
          ),
        );
        return;
      }
      try {
        socket.send(JSON.stringify(response(frame.id, handler(frame.params ?? {}))));
      } catch (error) {
        socket.send(
          JSON.stringify(
            responseError(
              frame.id,
              "mock_handler_failed",
              error instanceof Error ? error.message : String(error),
            ),
          ),
        );
      }
    });
  });

  await new Promise((resolve) =>
    server.listen(options.port ?? 0, options.host ?? "127.0.0.1", resolve),
  );
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("mock gateway failed to bind a TCP address");
  }
  const url = `http://${address.address}:${address.port}`;
  return {
    url,
    wsUrl: `ws://${address.address}:${address.port}`,
    token,
    requests,
    close: async () => {
      for (const client of wss.clients) {
        client.terminate();
      }
      await new Promise((resolve, reject) => {
        wss.close((wssError) => {
          if (wssError) {
            reject(wssError);
            return;
          }
          server.close((serverError) => {
            if (serverError) {
              reject(serverError);
              return;
            }
            resolve();
          });
        });
      });
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const gateway = await startMockGateway({
    token: process.env.MOCK_GATEWAY_TOKEN ?? defaultToken,
    port: process.env.MOCK_GATEWAY_PORT ? Number(process.env.MOCK_GATEWAY_PORT) : 0,
    requestLog: process.env.MOCK_GATEWAY_REQUEST_LOG,
  });
  process.stdout.write(JSON.stringify({ url: gateway.url, token: gateway.token }) + "\n");
  const shutdown = async () => {
    await gateway.close();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
