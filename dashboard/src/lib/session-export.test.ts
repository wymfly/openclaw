import { describe, it, expect } from "vitest";
import { exportAsJson, exportAsMarkdown } from "./session-export";

const mockSession = {
  key: "agent:bot-1:direct:user123",
  kind: "direct" as const,
  model: "claude-sonnet-4-20250514",
  tokensIn: 1500,
  tokensOut: 800,
  contextWindow: 8000,
  compactionCount: 0,
  updatedAt: 1711100000000,
};

const mockMessages = [
  { role: "user" as const, content: "Hello", timestamp: 1711100000000 },
  {
    role: "assistant" as const,
    content: "Hi there!",
    timestamp: 1711100001000,
  },
];

describe("exportAsJson", () => {
  it("includes session metadata and messages", () => {
    const json = exportAsJson(mockSession, mockMessages);
    const parsed = JSON.parse(json);
    expect(parsed.session.key).toBe("agent:bot-1:direct:user123");
    expect(parsed.session.model).toBe("claude-sonnet-4-20250514");
    expect(parsed.messages).toHaveLength(2);
    expect(parsed.exportedAt).toBeDefined();
  });

  it("handles empty messages", () => {
    const json = exportAsJson(mockSession, []);
    const parsed = JSON.parse(json);
    expect(parsed.messages).toEqual([]);
  });
});

describe("exportAsMarkdown", () => {
  it("formats messages with role headers", () => {
    const md = exportAsMarkdown(mockSession, mockMessages);
    expect(md).toContain("# Session: agent:bot-1:direct:user123");
    expect(md).toContain("**User:**");
    expect(md).toContain("Hello");
    expect(md).toContain("**Assistant:**");
    expect(md).toContain("Hi there!");
  });

  it("includes metadata section", () => {
    const md = exportAsMarkdown(mockSession, mockMessages);
    expect(md).toContain("claude-sonnet-4-20250514");
    expect(md).toContain("1500");
    expect(md).toContain("800");
  });

  it("handles empty messages", () => {
    const md = exportAsMarkdown(mockSession, []);
    expect(md).toContain("# Session:");
    expect(md).not.toContain("**User:**");
  });
});
