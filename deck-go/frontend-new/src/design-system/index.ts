/**
 * deck-go frontend design system — public API barrel.
 *
 * Consumers import atoms / hooks via `@/design-system`.
 * Tokens are loaded as a side effect via `theme.css` `@import`.
 *
 * Phase status:
 * - P1a: tokens + low-deps atoms + utility hooks (in progress)
 * - P1b: container / form / overlay atoms (pending)
 *
 * See: openspec/changes/frontend-design-system-via-chat/specs/frontend-design-system/spec.md
 */

export * from "./atoms";
export * from "./hooks";
