import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SkillCommandSpec } from "../../../agents/skills.js";
import type { ChatCommandDefinition } from "../../../auto-reply/commands-registry.types.js";
import type { GatewayRequestHandlerOptions, RespondFn } from "../types.js";

const {
  mockResolveDefaultAgentId,
  mockLoadConfig,
  mockGetChatCommands,
  mockListSkillCommandsForAgents,
} = vi.hoisted(() => ({
  mockResolveDefaultAgentId: vi.fn(),
  mockLoadConfig: vi.fn(),
  mockGetChatCommands: vi.fn(),
  mockListSkillCommandsForAgents: vi.fn(),
}));

vi.mock("../../../agents/agent-scope.js", () => ({
  resolveDefaultAgentId: mockResolveDefaultAgentId,
}));

vi.mock("../../../config/config.js", () => ({
  loadConfig: mockLoadConfig,
}));

vi.mock("../../../auto-reply/commands-registry.data.js", () => ({
  getChatCommands: mockGetChatCommands,
}));

vi.mock("../../../auto-reply/skill-commands.js", () => ({
  listSkillCommandsForAgents: mockListSkillCommandsForAgents,
}));

import { deckCommandsHandlers } from "./commands.js";

function callDiscover(
  params: Record<string, unknown>,
): Promise<{ ok: boolean; payload?: unknown; error?: unknown }> {
  return new Promise((resolve) => {
    const respond: RespondFn = (ok, payload, error) => {
      resolve({ ok, payload, error });
    };
    const handler = deckCommandsHandlers["deck.commands.discover"];
    if (!handler) {
      throw new Error("deck.commands.discover handler not found");
    }
    void handler({
      params,
      respond,
      req: { type: "req" as const, id: "1", method: "deck.commands.discover", params },
      client: null,
      isWebchatConnect: () => false,
      context: {} as GatewayRequestHandlerOptions["context"],
    });
  });
}

function makeBuiltinCommands(): ChatCommandDefinition[] {
  return [
    {
      key: "status",
      description: "Show current status",
      textAliases: ["/status"],
      scope: "text",
    },
    {
      key: "native-only",
      description: "Native-only command",
      textAliases: [],
      scope: "native",
    },
    {
      key: "queue",
      description: "Configure queue",
      textAliases: ["/queue"],
      scope: "both",
      acceptsArgs: true,
      args: [
        {
          name: "mode",
          description: "Queue mode",
          type: "string",
          choices: ["on", "off"],
        },
        {
          name: "value",
          description: "Queue value",
          type: "string",
          captureRemaining: true,
        },
      ],
    },
  ];
}

function makeSkillCommands(): SkillCommandSpec[] {
  return [
    {
      name: "deploy",
      skillName: "Deploy",
      description: "Deploy app",
    },
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveDefaultAgentId.mockReturnValue("main");
  mockLoadConfig.mockReturnValue({});
  mockGetChatCommands.mockReturnValue(makeBuiltinCommands());
  mockListSkillCommandsForAgents.mockReturnValue(makeSkillCommands());
});

describe("deck.commands.discover", () => {
  it("aggregates builtin and skill commands and skips native-only commands", async () => {
    const result = await callDiscover({});
    expect(result.ok).toBe(true);

    const payload = result.payload as {
      commands: Array<{
        name: string;
        source: "builtin" | "skill" | "plugin";
        description: string;
        args?: string;
        argChoices?: string[];
        category?: string;
        skillName?: string;
      }>;
      version: string;
    };

    expect(payload.commands).toEqual([
      {
        name: "queue",
        source: "builtin",
        description: "Configure queue",
        args: "<mode> <value...>",
        argChoices: ["on", "off"],
        category: "more",
      },
      {
        name: "status",
        source: "builtin",
        description: "Show current status",
        category: "more",
      },
      {
        name: "deploy",
        source: "skill",
        description: "Deploy app",
        category: "skills",
        skillName: "Deploy",
      },
    ]);
    expect(payload.version).toMatch(/^[0-9a-f]{12}$/);

    expect(mockResolveDefaultAgentId).toHaveBeenCalledTimes(1);
    expect(mockListSkillCommandsForAgents).toHaveBeenCalledWith({
      cfg: expect.any(Object),
      agentIds: ["main"],
    });
  });

  it("rejects invalid params", async () => {
    const result = await callDiscover({ agentId: "main", unexpected: true });
    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({ code: "INVALID_REQUEST" });
  });

  it("uses provided agentId without resolving default", async () => {
    const result = await callDiscover({ agentId: "agent-b" });
    expect(result.ok).toBe(true);
    expect(mockResolveDefaultAgentId).not.toHaveBeenCalled();
    expect(mockListSkillCommandsForAgents).toHaveBeenCalledWith({
      cfg: expect.any(Object),
      agentIds: ["agent-b"],
    });
  });
});
