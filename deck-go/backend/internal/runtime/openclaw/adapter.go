package openclaw

type RuntimeSurface interface {
	CapabilitySummary() *CapabilitySummaryLoader
	GatewayStatus() *GatewayStatusLoader
	GatewayQueries() *GatewayQueries
	SessionQueries() *SessionQueries
	SessionCommands() *SessionCommands
	SessionSubscriptions() *SessionSubscriptions
	CurrentDeviceID() (string, error)
}

type Adapter struct {
	queries           *GatewayQueries
	sessionQueries    *SessionQueries
	sessionCommands   *SessionCommands
	capabilitySummary *CapabilitySummaryLoader
	gatewayStatus     *GatewayStatusLoader
	subscriptions     *SessionSubscriptions
}

var _ RuntimeSurface = (*Adapter)(nil)

func NewAdapter(requester Requester) *Adapter {
	return newAdapter(requester, nil)
}

func NewAdapterWithRealtime(requester Requester, controller SessionSubscriptionController) *Adapter {
	return newAdapter(requester, controller)
}

func newAdapter(requester Requester, controller SessionSubscriptionController) *Adapter {
	queries := NewGatewayQueries(requester)
	return &Adapter{
		queries:           queries,
		sessionQueries:    NewSessionQueries(requester),
		sessionCommands:   NewSessionCommands(requester),
		capabilitySummary: NewCapabilitySummaryWithQueries(queries),
		gatewayStatus:     NewGatewayStatusWithQueries(queries),
		subscriptions:     NewSessionSubscriptions(controller),
	}
}

func (a *Adapter) Close() error {
	if a == nil {
		return nil
	}
	var closeErr error
	if a.queries != nil {
		closeErr = firstCloseErr(closeErr, closeRuntimeResource(a.queries.requester))
	}
	if a.subscriptions != nil {
		closeErr = firstCloseErr(closeErr, closeRuntimeResource(a.subscriptions.controller))
	}
	return closeErr
}

func closeRuntimeResource(target any) error {
	closeable, ok := target.(interface{ Close() error })
	if !ok {
		return nil
	}
	return closeable.Close()
}

func firstCloseErr(current error, next error) error {
	if current != nil {
		return current
	}
	return next
}

func (a *Adapter) CapabilitySummary() *CapabilitySummaryLoader {
	return a.capabilitySummary
}

func (a *Adapter) GatewayStatus() *GatewayStatusLoader {
	return a.gatewayStatus
}

func (a *Adapter) GatewayQueries() *GatewayQueries {
	return a.queries
}

func (a *Adapter) SessionQueries() *SessionQueries {
	return a.sessionQueries
}

func (a *Adapter) SessionCommands() *SessionCommands {
	return a.sessionCommands
}

func (a *Adapter) SessionSubscriptions() *SessionSubscriptions {
	return a.subscriptions
}

func (a *Adapter) CurrentDeviceID() (string, error) {
	return CurrentDeviceID()
}
