# Frontend

This directory is the active Stage 3 Deck host.

Current facts:

- `src/main.tsx` boots the restored Vite host by default
- browser transport goes through `src/lib/deck-client.ts`
- the build now runs `scripts/check-restored-host.mjs` before TypeScript/Vite
- `frontend-next/` is archive/reference-only and is no longer the active host path

Build / preview:

```bash
cd deck-go/frontend
VITE_DECK_GO_API_BASE=http://127.0.0.1:19566 \
npm run build

VITE_DECK_GO_API_BASE=http://127.0.0.1:19566 \
npm run preview -- --host 127.0.0.1
```

Host guardrails:

- all panel ids from `src/restoration/panel-registry.tsx` must stay implemented in `src/restoration/ActivePanelHost.tsx`
- `src/restoration/contract-readiness.ts` must not regress any panel back to `frontend-blocked`
- restored panels must stay compatible with the current frontend TypeScript/lib target
