package openclaw_test

import (
	httpapi "github.com/openclaw/openclaw/deck-go/backend/internal/api/http"
	openclawrt "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/openclaw"
)

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
