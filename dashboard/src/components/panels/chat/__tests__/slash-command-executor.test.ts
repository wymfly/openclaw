import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("slash command executor", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("removes kill from local slash commands", async () => {
    const { LOCAL_COMMAND_DEFS } = await import("../slash-commands");
    expect(LOCAL_COMMAND_DEFS.map((command) => command.name)).not.toContain("kill");
  });

  it("reset calls the reset route and keeps a reset action", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true, key: "sess-1" }), { status: 200 }),
      );

    const { executeSlashCommand } = await import("../slash-command-executor");
    const result = await executeSlashCommand("sess-1", "reset", "");

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/chat/sessions/reset",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(result.action).toBe("reset");
  });

  it("clear calls the clear route and keeps a clear action", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true, key: "sess-1" }), { status: 200 }),
      );

    const { executeSlashCommand } = await import("../slash-command-executor");
    const result = await executeSlashCommand("sess-1", "clear", "");

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/chat/sessions/clear",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(result.action).toBe("clear");
  });
});
