## Context

Old Deck app frame:

- `dashboard/src/app/page.tsx` composes `ThemeSync`, `Shell`, `PanelErrorBoundary`, `ToastContainer`, `KeyboardShortcutsDialog`, onboarding, and suspense fallback.
- `dashboard/src/components/layout/NavRail.tsx` uses Lucide icons, registry badges, active states, collapse behavior, tablet auto-collapse, mobile overlay, and bottom settings.
- `dashboard/src/components/layout/HeaderBar.tsx` uses gateway status, locale toggle, theme toggle, mobile menu, and active panel title.
- `dashboard/src/app/globals.css` defines shadcn-compatible design tokens and Tailwind utility-driven panel styling.

Current Vite app frame:

- `deck-go/frontend/src/deck-ui/App.tsx` focuses on summary/auth/bootstrap.
- `deck-go/frontend/src/deck-ui/Shell.tsx` only composes nav/header/content.
- `deck-go/frontend/src/theme.css` contains many custom `deckgo-*`/`deck-ui-*` styles and panel-specific primitives.

The migration should not copy Next.js runtime behavior, but it must restore the same visible operator experience on the Vite/Go stack.

## Goals / Non-Goals

**Goals:**

- Establish shell/i18n/shared primitives before panel-level work.
- Preserve old Deck desktop visual rhythm: 12px header, 52/208px sidebar behavior, compact card/list/form density, old active states, old status controls.
- Make all visible shell copy and shared primitive copy locale-aware.
- Provide shared primitives so child panel changes do not keep inventing one-off layouts.

**Non-Goals:**

- Do not migrate mobile parity in this change.
- Do not reintroduce Next.js routing or API routes.
- Do not redesign away from old Deck.

## Decisions

### D1: Restore shell parity before panel parity

Panel visual work depends on the global frame. The shell change must land first so screenshots and layout measurements use the correct baseline.

### D2: Treat i18n wiring as a blocking shell/platform concern

The current issue is not JSON key count; it is visible copy wiring. This change creates the audit and helpers used by all child panel changes.

### D3: Keep Vite CSS if it can match old Deck

The old client used Tailwind/shadcn. Vite may keep CSS variables and classes, but output must match old Deck perceptually. Reintroducing Tailwind is optional and requires a separate dependency decision.

## Risks / Trade-offs

- **Risk: shared primitives become a second design system.** → Keep them mapped to old Deck components and only add primitives with at least two panel consumers.
- **Risk: auth/bootstrap screens have no old equivalent.** → Style them using old Deck card/header/status patterns and document the product difference.
- **Risk: i18n audit becomes noisy due API identifiers.** → Maintain an explicit allowlist category for proper nouns, code, IDs, and user data.
