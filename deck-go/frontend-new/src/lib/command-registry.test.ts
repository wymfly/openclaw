import { describe, expect, it } from "vitest";
import { CommandRegistry } from "./command-registry";
import { SOURCE_PRIORITY } from "./command-types";

describe("CommandRegistry", () => {
  it("normalizes command names and aliases for typed lookup", () => {
    const registry = new CommandRegistry();

    registry.register({
      name: "Deploy",
      aliases: ["/Ship", "Release"],
      source: "skill",
      execMode: "remote",
      description: "Deploy",
      category: "skills",
      priority: SOURCE_PRIORITY.skill,
    });

    expect(registry.get("deploy")).toMatchObject({ name: "deploy", aliases: ["ship", "release"] });
    expect(registry.get("ship")).toMatchObject({ name: "deploy" });
    expect(registry.get("release")).toMatchObject({ name: "deploy" });
  });

  it("keeps lower-priority collisions qualified while active lookup follows priority", () => {
    const registry = new CommandRegistry();

    registry.register({
      name: "reset",
      source: "builtin",
      execMode: "remote",
      description: "Gateway reset",
      category: "session",
      priority: SOURCE_PRIORITY.builtin,
    });
    registry.register({
      name: "reset",
      source: "local",
      execMode: "local",
      description: "Deck reset",
      category: "session",
      priority: SOURCE_PRIORITY.local,
    });

    expect(registry.get("reset")).toMatchObject({ source: "local" });
    expect(registry.get("builtin:reset")).toMatchObject({ source: "builtin" });
  });
});
