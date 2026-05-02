# Agents Enterprise Prototype v2

This is a high-fidelity exploration for the `agents` module. It is not a
ready-to-implement six-file handoff package yet.

Source constraints:

- Contract authority: `deck-go/contracts/source/deck-api.contract.ts`
- UI metadata authority: `deck-go/contracts/source/deck-ui.contract.json`
- Gateway generated reference: `deck-go/contracts/generated/ts/gateway/protocol.ts`
- Design system authority: `deck-go/frontend-new/src/design-system/tokens/index.css`
- Current implementation reference: `deck-go/frontend-new/src/components/panels/agents/`

Design stance:

- Contract and design-system truth outrank visual exploration.
- The generated concept image is used only for layout rhythm, density, and visual direction.
- The prototype keeps the old Claude Design package untouched.

Open `prototype.html` in a browser for review.
