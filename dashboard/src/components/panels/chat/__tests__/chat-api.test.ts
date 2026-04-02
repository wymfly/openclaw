import { describe, expect, it } from "vitest";
import { resolveInitialSessionSendPlan } from "../chat-api";

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

  it("uses steer when attachments were deferred out of sessions.create", () => {
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

  it("falls back to steer only when create returned no run and no error", () => {
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
