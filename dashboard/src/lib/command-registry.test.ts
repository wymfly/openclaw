import { describe, it, expect, beforeEach } from "vitest";
import { CommandRegistry } from "./command-registry";
import type { RegisteredCommand } from "./command-types";

function makeCmd(overrides: Partial<RegisteredCommand> & { name: string }): RegisteredCommand {
  return {
    source: "local",
    execMode: "local",
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

  describe("register / get / unregister", () => {
    it("registers and retrieves a command by name", () => {
      const cmd = makeCmd({ name: "help" });
      registry.register(cmd);
      expect(registry.get("help")).toBe(cmd);
    });

    it("returns undefined for unknown command", () => {
      expect(registry.get("nope")).toBeUndefined();
    });

    it("unregisters a command", () => {
      registry.register(makeCmd({ name: "help" }));
      registry.unregister("help");
      expect(registry.get("help")).toBeUndefined();
    });

    it("getAll returns all registered commands", () => {
      registry.register(makeCmd({ name: "a" }));
      registry.register(makeCmd({ name: "b" }));
      expect(registry.getAll()).toHaveLength(2);
    });
  });

  describe("priority-based conflict resolution", () => {
    it("higher priority (lower number) wins on name conflict", () => {
      const local = makeCmd({ name: "model", source: "local", priority: 10 });
      const builtin = makeCmd({ name: "model", source: "builtin", priority: 20 });
      registry.register(builtin);
      registry.register(local);
      expect(registry.get("model")?.source).toBe("local");
    });

    it("displaced command accessible via qualified name", () => {
      const local = makeCmd({ name: "model", source: "local", priority: 10 });
      const builtin = makeCmd({ name: "model", source: "builtin", priority: 20 });
      registry.register(local);
      registry.register(builtin);
      expect(registry.get("model")?.source).toBe("local");
      expect(registry.get("builtin:model")?.source).toBe("builtin");
    });

    it("lower priority does not override existing higher priority", () => {
      const local = makeCmd({ name: "help", source: "local", priority: 10 });
      const skill = makeCmd({ name: "help", source: "skill", priority: 30 });
      registry.register(local);
      registry.register(skill);
      expect(registry.get("help")?.source).toBe("local");
    });

    it("promotes displaced command after unregister", () => {
      const local = makeCmd({ name: "model", source: "local", priority: 10 });
      const builtin = makeCmd({ name: "model", source: "builtin", priority: 20 });
      registry.register(local);
      registry.register(builtin);
      expect(registry.get("model")?.source).toBe("local");
      registry.unregister("model");
      expect(registry.get("model")?.source).toBe("builtin");
    });

    it("promotes displaced command after unregisterBySource", () => {
      const local = makeCmd({ name: "model", source: "local", priority: 10 });
      const builtin = makeCmd({ name: "model", source: "builtin", priority: 20 });
      registry.register(local);
      registry.register(builtin);
      registry.unregisterBySource("local");
      expect(registry.get("model")?.source).toBe("builtin");
    });
  });

  describe("filter", () => {
    it("empty query returns all commands", () => {
      registry.register(makeCmd({ name: "new", category: "session" }));
      registry.register(makeCmd({ name: "model", category: "model" }));
      const results = registry.filter("");
      expect(results).toHaveLength(2);
    });

    it("prefix search matches across sources", () => {
      registry.register(makeCmd({ name: "model", source: "local" }));
      registry.register(makeCmd({ name: "monitor", source: "builtin", priority: 20 }));
      const results = registry.filter("mo");
      expect(results).toHaveLength(2);
      expect(results.map((c) => c.name)).toContain("model");
      expect(results.map((c) => c.name)).toContain("monitor");
    });

    it("no match returns empty array", () => {
      registry.register(makeCmd({ name: "help" }));
      expect(registry.filter("xyz")).toHaveLength(0);
    });
  });

  describe("registerLocalCommands", () => {
    it("converts SlashCommandDef array to registered commands", () => {
      const defs = [
        { name: "new", descriptionKey: "cmd_new", icon: "plus", category: "session" as const },
        { name: "model", descriptionKey: "cmd_model", args: "<name>", icon: "cpu", category: "model" as const, argOptions: ["gpt-4"] },
      ];
      registry.registerLocalCommands(defs);
      expect(registry.getAll()).toHaveLength(2);
      const newCmd = registry.get("new");
      expect(newCmd?.source).toBe("local");
      expect(newCmd?.execMode).toBe("local");
      expect(newCmd?.descriptionKey).toBe("cmd_new");
      expect(newCmd?.icon).toBe("plus");
      const modelCmd = registry.get("model");
      expect(modelCmd?.argOptions).toEqual(["gpt-4"]);
    });
  });

  describe("unregisterBySource", () => {
    it("removes all commands from a specific source", () => {
      registry.register(makeCmd({ name: "local1", source: "local" }));
      registry.register(makeCmd({ name: "remote1", source: "builtin", priority: 20 }));
      registry.register(makeCmd({ name: "remote2", source: "skill", priority: 30 }));
      registry.unregisterBySource("builtin");
      expect(registry.get("remote1")).toBeUndefined();
      expect(registry.get("local1")).toBeDefined();
      expect(registry.get("remote2")).toBeDefined();
    });
  });
});
