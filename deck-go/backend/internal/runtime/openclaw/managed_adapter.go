package openclaw

import "github.com/openclaw/openclaw/deck-go/backend/internal/events"

func NewManagedAdapter(provider ManagedConnectionProvider, bus *events.Bus) *Adapter {
	return NewAdapterWithRealtime(
		transportBinding.NewRequester(provider),
		transportBinding.NewSubscriptionController(provider, bus),
	)
}
