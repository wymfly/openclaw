package remote

import (
	"context"
	"sync"
	"time"

	runtimestate "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/state"
)

const (
	remoteReconnectInitialBackoff = 250 * time.Millisecond
	remoteReconnectMaxBackoff     = 5 * time.Second
)

type RemoteConnectionStatus string

const (
	RemoteConnectionIdle       RemoteConnectionStatus = "idle"
	RemoteConnectionConnecting RemoteConnectionStatus = "connecting"
	RemoteConnectionConnected  RemoteConnectionStatus = "connected"
	RemoteConnectionError      RemoteConnectionStatus = "error"
)

type RemoteStateSnapshot struct {
	Status          RemoteConnectionStatus
	LastConnectedAt *time.Time
	LastError       string
	Attempts        int
}

type RemoteState struct {
	mu              sync.RWMutex
	status          RemoteConnectionStatus
	lastConnectedAt *time.Time
	lastError       string
	attempts        int
	now             func() time.Time
	sleep           func(context.Context, time.Duration) error
}

func NewRemoteState() *RemoteState {
	return &RemoteState{
		status: RemoteConnectionIdle,
		now:    time.Now,
		sleep:  sleepContext,
	}
}

func (s *RemoteState) Snapshot() RemoteStateSnapshot {
	if s == nil {
		return RemoteStateSnapshot{Status: RemoteConnectionIdle}
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	var lastConnectedAt *time.Time
	if s.lastConnectedAt != nil {
		value := *s.lastConnectedAt
		lastConnectedAt = &value
	}
	return RemoteStateSnapshot{
		Status:          s.status,
		LastConnectedAt: lastConnectedAt,
		LastError:       s.lastError,
		Attempts:        s.attempts,
	}
}

func (s *RemoteState) Reconnect(
	ctx context.Context,
	endpoint runtimestate.RemoteEndpoint,
	connect func(context.Context, runtimestate.RemoteEndpoint) error,
) error {
	if ctx == nil {
		ctx = context.Background()
	}
	if connect == nil {
		return nil
	}
	sleep := sleepContext
	if s != nil && s.sleep != nil {
		sleep = s.sleep
	}

	for {
		s.markConnecting()
		if err := connect(ctx, endpoint); err != nil {
			delay := s.markErrorAndNextBackoff(err)
			if sleepErr := sleep(ctx, delay); sleepErr != nil {
				return sleepErr
			}
			continue
		}
		s.markConnected()
		return nil
	}
}

func (s *RemoteState) markConnecting() {
	if s == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.status = RemoteConnectionConnecting
}

func (s *RemoteState) markConnected() {
	if s == nil {
		return
	}
	nowFunc := s.now
	if nowFunc == nil {
		nowFunc = time.Now
	}
	now := nowFunc().UTC()
	s.mu.Lock()
	defer s.mu.Unlock()
	s.status = RemoteConnectionConnected
	s.lastConnectedAt = &now
	s.lastError = ""
	s.attempts = 0
}

func (s *RemoteState) markError(err error) {
	if s == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.status = RemoteConnectionError
	if err != nil {
		s.lastError = err.Error()
	}
}

func (s *RemoteState) markErrorAndNextBackoff(err error) time.Duration {
	if s == nil {
		return remoteReconnectInitialBackoff
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.status = RemoteConnectionError
	if err != nil {
		s.lastError = err.Error()
	}
	s.attempts++
	return reconnectBackoff(s.attempts)
}

func reconnectBackoff(attempt int) time.Duration {
	if attempt <= 1 {
		return remoteReconnectInitialBackoff
	}
	delay := remoteReconnectInitialBackoff
	for i := 1; i < attempt; i++ {
		if delay >= remoteReconnectMaxBackoff/2 {
			return remoteReconnectMaxBackoff
		}
		delay *= 2
	}
	return delay
}

func sleepContext(ctx context.Context, delay time.Duration) error {
	if delay <= 0 {
		return ctx.Err()
	}
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}
