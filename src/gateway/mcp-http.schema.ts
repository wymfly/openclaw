import type { resolveGatewayScopedTools } from "./tool-resolution.js";

export type McpLoopbackTool = ReturnType<typeof resolveGatewayScopedTools>["tools"][number];

export type McpToolSchemaEntry = {
  name: string;
  description: string | undefined;
  inputSchema: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function schemaFingerprint(value: unknown): string {
  return JSON.stringify(value);
}

function readLiteralValues(schema: Record<string, unknown>): unknown[] | undefined {
  if ("const" in schema) {
    return [schema.const];
  }
  if (Array.isArray(schema.enum)) {
    return schema.enum;
  }
  return undefined;
}

function mergeLiteralSchemas(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const existingValues = readLiteralValues(existing);
  const incomingValues = readLiteralValues(incoming);
  if (!existingValues || !incomingValues) {
    return undefined;
  }
  const merged: Record<string, unknown> = {
    ...existing,
    enum: [...new Set([...existingValues, ...incomingValues])],
  };
  delete merged.const;
  return merged;
}

function expandAnyOf(schema: unknown): unknown[] {
  return isRecord(schema) && Array.isArray(schema.anyOf) ? schema.anyOf : [schema];
}

function mergeSchemaAsAnyOf(existing: unknown, incoming: unknown): Record<string, unknown> {
  const variants: unknown[] = [];
  const seen = new Set<string>();
  for (const schema of [...expandAnyOf(existing), ...expandAnyOf(incoming)]) {
    const fingerprint = schemaFingerprint(schema);
    if (seen.has(fingerprint)) {
      continue;
    }
    seen.add(fingerprint);
    variants.push(schema);
  }
  return { anyOf: variants };
}

function mergePropertySchema(key: string, existing: unknown, incoming: unknown): unknown {
  if (schemaFingerprint(existing) === schemaFingerprint(incoming)) {
    return existing;
  }

  if (isRecord(existing) && isRecord(incoming)) {
    const mergedLiteral = mergeLiteralSchemas(existing, incoming);
    if (mergedLiteral) {
      return mergedLiteral;
    }
  }

  return mergeSchemaAsAnyOf(existing, incoming);
}

function flattenUnionSchema(raw: Record<string, unknown>): Record<string, unknown> {
  const variants = (raw.anyOf ?? raw.oneOf) as Record<string, unknown>[] | undefined;
  if (!Array.isArray(variants) || variants.length === 0) {
    return raw;
  }
  const mergedProps: Record<string, unknown> = {};
  const requiredSets: Set<string>[] = [];
  for (const variant of variants) {
    const props = variant.properties as Record<string, unknown> | undefined;
    if (props) {
      for (const [key, schema] of Object.entries(props)) {
        if (!(key in mergedProps)) {
          mergedProps[key] = schema;
          continue;
        }
        mergedProps[key] = mergePropertySchema(key, mergedProps[key], schema);
      }
    }
    requiredSets.push(
      new Set(Array.isArray(variant.required) ? (variant.required as string[]) : []),
    );
  }
  const required =
    requiredSets.length > 0
      ? [...(requiredSets[0] ?? [])].filter((key) => requiredSets.every((set) => set.has(key)))
      : [];
  const { anyOf: _anyOf, oneOf: _oneOf, ...rest } = raw;
  return { ...rest, type: "object", properties: mergedProps, required };
}

export function buildMcpToolSchema(tools: McpLoopbackTool[]): McpToolSchemaEntry[] {
  return tools.map((tool) => {
    let raw =
      tool.parameters && typeof tool.parameters === "object"
        ? { ...(tool.parameters as Record<string, unknown>) }
        : {};
    if (raw.anyOf || raw.oneOf) {
      raw = flattenUnionSchema(raw);
    }
    if (raw.type !== "object") {
      raw.type = "object";
      if (!raw.properties) {
        raw.properties = {};
      }
    }
    return {
      name: tool.name,
      description: tool.description,
      inputSchema: raw,
    };
  });
}
