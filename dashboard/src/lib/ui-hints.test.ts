import { describe, expect, it } from "vitest";
import type { FormField } from "./schema-parser";
import { applyUiHints, matchUiHint } from "./ui-hints";

// ---------------------------------------------------------------------------
// matchUiHint
// ---------------------------------------------------------------------------

describe("matchUiHint", () => {
  it("returns hint for exact path match", () => {
    const hints = { "models.apiKey": { sensitive: true } };
    const result = matchUiHint("models.apiKey", hints);
    expect(result).toEqual({ sensitive: true });
  });

  it("returns hint for wildcard match on array index", () => {
    const hints = { "models.providers.*.apiKey": { sensitive: true } };
    const result = matchUiHint("models.providers.0.apiKey", hints);
    expect(result).toEqual({ sensitive: true });
  });

  it("exact path takes precedence over wildcard", () => {
    const hints = {
      "models.providers.*.apiKey": { sensitive: true, placeholder: "wildcard" },
      "models.providers.0.apiKey": { sensitive: false, placeholder: "exact" },
    };
    const result = matchUiHint("models.providers.0.apiKey", hints);
    expect(result).toEqual({ sensitive: false, placeholder: "exact" });
  });

  it("returns undefined when no path matches", () => {
    const hints = { "other.path": { sensitive: true } };
    const result = matchUiHint("models.apiKey", hints);
    expect(result).toBeUndefined();
  });

  it("returns undefined for empty hints map", () => {
    const result = matchUiHint("models.apiKey", {});
    expect(result).toBeUndefined();
  });

  it("returns undefined when wildcard segment count does not match", () => {
    const hints = { "a.*.c": { sensitive: true } };
    // "a.b.c.d" has 4 segments vs 3 in pattern
    expect(matchUiHint("a.b.c.d", hints)).toBeUndefined();
    // "a.b" has 2 segments
    expect(matchUiHint("a.b", hints)).toBeUndefined();
  });

  it("supports multiple wildcards in the same pattern", () => {
    const hints = { "a.*.c.*": { collapsed: true } };
    expect(matchUiHint("a.x.c.y", hints)).toEqual({ collapsed: true });
    expect(matchUiHint("a.x.d.y", hints)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// applyUiHints
// ---------------------------------------------------------------------------

function makeField(key: string, overrides: Partial<FormField> = {}): FormField {
  return { key, type: "string", ...overrides };
}

describe("applyUiHints", () => {
  it("decorates field with sensitive hint", () => {
    const fields: FormField[] = [makeField("apiKey")];
    const hints = { apiKey: { sensitive: true } };
    const [result] = applyUiHints(fields, hints);
    expect(result.sensitive).toBe(true);
  });

  it("decorates field with collapsed hint", () => {
    const fields: FormField[] = [makeField("advanced")];
    const hints = { advanced: { collapsed: true } };
    const [result] = applyUiHints(fields, hints);
    expect(result.collapsed).toBe(true);
  });

  it("decorates field with placeholder hint", () => {
    const fields: FormField[] = [makeField("host")];
    const hints = { host: { placeholder: "e.g. localhost" } };
    const [result] = applyUiHints(fields, hints);
    expect(result.placeholder).toBe("e.g. localhost");
  });

  it("decorates field with all three hints at once", () => {
    const fields: FormField[] = [makeField("secret")];
    const hints = { secret: { sensitive: true, collapsed: false, placeholder: "enter secret" } };
    const [result] = applyUiHints(fields, hints);
    expect(result.sensitive).toBe(true);
    expect(result.collapsed).toBe(false);
    expect(result.placeholder).toBe("enter secret");
  });

  it("does not modify field when no hint matches", () => {
    const fields: FormField[] = [makeField("name")];
    const hints = { other: { sensitive: true } };
    const [result] = applyUiHints(fields, hints);
    expect(result.sensitive).toBeUndefined();
    expect(result.collapsed).toBeUndefined();
    expect(result.placeholder).toBeUndefined();
  });

  it("returns same structure when hints map is empty", () => {
    const fields: FormField[] = [makeField("host"), makeField("port", { type: "number" })];
    const result = applyUiHints(fields, {});
    // Returns identical reference when empty (fast-path)
    expect(result).toBe(fields);
  });

  it("does not mutate original field objects", () => {
    const original = makeField("apiKey");
    const fields: FormField[] = [original];
    const hints = { apiKey: { sensitive: true } };
    applyUiHints(fields, hints);
    expect(original.sensitive).toBeUndefined();
  });

  it("recurses into children with extended prefix", () => {
    const child = makeField("apiKey");
    const parent = makeField("provider", {
      type: "object",
      children: [child],
    });
    const hints = { "provider.apiKey": { sensitive: true } };
    const [resultParent] = applyUiHints([parent], hints);
    expect(resultParent.children?.[0].sensitive).toBe(true);
    // parent itself unaffected
    expect(resultParent.sensitive).toBeUndefined();
  });

  it("applies wildcard hints to nested children", () => {
    const child = makeField("apiKey");
    const parent = makeField("providers", {
      type: "object",
      children: [child],
    });
    const hints = { "providers.*.apiKey": { sensitive: true } };
    // We need the child's key to be an index-like value; simulate with numeric key
    const indexChild = makeField("0", { type: "object", children: [makeField("apiKey")] });
    const [result] = applyUiHints(
      [makeField("providers", { type: "object", children: [indexChild] })],
      hints,
    );
    // "providers.0.apiKey" should match "providers.*.apiKey"
    expect(result.children?.[0].children?.[0].sensitive).toBe(true);

    // Baseline: direct field using the child fixture above should NOT match
    // since "providers.apiKey" != "providers.*.apiKey"
    const [r2] = applyUiHints([parent], hints);
    expect(r2.children?.[0].sensitive).toBeUndefined();
  });
});
