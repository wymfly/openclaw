# Agents impact risk specifics i18n compatibility

- **Source**: Claude Code review `docs/superpowers/specs/2026-05-12-deck-go-agents-section-ia-convergence-implementation-review.md`, F-Rev1.
- **Category**: contract-chain / i18n / frontend-product.
- **Status**: resolved-additive.
- **Facts**:
  - Initial implementation returned only `riskSpecifics: string[]` from `deck.agents.impactPreview.get`.
  - The product UI is localized, so Gateway-authored English-only strings are not sufficient as the primary frontend rendering contract.
  - The fix preserves legacy `riskSpecifics` and adds `riskSpecificsI18n?: Array<{ key, vars? }>` for localized rendering.
- **Current resolution**:
  - Gateway emits both legacy strings and i18n keys for all current impact operations.
  - Frontend prefers `riskSpecificsI18n` and falls back to legacy strings when older Gateway responses do not include keys.
- **Suggested next step**:
  - Keep the legacy field until a future protocol-major cleanup can safely deprecate it.
- **Needs new OpenSpec**: no, unless removing the legacy field.
- **Acceptance clues**:
  - Contract source and generated DTOs include `DeckGoAgentRiskSpecific`.
  - Backend tests assert `riskSpecificsI18n`.
  - Frontend zh/en renders through `agentsPanel.impact.risks.*`.
