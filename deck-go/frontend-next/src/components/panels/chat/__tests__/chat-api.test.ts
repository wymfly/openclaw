import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSessionPreviews, resolveInitialSessionSendPlan } from "../chat-api";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveInitialSessionSendPlan", () => {
  it("prefers the create error over a second steer attempt", () => {
    expect(
      resolveInitialSessionSendPlan({
        hasAttachments: false,
        runStarted: false,
        runError: "run failed",
      }),
    ).toEqual({
      kind: "error",
      error: "run failed",
    });
  });

  it("uses send when attachments were deferred out of sessions.create", () => {
    expect(
      resolveInitialSessionSendPlan({
        hasAttachments: true,
        runStarted: false,
      }),
    ).toEqual({
      kind: "send",
    });
  });

  it("keeps the create-started path when the first run already launched", () => {
    expect(
      resolveInitialSessionSendPlan({
        hasAttachments: false,
        runStarted: true,
      }),
    ).toEqual({
      kind: "started",
    });
  });

  it("falls back to send only when create returned no run and no error", () => {
    expect(
      resolveInitialSessionSendPlan({
        hasAttachments: false,
        runStarted: false,
      }),
    ).toEqual({
      kind: "send",
    });
  });
});

describe("fetchSessionPreviews", () => {
  it("returns remote preview overlays keyed by session", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ts: 123,
          previews: [
            {
              key: "sess-1",
              status: "ok",
              items: [
                { role: "user", text: "hello" },
                { role: "assistant", text: "world" },
              ],
            },
          ],
        }),
        { status: 200 },
      ),
    );

    await expect(fetchSessionPreviews(["sess-1"])).resolves.toEqual({
      "sess-1": {
        text: "hello · world",
        updatedAt: 123,
        source: "remote",
      },
    });
  });

  it("skips empty remote preview items", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ts: 321,
          previews: [{ key: "sess-1", status: "empty", items: [] }],
        }),
        { status: 200 },
      ),
    );

    await expect(fetchSessionPreviews(["sess-1"])).resolves.toEqual({
      "sess-1": null,
    });
  });
});
