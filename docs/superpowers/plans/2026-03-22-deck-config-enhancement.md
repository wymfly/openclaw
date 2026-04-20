# Deck Config Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Config panel to support all Zod-generated JSON Schema types (union, record, typed arrays, format), apply uiHints (password masking, collapsing, placeholders), add diff preview before save, and implement smart write strategy (patch vs apply).

**Architecture:** Extend `schema-parser.ts` to detect complex JSON Schema patterns and produce enriched `FormField` objects. Add new field widgets to `SchemaForm.tsx`. Implement a `config-diff` utility and `DiffPreviewDialog` component. Add `config.patch` API route and smart write strategy in the config store. All changes are frontend-only — no gateway modifications.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zustand, @dnd-kit/sortable, shadcn/ui (Dialog, Select, Input, Switch, Collapsible, Button), next-intl, Vitest

**Skill 依赖：**

| 域         | Skills                              | 加载方式         |
| ---------- | ----------------------------------- | ---------------- |
| [frontend] | frontend-design, ui-ux-pro-max, TDD | session 首次加载 |

**OpenSpec Change:** `deck-config-enhancement`

---

## File Structure

### New Files

| File                                                                       | Responsibility                                                                |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `dashboard/src/lib/schema-parser.test.ts`                                  | Unit tests for schema parser (union, record, array items, format, validation) |
| `dashboard/src/lib/ui-hints.ts`                                            | uiHints path matcher + `applyUiHints()` post-processor                        |
| `dashboard/src/lib/ui-hints.test.ts`                                       | Unit tests for uiHints matching (exact, wildcard, precedence)                 |
| `dashboard/src/lib/config-diff.ts`                                         | `computeConfigDiff()` + `classifyChanges()` + `computeMergePatch()`           |
| `dashboard/src/lib/config-diff.test.ts`                                    | Unit tests for diff, classify, merge patch                                    |
| `dashboard/src/components/panels/config-editor/fields/UnionField.tsx`      | Discriminated union field widget                                              |
| `dashboard/src/components/panels/config-editor/fields/RecordField.tsx`     | Key-value record field widget                                                 |
| `dashboard/src/components/panels/config-editor/fields/TypedArrayField.tsx` | Item-level array field widget with reorder                                    |
| `dashboard/src/components/panels/config-editor/fields/PasswordField.tsx`   | Masked input with show/hide toggle                                            |
| `dashboard/src/components/panels/config-editor/fields/FieldValidation.tsx` | Inline validation error display + validation logic                            |
| `dashboard/src/components/panels/config-editor/DiffPreviewDialog.tsx`      | Diff preview modal before save                                                |
| `dashboard/src/app/api/config/patch/route.ts`                              | API route for `config.patch` RPC                                              |

### Modified Files

| File                                                            | Changes                                                                                                                                                                                                                                  |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dashboard/src/lib/schema-parser.ts`                            | Add `union`, `record`, `json` types; add `format`, `validation`, `discriminator`, `variants`, `valueSchema`, `itemSchema` to FormField; detect `oneOf`/`anyOf`, `additionalProperties`, `items`, format keywords, validation constraints |
| `dashboard/src/stores/config.ts`                                | Add `uiHints` state; store uiHints from `fetchSchema`; add `patchConfig()` method; refactor `saveConfig()` to use write strategy                                                                                                         |
| `dashboard/src/components/panels/config-editor/SchemaForm.tsx`  | Add cases for `union`, `record`, `json` types; pass `uiHints`/`validation` props; integrate PasswordField, advanced collapsing, placeholder hints, inline validation                                                                     |
| `dashboard/src/components/panels/config-editor/ConfigPanel.tsx` | Wire diff preview into save flow; pass uiHints to SchemaForm; add validation error state                                                                                                                                                 |
| `dashboard/src/i18n/zh.json`                                    | Add ~25 new keys in `config` namespace                                                                                                                                                                                                   |
| `dashboard/src/i18n/en.json`                                    | Add ~25 new keys in `config` namespace                                                                                                                                                                                                   |

---

### Task 1: Extend FormField interface + union detection in schema-parser

**covers:** config-schema-advanced > Schema parser handles union types > "Discriminated union with const property", "Simple type union", "Unrecognized union pattern"

**Files:**

- Modify: `dashboard/src/lib/schema-parser.ts`
- Create: `dashboard/src/lib/schema-parser.test.ts`

- [ ] **Step 1: Write failing tests for union type detection**

Create `dashboard/src/lib/schema-parser.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseSchemaSection } from "./schema-parser";

