package openclaw_test

import (
	"context"

	httpapi "github.com/openclaw/openclaw/deck-go/backend/internal/api/http"
	wsapi "github.com/openclaw/openclaw/deck-go/backend/internal/api/ws"
	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
	openclawrt "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/openclaw"
	runtimeregistry "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/registry"
)

type runtimeGatewayRouteSurface interface {
	RuntimeGatewayStatusResponse() deckapi.DeckGoRuntimeGatewayActionResponse
	StartRuntimeGateway(context.Context) (deckapi.DeckGoRuntimeGatewayActionResponse, error)
	StopRuntimeGateway(context.Context) (deckapi.DeckGoRuntimeGatewayActionResponse, error)
	RestartRuntimeGateway(context.Context) (deckapi.DeckGoRuntimeGatewayActionResponse, error)
	BootstrapStatus(context.Context) (deckapi.DeckGoBootstrapStatusResponse, error)
}

var _ httpapi.LogProvider = (*openclawrt.ManagedRuntime)(nil)
var _ httpapi.SettingsProvider = (*openclawrt.ManagedRuntime)(nil)
var _ httpapi.SessionEventProvider = (*openclawrt.ManagedRuntime)(nil)
var _ httpapi.ChatCompatProvider = (*openclawrt.ManagedRuntime)(nil)
var _ httpapi.UsageProvider = (*openclawrt.ManagedRuntime)(nil)
var _ httpapi.ModelAdminProvider = (*openclawrt.ManagedRuntime)(nil)
var _ httpapi.EventStreamProvider = (*openclawrt.ManagedRuntime)(nil)
var _ httpapi.AssetProvider = (*openclawrt.ManagedRuntime)(nil)
var _ httpapi.DocsProvider = (*openclawrt.ManagedRuntime)(nil)
var _ httpapi.MemoryBrowseProvider = (*openclawrt.ManagedRuntime)(nil)
var _ httpapi.BudgetProvider = (*openclawrt.ManagedRuntime)(nil)
var _ httpapi.OnboardingProvider = (*openclawrt.ManagedRuntime)(nil)
var _ httpapi.RuntimeQueryProvider = (*runtimeregistry.Registry)(nil)
var _ wsapi.RuntimeEventFeed = (*runtimeregistry.Registry)(nil)
var _ runtimeGatewayRouteSurface = (*openclawrt.ManagedRuntime)(nil)
