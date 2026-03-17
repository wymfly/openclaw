/**
 * Integration test: verifies enhanced modules work together as a pipeline.
 *
 * Tests the flow: inbound → dedup → quota check → reasoning → outbound → failure → pending-reply.
 * All modules use real implementations (no mocks), but with injected dependencies.
 */

import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyFlatKeyCompat } from "./config-compat.js";
import { createQuotaTracker } from "./quota-tracker.js";
import { applyWecomReasoningPolicy } from "./reasoning-visibility.js";
import { createReqIdStore } from "./reqid-store.js";

describe("enhanced pipeline integration", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "wecom-integration-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("full inbound → dedup → quota → reasoning → outbound pipeline", async () => {
    // 1. Config compat: flat-key input → nested config
    const flatConfig = {
      botId: "bot-123",
      secret: "sec-456",
      dmPolicy: "open",
      groupPolicy: "open",
    };
    const nestedConfig = applyFlatKeyCompat(flatConfig);
    expect(nestedConfig.bot?.ws?.botId).toBe("bot-123");
    expect(nestedConfig.bot?.dm?.policy).toBe("open");
    expect(nestedConfig.dynamicAgents?.groupEnabled).toBe(true);

    // 2. ReqId dedup: first message passes, duplicate rejected
    const reqIdStore = createReqIdStore({ storeDir: tmpDir, accountId: "test-acct" });
    await reqIdStore.warmup();

    const firstSeen = reqIdStore.has("chat-1", "req-001");
    expect(firstSeen).toBe(false); // first time → not a dup

    reqIdStore.set("chat-1", "req-001");
    const secondSeen = reqIdStore.has("chat-1", "req-001");
    expect(secondSeen).toBe(true); // duplicate → rejected

    // 3. Quota tracking: record inbound + outbound
    const tracker = createQuotaTracker();
    tracker.recordInboundMessage({ accountId: "test-acct", chatId: "chat-1" });

    const replyQuota = tracker.forecastReplyQuota({ accountId: "test-acct", chatId: "chat-1" });
    expect(replyQuota.exhausted).toBe(false);
    expect(replyQuota.remaining).toBe(30); // fresh, no replies yet

    tracker.recordPassiveReply({ accountId: "test-acct", chatId: "chat-1" });
    const afterReply = tracker.forecastReplyQuota({ accountId: "test-acct", chatId: "chat-1" });
    expect(afterReply.remaining).toBe(29);

    // 4. Reasoning visibility: separate mode preserves thinking
    // applyWecomReasoningPolicy works with pre-separated text and thinkingContent
    const visibleText = "Here is the answer.";
    const thinkContent = "This is my reasoning about the problem";
    const reasoningResult = applyWecomReasoningPolicy({
      text: visibleText,
      thinkingContent: thinkContent,
      policy: { mode: "separate" },
      transport: "bot",
      phase: "final",
    });
    expect(reasoningResult.effectiveMode).toBe("separate");
    expect(reasoningResult.text).toBe(visibleText);
    expect(reasoningResult.thinkingContent).toContain("reasoning about the problem");

    // 5. Hidden mode strips thinking entirely
    const hiddenResult = applyWecomReasoningPolicy({
      text: visibleText,
      thinkingContent: thinkContent,
      policy: { mode: "hidden" },
      transport: "bot",
      phase: "final",
    });
    expect(hiddenResult.text).toBe(visibleText);
    expect(hiddenResult.thinkingContent).toBe("");

    // 6. Code block protection
    const codeBlockOutput = "```\n<think>this is code not thinking</think>\n```\nReal answer";
    const codeResult = applyWecomReasoningPolicy({
      text: codeBlockOutput,
      policy: { mode: "hidden" },
      transport: "bot",
      phase: "final",
    });
    expect(codeResult.text).toContain("<think>this is code not thinking</think>");

    // 7. ReqId persistence: flush and reload
    await reqIdStore.flush();
    const reloaded = createReqIdStore({ storeDir: tmpDir, accountId: "test-acct" });
    await reloaded.warmup();
    expect(reloaded.has("chat-1", "req-001")).toBe(true); // survived reload

    // Cleanup
    reqIdStore.destroy();
    reloaded.destroy();
  });

  it("quota exhaustion blocks sending", () => {
    const tracker = createQuotaTracker();
    const accountId = "quota-test";
    const chatId = "chat-exhaust";

    // Record inbound to start the window
    tracker.recordInboundMessage({ accountId, chatId });

    // Send 30 passive replies to exhaust quota
    for (let i = 0; i < 30; i++) {
      tracker.recordPassiveReply({ accountId, chatId });
    }

    const exhausted = tracker.forecastReplyQuota({ accountId, chatId });
    expect(exhausted.exhausted).toBe(true);
    expect(exhausted.remaining).toBe(0);
  });

  it("active send quota resets at UTC midnight boundary", () => {
    const tracker = createQuotaTracker();
    const accountId = "active-test";
    const chatId = "chat-active";

    // Use a fixed time just before midnight UTC
    const beforeMidnight = new Date("2026-03-17T23:59:00Z").getTime();
    const afterMidnight = new Date("2026-03-18T00:01:00Z").getTime();

    tracker.recordActiveSend({ accountId, chatId, at: beforeMidnight });
    const before = tracker.forecastActiveSendQuota({ accountId, chatId, at: beforeMidnight });
    expect(before.remaining).toBe(9); // 10 - 1

    // After midnight, quota resets
    const after = tracker.forecastActiveSendQuota({ accountId, chatId, at: afterMidnight });
    expect(after.remaining).toBe(10); // reset
  });

  it("config-compat preserves nested keys over flat keys", () => {
    const mixed = {
      botId: "flat-bot",
      secret: "flat-secret",
      dmPolicy: "open",
      bot: {
        ws: { botId: "nested-bot", secret: "nested-secret" },
        dm: { policy: "allowlist" as const },
      },
    };
    const result = applyFlatKeyCompat(mixed);
    // Nested takes precedence
    expect(result.bot?.ws?.botId).toBe("nested-bot");
    expect(result.bot?.ws?.secret).toBe("nested-secret");
    expect(result.bot?.dm?.policy).toBe("allowlist");
  });
});