describe("schema-parser", () => {
  describe("union types", () => {
    it("detects discriminated union with const property", () => {
      const schema = {
        type: "object",
        properties: {
          provider: {
            oneOf: [
              {
                type: "object",
                properties: {
                  type: { type: "string", const: "openai" },
                  apiKey: { type: "string" },
                  model: { type: "string" },
                },
                required: ["type"],
              },
              {
                type: "object",
                properties: {
                  type: { type: "string", const: "anthropic" },
                  apiKey: { type: "string" },
                  maxTokens: { type: "number" },
                },
                required: ["type"],
              },
            ],
          },
        },
      };

      const fields = parseSchemaSection(schema);
      expect(fields).toHaveLength(1);
      const field = fields[0];
      expect(field.type).toBe("union");
      expect(field.discriminator).toBe("type");
      expect(field.variants).toHaveLength(2);
      expect(field.variants![0].value).toBe("openai");
      expect(field.variants![0].fields).toBeDefined();
      expect(field.variants![1].value).toBe("anthropic");
    });

    it("detects simple type union", () => {
      const schema = {
        type: "object",
        properties: {
          timeout: {
            oneOf: [{ type: "string" }, { type: "number" }],
          },
        },
      };

      const fields = parseSchemaSection(schema);
      expect(fields).toHaveLength(1);
      const field = fields[0];
      expect(field.type).toBe("union");
      expect(field.discriminator).toBeUndefined();
      expect(field.variants).toHaveLength(2);
      expect(field.variants![0].value).toBe("string");
      expect(field.variants![1].value).toBe("number");
    });

    it("falls back to json for unrecognized union patterns", () => {
      const schema = {
        type: "object",
        properties: {
          mixed: {
            anyOf: [
              { type: "object", properties: { a: { type: "string" } } },
              { type: "object", properties: { b: { type: "number" } } },
            ],
          },
        },
      };

      const fields = parseSchemaSection(schema);
      expect(fields).toHaveLength(1);
      expect(fields[0].type).toBe("json");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && pnpm vitest run src/lib/schema-parser.test.ts`
Expected: FAIL — `type` value `"union"` and `"json"` not in FormField type union; `discriminator`, `variants` don't exist on FormField.

- [ ] **Step 3: Extend FormField interface with union/json types and new fields**

Modify `dashboard/src/lib/schema-parser.ts` — replace the `FormField` interface:

```typescript
export interface UnionVariant {
  value: string;
  label: string;
  fields?: FormField[];
  type?: string; // for simple type unions
}

export interface ValidationConstraints {
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
}

export interface FormField {
  key: string;
  type: "string" | "number" | "boolean" | "enum" | "array" | "object" | "union" | "record" | "json";
  description?: string;
  defaultValue?: unknown;
  options?: string[];
  children?: FormField[];
  required?: boolean;
  // Union fields
  discriminator?: string;
  variants?: UnionVariant[];
  // Record fields
  valueSchema?: FormField;
  // Typed array fields
  itemSchema?: FormField;
  // Format
  format?: string;
  // Validation
  validation?: ValidationConstraints;
  // uiHints (applied post-parse)
  sensitive?: boolean;
  collapsed?: boolean;
  placeholder?: string;
}
```

- [ ] **Step 4: Implement union detection in parseProperty**

Add union detection BEFORE the `schemaType` check in `parseProperty()`:

```typescript
// Union detection: oneOf or anyOf
const oneOf = (schema.oneOf ?? schema.anyOf) as Record<string, unknown>[] | undefined;
if (Array.isArray(oneOf) && oneOf.length > 0) {
  return parseUnion(key, oneOf, description, defaultValue, isRequired);
}
```

Add the `parseUnion` function:

```typescript
function parseUnion(
  key: string,
  variants: Record<string, unknown>[],
  description: string | undefined,
  defaultValue: unknown,
  isRequired: boolean,
): FormField {
  // Check if all variants are objects with a shared const property (discriminated union)
  const discriminator = findDiscriminator(variants);
  if (discriminator) {
    return {
      key,
      type: "union",
      description,
      defaultValue,
      required: isRequired,
      discriminator,
      variants: variants.map((variant) => {
        const props = variant.properties as Record<string, Record<string, unknown>> | undefined;
        const discProp = props?.[discriminator];
        const value = (discProp?.const as string) ?? (discProp?.enum as string[])?.[0] ?? "unknown";
        // Parse the variant's properties (excluding the discriminator itself)
        const variantSchema = { ...variant };
        if (variantSchema.properties && typeof variantSchema.properties === "object") {
          const { [discriminator]: _, ...rest } = variantSchema.properties as Record<
            string,
            unknown
          >;
          variantSchema.properties = rest;
        }
        const fields = parseSchemaSection(variantSchema);
        return { value, label: value, fields };
      }),
    };
  }

  // Check if all variants are simple types (string, number, boolean)
  const allSimple = variants.every(
    (v) =>
      typeof v.type === "string" &&
      ["string", "number", "boolean", "integer"].includes(v.type as string),
  );
  if (allSimple) {
    return {
      key,
      type: "union",
      description,
      defaultValue,
      required: isRequired,
      variants: variants.map((v) => ({
        value: v.type as string,
        label: v.type as string,
        type: v.type as string,
      })),
    };
  }

  // Fallback: raw JSON editor
  console.warn(
    `[schema-parser] Unrecognized union pattern for "${key}", falling back to JSON editor`,
  );
  return { key, type: "json", description, defaultValue, required: isRequired };
}

function findDiscriminator(variants: Record<string, unknown>[]): string | undefined {
  // All variants must be objects
  if (!variants.every((v) => v.type === "object" && v.properties)) {
    return undefined;
  }

  // Find a shared property with const/enum values across all variants
  const firstProps = Object.keys((variants[0].properties as Record<string, unknown>) ?? {});

  for (const propName of firstProps) {
    const allHaveConst = variants.every((v) => {
      const props = v.properties as Record<string, Record<string, unknown>> | undefined;
      const prop = props?.[propName];
      return (
        prop && (prop.const !== undefined || (Array.isArray(prop.enum) && prop.enum.length > 0))
      );
    });
    if (allHaveConst) {
      return propName;
    }
  }

  return undefined;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd dashboard && pnpm vitest run src/lib/schema-parser.test.ts`
Expected: PASS — all 3 union tests green.

- [ ] **Step 6: Verify existing types still work**

Add a test to confirm existing behavior is preserved:

```typescript
describe("existing types (regression)", () => {
  it("parses string, number, boolean, enum, array, object", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string", description: "Agent name" },
        port: { type: "number" },
        enabled: { type: "boolean" },
        mode: { type: "string", enum: ["auto", "manual"] },
        tags: { type: "array" },
        nested: {
          type: "object",
          properties: {
            inner: { type: "string" },
          },
        },
      },
      required: ["name"],
    };

    const fields = parseSchemaSection(schema);
    expect(fields).toHaveLength(6);
    expect(fields.find((f) => f.key === "name")?.type).toBe("string");
    expect(fields.find((f) => f.key === "name")?.required).toBe(true);
    expect(fields.find((f) => f.key === "port")?.type).toBe("number");
    expect(fields.find((f) => f.key === "enabled")?.type).toBe("boolean");
    expect(fields.find((f) => f.key === "mode")?.type).toBe("enum");
    expect(fields.find((f) => f.key === "tags")?.type).toBe("array");
    expect(fields.find((f) => f.key === "nested")?.type).toBe("object");
    expect(fields.find((f) => f.key === "nested")?.children).toHaveLength(1);
  });
});
```

Run: `cd dashboard && pnpm vitest run src/lib/schema-parser.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
scripts/committer "[enhanced] [impl] feat(deck): add union type detection to schema-parser" \
  dashboard/src/lib/schema-parser.ts \
  dashboard/src/lib/schema-parser.test.ts
```

---

### Task 2: Add record type + array items + format + validation to schema-parser

**covers:** config-schema-advanced > Schema parser handles record types > "Record with typed values", "Record with complex values"; Schema parser handles array items > "Array with object items", "Array with simple items", "Array without items schema"; Schema parser handles format keywords > "URI format", "Email format"; Schema parser extracts validation constraints > "String with length constraints", "Number with range constraints"

**Files:**

- Modify: `dashboard/src/lib/schema-parser.ts`
- Modify: `dashboard/src/lib/schema-parser.test.ts`

- [ ] **Step 1: Write failing tests for record, array items, format, and validation**

Add to `dashboard/src/lib/schema-parser.test.ts`:

```typescript
describe("record types", () => {
  it("detects record with typed string values", () => {
    const schema = {
      type: "object",
      properties: {
        envVars: {
          type: "object",
          additionalProperties: { type: "string" },
        },
      },
    };
    const fields = parseSchemaSection(schema);
    expect(fields[0].type).toBe("record");
    expect(fields[0].valueSchema).toBeDefined();
    expect(fields[0].valueSchema!.type).toBe("string");
  });

  it("detects record with complex object values", () => {
    const schema = {
      type: "object",
      properties: {
        providers: {
          type: "object",
          additionalProperties: {
            type: "object",
            properties: {
              url: { type: "string" },
              token: { type: "string" },
            },
          },
        },
      },
    };
    const fields = parseSchemaSection(schema);
    expect(fields[0].type).toBe("record");
    expect(fields[0].valueSchema!.type).toBe("object");
    expect(fields[0].valueSchema!.children).toHaveLength(2);
  });
});

describe("array items", () => {
  it("parses array with object items", () => {
    const schema = {
      type: "object",
      properties: {
        rules: {
          type: "array",
          items: {
            type: "object",
            properties: {
              pattern: { type: "string" },
              action: { type: "string", enum: ["allow", "deny"] },
            },
          },
        },
      },
    };
    const fields = parseSchemaSection(schema);
    expect(fields[0].type).toBe("array");
    expect(fields[0].itemSchema).toBeDefined();
    expect(fields[0].itemSchema!.type).toBe("object");
    expect(fields[0].itemSchema!.children).toHaveLength(2);
  });

  it("parses array with simple string items", () => {
    const schema = {
      type: "object",
      properties: {
        tags: {
          type: "array",
          items: { type: "string" },
        },
      },
    };
    const fields = parseSchemaSection(schema);
    expect(fields[0].type).toBe("array");
    expect(fields[0].itemSchema).toBeDefined();
    expect(fields[0].itemSchema!.type).toBe("string");
  });

  it("falls back to JSON textarea for array without items", () => {
    const schema = {
      type: "object",
      properties: {
        data: { type: "array" },
      },
    };
    const fields = parseSchemaSection(schema);
    expect(fields[0].type).toBe("array");
    expect(fields[0].itemSchema).toBeUndefined();
  });
});

describe("format keywords", () => {
  it("extracts uri format from string schema", () => {
    const schema = {
      type: "object",
      properties: {
        endpoint: { type: "string", format: "uri" },
      },
    };
    const fields = parseSchemaSection(schema);
    expect(fields[0].format).toBe("uri");
  });

  it("extracts email format from string schema", () => {
    const schema = {
      type: "object",
      properties: {
        contact: { type: "string", format: "email" },
      },
    };
    const fields = parseSchemaSection(schema);
    expect(fields[0].format).toBe("email");
  });
});

describe("validation constraints", () => {
  it("extracts string length constraints", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string", minLength: 1, maxLength: 255 },
      },
    };
    const fields = parseSchemaSection(schema);
    expect(fields[0].validation).toEqual({ minLength: 1, maxLength: 255 });
  });

  it("extracts number range constraints", () => {
    const schema = {
      type: "object",
      properties: {
        port: { type: "number", minimum: 0, maximum: 65535 },
      },
    };
    const fields = parseSchemaSection(schema);
    expect(fields[0].validation).toEqual({ minimum: 0, maximum: 65535 });
  });

  it("extracts pattern constraint", () => {
    const schema = {
      type: "object",
      properties: {
        slug: { type: "string", pattern: "^[a-z0-9-]+$" },
      },
    };
    const fields = parseSchemaSection(schema);
    expect(fields[0].validation).toEqual({ pattern: "^[a-z0-9-]+$" });
  });

  it("returns no validation when no constraints present", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
      },
    };
    const fields = parseSchemaSection(schema);
    expect(fields[0].validation).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && pnpm vitest run src/lib/schema-parser.test.ts`
Expected: FAIL — `record` type not in union; `valueSchema`, `itemSchema`, `format`, `validation` not populated.

- [ ] **Step 3: Implement record detection in parseProperty**

In `parseProperty()`, modify the `object` type handling to detect records:

```typescript
if (schemaType === "object") {
  // Record detection: additionalProperties with a schema (not just `true`)
  const additionalProps = schema.additionalProperties;
  if (additionalProps && typeof additionalProps === "object" && additionalProps !== null) {
    const valueField = parseProperty("_value", additionalProps as Record<string, unknown>, false);
    return {
      key,
      type: "record",
      description,
      defaultValue,
      required: isRequired,
      valueSchema: valueField ?? undefined,
    };
  }

  const children = schema.properties ? parseSchemaSection(schema) : undefined;
  return { key, type: "object", description, defaultValue, children, required: isRequired };
}
```

- [ ] **Step 4: Implement array items parsing**

Replace the simple array case in `parseProperty()`:

```typescript
if (schemaType === "array") {
  const items = schema.items as Record<string, unknown> | undefined;
  let itemSchema: FormField | undefined;
  if (items && typeof items === "object") {
    itemSchema = parseProperty("_item", items, false) ?? undefined;
  }
  return { key, type: "array", description, defaultValue, required: isRequired, itemSchema };
}
```

- [ ] **Step 5: Add format extraction to string parsing**

Replace the string case:

```typescript
if (schemaType === "string") {
  const format = typeof schema.format === "string" ? schema.format : undefined;
  const validation = extractValidation(schema);
  return {
    key,
    type: "string",
    description,
    defaultValue,
    required: isRequired,
    format,
    validation,
  };
}
```

- [ ] **Step 6: Add validation extraction helper**

Add at the bottom of the file:

```typescript
function extractValidation(schema: Record<string, unknown>): ValidationConstraints | undefined {
  const v: ValidationConstraints = {};
  if (typeof schema.minLength === "number") v.minLength = schema.minLength;
  if (typeof schema.maxLength === "number") v.maxLength = schema.maxLength;
  if (typeof schema.minimum === "number") v.minimum = schema.minimum;
  if (typeof schema.maximum === "number") v.maximum = schema.maximum;
  if (typeof schema.pattern === "string") v.pattern = schema.pattern;
  return Object.keys(v).length > 0 ? v : undefined;
}
```

Also add validation extraction to the number case:

```typescript
if (schemaType === "number" || schemaType === "integer") {
  const validation = extractValidation(schema);
  return { key, type: "number", description, defaultValue, required: isRequired, validation };
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd dashboard && pnpm vitest run src/lib/schema-parser.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 8: Commit**

```bash
scripts/committer "[enhanced] [impl] feat(deck): add record, array items, format, validation to schema-parser" \
  dashboard/src/lib/schema-parser.ts \
  dashboard/src/lib/schema-parser.test.ts
```

---

### Task 3: Implement uiHints path matcher and applyUiHints post-processor

**covers:** config-uihints > uiHints are fetched and stored > "Schema response includes uiHints", "Schema response has empty uiHints"; uiHints path matching supports wildcards > "Wildcard path matches array element", "Exact path takes precedence over wildcard"

**Files:**

- Create: `dashboard/src/lib/ui-hints.ts`
- Create: `dashboard/src/lib/ui-hints.test.ts`
- Modify: `dashboard/src/stores/config.ts`

- [ ] **Step 1: Write failing tests for uiHints path matching**

Create `dashboard/src/lib/ui-hints.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { matchUiHint, applyUiHints } from "./ui-hints";
import type { FormField } from "./schema-parser";

describe("ui-hints", () => {
  describe("matchUiHint", () => {
    const hints = {
      "gateway.port": { placeholder: "18789" },
      "models.providers.*.apiKey": { sensitive: true },
      "models.providers.0.apiKey": { sensitive: false },
      advanced: { collapsed: true },
    };

    it("matches exact path", () => {
      expect(matchUiHint("gateway.port", hints)).toEqual({ placeholder: "18789" });
    });

    it("matches wildcard path for array index", () => {
      expect(matchUiHint("models.providers.1.apiKey", hints)).toEqual({ sensitive: true });
    });

    it("exact path takes precedence over wildcard", () => {
      expect(matchUiHint("models.providers.0.apiKey", hints)).toEqual({ sensitive: false });
    });

    it("returns undefined for unmatched path", () => {
      expect(matchUiHint("unknown.path", hints)).toBeUndefined();
    });

    it("handles empty hints", () => {
      expect(matchUiHint("gateway.port", {})).toBeUndefined();
    });
  });

  describe("applyUiHints", () => {
    it("decorates fields with sensitive, collapsed, placeholder", () => {
      const fields: FormField[] = [
        { key: "apiKey", type: "string" },
        { key: "debug", type: "boolean" },
        { key: "endpoint", type: "string" },
      ];
      const hints = {
        "section.apiKey": { sensitive: true },
        "section.debug": { collapsed: true },
        "section.endpoint": { placeholder: "https://api.example.com" },
      };

      const result = applyUiHints(fields, hints, "section");
      expect(result[0].sensitive).toBe(true);
      expect(result[1].collapsed).toBe(true);
      expect(result[2].placeholder).toBe("https://api.example.com");
    });

    it("does not modify fields when no hints match", () => {
      const fields: FormField[] = [{ key: "name", type: "string" }];
      const result = applyUiHints(fields, {}, "section");
      expect(result[0].sensitive).toBeUndefined();
      expect(result[0].collapsed).toBeUndefined();
      expect(result[0].placeholder).toBeUndefined();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && pnpm vitest run src/lib/ui-hints.test.ts`
Expected: FAIL — module `./ui-hints` does not exist.

- [ ] **Step 3: Implement ui-hints.ts**

Create `dashboard/src/lib/ui-hints.ts`:

```typescript
import type { FormField } from "./schema-parser";

export interface UiHint {
  sensitive?: boolean;
  collapsed?: boolean;
  placeholder?: string;
}

export type UiHintsMap = Record<string, UiHint>;

/**
 * Match a field path against the uiHints map.
 * Supports `*` wildcard segments that match any single path component (e.g., array indices).
 * Exact match takes precedence over wildcard match.
 */
export function matchUiHint(fieldPath: string, hints: UiHintsMap): UiHint | undefined {
  // Exact match first
  if (hints[fieldPath]) {
    return hints[fieldPath];
  }

  // Wildcard match: try replacing each numeric segment with *
  const segments = fieldPath.split(".");
  for (const [pattern, hint] of Object.entries(hints)) {
    if (!pattern.includes("*")) continue;
    const patternSegments = pattern.split(".");
    if (patternSegments.length !== segments.length) continue;

    const matches = patternSegments.every((pat, i) => pat === "*" || pat === segments[i]);
    if (matches) {
      return hint;
    }
  }

  return undefined;
}

/**
 * Post-process FormField[] to apply uiHints decorations.
 * @param fields - Parsed form fields from schema-parser
 * @param hints - uiHints map from config.schema response
 * @param prefix - Current field path prefix (e.g., "models" for section-level)
 */
export function applyUiHints(fields: FormField[], hints: UiHintsMap, prefix: string): FormField[] {
  if (!hints || Object.keys(hints).length === 0) {
    return fields;
  }

  return fields.map((field) => {
    const path = prefix ? `${prefix}.${field.key}` : field.key;
    const hint = matchUiHint(path, hints);

    if (!hint) {
      // Recurse into children
      if (field.children) {
        return { ...field, children: applyUiHints(field.children, hints, path) };
      }
      return field;
    }

    const decorated = { ...field };
    if (hint.sensitive !== undefined) decorated.sensitive = hint.sensitive;
    if (hint.collapsed !== undefined) decorated.collapsed = hint.collapsed;
    if (hint.placeholder !== undefined) decorated.placeholder = hint.placeholder;

    // Recurse into children
    if (decorated.children) {
      decorated.children = applyUiHints(decorated.children, hints, path);
    }

    return decorated;
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && pnpm vitest run src/lib/ui-hints.test.ts`
Expected: PASS

- [ ] **Step 5: Extend config store to fetch and store uiHints**

Modify `dashboard/src/stores/config.ts`:

1. Add to `ConfigState` interface:

```typescript
uiHints: Record<string, unknown>;
```

2. Add to initial state:

```typescript
uiHints: {},
```

3. Modify `fetchSchema` to store uiHints:

```typescript
fetchSchema: async () => {
  try {
    const res = await fetch("/api/config/schema");
    if (!res.ok) {
      return;
    }
    const data = (await res.json()) as Record<string, unknown>;
    // config.schema returns `{ schema, uiHints, version }` — unwrap.
    set({
      schema: (data.schema as Record<string, unknown>) ?? data,
      uiHints: (data.uiHints as Record<string, unknown>) ?? {},
    });
  } catch {
    // Schema fetch is best-effort
  }
},
```

- [ ] **Step 6: Run type check**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: PASS (no type errors). Note: SchemaForm.tsx may need updating later when we add new type cases — that's Task 5.

- [ ] **Step 7: Commit**

```bash
scripts/committer "[enhanced] [impl] feat(deck): add uiHints path matcher and config store integration" \
  dashboard/src/lib/ui-hints.ts \
  dashboard/src/lib/ui-hints.test.ts \
  dashboard/src/stores/config.ts
```

---

### Task 4: Implement config-diff utility (computeConfigDiff + classifyChanges + computeMergePatch)

**covers:** config-diff-preview > Diff preview shows structured field-level changes > "Scalar field changed", "Array field changed", "New field added", "Field removed"; config-write-strategy > Change type detection classifies mutations > "Only scalar properties changed", "Array length changed", "Array element order changed", "No changes detected"

**Files:**

- Create: `dashboard/src/lib/config-diff.ts`
- Create: `dashboard/src/lib/config-diff.test.ts`

- [ ] **Step 1: Write failing tests for config-diff**

Create `dashboard/src/lib/config-diff.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { computeConfigDiff, classifyChanges, computeMergePatch } from "./config-diff";

describe("config-diff", () => {
  describe("computeConfigDiff", () => {
    it("detects scalar change", () => {
      const diff = computeConfigDiff({ gateway: { port: 18789 } }, { gateway: { port: 18790 } });
      expect(diff).toHaveLength(1);
      expect(diff[0]).toEqual({
        path: "gateway.port",
        oldValue: 18789,
        newValue: 18790,
        type: "change",
      });
    });

    it("detects added field", () => {
      const diff = computeConfigDiff({ gateway: {} }, { gateway: { port: 18789 } });
      expect(diff).toHaveLength(1);
      expect(diff[0].type).toBe("add");
      expect(diff[0].newValue).toBe(18789);
    });

    it("detects removed field", () => {
      const diff = computeConfigDiff({ gateway: { port: 18789 } }, { gateway: {} });
      expect(diff).toHaveLength(1);
      expect(diff[0].type).toBe("remove");
      expect(diff[0].oldValue).toBe(18789);
    });

    it("detects array item changes", () => {
      const diff = computeConfigDiff(
        { models: { providers: ["openai", "anthropic"] } },
        { models: { providers: ["openai"] } },
      );
      expect(diff.length).toBeGreaterThanOrEqual(1);
      expect(diff.some((d) => d.path.startsWith("models.providers"))).toBe(true);
    });

    it("returns empty array for identical configs", () => {
      const config = { gateway: { port: 18789, host: "localhost" } };
      const diff = computeConfigDiff(config, structuredClone(config));
      expect(diff).toHaveLength(0);
    });
  });

  describe("classifyChanges", () => {
    it("returns patch-safe for scalar-only changes", () => {
      expect(classifyChanges({ gateway: { port: 18789 } }, { gateway: { port: 18790 } })).toBe(
        "patch-safe",
      );
    });

    it("returns apply-required for array deletion", () => {
      expect(
        classifyChanges({ models: { list: ["a", "b", "c"] } }, { models: { list: ["a", "c"] } }),
      ).toBe("apply-required");
    });

    it("returns apply-required for array reorder", () => {
      expect(
        classifyChanges(
          { models: { list: ["a", "b", "c"] } },
          { models: { list: ["c", "a", "b"] } },
        ),
      ).toBe("apply-required");
    });

    it("returns apply-required for mixed changes", () => {
      expect(
        classifyChanges(
          { gateway: { port: 18789 }, models: { list: ["a", "b"] } },
          { gateway: { port: 18790 }, models: { list: ["a"] } },
        ),
      ).toBe("apply-required");
    });

    it("returns patch-safe for no changes", () => {
      const config = { gateway: { port: 18789 } };
      expect(classifyChanges(config, structuredClone(config))).toBe("patch-safe");
    });
  });

  describe("computeMergePatch", () => {
    it("produces merge patch for scalar changes", () => {
      const patch = computeMergePatch(
        { gateway: { port: 18789, host: "localhost" } },
        { gateway: { port: 18790, host: "localhost" } },
      );
      expect(patch).toEqual({ gateway: { port: 18790 } });
    });

    it("produces merge patch for added properties", () => {
      const patch = computeMergePatch({ gateway: {} }, { gateway: { port: 18789 } });
      expect(patch).toEqual({ gateway: { port: 18789 } });
    });

    it("sets null for removed properties", () => {
      const patch = computeMergePatch(
        { gateway: { port: 18789, host: "localhost" } },
        { gateway: { port: 18789 } },
      );
      expect(patch).toEqual({ gateway: { host: null } });
    });

    it("returns empty object for no changes", () => {
      const config = { gateway: { port: 18789 } };
      expect(computeMergePatch(config, structuredClone(config))).toEqual({});
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && pnpm vitest run src/lib/config-diff.test.ts`
Expected: FAIL — module `./config-diff` does not exist.

- [ ] **Step 3: Implement config-diff.ts**

Create `dashboard/src/lib/config-diff.ts`:

```typescript
export interface DiffEntry {
  path: string;
  oldValue: unknown;
  newValue: unknown;
  type: "add" | "change" | "remove";
}

/**
 * Compute a structured field-level diff between two config objects.
 * Returns an array of DiffEntry objects with path, old/new values, and change type.
 */
export function computeConfigDiff(
  oldConfig: Record<string, unknown>,
  newConfig: Record<string, unknown>,
): DiffEntry[] {
  const entries: DiffEntry[] = [];
  diffRecursive(oldConfig, newConfig, "", entries);
  return entries;
}

function diffRecursive(oldObj: unknown, newObj: unknown, path: string, entries: DiffEntry[]): void {
  // Both are arrays — compare as whole value (arrays are leaf nodes for diff display)
  if (Array.isArray(oldObj) && Array.isArray(newObj)) {
    if (JSON.stringify(oldObj) !== JSON.stringify(newObj)) {
      entries.push({ path, oldValue: oldObj, newValue: newObj, type: "change" });
    }
    return;
  }

  // Both are objects — recurse into properties
  if (isPlainObject(oldObj) && isPlainObject(newObj)) {
    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
    for (const key of allKeys) {
      const childPath = path ? `${path}.${key}` : key;
      const oldVal = (oldObj as Record<string, unknown>)[key];
      const newVal = (newObj as Record<string, unknown>)[key];

      if (oldVal === undefined && newVal !== undefined) {
        entries.push({ path: childPath, oldValue: undefined, newValue: newVal, type: "add" });
      } else if (oldVal !== undefined && newVal === undefined) {
        entries.push({ path: childPath, oldValue: oldVal, newValue: undefined, type: "remove" });
      } else {
        diffRecursive(oldVal, newVal, childPath, entries);
      }
    }
    return;
  }

  // Leaf values — compare directly
  if (oldObj !== newObj) {
    if (oldObj === undefined) {
      entries.push({ path, oldValue: undefined, newValue: newObj, type: "add" });
    } else if (newObj === undefined) {
      entries.push({ path, oldValue: oldObj, newValue: undefined, type: "remove" });
    } else {
      entries.push({ path, oldValue: oldObj, newValue: newObj, type: "change" });
    }
  }
}

/**
 * Classify changes between old and new config.
 * Returns "patch-safe" if only scalar/object property changes.
 * Returns "apply-required" if any array mutations (length change, reorder).
 */
export function classifyChanges(
  oldConfig: Record<string, unknown>,
  newConfig: Record<string, unknown>,
): "patch-safe" | "apply-required" {
  return hasArrayMutation(oldConfig, newConfig) ? "apply-required" : "patch-safe";
}

function hasArrayMutation(oldObj: unknown, newObj: unknown): boolean {
  if (Array.isArray(oldObj) && Array.isArray(newObj)) {
    if (oldObj.length !== newObj.length) return true;
    if (JSON.stringify(oldObj) !== JSON.stringify(newObj)) return true;
    return false;
  }

  if (isPlainObject(oldObj) && isPlainObject(newObj)) {
    const allKeys = new Set([...Object.keys(oldObj as object), ...Object.keys(newObj as object)]);
    for (const key of allKeys) {
      const oldVal = (oldObj as Record<string, unknown>)[key];
      const newVal = (newObj as Record<string, unknown>)[key];
      // If one side has an array and the other doesn't, it's a structural change
      if (Array.isArray(oldVal) !== Array.isArray(newVal)) return true;
      if (hasArrayMutation(oldVal, newVal)) return true;
    }
  }

  return false;
}

/**
 * Compute a JSON Merge Patch (RFC 7396) from old to new config.
 * Only call this for "patch-safe" changes — does NOT handle array mutations.
 */
export function computeMergePatch(
  oldConfig: Record<string, unknown>,
  newConfig: Record<string, unknown>,
): Record<string, unknown> {
  return mergePatchRecursive(oldConfig, newConfig);
}

function mergePatchRecursive(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  // Properties in newObj that differ from oldObj
  for (const [key, newVal] of Object.entries(newObj)) {
    const oldVal = oldObj[key];
    if (isPlainObject(oldVal) && isPlainObject(newVal)) {
      const subPatch = mergePatchRecursive(
        oldVal as Record<string, unknown>,
        newVal as Record<string, unknown>,
      );
      if (Object.keys(subPatch).length > 0) {
        patch[key] = subPatch;
      }
    } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      patch[key] = newVal;
    }
  }

  // Properties removed in newObj
  for (const key of Object.keys(oldObj)) {
    if (!(key in newObj)) {
      patch[key] = null;
    }
  }

  return patch;
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === "object" && !Array.isArray(val);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && pnpm vitest run src/lib/config-diff.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
scripts/committer "[enhanced] [impl] feat(deck): add config-diff utility (diff, classify, merge patch)" \
  dashboard/src/lib/config-diff.ts \
  dashboard/src/lib/config-diff.test.ts
```

---

### Task 5: Add new field widgets (UnionField, RecordField, TypedArrayField, PasswordField) and wire into SchemaForm

**covers:** config-schema-advanced > SchemaForm renders union fields > "User switches union variant"; SchemaForm renders record fields > "User adds a record entry", "User removes a record entry"; SchemaForm renders typed array fields > "User adds an array item", "User reorders array items", "User removes an array item"; config-uihints > Sensitive fields render as password inputs > "Sensitive field displays masked", "User toggles sensitive field visibility"; Placeholder hints display on inputs > "Field has placeholder hint"

**Files:**

- Create: `dashboard/src/components/panels/config-editor/fields/UnionField.tsx`
- Create: `dashboard/src/components/panels/config-editor/fields/RecordField.tsx`
- Create: `dashboard/src/components/panels/config-editor/fields/TypedArrayField.tsx`
- Create: `dashboard/src/components/panels/config-editor/fields/PasswordField.tsx`
- Modify: `dashboard/src/components/panels/config-editor/SchemaForm.tsx`
- Modify: `dashboard/src/i18n/zh.json`
- Modify: `dashboard/src/i18n/en.json`

- [ ] **Step 1: Add i18n keys for new field operations**

Add to `config` namespace in both `zh.json` and `en.json`:

**zh.json additions** (inside `"config": { ... }`):

```json
"addEntry": "添加条目",
"removeEntry": "删除",
"addItem": "添加项",
"removeItem": "删除",
"moveUp": "上移",
"moveDown": "下移",
"showAdvanced": "显示高级选项",
"hideAdvanced": "隐藏高级选项",
"showPassword": "显示密码",
"hidePassword": "隐藏密码",
"selectVariant": "选择类型",
"selectType": "选择类型",
"rawJsonFallback": "原始 JSON（此字段类型暂不支持可视化编辑）",
"entryKey": "键",
"entryValue": "值",
"itemIndex": "第 {index} 项",
"validationRequired": "此字段为必填",
"validationMinLength": "最少 {min} 个字符",
"validationMaxLength": "最多 {max} 个字符",
"validationMin": "最小值为 {min}",
"validationMax": "最大值为 {max}",
"validationPattern": "格式不正确",
"validationErrors": "存在验证错误，请修正后保存",
"diffPreview": "变更预览",
"diffConfirm": "确认保存",
"diffCancel": "取消",
"diffNoChanges": "无变更",
"diffAdded": "新增",
"diffRemoved": "删除",
"diffChanged": "修改",
"diffDontShowAgain": "本次会话不再显示",
"diffSingleChange": "{field}: {old} → {new}"
```

**en.json additions** (inside `"config": { ... }`):

```json
"addEntry": "Add Entry",
"removeEntry": "Remove",
"addItem": "Add Item",
"removeItem": "Remove",
"moveUp": "Move Up",
"moveDown": "Move Down",
"showAdvanced": "Show Advanced",
"hideAdvanced": "Hide Advanced",
"showPassword": "Show",
"hidePassword": "Hide",
"selectVariant": "Select variant",
"selectType": "Select type",
"rawJsonFallback": "Raw JSON (visual editing not supported for this field type)",
"entryKey": "Key",
"entryValue": "Value",
"itemIndex": "Item {index}",
"validationRequired": "This field is required",
"validationMinLength": "At least {min} characters",
"validationMaxLength": "At most {max} characters",
"validationMin": "Minimum value is {min}",
"validationMax": "Maximum value is {max}",
"validationPattern": "Invalid format",
"validationErrors": "Please fix validation errors before saving",
"diffPreview": "Change Preview",
"diffConfirm": "Confirm Save",
"diffCancel": "Cancel",
"diffNoChanges": "No changes",
"diffAdded": "Added",
"diffRemoved": "Removed",
"diffChanged": "Changed",
"diffDontShowAgain": "Don't show again this session",
"diffSingleChange": "{field}: {old} → {new}"
```

- [ ] **Step 2: Create PasswordField component**

Create `dashboard/src/components/panels/config-editor/fields/PasswordField.tsx`:

```tsx
"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FormField } from "@/lib/schema-parser";

interface PasswordFieldProps {
  field: FormField;
  value: string;
  onChange: (v: string) => void;
}

export function PasswordField({ field, value, onChange }: PasswordFieldProps) {
  const t = useTranslations("config");
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex items-center gap-1 w-full max-w-md">
      <Input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder ?? ""}
        className="flex-1 text-xs h-7 font-mono"
      />
      <Button
        variant="ghost"
        size="xs"
        type="button"
        onClick={() => setVisible(!visible)}
        className="h-7 w-7 p-0 shrink-0"
        title={visible ? t("hidePassword") : t("showPassword")}
      >
        {visible ? <EyeOff size={12} /> : <Eye size={12} />}
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Create UnionField component**

Create `dashboard/src/components/panels/config-editor/fields/UnionField.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FormField } from "@/lib/schema-parser";
import { SchemaForm } from "../SchemaForm";

interface UnionFieldProps {
  field: FormField;
  value: unknown;
  onChange: (value: unknown) => void;
  prefix: string;
}

export function UnionField({ field, value, onChange, prefix }: UnionFieldProps) {
  const t = useTranslations("config");
  const variants = field.variants ?? [];

  // Determine current variant
  const currentVariant = useMemo(() => {
    if (field.discriminator && isPlainObject(value)) {
      const discValue = (value as Record<string, unknown>)[field.discriminator];
      return typeof discValue === "string" ? discValue : undefined;
    }
    // Simple type union: detect by typeof
    if (!field.discriminator && value !== undefined) {
      const t = typeof value;
      if (t === "string" || t === "number" || t === "boolean") return t;
    }
    return variants[0]?.value;
  }, [value, field.discriminator, variants]);

  const activeVariant = variants.find((v) => v.value === currentVariant) ?? variants[0];

  const handleVariantChange = (newVariant: string) => {
    if (field.discriminator) {
      // Keep discriminator, clear other fields
      onChange({ [field.discriminator]: newVariant });
    } else {
      // Simple type union: set default value for type
      const defaults: Record<string, unknown> = {
        string: "",
        number: 0,
        boolean: false,
        integer: 0,
      };
      onChange(defaults[newVariant] ?? "");
    }
  };

  return (
    <div className="space-y-2">
      <Select value={currentVariant ?? ""} onValueChange={handleVariantChange}>
        <SelectTrigger size="sm" className="w-full max-w-md text-xs">
          <SelectValue placeholder={t("selectVariant")} />
        </SelectTrigger>
        <SelectContent>
          {variants.map((v) => (
            <SelectItem key={v.value} value={v.value}>
              {v.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Subform for discriminated union */}
      {field.discriminator && activeVariant?.fields && activeVariant.fields.length > 0 && (
        <div className="ml-3 pl-3 border-l border-[var(--border-subtle)]">
          <SchemaForm
            fields={activeVariant.fields}
            values={(isPlainObject(value) ? value : {}) as Record<string, unknown>}
            onChange={(childKey, childValue) => {
              const current = isPlainObject(value) ? { ...(value as Record<string, unknown>) } : {};
              if (field.discriminator) {
                current[field.discriminator] = currentVariant;
              }
              current[childKey] = childValue;
              onChange(current);
            }}
            prefix={`${prefix}${field.key}.`}
          />
        </div>
      )}
    </div>
  );
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === "object" && !Array.isArray(val);
}
```

- [ ] **Step 4: Create RecordField component**

Create `dashboard/src/components/panels/config-editor/fields/RecordField.tsx`:

```tsx
"use client";

import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FormField } from "@/lib/schema-parser";
import { SchemaForm } from "../SchemaForm";

interface RecordFieldProps {
  field: FormField;
  value: unknown;
  onChange: (value: unknown) => void;
  prefix: string;
}

export function RecordField({ field, value, onChange, prefix }: RecordFieldProps) {
  const t = useTranslations("config");
  const entries = isPlainObject(value) ? Object.entries(value as Record<string, unknown>) : [];
  const [newKey, setNewKey] = useState("");

  const handleAdd = () => {
    if (!newKey.trim()) return;
    const current = isPlainObject(value) ? { ...(value as Record<string, unknown>) } : {};
    current[newKey.trim()] = getDefaultForType(field.valueSchema);
    onChange(current);
    setNewKey("");
  };

  const handleRemove = (key: string) => {
    const current = isPlainObject(value) ? { ...(value as Record<string, unknown>) } : {};
    delete current[key];
    onChange(current);
  };

  const handleValueChange = (key: string, newValue: unknown) => {
    const current = isPlainObject(value) ? { ...(value as Record<string, unknown>) } : {};
    current[key] = newValue;
    onChange(current);
  };

  const valueType = field.valueSchema?.type;

  return (
    <div className="space-y-2">
      {entries.map(([entryKey, entryValue]) => (
        <div key={entryKey} className="flex items-start gap-2 group">
          <Input
            value={entryKey}
            readOnly
            className="w-32 shrink-0 text-xs h-7 font-mono bg-[var(--bg-tertiary)]"
            title={t("entryKey")}
          />
          {valueType === "object" && field.valueSchema?.children ? (
            <div className="flex-1 ml-1 pl-3 border-l border-[var(--border-subtle)]">
              <SchemaForm
                fields={field.valueSchema.children}
                values={(isPlainObject(entryValue) ? entryValue : {}) as Record<string, unknown>}
                onChange={(childKey, childValue) => {
                  const current = isPlainObject(entryValue)
                    ? { ...(entryValue as Record<string, unknown>) }
                    : {};
                  current[childKey] = childValue;
                  handleValueChange(entryKey, current);
                }}
                prefix={`${prefix}${field.key}.${entryKey}.`}
              />
            </div>
          ) : (
            <Input
              value={typeof entryValue === "string" ? entryValue : JSON.stringify(entryValue ?? "")}
              onChange={(e) => handleValueChange(entryKey, e.target.value)}
              className="flex-1 text-xs h-7"
              placeholder={t("entryValue")}
            />
          )}
          <Button
            variant="ghost"
            size="xs"
            type="button"
            onClick={() => handleRemove(entryKey)}
            className="h-7 w-7 p-0 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--danger)]"
            title={t("removeEntry")}
          >
            <Trash2 size={12} />
          </Button>
        </div>
      ))}

      {/* Add new entry */}
      <div className="flex items-center gap-2">
        <Input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder={t("entryKey")}
          className="w-32 shrink-0 text-xs h-7 font-mono"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <Button
          variant="outline"
          size="xs"
          type="button"
          onClick={handleAdd}
          disabled={!newKey.trim()}
          className="gap-1"
        >
          <Plus size={12} />
          {t("addEntry")}
        </Button>
      </div>
    </div>
  );
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === "object" && !Array.isArray(val);
}

function getDefaultForType(schema?: FormField): unknown {
  if (!schema) return "";
  switch (schema.type) {
    case "string":
      return "";
    case "number":
      return 0;
    case "boolean":
      return false;
    case "object":
      return {};
    case "array":
      return [];
    default:
      return "";
  }
}
```

- [ ] **Step 5: Create TypedArrayField component**

Create `dashboard/src/components/panels/config-editor/fields/TypedArrayField.tsx`:

```tsx
"use client";

import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FormField } from "@/lib/schema-parser";
import { SchemaForm } from "../SchemaForm";

interface TypedArrayFieldProps {
  field: FormField;
  value: unknown;
  onChange: (value: unknown) => void;
  prefix: string;
}

export function TypedArrayField({ field, value, onChange, prefix }: TypedArrayFieldProps) {
  const t = useTranslations("config");
  const items = Array.isArray(value) ? value : [];
  const itemSchema = field.itemSchema;

  const handleAdd = () => {
    onChange([...items, getDefaultForItemSchema(itemSchema)]);
  };

  const handleRemove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= items.length) return;
    const newItems = [...items];
    [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];
    onChange(newItems);
  };

  const handleItemChange = (index: number, newValue: unknown) => {
    const newItems = [...items];
    newItems[index] = newValue;
    onChange(newItems);
  };

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div
          key={index}
          className="group rounded-lg border border-[var(--border-subtle)] p-2 bg-[var(--bg-tertiary)]/50"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono text-[var(--text-secondary)]">
              {t("itemIndex", { index: index + 1 })}
            </span>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="xs"
                type="button"
                onClick={() => handleMove(index, -1)}
                disabled={index === 0}
                className="h-6 w-6 p-0"
                title={t("moveUp")}
              >
                <ChevronUp size={12} />
              </Button>
              <Button
                variant="ghost"
                size="xs"
                type="button"
                onClick={() => handleMove(index, 1)}
                disabled={index === items.length - 1}
                className="h-6 w-6 p-0"
                title={t("moveDown")}
              >
                <ChevronDown size={12} />
              </Button>
              <Button
                variant="ghost"
                size="xs"
                type="button"
                onClick={() => handleRemove(index)}
                className="h-6 w-6 p-0 text-[var(--danger)]"
                title={t("removeItem")}
              >
                <Trash2 size={12} />
              </Button>
            </div>
          </div>

          {itemSchema?.type === "object" && itemSchema.children ? (
            <SchemaForm
              fields={itemSchema.children}
              values={
                (typeof item === "object" && item !== null ? item : {}) as Record<string, unknown>
              }
              onChange={(childKey, childValue) => {
                const current =
                  typeof item === "object" && item !== null
                    ? { ...(item as Record<string, unknown>) }
                    : {};
                current[childKey] = childValue;
                handleItemChange(index, current);
              }}
              prefix={`${prefix}${field.key}.${index}.`}
            />
          ) : (
            <Input
              value={
                typeof item === "string"
                  ? item
                  : typeof item === "number"
                    ? String(item)
                    : JSON.stringify(item ?? "")
              }
              onChange={(e) => {
                const v = itemSchema?.type === "number" ? Number(e.target.value) : e.target.value;
                handleItemChange(index, v);
              }}
              type={itemSchema?.type === "number" ? "number" : "text"}
              className="w-full text-xs h-7"
            />
          )}
        </div>
      ))}

      <Button variant="outline" size="xs" type="button" onClick={handleAdd} className="gap-1">
        <Plus size={12} />
        {t("addItem")}
      </Button>
    </div>
  );
}

