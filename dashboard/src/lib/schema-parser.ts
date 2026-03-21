/**
 * JSON Schema → FormField[] parser for the config editor.
 *
 * Converts a JSON Schema (as returned by config.schema) into a flat/nested
 * list of typed form fields that the SchemaForm component can render.
 */

export interface UnionVariant {
  value: string;
  label: string;
  fields?: FormField[];
  type?: string;
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
  // Record / typed array fields (populated in T2)
  valueSchema?: FormField;
  itemSchema?: FormField;
  // Format hint (e.g. "password", "textarea", "date") — populated in T2
  format?: string;
  // Validation constraints — populated in T2
  validation?: ValidationConstraints;
  // UI hints — populated in T3+
  sensitive?: boolean;
  collapsed?: boolean;
  placeholder?: string;
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

  // Union detection: oneOf / anyOf BEFORE schemaType check
  const oneOf = (schema.oneOf ?? schema.anyOf) as Record<string, unknown>[] | undefined;
  if (Array.isArray(oneOf) && oneOf.length > 0) {
    return parseUnion(key, oneOf, description, defaultValue, isRequired);
  }

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

  const schemaType = schema.type as string | undefined;

  if (schemaType === "string") {
    return { key, type: "string", description, defaultValue, required: isRequired };
  }

  if (schemaType === "number" || schemaType === "integer") {
    return { key, type: "number", description, defaultValue, required: isRequired };
  }

  if (schemaType === "boolean") {
    return { key, type: "boolean", description, defaultValue, required: isRequired };
  }

  if (schemaType === "array") {
    return { key, type: "array", description, defaultValue, required: isRequired };
  }

  if (schemaType === "object") {
    const children = schema.properties ? parseSchemaSection(schema) : undefined;
    return { key, type: "object", description, defaultValue, children, required: isRequired };
  }

  // Fallback: treat unknown types as string
  if (schemaType) {
    return { key, type: "string", description, defaultValue, required: isRequired };
  }

  return null;
}

/**
 * Parse a oneOf / anyOf array into a union FormField.
 *
 * Strategy priority:
 * 1. Discriminated union — all variants are objects sharing a property with const/enum values
 * 2. Simple type union  — all variants are primitive types (string / number / boolean)
 * 3. Fallback           — unrecognized pattern → type "json" + console.warn
 */
function parseUnion(
  key: string,
  variants: Record<string, unknown>[],
  description: string | undefined,
  defaultValue: unknown,
  isRequired: boolean,
): FormField {
  // Try discriminated union
  const discriminatorKey = findDiscriminator(variants);
  if (discriminatorKey !== null) {
    const parsedVariants: UnionVariant[] = variants.map((variant) => {
      const variantProps = variant.properties as
        | Record<string, Record<string, unknown>>
        | undefined;
      const discProp = variantProps?.[discriminatorKey];
      // Const value (string), or first element of enum array
      const constVal =
        typeof discProp?.const === "string"
          ? discProp.const
          : Array.isArray(discProp?.enum)
            ? String(discProp.enum[0])
            : "";

      // Parse sub-fields, excluding the discriminator property itself
      let fields: FormField[] | undefined;
      if (variantProps) {
        const subSchema: Record<string, unknown> = {
          properties: Object.fromEntries(
            Object.entries(variantProps).filter(([k]) => k !== discriminatorKey),
          ),
        };
        if (Array.isArray(variant.required)) {
          subSchema.required = (variant.required as string[]).filter((r) => r !== discriminatorKey);
        }
        fields = parseSchemaSection(subSchema);
      }

      return {
        value: constVal,
        label: constVal,
        fields: fields && fields.length > 0 ? fields : undefined,
      };
    });

    return {
      key,
      type: "union",
      description,
      defaultValue,
      required: isRequired,
      discriminator: discriminatorKey,
      variants: parsedVariants,
    };
  }

  // Try simple type union (all variants are primitive types with no extra properties)
  const SIMPLE_TYPES = new Set(["string", "number", "integer", "boolean"]);
  const allSimple = variants.every((v) => {
    const t = v.type as string | undefined;
    return t !== undefined && SIMPLE_TYPES.has(t);
  });
  if (allSimple) {
    const parsedVariants: UnionVariant[] = variants.map((v) => {
      // Normalise "integer" → "number" for the label/value
      const t = v.type === "integer" ? "number" : String(v.type);
      return { value: t, label: t, type: t };
    });
    return {
      key,
      type: "union",
      description,
      defaultValue,
      required: isRequired,
      variants: parsedVariants,
    };
  }

  // Fallback: unrecognized pattern → json
  console.warn(`[schema-parser] Unrecognized union pattern for key "${key}"; falling back to json`);
  return { key, type: "json", description, defaultValue, required: isRequired };
}

/**
 * Check whether all variants in a oneOf/anyOf array share a common property
 * whose value is fixed by a `const` or a single-element `enum`.
 *
 * Returns the discriminator property name, or null if no such property exists.
 */
function findDiscriminator(variants: Record<string, unknown>[]): string | null {
  // All variants must be objects with a `properties` map
  const allObjects = variants.every(
    (v) => v.type === "object" && v.properties && typeof v.properties === "object",
  );
  if (!allObjects) {
    return null;
  }

  // Collect property names from the first variant as candidate discriminators
  const firstProps = Object.keys((variants[0]?.properties as Record<string, unknown>) ?? {});

  for (const propName of firstProps) {
    // Every variant must have this property with a const or enum value
    const allHaveConst = variants.every((variant) => {
      const props = variant.properties as Record<string, Record<string, unknown>>;
      const prop = props[propName];
      if (!prop) {
        return false;
      }
      return (
        typeof prop.const !== "undefined" || (Array.isArray(prop.enum) && prop.enum.length > 0)
      );
    });
    if (allHaveConst) {
      return propName;
    }
  }

  return null;
}
