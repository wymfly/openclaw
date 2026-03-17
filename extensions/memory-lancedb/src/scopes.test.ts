import { describe, test, expect } from "vitest";
import {
  MemoryScopeManager,
  createScopeManager,
  createAgentScope,
  createCustomScope,
  createProjectScope,
  createUserScope,
  parseScopeId,
  isScopeAccessible,
  filterScopesForAgent,
  DEFAULT_SCOPE_CONFIG,
} from "./scopes.js";

describe("MemoryScopeManager", () => {
  test("creates with default config", () => {
    const manager = createScopeManager();
    expect(manager.getAllScopes()).toEqual(["global"]);
    expect(manager.getDefaultScope()).toBe("global");
  });

  test("global scope always exists", () => {
    const manager = createScopeManager({ definitions: {} });
    expect(manager.validateScope("global")).toBe(true);
  });

  test("validates built-in scope patterns", () => {
    const manager = createScopeManager();
    expect(manager.validateScope("global")).toBe(true);
    expect(manager.validateScope("agent:bot-1")).toBe(true);
    expect(manager.validateScope("custom:workspace")).toBe(true);
    expect(manager.validateScope("project:myproj")).toBe(true);
    expect(manager.validateScope("user:alice")).toBe(true);
  });

  test("rejects invalid scopes", () => {
    const manager = createScopeManager();
    expect(manager.validateScope("")).toBe(false);
    expect(manager.validateScope("  ")).toBe(false);
  });

  test("getAccessibleScopes returns all scopes when no agent specified", () => {
    const manager = createScopeManager({
      definitions: {
        global: { description: "Global" },
        "custom:team-a": { description: "Team A" },
      },
    });
    const scopes = manager.getAccessibleScopes();
    expect(scopes).toContain("global");
    expect(scopes).toContain("custom:team-a");
  });

  test("getAccessibleScopes returns default access for unknown agent", () => {
    const manager = createScopeManager();
    const scopes = manager.getAccessibleScopes("unknown-agent");
    expect(scopes).toContain("global");
  });

  test("getAccessibleScopes respects explicit agent access", () => {
    const manager = createScopeManager({
      definitions: {
        global: { description: "Global" },
        "custom:private": { description: "Private" },
      },
      agentAccess: {
        "bot-1": ["global", "custom:private"],
      },
    });
    const scopes = manager.getAccessibleScopes("bot-1");
    expect(scopes).toEqual(["global", "custom:private"]);
  });

  test("getDefaultScope returns agent scope when accessible", () => {
    const manager = createScopeManager({
      definitions: {
        global: { description: "Global" },
        "agent:bot-1": { description: "Bot 1 scope" },
      },
    });
    expect(manager.getDefaultScope("bot-1")).toBe("agent:bot-1");
  });

  test("getDefaultScope falls back to agent scope for unknown agent", () => {
    // Any agent gets its own built-in agent scope by default
    const manager = createScopeManager();
    expect(manager.getDefaultScope("no-scope-agent")).toBe("agent:no-scope-agent");
  });

  test("isAccessible checks agent permissions", () => {
    const manager = createScopeManager({
      definitions: {
        global: { description: "Global" },
        "custom:restricted": { description: "Restricted" },
      },
      agentAccess: {
        "bot-1": ["global"],
      },
    });
    expect(manager.isAccessible("global", "bot-1")).toBe(true);
    expect(manager.isAccessible("custom:restricted", "bot-1")).toBe(false);
  });

  test("isAccessible without agent allows any valid scope", () => {
    const manager = createScopeManager();
    expect(manager.isAccessible("global")).toBe(true);
    expect(manager.isAccessible("agent:any")).toBe(true);
  });
});

