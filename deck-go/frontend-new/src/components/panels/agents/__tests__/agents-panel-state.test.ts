import { describe, expect, it } from "vitest";
import {
  buildAgentPatch,
  buildCreateAgentRequest,
  hasOverviewChanges,
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
    expect(buildAgentPatch(agent, draft)).toEqual({
      name: "Main Ops",
      model: undefined,
    });
  });

  it("submits create requests limited to backend-supported fields", () => {
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
      emoji: "R",
      avatar: "https://example.test/avatar.png",
    });
  });

  it("guards wizard validation and conflict detection", () => {
    expect(validateCreateStep(initialCreateDraft())).toBe("validation.nameRequired");
    expect(isConflictError(new Error("409 conflict: stale hash"))).toBe(true);
    expect(readSectionFromHash("#files")).toBe("files");
    expect(readSectionFromHash("#missing")).toBe("overview");
  });
});
