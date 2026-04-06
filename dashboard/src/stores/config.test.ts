import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useConfigStore } from "./config";

describe("config store lookupSchema", () => {
  beforeEach(() => {
    useConfigStore.setState((state) => ({
      ...state,
      schemaCache: new Map(),
      schema: null,
      uiHints: null,
      rawConfig: "",
      editedConfig: "",
      baseHash: null,
      isDirty: false,
      saving: false,
      conflict: false,
      loading: false,
      error: null,
      activeSection: null,
      remoteConfig: null,
    }));
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("caches parsed lookup results", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          path: "agents.defaults",
          schema: {},
          children: [],
        }),
        { status: 200 },
      ),
    );

    const first = await useConfigStore.getState().lookupSchema("agents.defaults");
    const second = await useConfigStore.getState().lookupSchema("agents.defaults");

    expect(first?.path).toBe("agents.defaults");
    expect(second?.path).toBe("agents.defaults");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("does not permanently latch lookup failures", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("temporary lookup failure"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            path: "agents.defaults",
            schema: {},
            children: [],
          }),
          { status: 200 },
        ),
      );

    const first = await useConfigStore.getState().lookupSchema("agents.defaults");
    const second = await useConfigStore.getState().lookupSchema("agents.defaults");

    expect(first).toBeNull();
    expect(second?.path).toBe("agents.defaults");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("parses config.schema payloads before storing bootstrap schema", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          schema: { properties: { agents: {} } },
          uiHints: {},
          version: "1",
          generatedAt: "now",
        }),
        { status: 200 },
      ),
    );

    await useConfigStore.getState().fetchSchema();

    expect(useConfigStore.getState().schema).toEqual({ properties: { agents: {} } });
  });

  it("parses config.get payloads before storing editable config", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          path: "/tmp/openclaw.json",
          exists: true,
          raw: '{\n  "agents": {}\n}',
          parsed: {},
          sourceConfig: {},
          resolved: {},
          valid: true,
          runtimeConfig: {},
          config: { agents: {} },
          issues: [],
          warnings: [],
          legacyIssues: [],
          hash: "hash-1",
        }),
        { status: 200 },
      ),
    );

    await useConfigStore.getState().fetchConfig();

    expect(useConfigStore.getState().editedConfig).toContain('"agents"');
    expect(useConfigStore.getState().baseHash).toBe("hash-1");
  });
});