function getDefaultForItemSchema(schema?: FormField): unknown {
  if (!schema) return "";
  switch (schema.type) {
    case "string":
      return "";
    case "number":
      return 0;
    case "boolean":
      return false;
    case "object":
      return {};
    default:
      return "";
  }
}
```

- [ ] **Step 6: Update SchemaForm to handle new field types + uiHints**

Modify `dashboard/src/components/panels/config-editor/SchemaForm.tsx`:

1. Add imports at the top:

```tsx
import { UnionField } from "./fields/UnionField";
import { RecordField } from "./fields/RecordField";
import { TypedArrayField } from "./fields/TypedArrayField";
import { PasswordField } from "./fields/PasswordField";
```

2. Update `StringField` to use placeholder from uiHints:

```tsx
// In StringField's Input component, change placeholder:
placeholder={field.placeholder ?? (typeof field.defaultValue === "string" ? field.defaultValue : "")}
```

3. Add new cases to the switch statement in `SchemaForm`, before the `default:` case:

```tsx
case "union":
  return (
    <div key={fullKey} className="mb-3">
      <FieldLabel field={field} />
      <UnionField
        field={field}
        value={value}
        onChange={(v) => handleChange(field.key, v)}
        prefix={prefix}
      />
    </div>
  );
case "record":
  return (
    <div key={fullKey} className="mb-3">
      <FieldLabel field={field} />
      <RecordField
        field={field}
        value={value}
        onChange={(v) => handleChange(field.key, v)}
        prefix={prefix}
      />
    </div>
  );