describe("scope management", () => {
  test("addScopeDefinition creates new scope", () => {
    const manager = createScopeManager();
    manager.addScopeDefinition("custom:new", { description: "New scope" });
    expect(manager.getAllScopes()).toContain("custom:new");
    expect(manager.getScopeDefinition("custom:new")?.description).toBe("New scope");
  });

  test("addScopeDefinition rejects invalid format", () => {
    const manager = createScopeManager();
    expect(() => manager.addScopeDefinition("", { description: "Empty" })).toThrow();
  });

  test("removeScopeDefinition removes scope", () => {
    const manager = createScopeManager({
      definitions: {
        global: { description: "Global" },
        "custom:temp": { description: "Temp" },
      },
    });
    expect(manager.removeScopeDefinition("custom:temp")).toBe(true);
    expect(manager.getAllScopes()).not.toContain("custom:temp");
  });

  test("removeScopeDefinition prevents removing global", () => {
    const manager = createScopeManager();
    expect(() => manager.removeScopeDefinition("global")).toThrow("Cannot remove global scope");
  });

  test("removeScopeDefinition returns false for non-existent", () => {
    const manager = createScopeManager();
    expect(manager.removeScopeDefinition("custom:nonexistent")).toBe(false);
  });

  test("setAgentAccess and removeAgentAccess", () => {
    const manager = createScopeManager();
    manager.setAgentAccess("bot-1", ["global"]);
    expect(manager.getAccessibleScopes("bot-1")).toEqual(["global"]);

    expect(manager.removeAgentAccess("bot-1")).toBe(true);
    expect(manager.removeAgentAccess("bot-1")).toBe(false); // already removed
  });
});

describe("export/import", () => {
  test("exportConfig returns deep copy", () => {
    const manager = createScopeManager();
    const config = manager.exportConfig();
    expect(config.default).toBe("global");
    // Mutating the export should not affect the manager
    config.default = "changed";
    expect(manager.getDefaultScope()).toBe("global");
  });

  test("importConfig merges configuration", () => {
    const manager = createScopeManager();
    manager.importConfig({
      definitions: {
        "custom:imported": { description: "Imported scope" },
      },
    });
    expect(manager.getAllScopes()).toContain("custom:imported");
    expect(manager.getAllScopes()).toContain("global");
  });
});

describe("getStats", () => {
  test("returns correct statistics", () => {
    const manager = createScopeManager({
      definitions: {
        global: { description: "Global" },
        "agent:bot-1": { description: "Bot 1" },
        "custom:team": { description: "Team" },
        "project:myproj": { description: "Project" },
        "user:alice": { description: "Alice" },
      },
      agentAccess: {
        "bot-1": ["global", "agent:bot-1"],
      },
    });

    const stats = manager.getStats();
    expect(stats.totalScopes).toBe(5);
    expect(stats.agentsWithCustomAccess).toBe(1);
    expect(stats.scopesByType.global).toBe(1);
    expect(stats.scopesByType.agent).toBe(1);
    expect(stats.scopesByType.custom).toBe(1);
    expect(stats.scopesByType.project).toBe(1);
    expect(stats.scopesByType.user).toBe(1);
  });
});

describe("factory functions", () => {
  test("createAgentScope returns agent:id pattern", () => {
    expect(createAgentScope("bot-1")).toBe("agent:bot-1");
  });

  test("createCustomScope returns custom:name pattern", () => {
    expect(createCustomScope("workspace")).toBe("custom:workspace");
  });

  test("createProjectScope returns project:id pattern", () => {
    expect(createProjectScope("myproj")).toBe("project:myproj");
  });

  test("createUserScope returns user:id pattern", () => {
    expect(createUserScope("alice")).toBe("user:alice");
  });
});

describe("utility functions", () => {
  test("parseScopeId parses global scope", () => {
    expect(parseScopeId("global")).toEqual({ type: "global", id: "" });
  });

  test("parseScopeId parses prefixed scopes", () => {
    expect(parseScopeId("agent:bot-1")).toEqual({ type: "agent", id: "bot-1" });
    expect(parseScopeId("custom:name")).toEqual({ type: "custom", id: "name" });
    expect(parseScopeId("project:p1")).toEqual({ type: "project", id: "p1" });
    expect(parseScopeId("user:u1")).toEqual({ type: "user", id: "u1" });
  });

  test("parseScopeId returns null for invalid format", () => {
    expect(parseScopeId("nocolon")).toBeNull();
  });

  test("isScopeAccessible checks inclusion", () => {
    expect(isScopeAccessible("global", ["global", "custom:a"])).toBe(true);
    expect(isScopeAccessible("custom:b", ["global", "custom:a"])).toBe(false);
  });

  test("filterScopesForAgent filters by agent access", () => {
    const manager = createScopeManager({
      agentAccess: { "bot-1": ["global"] },
    });
    const filtered = filterScopesForAgent(["global", "custom:secret"], "bot-1", manager);
    expect(filtered).toEqual(["global"]);
  });

  test("filterScopesForAgent passes through without manager", () => {
    const scopes = ["global", "custom:a"];
    expect(filterScopesForAgent(scopes)).toEqual(scopes);
  });
});
