/**
 * uiHints path matcher and FormField post-processor.
 *
 * uiHints is a flat map of dotted paths → hint objects returned alongside the
 * JSON Schema by /api/config/schema.  A `*` segment in a path key matches any
 * single segment in the resolved field path (useful for array indices or
 * dynamic map keys such as `models.providers.*.apiKey`).
 *
 * Usage:
 *   const decorated = applyUiHints(fields, uiHintsMap);
 */

import type { FormField } from "./schema-parser";

export interface UiHint {
  sensitive?: boolean;
  collapsed?: boolean;
  placeholder?: string;
}

export type UiHintsMap = Record<string, UiHint>;

/**
 * Match a concrete field path against a hints map.
 *
 * Priority:
 *   1. Exact match (highest)
 *   2. Wildcard match — `*` matches exactly one dot-separated segment
 *
 * Returns the matched UiHint, or undefined when nothing matches.
 */
export function matchUiHint(fieldPath: string, hints: UiHintsMap): UiHint | undefined {
  // 1. Exact match
  if (Object.prototype.hasOwnProperty.call(hints, fieldPath)) {
    return hints[fieldPath];
  }

  // 2. Wildcard match — iterate all hint keys that contain `*`
  const fieldParts = fieldPath.split(".");

  for (const [hintPath, hint] of Object.entries(hints)) {
    if (!hintPath.includes("*")) {
      continue;
    }
    const hintParts = hintPath.split(".");
    if (hintParts.length !== fieldParts.length) {
      continue;
    }
    const matches = hintParts.every((segment, i) => segment === "*" || segment === fieldParts[i]);
    if (matches) {
      return hint;
    }
  }

  return undefined;
}

/**
 * Post-process a FormField[] tree, decorating each field with any matching
 * uiHint properties (sensitive, collapsed, placeholder).
 *
 * - Builds the dotted path as it recurses: `<prefix><field.key>`
 * - Returns a new array with shallow-copied, decorated fields (no mutation)
 * - Recurses into `children` with the path extended by `<key>.`
 */
export function applyUiHints(fields: FormField[], hints: UiHintsMap, prefix = ""): FormField[] {
  if (Object.keys(hints).length === 0) {
    return fields;
  }

  return fields.map((field) => {
    const path = `${prefix}${field.key}`;
    const hint = matchUiHint(path, hints);

    // Build shallow copy, applying hint properties only when defined
    const decorated: FormField = hint
      ? {
          ...field,
          ...(hint.sensitive !== undefined ? { sensitive: hint.sensitive } : {}),
          ...(hint.collapsed !== undefined ? { collapsed: hint.collapsed } : {}),
          ...(hint.placeholder !== undefined ? { placeholder: hint.placeholder } : {}),
        }
      : { ...field };

    // Recurse into children
    if (decorated.children && decorated.children.length > 0) {
      decorated.children = applyUiHints(decorated.children, hints, `${path}.`);
    }

    return decorated;
  });
}
