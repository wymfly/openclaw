import { expect, test } from "@playwright/test";
import { startLocalStack, type E2EStack } from "./helpers";

test.describe("live projection stream contract", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startLocalStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("accepts fresh and Last-Event-ID reconnect attempts", async ({ page }) => {
    const attempts = await page.evaluate(async (base) => {
      async function connect(lastEventId: string) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2_000);
        try {
          const response = await fetch(`${base}/api/stream`, {
            headers: lastEventId ? { "Last-Event-ID": lastEventId } : {},
            signal: controller.signal,
          });
          return {
            ok: response.ok,
            status: response.status,
            contentType: response.headers.get("content-type") ?? "",
          };
        } finally {
          clearTimeout(timeout);
          controller.abort();
        }
      }
      return [await connect(""), await connect("1")];
    }, stack.backendBase);

    expect(attempts).toHaveLength(2);
    for (const attempt of attempts) {
      expect(attempt.ok, `stream returned ${attempt.status}`).toBe(true);
      expect(attempt.contentType).toContain("text/event-stream");
    }
  });
});
