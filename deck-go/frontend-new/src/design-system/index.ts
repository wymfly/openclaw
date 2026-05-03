/**
 * deck-go frontend design system — public API barrel.
 *
 * Consumers import atoms / patterns / icons / hooks via `@/design-system`.
 * Tokens are loaded as a side effect via `theme.css` `@import`.
 *
 * Phase status:
 * - P1a: tokens + low-deps atoms + utility hooks (complete)
 * - P1b: container / form / overlay atoms (complete)
 * - P2:  patterns (cross-module shells) + icons (lucide-react canonical)
 *
 * See: openspec/changes/deck-go-frontend-foundation-readiness/
 */

export * from "./atoms";
export * from "./hooks";
export * from "./patterns";
export * from "./icons";