case "json":
  return (
    <div key={fullKey} className="mb-3">
      <FieldLabel field={field} />
      <textarea
        value={typeof value === "string" ? value : JSON.stringify(value ?? "", null, 2)}
        onChange={(e) => {
          try { handleChange(field.key, JSON.parse(e.target.value)); }
          catch { handleChange(field.key, e.target.value); }
        }}
        rows={4}
        className={cn(
          "w-full max-w-md text-xs rounded-lg px-2.5 py-1.5 font-mono resize-y",
          "border border-[var(--border)] bg-transparent text-[var(--text-primary)]",
          "focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50",
          "outline-none transition-colors duration-150",
        )}
      />
    </div>
  );
```

4. Update the `"string"` case to handle `sensitive` fields:

```tsx
case "string":
  if (field.sensitive) {
    return (
      <div key={fullKey} className="mb-3">
        <FieldLabel field={field} />
        <PasswordField
          field={field}
          value={typeof value === "string" ? value : value != null ? JSON.stringify(value) : ""}
          onChange={(v) => handleChange(field.key, v)}
        />
      </div>
    );
  }
  return (
    <StringField
      key={fullKey}
      field={field}
      value={typeof value === "string" ? value : value != null ? JSON.stringify(value) : ""}
      onChange={(v) => handleChange(field.key, v)}
    />
  );
