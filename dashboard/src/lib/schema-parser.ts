/**
 * JSON Schema → FormField[] parser for the config editor.
 *
 * Converts a JSON Schema (as returned by config.schema) into a flat/nested
 * list of typed form fields that the SchemaForm component can render.
 */

export interface ValidationConstraints {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minimum?: number;
  maximum?: number;
}

export interface UnionVariant {
  value: string;
  label: string;
  type?: string;
  fields?: FormField[];
}

export interface FormField {
  key: string;
  type: "string" | "number" | "boolean" | "enum" | "array" | "object";
  description?: string;
  defaultValue?: unknown;
  options?: string[];
  children?: FormField[];
  required?: boolean;
  /** Union variants for discriminated/simple union fields. */
  variants?: UnionVariant[];
  /** Discriminator key for discriminated union fields. */
  discriminator?: string;
  /** Schema for record/map values. */
  valueSchema?: FormField;
  /** Schema for typed-array items. */
  itemSchema?: FormField;
  /** Placeholder text (from uiHints). */
  placeholder?: string;
  /** Whether the field contains a sensitive value (from uiHints). */
  sensitive?: boolean;
  /** Whether the field section should be collapsed by default (from uiHints). */
  collapsed?: boolean;
  /** Action-oriented help text (from uiHints). */
  help?: string;
  /** Group key for section-based layout (from uiHints). */
  group?: string;
  /** Tags for categorization, e.g. "advanced" (from uiHints). */
  tags?: string[];
  /** Human-readable label override (from uiHints). */
  label?: string;
  /** Sort order within a group — lower = earlier (from uiHints). */
  order?: number;
  /** Whether this field is an advanced setting, collapsed by default (from uiHints). */
  advanced?: boolean;
  /** Validation constraints extracted from JSON Schema. */
  validation?: ValidationConstraints;
}

/**
 * Parse a JSON Schema section (typically the `properties` of a top-level key)
 * into a renderable FormField list.
 */
export function parseSchemaSection(schema: Record<string, unknown>): FormField[] {
  const properties = (schema.properties ?? schema) as Record<string, Record<string, unknown>>;
  const requiredSet = new Set<string>(
    Array.isArray(schema.required) ? (schema.required as string[]) : [],
  );

  const fields: FormField[] = [];

  for (const [key, propSchema] of Object.entries(properties)) {
    if (!propSchema || typeof propSchema !== "object") {
      continue;
    }
    const field = parseProperty(key, propSchema, requiredSet.has(key));
    if (field) {
      fields.push(field);
    }
  }

  return fields;
}

function parseProperty(
  key: string,
  schema: Record<string, unknown>,
  isRequired: boolean,
): FormField | null {
  const description = typeof schema.description === "string" ? schema.description : undefined;
  const defaultValue = schema.default;

  // Enum detection: explicit enum array or oneOf with const values
  if (Array.isArray(schema.enum)) {
    return {
      key,
      type: "enum",
      description,
      defaultValue,
      options: schema.enum.map(String),
      required: isRequired,
    };
  }

  // Union detection: oneOf / anyOf with object variants
  const unionCandidates = (schema.oneOf ?? schema.anyOf) as Record<string, unknown>[] | undefined;
  if (Array.isArray(unionCandidates) && unionCandidates.length > 0) {
    const variants = parseUnionVariants(
      unionCandidates,
      schema.discriminator as Record<string, unknown> | undefined,
    );
    if (variants.length > 0) {
      return { key, type: "object", description, defaultValue, required: isRequired, variants };
    }
  }

  const schemaType = schema.type as string | undefined;

  // Extract validation constraints from JSON Schema keywords
  const validation = extractValidation(schema);

  if (schemaType === "string") {
    return {
      key,
      type: "string",
      description,
      defaultValue,
      required: isRequired,
      ...(validation ? { validation } : {}),
    };
  }

  if (schemaType === "number" || schemaType === "integer") {
    return {
      key,
      type: "number",
      description,
      defaultValue,
      required: isRequired,
      ...(validation ? { validation } : {}),
    };
  }

  if (schemaType === "boolean") {
    return { key, type: "boolean", description, defaultValue, required: isRequired };
  }

  if (schemaType === "array") {
    const itemSchema = parseItemSchema(schema);
    return {
      key,
      type: "array",
      description,
      defaultValue,
      required: isRequired,
      ...(itemSchema ? { itemSchema } : {}),
    };
  }

  if (schemaType === "object") {
    const children = schema.properties ? parseSchemaSection(schema) : undefined;
    const valueSchema = parseValueSchema(schema);
    return {
      key,
      type: "object",
      description,
      defaultValue,
      children,
      required: isRequired,
      ...(valueSchema ? { valueSchema } : {}),
    };
  }

  // Fallback: treat unknown types as string
  if (schemaType) {
    return { key, type: "string", description, defaultValue, required: isRequired };
  }

  return null;
}

