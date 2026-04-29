package remote

import (
	"context"
	"errors"
	"testing"
	"time"

	runtimestate "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/state"
)

func TestReconnectRetriesWithExponentialBackoffAndTracksConnectedAt(t *testing.T) {
	state := NewRemoteState()
	now := time.Date(2026, 4, 28, 10, 0, 0, 0, time.UTC)
	var sleeps []time.Duration
	state.now = func() time.Time { return now }
	state.sleep = func(_ context.Context, delay time.Duration) error {
		sleeps = append(sleeps, delay)
		now = now.Add(delay)
		return nil
	}

	attempts := 0
	err := state.Reconnect(context.Background(), runtimestate.RemoteEndpoint{URL: "https://gateway.example.test"}, func(_ context.Context, endpoint runtimestate.RemoteEndpoint) error {
		if endpoint.URL != "https://gateway.example.test" {
			t.Fatalf("endpoint URL = %q", endpoint.URL)
		}
		attempts++
		if attempts < 3 {
			return errors.New("dial failed")
		}
		return nil
	})
	if err != nil {
		t.Fatalf("Reconnect() error = %v", err)
	}
	if attempts != 3 {
		t.Fatalf("attempts = %d, want 3", attempts)
	}
	if len(sleeps) != 2 || sleeps[0] != remoteReconnectInitialBackoff || sleeps[1] != 2*remoteReconnectInitialBackoff {
		t.Fatalf("sleeps = %#v, want exponential backoff", sleeps)
	}
	snapshot := state.Snapshot()
	if snapshot.Status != RemoteConnectionConnected || snapshot.LastError != "" || snapshot.Attempts != 0 {
		t.Fatalf("snapshot after success = %#v", snapshot)
	}
	if snapshot.LastConnectedAt == nil || !snapshot.LastConnectedAt.Equal(now) {
		t.Fatalf("LastConnectedAt = %#v, want %s", snapshot.LastConnectedAt, now)
	}
}

func TestReconnectKeepsLastErrorWhenContextStopsBackoff(t *testing.T) {
	state := NewRemoteState()
	ctx, cancel := context.WithCancel(context.Background())
	state.sleep = func(context.Context, time.Duration) error {
		cancel()
		return ctx.Err()
	}

	err := state.Reconnect(ctx, runtimestate.RemoteEndpoint{}, func(context.Context, runtimestate.RemoteEndpoint) error {
		return errors.New("auth failed")
	})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("Reconnect() error = %v, want context canceled", err)
	}
	snapshot := state.Snapshot()
	if snapshot.Status != RemoteConnectionError || snapshot.LastError != "auth failed" || snapshot.Attempts != 1 {
		t.Fatalf("snapshot after canceled retry = %#v", snapshot)
	}
	if snapshot.LastConnectedAt != nil {
		t.Fatalf("LastConnectedAt = %#v, want nil", snapshot.LastConnectedAt)
	}
}

func TestReconnectBackoffCapsAtMaximum(t *testing.T) {
	if got := reconnectBackoff(99); got != remoteReconnectMaxBackoff {
		t.Fatalf("reconnectBackoff(99) = %v, want %v", got, remoteReconnectMaxBackoff)
	}
}
