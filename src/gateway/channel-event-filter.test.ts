import { describe, expect, it, vi } from "vitest";
import {
  resolveChannelEventStreams,
  DEFAULT_EVENT_STREAMS,
  shouldFilterChannelEvent,
} from "./channel-event-filter.js";

vi.mock("../config/config.js", () => ({
  loadConfig: vi.fn(),
}));

import { loadConfig } from "../config/config.js";

const mockLoadConfig = vi.mocked(loadConfig);

describe("resolveChannelEventStreams", () => {
  it("returns agent-level eventStreams when configured", () => {
    mockLoadConfig.mockReturnValue({
      agents: { list: [{ id: "coder", channels: { eventStreams: ["lifecycle", "tool"] } }] },
    } as ReturnType<typeof loadConfig>);
    expect(resolveChannelEventStreams("agent:coder:main")).toEqual(["lifecycle", "tool"]);
  });

  it("falls back to agents.defaults.channels.eventStreams", () => {
    mockLoadConfig.mockReturnValue({
      agents: { defaults: { channels: { eventStreams: ["lifecycle"] } }, list: [{ id: "main" }] },
    } as ReturnType<typeof loadConfig>);
    expect(resolveChannelEventStreams("agent:main:main")).toEqual(["lifecycle"]);
  });

  it("falls back to DEFAULT_EVENT_STREAMS when nothing configured", () => {
    mockLoadConfig.mockReturnValue({
      agents: { list: [{ id: "main" }] },
    } as ReturnType<typeof loadConfig>);
    expect(resolveChannelEventStreams("agent:main:main")).toEqual(DEFAULT_EVENT_STREAMS);
  });

  it("returns DEFAULT_EVENT_STREAMS for non-agent session keys", () => {
    mockLoadConfig.mockReturnValue({
      agents: { list: [{ id: "main" }] },
    } as ReturnType<typeof loadConfig>);
    // parseAgentSessionKey returns null for keys with < 3 parts
    expect(resolveChannelEventStreams("some-legacy-key")).toEqual(DEFAULT_EVENT_STREAMS);
  });
});

describe("shouldFilterChannelEvent", () => {
  it("allows chat events (never filtered)", () => {
    expect(shouldFilterChannelEvent("chat", undefined, ["lifecycle"])).toBe(false);
  });
  it("allows error stream (always pass through)", () => {
    expect(shouldFilterChannelEvent("agent", "error", ["lifecycle"])).toBe(false);
  });
  it("allows stream in whitelist", () => {
    expect(shouldFilterChannelEvent("agent", "lifecycle", ["lifecycle", "assistant"])).toBe(false);
  });
  it("filters stream NOT in whitelist", () => {
    expect(shouldFilterChannelEvent("agent", "tool", ["lifecycle", "assistant"])).toBe(true);
  });
  it("filters thinking when not in whitelist", () => {
    expect(shouldFilterChannelEvent("agent", "thinking", ["lifecycle", "assistant"])).toBe(true);
  });
  it("allows thinking when in whitelist", () => {
    expect(shouldFilterChannelEvent("agent", "thinking", ["lifecycle", "thinking"])).toBe(false);
  });
});
