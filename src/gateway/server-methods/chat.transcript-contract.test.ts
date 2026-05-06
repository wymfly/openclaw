import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  connectOk,
  installGatewayTestHooks,
  rpcReq,
  startServerWithClient,
  testState,
  writeSessionStore,
} from "../test-helpers.js";

installGatewayTestHooks({ scope: "suite" });

const cleanupDirs: string[] = [];

afterEach(async () => {
  testState.sessionStorePath = undefined;
  await Promise.all(
    cleanupDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

async function withChatHistoryHarness(
  run: (ctx: {
    ws: Awaited<ReturnType<typeof startServerWithClient>>["ws"];
    sessionDir: string;
  }) => Promise<void>,
) {
  const { server, ws } = await startServerWithClient();
  const sessionDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-chat-history-contract-"));
  cleanupDirs.push(sessionDir);
  testState.sessionStorePath = path.join(sessionDir, "sessions.json");

  try {
    await connectOk(ws);
    await writeSessionStore({
      entries: {
        main: { sessionId: "sess-main", updatedAt: Date.now() },
      },
      storePath: testState.sessionStorePath,
    });
    await run({ ws, sessionDir });
  } finally {
    ws.close();
    await server.close();
  }
}

async function writeTranscript(sessionDir: string, messages: unknown[]) {
  const lines = [
    JSON.stringify({ type: "session", version: 1, id: "sess-main" }),
    ...messages.map((message, index) =>
      JSON.stringify({
        id: `msg-${index + 1}`,
        message,
      }),
    ),
  ];
  await fs.writeFile(path.join(sessionDir, "sess-main.jsonl"), `${lines.join("\n")}\n`, "utf-8");
}

describe("chat.history transcript contract", () => {
  test("canonicalizes legacy transcript content into deck-facing block arrays", async () => {
    await withChatHistoryHarness(async ({ ws, sessionDir }) => {
      await writeTranscript(sessionDir, [
        {
          role: "user",
          content: "legacy plain user text",
          timestamp: 1_710_000_000_000,
        },
        {
          role: "assistant",
          content: [
            { type: "input_text", text: "input alias" },
            { type: "output_text", text: "output alias" },
            { type: "reasoning", reasoning: "reasoning alias" },
            { type: "analysis", text: "analysis alias" },
            {
              type: "toolCall",
              id: "tool-1",
              name: "read_file",
              arguments: { path: "/tmp/demo.txt" },
            },
            {
              type: "toolResult",
              toolCallId: "tool-1",
              content: [
                { type: "output_text", text: "tool output" },
                {
                  type: "canvas",
                  preview: {
                    kind: "canvas",
                    surface: "assistant_message",
                    render: "url",
                    url: "/__openclaw__/canvas/documents/tool/index.html",
                    viewId: "tool",
                    title: "Tool canvas",
                    preferredHeight: 360,
                  },
                },
                { type: "vendor_metric", score: 0.97, label: "confidence" },
              ],
              is_error: false,
            },
            {
              type: "image",
              source: { type: "base64", media_type: "image/png", data: "aW1hZ2U=" },
              fileName: "demo.png",
            },
            {
              type: "file",
              content: "ZmlsZQ==",
              mimeType: "text/plain",
              fileName: "demo.txt",
              size: 4,
            },
            {
              type: "canvas",
              kind: "canvas",
              surface: "assistant_message",
              render: "url",
              url: "/__openclaw__/canvas/documents/direct/index.html",
              viewId: "direct",
              title: "Direct canvas",
              preferredHeight: 420,
            },
            {
              type: "future_block",
              value: "kept as unknown",
            },
          ],
          timestamp: 1_710_000_000_100,
        },
      ]);

      const historyRes = await rpcReq<{ messages?: unknown[] }>(ws, "chat.history", {
        sessionKey: "main",
        limit: 100,
      });
      expect(historyRes.ok).toBe(true);
      expect(historyRes.payload?.messages).toEqual([
        {
          role: "user",
          content: [{ type: "text", text: "legacy plain user text" }],
          timestamp: 1_710_000_000_000,
          __openclaw: { id: "msg-1", seq: 1 },
        },
        {
          role: "assistant",
          content: [
            { type: "text", text: "input alias" },
            { type: "text", text: "output alias" },
            { type: "thinking", text: "reasoning alias" },
            { type: "thinking", text: "analysis alias" },
            {
              type: "tool_use",
              id: "tool-1",
              name: "read_file",
              input: { path: "/tmp/demo.txt" },
            },
            {
              type: "tool_result",
              toolUseId: "tool-1",
              content: [
                { type: "text", text: "tool output" },
                {
                  type: "canvas",
                  kind: "canvas",
                  surface: "assistant_message",
                  render: "url",
                  url: "/__openclaw__/canvas/documents/tool/index.html",
                  viewId: "tool",
                  title: "Tool canvas",
                  preferredHeight: 360,
                },
                {
                  type: "unknown",
                  rawType: "vendor_metric",
                  summary: { type: "vendor_metric", score: 0.97, label: "confidence" },
                },
              ],
              isError: false,
            },
            {
              type: "image",
              data: "aW1hZ2U=",
              mimeType: "image/png",
              fileName: "demo.png",
            },
            {
              type: "file",
              data: "ZmlsZQ==",
              mimeType: "text/plain",
              fileName: "demo.txt",
              size: 4,
            },
            {
              type: "canvas",
              kind: "canvas",
              surface: "assistant_message",
              render: "url",
              url: "/__openclaw__/canvas/documents/direct/index.html",
              viewId: "direct",
              title: "Direct canvas",
              preferredHeight: 420,
            },
            {
              type: "unknown",
              rawType: "future_block",
              summary: { type: "future_block", value: "kept as unknown" },
            },
          ],
          timestamp: 1_710_000_000_100,
          __openclaw: { id: "msg-2", seq: 2 },
        },
      ]);
    });
  });
});
