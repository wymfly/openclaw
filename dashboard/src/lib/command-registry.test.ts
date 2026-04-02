import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandRegistry } from "./command-registry";
import type { RegisteredCommand } from "./command-types";

function makeCmd(overrides: Partial<RegisteredCommand> = {}): RegisteredCommand {
  return {
    name: "test",
    source: "local",
    execMode: "local",
    description: "Test command",
    category: "session",
    priority: 10,
    ...overrides,
  };
}

describe("CommandRegistry", () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    registry = new CommandRegistry();
  });

  it("registers and retrieves a command", () => {
    registry.register(makeCmd());
    expect(registry.get("test")).toBeDefined();
    expect(registry.get("test")?.name).toBe("test");
  });

  it("returns undefined for unknown command", () => {
    expect(registry.get("unknown")).toBeUndefined();
  });

  it("unregisters a command", () => {
    registry.register(makeCmd());
    registry.unregister("test");
    expect(registry.get("test")).toBeUndefined();
  });

  it("priority conflict: lower value wins", () => {
    registry.register(makeCmd({ source: "builtin", priority: 20 }));
    registry.register(makeCmd({ source: "local", priority: 10 }));
    expect(registry.get("test")?.source).toBe("local");
  });

  it("priority conflict: higher value stored as qualified fallback", () => {
    registry.register(makeCmd({ source: "local", priority: 10 }));
    registry.register(makeCmd({ source: "skill", priority: 30 }));
    expect(registry.get("test")?.source).toBe("local");
  });

  it("promotes qualified on unregister", () => {
    registry.register(makeCmd({ source: "local", priority: 10 }));
    registry.register(makeCmd({ source: "builtin", priority: 20 }));
    registry.unregister("test");
    expect(registry.get("test")).toBeDefined();
    expect(registry.get("test")?.source).toBe("builtin");
  });

  it("unregisterBySource removes all commands of that source", () => {
    registry.register(makeCmd({ name: "a", source: "builtin", priority: 20 }));
    registry.register(makeCmd({ name: "b", source: "builtin", priority: 20 }));
    registry.register(makeCmd({ name: "c", source: "local", priority: 10 }));

    registry.unregisterBySource("builtin");

    expect(registry.get("a")).toBeUndefined();
    expect(registry.get("b")).toBeUndefined();
    expect(registry.get("c")).toBeDefined();
  });

  it("getAll returns all active commands", () => {
    registry.register(makeCmd({ name: "a" }));
    registry.register(makeCmd({ name: "b" }));
    expect(registry.getAll()).toHaveLength(2);
  });

  it("filter matches by prefix", () => {
    registry.register(makeCmd({ name: "help" }));
    registry.register(makeCmd({ name: "history" }));
    registry.register(makeCmd({ name: "model" }));

    expect(registry.filter("h")).toHaveLength(2);
    expect(registry.filter("mo")).toHaveLength(1);
  });

  it("filter applies visibleIf when context is provided", () => {
    registry.register(makeCmd({ name: "stop", visibleIf: (ctx) => ctx.isStreaming }));
    registry.register(makeCmd({ name: "help" }));

    const ctx = { isStreaming: false, hasMessages: true };
    expect(registry.filter("", ctx)).toHaveLength(1);
    expect(registry.filter("", ctx)[0]?.name).toBe("help");
  });

  it("registerLocalCommands converts local defs to registered commands", () => {
    registry.registerLocalCommands([
      { name: "new", descriptionKey: "cmd_new", icon: "plus", category: "session" },
      { name: "help", descriptionKey: "cmd_help", icon: "book-open", category: "tools" },
    ]);

    expect(registry.getAll()).toHaveLength(2);
    expect(registry.get("new")?.execMode).toBe("local");
    expect(registry.get("new")?.source).toBe("local");
  });

  it("subscribe notifies on register", () => {
    const listener = vi.fn();
    registry.subscribe(listener);

    registry.register(makeCmd());

    expect(listener).toHaveBeenCalledOnce();
  });

  it("unsubscribe stops notifications", () => {
    const listener = vi.fn();
    const unsubscribe = registry.subscribe(listener);
    unsubscribe();

    registry.register(makeCmd());

    expect(listener).not.toHaveBeenCalled();
  });

  it("getVersion increments on mutations", () => {
    const version0 = registry.getVersion();

    registry.register(makeCmd());
    expect(registry.getVersion()).toBe(version0 + 1);

    registry.unregister("test");
    expect(registry.getVersion()).toBe(version0 + 2);
  });
});
