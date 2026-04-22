import type { FormField, UnionVariant } from "@/lib/schema-parser";

function matchesPattern(path: string[], pattern: string[]): boolean {
  if (path.length !== pattern.length) {
    return false;
  }
  return pattern.every((segment, index) => segment === "*" || segment === path[index]);
}

function shouldExclude(path: string[], patterns: string[][]): boolean {
  return patterns.some((pattern) => matchesPattern(path, pattern));
}

function filterSchemaFieldsWithPatterns(
  fields: FormField[],
  patterns: string[][],
  basePath: string[] = [],
): FormField[] {
  return fields.flatMap((field) => {
    const path = [...basePath, field.key];
    if (shouldExclude(path, patterns)) {
      return [];
    }

    let nextField: FormField = field;

    if (field.children) {
      const children = filterSchemaFieldsWithPatterns(field.children, patterns, path);
      if (children.length === 0 && field.children.length > 0) {
        return [];
      }
      nextField = { ...nextField, children };
    }

    if (field.valueSchema?.children) {
      const valueChildren = filterSchemaFieldsWithPatterns(field.valueSchema.children, patterns, [
        ...path,
        "*",
      ]);
      if (valueChildren.length === 0 && field.valueSchema.children.length > 0) {
        return [];
      }
      nextField = {
        ...nextField,
        valueSchema: {
          ...field.valueSchema,
          children: valueChildren,
        },
      };
    }

    if (field.variants) {
      const variants = field.variants
        .map((variant) => maybeFilterVariant(variant, patterns, path))
        .filter((variant): variant is UnionVariant => variant !== null);
      nextField = { ...nextField, variants };
    }

    return [nextField];
  });
}

function maybeFilterVariant(
  variant: UnionVariant,
  patterns: string[][],
  basePath: string[],
): UnionVariant | null {
  if (!variant.fields) {
    return variant;
  }
  const fields = filterSchemaFieldsWithPatterns(variant.fields, patterns, basePath);
  if (fields.length === 0) {
    return null;
  }
  return { ...variant, fields };
}

/**
 * Recursively filter schema-derived form fields by dotted path.
 *
 * Supports `*` wildcards for record-style keys, e.g. `accounts.*.bot.dm`.
 */
export function filterSchemaFields(
  fields: FormField[],
  excludePaths: string[],
  basePath: string[] = [],
): FormField[] {
  const patterns = excludePaths.map((path) => path.split(".").filter(Boolean));
  return filterSchemaFieldsWithPatterns(fields, patterns, basePath);
}
