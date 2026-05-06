import { describe, expect, it } from "vitest";
import { parseSlashCommand } from "../slash-commands";

describe("parseSlashCommand", () => {
  it("parses bare, space-separated, and colon-separated slash commands", () => {
    expect(parseSlashCommand("/status")).toEqual({ name: "status", args: "" });
    expect(parseSlashCommand("/think high")).toEqual({ name: "think", args: "high" });
    expect(parseSlashCommand("/model: cpa/gpt-5.4")).toEqual({
      name: "model",
      args: "cpa/gpt-5.4",
    });
  });

  it("rejects non-command input and empty command names", () => {
    expect(parseSlashCommand("hello")).toBeNull();
    expect(parseSlashCommand("/")).toBeNull();
  });
});
