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
});
