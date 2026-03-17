/**
 * JSON Schema → FormField[] parser for the config editor.
 *
 * Converts a JSON Schema (as returned by config.schema) into a flat/nested
 * list of typed form fields that the SchemaForm component can render.
 */

export interface FormField {
  key: string;
  type: "string" | "number" | "boolean" | "enum" | "array" | "object";
  description?: string;
  defaultValue?: unknown;
  options?: string[];
  children?: FormField[];
  required?: boolean;
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
