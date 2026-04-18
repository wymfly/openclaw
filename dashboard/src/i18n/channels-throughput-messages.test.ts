import { describe, expect, it } from "vitest";
import en from "./en.json";
import zh from "./zh.json";

function assertThroughputMessages(messages: typeof en | typeof zh) {
  const channels = messages.channels as Record<string, unknown>;

  expect(typeof channels.throughput).toBe("string");
  expect(typeof channels.estimated).toBe("string");
  expect(typeof channels.messagesIn).toBe("string");
  expect(typeof channels.messagesOut).toBe("string");
  expect(typeof channels.noThroughput).toBe("string");
  expect(typeof channels.lastUpdated).toBe("string");
  expect(typeof channels.refreshPaused).toBe("string");
}

describe("channels throughput locale messages", () => {
  it("keeps the throughput chart messages in zh", () => {
    assertThroughputMessages(zh);
  });

  it("keeps the throughput chart messages in en", () => {
    assertThroughputMessages(en);
  });
});
