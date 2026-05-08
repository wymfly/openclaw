package runtimeid

import (
	"testing"

	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
)

func TestDefaultMatchesDeckAPIContract(t *testing.T) {
	if Default != deckapi.DeckGoDefaultRuntimeId {
		t.Fatalf("runtime default %q does not match Deck API contract %q", Default, deckapi.DeckGoDefaultRuntimeId)
	}
}