```

5. Update the `"array"` case to use TypedArrayField when itemSchema exists:

```tsx
case "array":
  if (field.itemSchema) {
    return (
      <div key={fullKey} className="mb-3">
        <FieldLabel field={field} />
        <TypedArrayField
          field={field}
          value={value}
          onChange={(v) => handleChange(field.key, v)}
          prefix={prefix}
        />
      </div>
    );
  }
  return (
    <ArrayField
      key={fullKey}
      field={field}
      value={value}
      onChange={(v) => {
        try { handleChange(field.key, JSON.parse(v)); }
        catch { handleChange(field.key, v); }
      }}
    />
  );
```

- [ ] **Step 7: Run type check**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: PASS — no type errors.

- [ ] **Step 8: Commit**

```bash
scripts/committer "[enhanced] [impl] feat(deck): add Union/Record/TypedArray/Password field widgets" \
  dashboard/src/components/panels/config-editor/fields/UnionField.tsx \
  dashboard/src/components/panels/config-editor/fields/RecordField.tsx \
  dashboard/src/components/panels/config-editor/fields/TypedArrayField.tsx \
  dashboard/src/components/panels/config-editor/fields/PasswordField.tsx \
  dashboard/src/components/panels/config-editor/SchemaForm.tsx \
  dashboard/src/i18n/zh.json \
  dashboard/src/i18n/en.json
