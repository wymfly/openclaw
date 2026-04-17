import { beforeEach, describe, expect, test, vi } from "vitest";

describe("access descriptor side-effect mounting", () => {
  beforeEach(async () => {
    vi.resetModules();
    const registry = await import("./access-descriptor-registry");
    registry.__resetAccessDescriptorsForTesting();
  });

  test("wecom descriptor is registered when barrel is imported", async () => {
    const registry = await import("./access-descriptor-registry");
    expect(registry.hasAccessDescriptor("wecom")).toBe(false);

    await import("./index");

    expect(registry.hasAccessDescriptor("wecom")).toBe(true);
  });
});
