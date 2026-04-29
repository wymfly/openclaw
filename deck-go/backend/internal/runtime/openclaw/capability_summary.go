package openclaw

import (
	"context"

	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway/generated"
	runtimecapability "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/capability"
)

type CapabilitySummary = runtimecapability.Summary

type CapabilitySummaryLoader struct {
	queries *GatewayQueries
}

func NewCapabilitySummary(requester Requester) *CapabilitySummaryLoader {
	return NewCapabilitySummaryWithQueries(NewGatewayQueries(requester))
}

func NewCapabilitySummaryWithQueries(queries *GatewayQueries) *CapabilitySummaryLoader {
	return &CapabilitySummaryLoader{queries: queries}
}

func (l *CapabilitySummaryLoader) Load(ctx context.Context) (CapabilitySummary, error) {
	if l.queries == nil {
		return CapabilitySummary{}, nil
	}
	payload, err := l.queries.Describe(ctx, false)
	if err != nil {
		return CapabilitySummary{}, err
	}
	return summarizeCapabilitySummaryPayload(payload), nil
}

func summarizeCapabilitySummaryPayload(payload any) CapabilitySummary {
	if result, ok := payload.(generated.GatewayDescribeResult); ok {
		return CapabilitySummary{
			Available:     true,
			SchemaVersion: result.SchemaVersion,
			MethodCount:   len(result.Methods),
			EventCount:    len(result.Events),
		}
	}
	record, ok := payload.(map[string]any)
	if !ok {
		return CapabilitySummary{}
	}
	summary := CapabilitySummary{Available: true}
	if schemaVersion, ok := record["schemaVersion"].(string); ok {
		summary.SchemaVersion = schemaVersion
	}
	if methods, ok := record["methods"].(map[string]any); ok {
		summary.MethodCount = len(methods)
	}
	if events, ok := record["events"].(map[string]any); ok {
		summary.EventCount = len(events)
	}
	return summary
}
