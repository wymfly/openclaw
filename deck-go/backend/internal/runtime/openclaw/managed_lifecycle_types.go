package openclaw

import "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/bundled"

type ManagedSnapshot = bundled.Snapshot
type ManagedStatus = bundled.Status
type ManagedHealth = bundled.Health
type ManagedStartFailureContext = bundled.StartFailureContext
type ManagedStartFailureDecision = bundled.StartFailureDecision
type ManagedStopSignalFailureContext = bundled.StopSignalFailureContext
type ManagedStopSignalFailureDecision = bundled.StopSignalFailureDecision
type ManagedStopNoProcessContext = bundled.StopNoProcessContext
type ManagedStopNoProcessDecision = bundled.StopNoProcessDecision
type ManagedStopWaitFailureContext = bundled.StopWaitFailureContext
type ManagedStopWaitFailureDecision = bundled.StopWaitFailureDecision
type ManagedExitTransitionContext = bundled.ExitTransitionContext
type ManagedExitTransitionDecision = bundled.ExitTransitionDecision

const (
	ManagedStatusStopped  = bundled.StatusStopped
	ManagedStatusStarting = bundled.StatusStarting
	ManagedStatusRunning  = bundled.StatusRunning
	ManagedStatusDegraded = bundled.StatusDegraded
	ManagedStatusStopping = bundled.StatusStopping
	ManagedStatusFailed   = bundled.StatusFailed

	ManagedHealthUnknown   = bundled.HealthUnknown
	ManagedHealthHealthy   = bundled.HealthHealthy
	ManagedHealthUnhealthy = bundled.HealthUnhealthy
)