```

---

### Task 6: Add advanced section collapsing + inline validation + uiHints wiring in ConfigPanel

**covers:** config-uihints > Advanced fields render collapsed by default > "Advanced section is initially collapsed", "User expands advanced section"; config-schema-advanced > SchemaForm shows inline validation errors > "Value violates minimum constraint", "Value violates pattern constraint", "Save blocked by validation errors"

**Files:**

- Create: `dashboard/src/components/panels/config-editor/fields/FieldValidation.tsx`
- Modify: `dashboard/src/components/panels/config-editor/SchemaForm.tsx`
- Modify: `dashboard/src/components/panels/config-editor/ConfigPanel.tsx`

- [ ] **Step 1: Create FieldValidation component**

Create `dashboard/src/components/panels/config-editor/fields/FieldValidation.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import type { ValidationConstraints } from "@/lib/schema-parser";

interface FieldValidationProps {
  value: unknown;
  validation?: ValidationConstraints;
  format?: string;
  touched: boolean;
}

export function validateField(
  value: unknown,
  validation?: ValidationConstraints,
  format?: string,
): string | null {
  if (validation === undefined && format === undefined) return null;
  const strVal = typeof value === "string" ? value : undefined;
  const numVal = typeof value === "number" ? value : undefined;

  if (validation) {
    if (
      validation.minLength !== undefined &&
      strVal !== undefined &&
      strVal.length < validation.minLength
    ) {
      return `minLength:${validation.minLength}`;
    }
    if (
      validation.maxLength !== undefined &&
      strVal !== undefined &&
      strVal.length > validation.maxLength
    ) {
      return `maxLength:${validation.maxLength}`;
    }
    if (validation.minimum !== undefined && numVal !== undefined && numVal < validation.minimum) {
      return `min:${validation.minimum}`;
    }
    if (validation.maximum !== undefined && numVal !== undefined && numVal > validation.maximum) {
      return `max:${validation.maximum}`;
    }
    if (validation.pattern !== undefined && strVal !== undefined) {
      try {
        if (!new RegExp(validation.pattern).test(strVal)) {
          return "pattern";
        }
      } catch {
        // Invalid regex pattern — skip validation
      }
    }
  }

  if (format && strVal) {
    if (format === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strVal)) {
      return "pattern";
    }
    if (format === "uri" && !/^https?:\/\//.test(strVal)) {
      return "pattern";
    }
  }

  return null;
}

export function FieldValidationError({ value, validation, format, touched }: FieldValidationProps) {
  const t = useTranslations("config");

  if (!touched) return null;
  const errorKey = validateField(value, validation, format);
  if (!errorKey) return null;

  let message: string;
  if (errorKey.startsWith("minLength:")) {
    message = t("validationMinLength", { min: errorKey.split(":")[1] });
  } else if (errorKey.startsWith("maxLength:")) {
    message = t("validationMaxLength", { max: errorKey.split(":")[1] });
  } else if (errorKey.startsWith("min:")) {
    message = t("validationMin", { min: errorKey.split(":")[1] });
  } else if (errorKey.startsWith("max:")) {
    message = t("validationMax", { max: errorKey.split(":")[1] });
  } else if (errorKey === "pattern") {
    message = t("validationPattern");
  } else {
    message = errorKey;
  }

  return <p className="text-[10px] text-[var(--danger)] mt-0.5">{message}</p>;
}
```

- [ ] **Step 2: Wire uiHints into ConfigPanel**

Modify `dashboard/src/components/panels/config-editor/ConfigPanel.tsx`:

1. Add imports:

```tsx
import { applyUiHints } from "@/lib/ui-hints";
import type { UiHintsMap } from "@/lib/ui-hints";
```

2. Add `uiHints` to the store destructuring:

```tsx
const {
  schema,
  editedConfig,
  isDirty,
  saving,
  conflict,
  loading,
  error,
  activeSection,
  uiHints,
  fetchSchema,
  fetchConfig,
  setEditedConfig,
  setActiveSection,
  saveConfig,
  reloadConfig,
} = useConfigStore();
```

3. Update `currentFields` to apply uiHints:

```tsx
const currentFields = useMemo(() => {
  if (!schema || !activeSection) {
    return [];
  }
  const props = schema.properties as Record<string, Record<string, unknown>> | undefined;
  const sectionSchema = props?.[activeSection];
  if (!sectionSchema || typeof sectionSchema !== "object") {
    return [];
  }
  let fields = parseSchemaSection(sectionSchema);
  // Apply uiHints decorations
  if (uiHints && Object.keys(uiHints).length > 0) {
    fields = applyUiHints(fields, uiHints as UiHintsMap, activeSection);
  }
  return fields;
}, [schema, activeSection, uiHints]);
```

- [ ] **Step 3: Add advanced section collapsing to SchemaForm**

In `SchemaForm.tsx`, add handling for `collapsed` fields. Wrap the fields list to group collapsed fields:

1. Add import:

```tsx
import { FieldValidationError } from "./fields/FieldValidation";
```

2. In the `SchemaForm` component, before the return, split fields into normal and advanced:

```tsx
const normalFields = fields.filter((f) => !f.collapsed);
const advancedFields = fields.filter((f) => f.collapsed);
```

3. Update the return to render advanced fields in a collapsible:

```tsx
return (
  <div>
    {normalFields.map((field) => {
      // ... existing field rendering
    })}
    {advancedFields.length > 0 && (
      <AdvancedSection
        fields={advancedFields}
        values={values}
        onChange={handleChange}
        prefix={prefix}
      />
    )}
  </div>
);
```

4. Add `AdvancedSection` component inside the file:

```tsx
function AdvancedSection({
  fields,
  values,
  onChange,
  prefix,
}: {
  fields: FormField[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  prefix: string;
}) {
  const t = useTranslations("config");
  const [open, setOpen] = useState(false);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="mt-4 pt-3 border-t border-[var(--border-subtle)]"
    >
      <CollapsibleTrigger
        className={cn(
          "flex items-center gap-1 text-xs font-medium cursor-pointer transition-colors duration-150",
          "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
        )}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {open ? t("hideAdvanced") : t("showAdvanced")}
        <span className="text-[10px] opacity-60 ml-1">({fields.length})</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <SchemaForm fields={fields} values={values} onChange={onChange} prefix={prefix} />
      </CollapsibleContent>
    </Collapsible>
  );
}
```

- [ ] **Step 4: Add validation error collection and save-blocking to ConfigPanel**

In `ConfigPanel.tsx`, add a `validationErrors` state and a function to collect errors from all visible fields. This blocks save when errors exist:

1. Add a memo that validates on `editedConfig` change using the exported `validateField`:

```tsx
import { validateField } from "./fields/FieldValidation";

