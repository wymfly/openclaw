import { describe, expect, it } from "vitest";
import {
  buildAgentIdentityPatch,
  buildAgentRuntimePatch,
  AGENT_SECTIONS,
  buildCreateAgentRequest,
  hasOverviewChanges,
  hasRuntimeChanges,
  initialCreateDraft,
  isConflictError,
  readSectionFromHash,
  validateCreateStep,
} from "../agents-panel-state";

describe("agents panel state helpers", () => {
  it("builds minimal overview patches", () => {
    const agent = {
      id: "main",
      name: "Main",
      model: "gpt-5.4",
      workspace: "/repo",
      emoji: "M",
      status: "idle" as const,
      isDefault: true,
    };
    const draft = { name: "Main Ops", model: "", workspace: "/repo", emoji: "M", avatar: "" };

    expect(hasOverviewChanges(agent, draft)).toBe(true);
    expect(hasRuntimeChanges(agent, draft)).toBe(false);
    expect(buildAgentIdentityPatch(agent, draft)).toEqual({
      name: "Main Ops",
    });
    expect(buildAgentRuntimePatch(agent, draft)).toEqual({});
  });

  it("submits create requests with backend-supported model seed", () => {
    const draft = {
      ...initialCreateDraft(),
      name: "Research",
      workspace: "/workspace",
      model: "not-submitted-yet",
      emoji: "R",
      avatar: "https://example.test/avatar.png",
    };

    expect(buildCreateAgentRequest(draft)).toEqual({
      name: "Research",
      workspace: "/workspace",
      model: "not-submitted-yet",
      emoji: "R",
      avatar: "https://example.test/avatar.png",
    });
  });

  it("guards wizard validation and conflict detection", () => {
    expect(validateCreateStep(initialCreateDraft())).toBe("validation.nameRequired");
    expect(isConflictError(new Error("409 conflict: stale hash"))).toBe(true);
    expect(readSectionFromHash("#files")).toBe("files");
    expect(readSectionFromHash("#runtime")).toBe("workspace");
    expect(readSectionFromHash("#tool-policy")).toBe("tools");
    expect(readSectionFromHash("#event-streams")).toBe("delivery");
    expect(readSectionFromHash("#system-prompt")).toBe("conversation");
    expect(readSectionFromHash("#missing")).toBe("overview");
  });

  it("exposes the 11 task-driven sections in order", () => {
    expect(AGENT_SECTIONS.map((section) => section.id)).toEqual([
      "overview",
      "model",
      "workspace",
      "skills",
      "subagents",
      "tools",
      "conversation",
      "delivery",
      "files",
      "routing",
      "danger",
    ]);
  });
});
