import { describe, expect, it } from "vitest";
import {
  parseConfigGetResult,
  parseConfigLookupResult,
  parseConfigSchemaResult,
  resolveSectionSchemaNode,
} from "./config-lookup";

describe("parseConfigLookupResult", () => {
  it("accepts valid lookup payloads", () => {
    const payload = {
      path: "agents",
      schema: {},
      hint: { label: "Agents" },
      children: [
        {
          key: "defaults",
          path: "agents.defaults",
          required: false,
          hasChildren: true,
        },
      ],
    };

    expect(parseConfigLookupResult(payload)).toEqual(payload);
  });

  it("rejects malformed lookup payloads", () => {
    expect(
      parseConfigLookupResult({
        path: "agents",
        children: [{ key: "defaults" }],
      }),
    ).toBeNull();
  });

  it("accepts valid config.schema payloads", () => {
    const payload = {
      schema: {},
      uiHints: {},
      version: "1",
      generatedAt: "now",
    };

    expect(parseConfigSchemaResult(payload)).toEqual(payload);
  });

  it("accepts valid config.get payloads", () => {
    const payload = {
      path: "/tmp/openclaw.json",
      exists: true,
      raw: "{}",
      parsed: {},
      sourceConfig: {},
      resolved: {},
      valid: true,
      runtimeConfig: {},
      config: {},
      issues: [],
      warnings: [],
      legacyIssues: [],
      hash: "abc",
    };

    expect(parseConfigGetResult(payload)).toEqual(payload);
  });

  it("prefers lookup schema for the active section when available", () => {
    const result = resolveSectionSchemaNode({
      activeSection: "agents.defaults",
      lookupResult: {
        path: "agents.defaults",
        schema: { source: "lookup" },
        children: [],
      },
    });

    expect(result).toEqual({ source: "lookup" });
  });

  it("does not fall back to bootstrap schema when lookup is missing", () => {
    const result = resolveSectionSchemaNode({
      activeSection: "agents.defaults",
      lookupResult: null,
    });

    expect(result).toBeNull();
  });
});
