package openclaw

import runtimecontrol "github.com/openclaw/openclaw/deck-go/backend/internal/runtime"

type ManagedSnapshot = runtimecontrol.Snapshot
type ManagedStatus = runtimecontrol.Status
type ManagedHealth = runtimecontrol.Health

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
