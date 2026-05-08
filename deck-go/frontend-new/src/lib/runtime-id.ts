import { DeckGoDefaultRuntimeId } from "../../../contracts/generated/ts/deck-api.generated";

// Deck-facing contract owns this default; backend runtimeid tests lock the Go bridge.
export const DEFAULT_RUNTIME_ID = DeckGoDefaultRuntimeId;