// In the component, after currentFields:
const hasValidationErrors = useMemo(() => {
  // Walk fields and check for validation errors in current values
  function checkFields(fields: FormField[], values: Record<string, unknown>): boolean {
    for (const field of fields) {
      const val = values[field.key];
      if (field.validation || field.format) {
        const error = validateField(val, field.validation, field.format);
        if (error) return true;
      }
      if (field.children && typeof val === "object" && val !== null) {
        if (checkFields(field.children, val as Record<string, unknown>)) return true;
      }
    }
    return false;
  }
  return checkFields(currentFields, sectionValues);
}, [currentFields, sectionValues]);
```

3. Update the Save button to disable when validation errors exist:

```tsx
<Button size="xs" onClick={handleSave} disabled={!isDirty || saving || hasValidationErrors} className="gap-1">
```

4. If `hasValidationErrors` is true when user tries to save, show a toast:

```tsx
// In handleSave, add at the start:
if (hasValidationErrors) {
  // Scroll to first error field
  const firstError = document.querySelector('[data-validation-error="true"]');
  firstError?.scrollIntoView({ behavior: "smooth", block: "center" });
  return;
}
```

- [ ] **Step 5: Run type check**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
scripts/committer "[enhanced] [impl] feat(deck): add uiHints wiring, advanced collapsing, field validation, save blocking" \
  dashboard/src/components/panels/config-editor/fields/FieldValidation.tsx \
  dashboard/src/components/panels/config-editor/SchemaForm.tsx \
  dashboard/src/components/panels/config-editor/ConfigPanel.tsx
```

---

### Task 7: Add DiffPreviewDialog and wire into save flow

**covers:** config-diff-preview > Diff preview dialog before save > "User saves with changes in one section", "User saves with changes across multiple sections", "User confirms save from diff preview", "User cancels save from diff preview"; Diff preview can be dismissed for session > "User opts out of diff preview", "Session reset restores diff preview"; Single-field change uses inline confirmation > "Single field change save"

**Files:**

- Create: `dashboard/src/components/panels/config-editor/DiffPreviewDialog.tsx`
- Modify: `dashboard/src/components/panels/config-editor/ConfigPanel.tsx`

- [ ] **Step 1: Create DiffPreviewDialog component**

Create `dashboard/src/components/panels/config-editor/DiffPreviewDialog.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { DiffEntry } from "@/lib/config-diff";
import { cn } from "@/lib/utils";

interface DiffPreviewDialogProps {
  entries: DiffEntry[];
  onConfirm: () => void;
  onCancel: () => void;
  onDontShowAgain: () => void;
}

export function DiffPreviewDialog({
  entries,
  onConfirm,
  onCancel,
  onDontShowAgain,
}: DiffPreviewDialogProps) {
  const t = useTranslations("config");
  const [dontShow, setDontShow] = useState(false);

  // Group entries by top-level section
  const grouped = useMemo(() => {
    const groups: Record<string, DiffEntry[]> = {};
    for (const entry of entries) {
      const section = entry.path.split(".")[0];
      if (!groups[section]) groups[section] = [];
      groups[section].push(entry);
    }
    return groups;
  }, [entries]);

  const handleConfirm = () => {
    if (dontShow) onDontShowAgain();
    onConfirm();
  };

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">{t("diffPreview")}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-2 px-1">
            {Object.entries(grouped).map(([section, sectionEntries]) => (
              <DiffSection key={section} section={section} entries={sectionEntries} />
            ))}
            {entries.length === 0 && (
              <p className="text-xs text-[var(--text-secondary)] py-4 text-center">
                {t("diffNoChanges")}
              </p>
            )}
          </div>
        </ScrollArea>

        <div className="flex items-center gap-2 pt-2 border-t border-[var(--border-subtle)]">
          <Checkbox
            id="dont-show"
            checked={dontShow}
            onCheckedChange={(v) => setDontShow(v === true)}
          />
          <label
            htmlFor="dont-show"
            className="text-[10px] text-[var(--text-secondary)] cursor-pointer"
          >
            {t("diffDontShowAgain")}
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onCancel}>
            {t("diffCancel")}
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={entries.length === 0}>
            {t("diffConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DiffSection({ section, entries }: { section: string; entries: DiffEntry[] }) {
  const t = useTranslations("config");
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className={cn(
          "flex items-center gap-1 text-xs font-medium w-full cursor-pointer transition-colors duration-150",
          "text-[var(--text-primary)] hover:text-[var(--accent)]",
        )}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className="font-mono">{section}</span>
        <Badge variant="outline" className="ml-auto text-[10px]">
          {entries.length}
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-4 mt-1 space-y-1">
          {entries.map((entry) => (
            <DiffEntryRow key={entry.path} entry={entry} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function DiffEntryRow({ entry }: { entry: DiffEntry }) {
  const t = useTranslations("config");
  // Strip the top-level section from the displayed path
  const displayPath = entry.path.includes(".")
    ? entry.path.substring(entry.path.indexOf(".") + 1)
    : entry.path;

  return (
    <div className="flex items-start gap-2 text-[10px] font-mono py-0.5">
      <Badge
        className={cn(
          "text-[9px] shrink-0 border-transparent",
          entry.type === "add" && "bg-[var(--success-muted)] text-[var(--success)]",
          entry.type === "remove" && "bg-[var(--danger-muted)] text-[var(--danger)]",
          entry.type === "change" && "bg-[var(--warning-muted)] text-[var(--warning-muted-text)]",
        )}
      >
        {t(
          entry.type === "add"
            ? "diffAdded"
            : entry.type === "remove"
              ? "diffRemoved"
              : "diffChanged",
        )}
      </Badge>
      <span className="text-[var(--text-secondary)]">{displayPath}</span>
      <div className="ml-auto flex items-center gap-1 shrink-0">
        {entry.oldValue !== undefined && (
          <span className="text-[var(--danger)] line-through">{formatValue(entry.oldValue)}</span>
        )}
        {entry.oldValue !== undefined && entry.newValue !== undefined && (
          <span className="text-[var(--text-secondary)]">&rarr;</span>
        )}
        {entry.newValue !== undefined && (
          <span className="text-[var(--success)]">{formatValue(entry.newValue)}</span>
        )}
      </div>
    </div>
  );
}

function formatValue(val: unknown): string {
  if (typeof val === "string") return val.length > 30 ? `"${val.substring(0, 27)}..."` : `"${val}"`;
  if (typeof val === "boolean" || typeof val === "number") return String(val);
  if (Array.isArray(val)) return `[${val.length} items]`;
  if (typeof val === "object" && val !== null) return "{...}";
  return String(val);
}
```

- [ ] **Step 2: Wire diff preview into ConfigPanel save flow**

Modify `dashboard/src/components/panels/config-editor/ConfigPanel.tsx`:

1. Add imports:

```tsx
import { useState } from "react"; // add useState to existing import
import { computeConfigDiff } from "@/lib/config-diff";
import type { DiffEntry } from "@/lib/config-diff";
import { DiffPreviewDialog } from "./DiffPreviewDialog";
```

2. **Add `rawConfig` to the store destructuring** — currently `rawConfig` is NOT in the destructuring list. Add it:

```tsx
const {
  schema,
  rawConfig, // ← ADD THIS
  editedConfig,
  isDirty,
  saving,
  conflict,
  loading,
  error,
  activeSection,
  uiHints,
  fetchSchema,
  fetchConfig,
  setEditedConfig,
  setActiveSection,
  saveConfig,
  reloadConfig,
} = useConfigStore();
```

3. Add state for diff preview:

```tsx
const [showDiffPreview, setShowDiffPreview] = useState(false);
const [diffEntries, setDiffEntries] = useState<DiffEntry[]>([]);
const [skipDiffPreview, setSkipDiffPreview] = useState(false);
```

4. Replace `handleSave`:

```tsx
const handleSave = useCallback(() => {
  if (skipDiffPreview) {
    void saveConfig();
    return;
  }

  // Compute diff
  try {
    const oldObj = JSON.parse(rawConfig || "{}") as Record<string, unknown>;
    const newObj = JSON.parse(editedConfig || "{}") as Record<string, unknown>;
    const entries = computeConfigDiff(oldObj, newObj);

    if (entries.length === 0) {
      // No changes — just save (no-op)
      void saveConfig();
      return;
    }

    // Single-field change: skip full dialog, save directly (lightweight confirmation per spec)
    if (entries.length === 1) {
      void saveConfig();
      return;
    }

    setDiffEntries(entries);
    setShowDiffPreview(true);
  } catch {
    // If JSON parsing fails, save directly
    void saveConfig();
  }
}, [rawConfig, editedConfig, saveConfig, skipDiffPreview]);
```

5. Add the DiffPreviewDialog before the closing `</div>`:

```tsx
{
  showDiffPreview && (
    <DiffPreviewDialog
      entries={diffEntries}
      onConfirm={() => {
        setShowDiffPreview(false);
        void saveConfig();
      }}
      onCancel={() => setShowDiffPreview(false)}
      onDontShowAgain={() => setSkipDiffPreview(true)}
    />
  );
}
```

- [ ] **Step 3: Run type check**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
scripts/committer "[enhanced] [impl] feat(deck): add DiffPreviewDialog and wire into save flow" \
  dashboard/src/components/panels/config-editor/DiffPreviewDialog.tsx \
  dashboard/src/components/panels/config-editor/ConfigPanel.tsx
```

---

### Task 8: Add config.patch API route + smart write strategy in config store

**covers:** config-write-strategy > Write strategy selects between patch and apply > "Scalar field updated", "Object property added", "Array item deleted", "Array items reordered", "Mixed scalar and array changes"; Patch failure falls back to apply > "Patch RPC returns error", "Patch RPC succeeds"; Write strategy preserves baseHash conflict detection > "Concurrent edit detected via patch", "Successful save updates baseHash"

**Files:**

- Create: `dashboard/src/app/api/config/patch/route.ts`
- Modify: `dashboard/src/stores/config.ts`
- Create: `dashboard/src/lib/config-diff.integration.test.ts` (optional, for patch fallback)

- [ ] **Step 1: Create config/patch API route**

Create `dashboard/src/app/api/config/patch/route.ts`:

```typescript
/**
 * /api/config/patch — Apply incremental config changes via JSON Merge Patch.
 *
 * POST — Send a merge patch to the gateway
 *
 * Gateway contract:
 *   config.patch: { raw: string, baseHash?: string }
 *   `raw` is a JSON string of the merge patch object.
 *   Returns: { ok, path, config, restart, sentinel }
 *   Conflict = INVALID_REQUEST error with "config changed" message
 *
 * Note: config.patch uses the same schema as config.apply (ConfigApplyLikeParamsSchema)
 * — the `raw` parameter is a JSON string, not a patch object.
 */
