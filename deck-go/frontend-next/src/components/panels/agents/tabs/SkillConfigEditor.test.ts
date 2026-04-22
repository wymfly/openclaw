import { describe, expect, it } from "vitest";
import { buildSkillConfigPatch } from "./SkillConfigEditor";

describe("buildSkillConfigPatch", () => {
  it("preserves empty apiKey and env to express deletion semantics", () => {
    expect(buildSkillConfigPatch("", [])).toEqual({
      apiKey: "",
      env: {},
    });
  });

  it("normalizes env pairs into a trimmed record", () => {
    expect(
      buildSkillConfigPatch("secret", [
        { key: " OPENAI_API_KEY ", value: "sk-123" },
        { key: "", value: "ignored" },
      ]),
    ).toEqual({
      apiKey: "secret",
      env: {
        OPENAI_API_KEY: "sk-123",
      },
    });
  });
});
