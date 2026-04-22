package openclaw

import "context"

type GatewayStatusSummary struct {
	Connected                   bool
	Error                       string
	CapabilitySnapshotAvailable bool
	SchemaVersion               string
	MethodCount                 int
	EventCount                  int
}

type GatewayStatusLoader struct {
	queries      *GatewayQueries
	capabilities *CapabilitySummaryLoader
}

func NewGatewayStatus(requester Requester) *GatewayStatusLoader {
	return NewGatewayStatusWithQueries(NewGatewayQueries(requester))
}

func NewGatewayStatusWithQueries(queries *GatewayQueries) *GatewayStatusLoader {
	return &GatewayStatusLoader{
		queries:      queries,
		capabilities: NewCapabilitySummaryWithQueries(queries),
	}
}

func (l *GatewayStatusLoader) Load(ctx context.Context) (GatewayStatusSummary, error) {
	if l.queries == nil {
		return GatewayStatusSummary{}, nil
	}
	_, err := l.queries.Health(ctx)
	if err != nil {
		return GatewayStatusSummary{Connected: false, Error: err.Error()}, nil
	}

	summary := GatewayStatusSummary{Connected: true}
	capability, err := l.capabilities.Load(ctx)
	if err != nil {
		summary.Error = err.Error()
		return summary, nil
	}
	summary.CapabilitySnapshotAvailable = capability.Available
	summary.SchemaVersion = capability.SchemaVersion
	summary.MethodCount = capability.MethodCount
	summary.EventCount = capability.EventCount
	return summary, nil
}
