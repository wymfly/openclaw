package registry

import (
	"context"
	"time"

	runtimecapability "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/capability"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/runtimeid"
)

const DefaultRuntimeID = runtimeid.Default

type LastStatusReader interface {
	LastStatus() facade.RuntimeStatus
}

type CapabilitySummary = runtimecapability.Summary

type CapabilityLoader interface {
	Load(context.Context) (CapabilitySummary, error)
}

type RuntimeSummary struct {
	RuntimeID         string  `json:"runtimeId"`
	Managed           bool    `json:"managed"`
	Configured        bool    `json:"configured"`
	Status            string  `json:"status"`
	Health            string  `json:"health"`
	CapabilityVersion *string `json:"capabilityVersion,omitempty"`
	MethodCount       *int    `json:"methodCount,omitempty"`
	EventCount        *int    `json:"eventCount,omitempty"`
	GatewayURL        *string `json:"gatewayUrl,omitempty"`
	LastError         *string `json:"lastError,omitempty"`
	AutoStart         bool    `json:"autoStart"`
	OccurredAt        string  `json:"occurredAt"`
}

type Summaries struct {
	reader       LastStatusReader
	capabilities CapabilityLoader
}

func NewSummaries(reader LastStatusReader) *Summaries {
	return &Summaries{reader: reader}
}

func NewSummariesWithCapabilities(reader LastStatusReader, capabilities CapabilityLoader) *Summaries {
	return &Summaries{
		reader:       reader,
		capabilities: capabilities,
	}
}

func (s *Summaries) ListRuntimes(ctx context.Context) ([]RuntimeSummary, error) {
	return []RuntimeSummary{summarize(ctx, s.reader.LastStatus(), s.capabilities)}, nil
}

func (s *Summaries) GetRuntime(ctx context.Context, runtimeID string) (RuntimeSummary, bool, error) {
	if runtimeID != DefaultRuntimeID {
		return RuntimeSummary{}, false, nil
	}
	return summarize(ctx, s.reader.LastStatus(), s.capabilities), true, nil
}

func summarize(ctx context.Context, status facade.RuntimeStatus, capabilities CapabilityLoader) RuntimeSummary {
	summary := RuntimeSummary{
		RuntimeID:         DefaultRuntimeID,
		Managed:           status.Mode == "bundled",
		Configured:        status.Configured,
		Status:            status.Status,
		Health:            status.Health,
		CapabilityVersion: nil,
		GatewayURL:        stringPtr(status.GatewayURL),
		LastError:         status.LastError,
		AutoStart:         status.AutoStart,
		OccurredAt:        time.Now().UTC().Format(time.RFC3339),
	}
	if capabilities == nil {
		return summary
	}
	capabilitySummary, err := capabilities.Load(ctx)
	if err != nil || !capabilitySummary.Available || capabilitySummary.SchemaVersion == "" {
		return summary
	}
	summary.CapabilityVersion = &capabilitySummary.SchemaVersion
	summary.MethodCount = &capabilitySummary.MethodCount
	summary.EventCount = &capabilitySummary.EventCount
	return summary
}

func stringPtr(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}
