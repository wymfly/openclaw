# Frontend

This directory will host the single React frontend product for the migrated Deck.

Constraints:

- chat remains in-app
- no visual regression is acceptable
- route structure and information architecture should remain familiar where possible
- large-scale UI rewrites are out of scope for phase 1

Migration posture:

- begin by copying/adapting the existing React UI surface
- replace Next runtime dependencies with a transport compatibility layer
- target a standalone SPA build
