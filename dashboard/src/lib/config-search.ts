/**
 * Config search parser and matcher.
 *
 * Supports `tag:xxx` prefix syntax and multi-field text matching
 * against label, help, description, path, and enum values.
 */

import type { FormField } from "./schema-parser";

export interface ParsedSearch {
  tags: string[];
  text: string;
}

/**
 * Parse a search query string into structured parts.
 *
 * Extracts all `tag:xxx` prefixes and combines remaining text.
 * Example: "tag:sensitive token" → { tags: ["sensitive"], text: "token" }
 */
export function parseConfigSearch(query: string): ParsedSearch {
  const tags: string[] = [];
  const textParts: string[] = [];

  for (const token of query.trim().split(/\s+/)) {
    if (!token) {
      continue;
    }
    const tagMatch = /^tag:(.+)$/i.exec(token);
    if (tagMatch) {
      tags.push(tagMatch[1].toLowerCase());
    } else {
      textParts.push(token);
    }
  }

  return { tags, text: textParts.join(" ") };
}

/**
 * Test whether a single FormField matches the parsed search criteria.
 *
 * Matching rules:
 * - tags: field.tags must include ALL specified tags (AND)
 * - text: case-insensitive match against label, key (path), description, help, or enum options (OR)
 * - When both present: tags AND text must match
 */
export function matchesSearch(field: FormField, search: ParsedSearch, prefix = ""): boolean {
  if (search.tags.length === 0 && !search.text) {
    return true;
  }

  if (search.tags.length > 0) {
    const fieldTags = new Set((field.tags ?? []).map((t) => t.toLowerCase()));
    const allTagsMatch = search.tags.every((t) => fieldTags.has(t));
    if (!allTagsMatch) {
      return false;
    }
  }

  if (search.text) {
    const q = search.text.toLowerCase();
    const fullPath = `${prefix}${field.key}`;

    const haystack = [
      field.label,
      field.key,
      fullPath,
      field.description,
      field.help,
      ...(field.options ?? []),
    ];

    const textMatches = haystack.some((s) => typeof s === "string" && s.toLowerCase().includes(q));
    if (!textMatches) {
      return false;
    }
  }

  return true;
}

/**
 * Filter a FormField[] tree, keeping fields that match search criteria.
 * Recursively filters children, variants, valueSchema, and itemSchema.
 */
export function filterFields(fields: FormField[], search: ParsedSearch, prefix = ""): FormField[] {
  if (search.tags.length === 0 && !search.text) {
    return fields;
  }

  const result: FormField[] = [];

  for (const field of fields) {
    if (matchesSearch(field, search, prefix)) {
      result.push(field);
      continue;
    }

    // Check children recursively
    const childPrefix = `${prefix}${field.key}.`;
    let matched = false;

    if (field.children && field.children.length > 0) {
      const filteredChildren = filterFields(field.children, search, childPrefix);
      if (filteredChildren.length > 0) {
        result.push({ ...field, children: filteredChildren });
        matched = true;
      }
    }

    // Check union variants
    if (!matched && field.variants) {
      for (const variant of field.variants) {
        if (variant.fields) {
          const filteredVariantFields = filterFields(variant.fields, search, childPrefix);
          if (filteredVariantFields.length > 0) {
            result.push(field);
            matched = true;
            break;
          }
        }
      }
    }

    // Check valueSchema (record/map fields)
    if (!matched && field.valueSchema) {
      if (matchesSearch(field.valueSchema, search, childPrefix)) {
        result.push(field);
        matched = true;
      }
    }

    // Check itemSchema (typed array fields)
    if (!matched && field.itemSchema) {
      if (matchesSearch(field.itemSchema, search, childPrefix)) {
        result.push(field);
      }
    }
  }

  return result;
}

/** Entry in a tag index: tag name → count of fields with that tag */
export interface TagEntry {
  tag: string;
  count: number;
}

/**
 * Build a tag index from all fields across all schema sections.
 * Walks children, variants, valueSchema, and itemSchema.
 */
export function buildTagIndex(allFields: FormField[]): TagEntry[] {
  const tagCounts = new Map<string, number>();

  function walk(fields: FormField[]) {
    for (const field of fields) {
      if (field.tags) {
        for (const tag of field.tags) {
          const lower = tag.toLowerCase();
          tagCounts.set(lower, (tagCounts.get(lower) ?? 0) + 1);
        }
      }
      if (field.children) {
        walk(field.children);
      }
      if (field.variants) {
        for (const v of field.variants) {
          if (v.fields) {
            walk(v.fields);
          }
        }
      }
      if (field.valueSchema) {
        walk([field.valueSchema]);
      }
      if (field.itemSchema) {
        walk([field.itemSchema]);
      }
    }
  }

  walk(allFields);

  return Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .toSorted((a, b) => a.tag.localeCompare(b.tag));
}