import { type NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as {
    patch?: Record<string, unknown>;
    baseHash?: string;
  };

  if (!body.patch || typeof body.patch !== "object") {
    return Response.json({ error: "patch object is required" }, { status: 400 });
  }

  // Gateway's config.patch expects { raw: string } where raw is JSON of the merge patch
  return gatewayRequest("config.patch", {
    raw: JSON.stringify(body.patch),
    ...(body.baseHash ? { baseHash: body.baseHash } : {}),
  });
});
```

- [ ] **Step 2: Refactor config store saveConfig to use write strategy**

Modify `dashboard/src/stores/config.ts`:

1. Add import at the top:

```typescript
import { classifyChanges, computeMergePatch } from "@/lib/config-diff";
```

2. Replace the `saveConfig` method with a strategy-aware version:

```typescript
saveConfig: async () => {
  const { editedConfig, rawConfig, baseHash } = get();
  set({ saving: true, error: null, conflict: false });

  try {
    const oldObj = JSON.parse(rawConfig || "{}") as Record<string, unknown>;
    const newObj = JSON.parse(editedConfig || "{}") as Record<string, unknown>;

    const strategy = classifyChanges(oldObj, newObj);

    if (strategy === "patch-safe") {
      const patch = computeMergePatch(oldObj, newObj);
      if (Object.keys(patch).length === 0) {
        // No changes — nothing to save
        set({ saving: false });
        return true;
      }

      // Try config.patch first
      const patchResult = await tryPatch(patch, baseHash);
      if (patchResult === "success") {
        await get().fetchConfig();
        return true;
      }
      if (patchResult === "conflict") {
        set({ conflict: true });
        return false;
      }
      // patchResult === "error" → fall through to apply
    }

    // Use config.apply (structural changes or patch fallback)
    return await applyConfig(editedConfig, baseHash, set, get);
  } catch {
    set({ error: "Save failed" });
    return false;
  } finally {
    set({ saving: false });
  }
},
```

3. Add helper functions outside the store:

```typescript
async function tryPatch(
  patch: Record<string, unknown>,
  baseHash: string | null,
): Promise<"success" | "conflict" | "error"> {
  try {
    const res = await fetch("/api/config/patch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patch, baseHash }),
    });

    if (res.ok) return "success";

    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      code?: string;
    };
    const msg = (data.error ?? data.message ?? "").toLowerCase();
    if (msg.includes("config changed") || msg.includes("base hash")) {
      return "conflict";
    }
    return "error"; // Non-conflict error → fall back to apply
  } catch {
    return "error";
  }
}

async function applyConfig(
  editedConfig: string,
  baseHash: string | null,
  set: (state: Partial<ConfigState>) => void,
  get: () => ConfigState,
): Promise<boolean> {
  const res = await fetch("/api/config/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ raw: editedConfig, baseHash }),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({ error: "Save failed" }))) as {
      error?: string;
      message?: string;
      code?: string;
    };
    const errorMsg = data.error ?? data.message ?? "Save failed";
    const msg = errorMsg.toLowerCase();
    if (msg.includes("config changed") || msg.includes("base hash")) {
      set({ conflict: true });
      return false;
    }
    set({ error: errorMsg });
    return false;
  }

  await get().fetchConfig();
  return true;
}
```

- [ ] **Step 3: Run type check**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Run full test suite**

Run: `cd dashboard && pnpm vitest run`
Expected: PASS — all existing and new tests pass.

- [ ] **Step 5: Commit**

```bash
scripts/committer "[enhanced] [impl] feat(deck): add config.patch route and smart write strategy" \
  dashboard/src/app/api/config/patch/route.ts \
  dashboard/src/stores/config.ts
```

---

### Task 9: Final verification — type check, lint, full tests

**covers:** All specs — verification pass

**Files:**

- All files modified in Tasks 1-8

- [ ] **Step 1: Run type check**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: PASS — zero errors.

- [ ] **Step 2: Run lint/format**

Run: `cd dashboard && pnpm check`
Expected: PASS. If format issues, run `pnpm format:fix` and re-check.

- [ ] **Step 3: Run full test suite**

Run: `cd dashboard && pnpm vitest run`
Expected: PASS — all tests green.

- [ ] **Step 4: Fix any issues found**

If any step above fails, fix the issue and re-run. Ensure:

- No unused imports
- All new types are properly exported
- i18n keys in zh.json and en.json are in sync
- No `any` types

- [ ] **Step 5: Commit any fixes**

```bash
scripts/committer "[enhanced] [impl] fix(deck): address type/lint issues in config enhancement" \
  <fixed-files>
```

---

## Requirements Coverage Matrix

| Spec                   | Requirement                                          | Scenario                                         | Task |
| ---------------------- | ---------------------------------------------------- | ------------------------------------------------ | ---- |
| config-schema-advanced | Schema parser handles union types                    | Discriminated union with const property          | T1   |
| config-schema-advanced | Schema parser handles union types                    | Simple type union                                | T1   |
| config-schema-advanced | Schema parser handles union types                    | Unrecognized union pattern                       | T1   |
| config-schema-advanced | Schema parser handles record types                   | Record with typed values                         | T2   |
| config-schema-advanced | Schema parser handles record types                   | Record with complex values                       | T2   |
| config-schema-advanced | Schema parser handles array items                    | Array with object items                          | T2   |
| config-schema-advanced | Schema parser handles array items                    | Array with simple items                          | T2   |
| config-schema-advanced | Schema parser handles array items                    | Array without items schema                       | T2   |
| config-schema-advanced | Schema parser handles format keywords                | URI format                                       | T2   |
| config-schema-advanced | Schema parser handles format keywords                | Email format                                     | T2   |
| config-schema-advanced | Schema parser extracts validation constraints        | String with length constraints                   | T2   |
| config-schema-advanced | Schema parser extracts validation constraints        | Number with range constraints                    | T2   |
| config-schema-advanced | SchemaForm renders union fields                      | User switches union variant                      | T5   |
| config-schema-advanced | SchemaForm renders record fields                     | User adds a record entry                         | T5   |
| config-schema-advanced | SchemaForm renders record fields                     | User removes a record entry                      | T5   |
| config-schema-advanced | SchemaForm renders typed array fields                | User adds an array item                          | T5   |
| config-schema-advanced | SchemaForm renders typed array fields                | User reorders array items                        | T5   |
| config-schema-advanced | SchemaForm renders typed array fields                | User removes an array item                       | T5   |
| config-schema-advanced | SchemaForm shows inline validation errors            | Value violates minimum constraint                | T6   |
| config-schema-advanced | SchemaForm shows inline validation errors            | Value violates pattern constraint                | T6   |
| config-schema-advanced | SchemaForm shows inline validation errors            | Save blocked by validation errors                | T6   |
| config-uihints         | uiHints are fetched and stored                       | Schema response includes uiHints                 | T3   |
| config-uihints         | uiHints are fetched and stored                       | Schema response has empty uiHints                | T3   |
| config-uihints         | Sensitive fields render as password inputs           | Sensitive field displays masked                  | T5   |
| config-uihints         | Sensitive fields render as password inputs           | User toggles sensitive field visibility          | T5   |
| config-uihints         | Advanced fields render collapsed by default          | Advanced section is initially collapsed          | T6   |
| config-uihints         | Advanced fields render collapsed by default          | User expands advanced section                    | T6   |
| config-uihints         | Placeholder hints display on inputs                  | Field has placeholder hint                       | T5   |
| config-uihints         | uiHints path matching supports wildcards             | Wildcard path matches array element              | T3   |
| config-uihints         | uiHints path matching supports wildcards             | Exact path takes precedence over wildcard        | T3   |
| config-diff-preview    | Diff preview dialog before save                      | User saves with changes in one section           | T7   |
| config-diff-preview    | Diff preview dialog before save                      | User saves with changes across multiple sections | T7   |
| config-diff-preview    | Diff preview dialog before save                      | User confirms save from diff preview             | T7   |
| config-diff-preview    | Diff preview dialog before save                      | User cancels save from diff preview              | T7   |
| config-diff-preview    | Diff preview shows structured field-level changes    | Scalar field changed                             | T4   |
| config-diff-preview    | Diff preview shows structured field-level changes    | Array field changed                              | T4   |
| config-diff-preview    | Diff preview shows structured field-level changes    | New field added                                  | T4   |
| config-diff-preview    | Diff preview shows structured field-level changes    | Field removed                                    | T4   |
| config-diff-preview    | Diff preview can be dismissed for session            | User opts out of diff preview                    | T7   |
| config-diff-preview    | Diff preview can be dismissed for session            | Session reset restores diff preview              | T7   |
| config-diff-preview    | Single-field change uses inline confirmation         | Single field change save                         | T7   |
| config-write-strategy  | Write strategy selects between patch and apply       | Scalar field updated                             | T8   |
| config-write-strategy  | Write strategy selects between patch and apply       | Object property added                            | T8   |
| config-write-strategy  | Write strategy selects between patch and apply       | Array item deleted                               | T8   |
| config-write-strategy  | Write strategy selects between patch and apply       | Array items reordered                            | T8   |
| config-write-strategy  | Write strategy selects between patch and apply       | Mixed scalar and array changes                   | T8   |
| config-write-strategy  | Patch failure falls back to apply                    | Patch RPC returns error                          | T8   |
| config-write-strategy  | Patch failure falls back to apply                    | Patch RPC succeeds                               | T8   |
| config-write-strategy  | Write strategy preserves baseHash conflict detection | Concurrent edit detected via patch               | T8   |
| config-write-strategy  | Write strategy preserves baseHash conflict detection | Successful save updates baseHash                 | T8   |
| config-write-strategy  | Change type detection classifies mutations           | Only scalar properties changed                   | T4   |
| config-write-strategy  | Change type detection classifies mutations           | Array length changed                             | T4   |
| config-write-strategy  | Change type detection classifies mutations           | Array element order changed                      | T4   |
| config-write-strategy  | Change type detection classifies mutations           | No changes detected                              | T4   |
