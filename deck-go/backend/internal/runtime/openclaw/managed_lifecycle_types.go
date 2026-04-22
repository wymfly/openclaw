package openclaw

import runtimecontrol "github.com/openclaw/openclaw/deck-go/backend/internal/runtime"

type ManagedSnapshot = runtimecontrol.Snapshot
type ManagedStatus = runtimecontrol.Status
type ManagedHealth = runtimecontrol.Health
type ManagedStartFailureContext = runtimecontrol.StartFailureContext
type ManagedStartFailureDecision = runtimecontrol.StartFailureDecision
type ManagedStopSignalFailureContext = runtimecontrol.StopSignalFailureContext
type ManagedStopSignalFailureDecision = runtimecontrol.StopSignalFailureDecision
type ManagedStopNoProcessContext = runtimecontrol.StopNoProcessContext
type ManagedStopNoProcessDecision = runtimecontrol.StopNoProcessDecision
type ManagedStopWaitFailureContext = runtimecontrol.StopWaitFailureContext
type ManagedStopWaitFailureDecision = runtimecontrol.StopWaitFailureDecision
type ManagedExitTransitionContext = runtimecontrol.ExitTransitionContext
type ManagedExitTransitionDecision = runtimecontrol.ExitTransitionDecision

const (
	ManagedStatusStopped  = runtimecontrol.StatusStopped
	ManagedStatusStarting = runtimecontrol.StatusStarting
	ManagedStatusRunning  = runtimecontrol.StatusRunning
	ManagedStatusDegraded = runtimecontrol.StatusDegraded
	ManagedStatusStopping = runtimecontrol.StatusStopping
	ManagedStatusFailed   = runtimecontrol.StatusFailed

	ManagedHealthUnknown   = runtimecontrol.HealthUnknown
	ManagedHealthHealthy   = runtimecontrol.HealthHealthy
	ManagedHealthUnhealthy = runtimecontrol.HealthUnhealthy
)
