import { describe, it, expect } from "vitest";
import { parseSchemaSection, type FormField } from "./schema-parser.js";

describe("parseSchemaSection", () => {
  it("parses a string property", () => {
    const schema = {
      properties: {
        name: { type: "string", description: "The name" },
      },
    };
    const fields = parseSchemaSection(schema);
    expect(fields).toHaveLength(1);
    expect(fields[0]).toEqual<FormField>({
      key: "name",
      type: "string",
      description: "The name",
      defaultValue: undefined,
      required: false,
    });
  });

  it("parses a boolean property", () => {
    const schema = {
      properties: {
        enabled: { type: "boolean", default: true },
      },
    };
    const fields = parseSchemaSection(schema);
    expect(fields).toHaveLength(1);
    expect(fields[0]).toEqual<FormField>({
      key: "enabled",
      type: "boolean",
      description: undefined,
      defaultValue: true,
      required: false,
    });
  });

  it("parses a number property", () => {
    const schema = {
      properties: {
        port: { type: "number", description: "Server port", default: 8080 },
      },
    };
    const fields = parseSchemaSection(schema);
    expect(fields).toHaveLength(1);
    expect(fields[0]).toEqual<FormField>({
      key: "port",
      type: "number",
      description: "Server port",
      defaultValue: 8080,
      required: false,
    });
  });

  it("parses an integer property as number", () => {
    const schema = {
      properties: {
        maxRetries: { type: "integer", default: 3 },
      },
    };
    const fields = parseSchemaSection(schema);
    expect(fields).toHaveLength(1);
    expect(fields[0]?.type).toBe("number");
  });

  it("parses an enum as select", () => {
    const schema = {
      properties: {
        mode: { enum: ["local", "remote", "hybrid"], description: "Run mode" },
      },
    };
    const fields = parseSchemaSection(schema);
    expect(fields).toHaveLength(1);
    expect(fields[0]).toEqual<FormField>({
      key: "mode",
      type: "enum",
      description: "Run mode",
      defaultValue: undefined,
      options: ["local", "remote", "hybrid"],
      required: false,
    });
  });

  it("parses a nested object with children", () => {
    const schema = {
      properties: {
        gateway: {
          type: "object",
          description: "Gateway settings",
          properties: {
            port: { type: "number", default: 18789 },
            bind: { type: "string", default: "loopback" },
          },
        },
      },
    };
    const fields = parseSchemaSection(schema);
    expect(fields).toHaveLength(1);
    const gw = fields[0];
    expect(gw?.type).toBe("object");
    expect(gw?.description).toBe("Gateway settings");
    expect(gw?.children).toHaveLength(2);
    expect(gw?.children?.[0]?.key).toBe("port");
    expect(gw?.children?.[1]?.key).toBe("bind");
  });

  it("marks required fields", () => {
    const schema = {
      required: ["name"],
      properties: {
        name: { type: "string" },
        optional: { type: "string" },
      },
    };
    const fields = parseSchemaSection(schema);
    expect(fields).toHaveLength(2);
    const nameField = fields.find((f) => f.key === "name");
    const optField = fields.find((f) => f.key === "optional");
    expect(nameField?.required).toBe(true);
    expect(optField?.required).toBe(false);
  });

  it("handles array property", () => {
    const schema = {
      properties: {
        tags: { type: "array", description: "Tags list" },
      },
    };
    const fields = parseSchemaSection(schema);
    expect(fields).toHaveLength(1);
    expect(fields[0]?.type).toBe("array");
  });

  it("skips null/non-object property definitions", () => {
    const schema = {
      properties: {
        good: { type: "string" },
        bad: null,
        worse: 42,
      },
    };
    const fields = parseSchemaSection(schema as Record<string, unknown>);
    expect(fields).toHaveLength(1);
    expect(fields[0]?.key).toBe("good");
  });

  it("treats unknown typed properties as string", () => {
    const schema = {
      properties: {
        custom: { type: "customType" },
      },
    };
    const fields = parseSchemaSection(schema);
    expect(fields).toHaveLength(1);
    expect(fields[0]?.type).toBe("string");
  });

  it("returns empty array for empty schema", () => {
    const fields = parseSchemaSection({});
    expect(fields).toEqual([]);
  });

  it("handles schema with properties at root level (no wrapper)", () => {
    // When passed a flat properties map directly
    const schema = {
      host: { type: "string", default: "localhost" },
      port: { type: "number", default: 3000 },
    };
    const fields = parseSchemaSection(schema as Record<string, unknown>);
    expect(fields).toHaveLength(2);
  });

  // ---------------------------------------------------------------------------
  // Validation constraints
  // ---------------------------------------------------------------------------

  it("extracts string validation constraints (minLength, maxLength, pattern)", () => {
    const schema = {
      properties: {
        name: { type: "string", minLength: 1, maxLength: 100, pattern: "^[a-z]+$" },
      },
    };
    const fields = parseSchemaSection(schema);
    expect(fields[0]?.validation).toEqual({
      minLength: 1,
      maxLength: 100,
      pattern: "^[a-z]+$",
    });
  });

  it("extracts number validation constraints (minimum, maximum)", () => {
    const schema = {
      properties: {
        port: { type: "number", minimum: 1, maximum: 65535 },
      },
    };
    const fields = parseSchemaSection(schema);
    expect(fields[0]?.validation).toEqual({
      minimum: 1,
      maximum: 65535,
    });
  });

  it("does not set validation when no constraints present", () => {
    const schema = {
      properties: {
        name: { type: "string" },
      },
    };
    const fields = parseSchemaSection(schema);
    expect(fields[0]?.validation).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // Array itemSchema
  // ---------------------------------------------------------------------------

  it("parses array items sub-schema", () => {
    const schema = {
      properties: {
        tags: { type: "array", items: { type: "string" }, description: "Tag list" },
      },
    };
    const fields = parseSchemaSection(schema);
    expect(fields[0]?.type).toBe("array");
    expect(fields[0]?.itemSchema).toBeDefined();
    expect(fields[0]?.itemSchema?.type).toBe("string");
    expect(fields[0]?.itemSchema?.key).toBe("item");
  });

  it("parses array with object items", () => {
    const schema = {
      properties: {
        rules: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" }, priority: { type: "number" } },
          },
        },
      },
    };
    const fields = parseSchemaSection(schema);
    expect(fields[0]?.itemSchema?.type).toBe("object");
    expect(fields[0]?.itemSchema?.children).toHaveLength(2);
  });

  it("returns undefined itemSchema for untyped array", () => {
    const schema = {
      properties: {
        data: { type: "array" },
      },
    };
    const fields = parseSchemaSection(schema);
    expect(fields[0]?.itemSchema).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // Object valueSchema (record/map)
  // ---------------------------------------------------------------------------

  it("parses object additionalProperties as valueSchema", () => {
    const schema = {
      properties: {
        env: {
          type: "object",
          additionalProperties: { type: "string" },
        },
      },
    };
    const fields = parseSchemaSection(schema);
    expect(fields[0]?.type).toBe("object");
    expect(fields[0]?.valueSchema).toBeDefined();
    expect(fields[0]?.valueSchema?.type).toBe("string");
    expect(fields[0]?.valueSchema?.key).toBe("value");
  });

  it("does not set valueSchema when additionalProperties is boolean", () => {
    const schema = {
      properties: {
        data: { type: "object", additionalProperties: true },
      },
    };
    const fields = parseSchemaSection(schema);
    expect(fields[0]?.valueSchema).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // Union variants (oneOf / anyOf)
  // ---------------------------------------------------------------------------

  it("parses oneOf with const values as enum (all-const shortcut)", () => {
    const schema = {
      properties: {
        mode: {
          oneOf: [
            { const: "local", title: "Local" },
            { const: "remote", title: "Remote" },
          ],
        },
      },
    };
    const fields = parseSchemaSection(schema);
    // All-const variants are promoted to enum type for direct selection
    expect(fields[0]?.type).toBe("enum");
    expect(fields[0]?.options).toEqual(["local", "remote"]);
  });

  it("parses anyOf with object variants", () => {
    const schema = {
      properties: {
        provider: {
          anyOf: [
            {
              type: "object",
              title: "OpenAI",
              properties: { apiKey: { type: "string" } },
            },
            {
              type: "object",
              title: "Anthropic",
              properties: { apiKey: { type: "string" } },
            },
          ],
        },
      },
    };
    const fields = parseSchemaSection(schema);
    expect(fields[0]?.variants).toHaveLength(2);
    expect(fields[0]?.variants?.[0]?.value).toBe("OpenAI");
    expect(fields[0]?.variants?.[0]?.fields).toBeDefined();
    expect(fields[0]?.variants?.[1]?.value).toBe("Anthropic");
  });

  it("passes discriminator propertyName to field for discriminated unions", () => {
    const schema = {
      properties: {
        output: {
          discriminator: { propertyName: "kind" },
          oneOf: [
            {
              type: "object",
              title: "File",
              properties: { kind: { const: "file" }, path: { type: "string" } },
            },
            {
              type: "object",
              title: "Stream",
              properties: { kind: { const: "stream" }, url: { type: "string" } },
            },
          ],
        },
      },
    };
    const fields = parseSchemaSection(schema);
    expect(fields[0]?.discriminator).toBe("kind");
    expect(fields[0]?.variants).toHaveLength(2);
    expect(fields[0]?.variants?.[0]?.value).toBe("file");
    expect(fields[0]?.variants?.[1]?.value).toBe("stream");
  });
});