/**
 * Extract validation constraints from JSON Schema keywords.
 * Returns undefined if no constraints are present.
 */
function extractValidation(schema: Record<string, unknown>): ValidationConstraints | undefined {
  const v: ValidationConstraints = {};
  let hasAny = false;

  if (typeof schema.minLength === "number") {
    v.minLength = schema.minLength;
    hasAny = true;
  }
  if (typeof schema.maxLength === "number") {
    v.maxLength = schema.maxLength;
    hasAny = true;
  }
  if (typeof schema.minimum === "number") {
    v.minimum = schema.minimum;
    hasAny = true;
  }
  if (typeof schema.maximum === "number") {
    v.maximum = schema.maximum;
    hasAny = true;
  }
  if (typeof schema.pattern === "string") {
    v.pattern = schema.pattern;
    hasAny = true;
  }

  return hasAny ? v : undefined;
}

/**
 * Parse `items` sub-schema for typed arrays.
 * Returns a FormField for the item type, or undefined for untyped arrays.
 */
function parseItemSchema(schema: Record<string, unknown>): FormField | undefined {
  const items = schema.items as Record<string, unknown> | undefined;
  if (!items || typeof items !== "object") {
    return undefined;
  }
  return parseProperty("item", items, false) ?? undefined;
}

/**
 * Parse `additionalProperties` sub-schema for record/map objects.
 * Returns a FormField for the value type, or undefined for non-record objects.
 */
function parseValueSchema(schema: Record<string, unknown>): FormField | undefined {
  const ap = schema.additionalProperties;
  if (!ap || typeof ap !== "object") {
    return undefined;
  }
  return parseProperty("value", ap as Record<string, unknown>, false) ?? undefined;
}

/**
 * Parse union variants from `oneOf`/`anyOf` sub-schemas.
 * Supports discriminated unions (with `discriminator.propertyName`) and simple unions.
 */
function parseUnionVariants(
  candidates: Record<string, unknown>[],
  discriminator?: Record<string, unknown>,
): UnionVariant[] {
  const discKey =
    typeof discriminator?.propertyName === "string" ? discriminator.propertyName : undefined;

  return candidates
    .map((variant): UnionVariant | null => {
      const title = typeof variant.title === "string" ? variant.title : undefined;
      const variantType = typeof variant.type === "string" ? variant.type : undefined;

      // Simple const variant (string union)
      if (variant.const !== undefined) {
        const constStr =
          typeof variant.const === "string" ? variant.const : JSON.stringify(variant.const);
        return { value: constStr, label: title ?? constStr };
      }

      // Object variant with properties
      if (variantType === "object" && variant.properties) {
        const props = variant.properties as Record<string, Record<string, unknown>>;
        // Try to extract discriminator value
        let value = title;
        if (discKey && props[discKey]) {
          const discProp = props[discKey];
          const discConst = typeof discProp.const === "string" ? discProp.const : undefined;
          const discEnum =
            Array.isArray(discProp.enum) && typeof discProp.enum[0] === "string"
              ? discProp.enum[0]
              : undefined;
          value = discConst ?? discEnum ?? title ?? "unknown";
        }
        if (!value) {
          return null;
        }

        const fields = parseSchemaSection(variant);
        return { value, label: title ?? value, type: variantType, fields };
      }

      // Typed non-object variant
      if (variantType) {
        const label = title ?? variantType;
        return { value: label, label, type: variantType };
      }

      return null;
    })
    .filter((v): v is UnionVariant => v !== null);
}
