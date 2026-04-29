package shared

import (
	"context"
	"errors"
	"io"
	"testing"
	"time"
)

type recordingCloser struct {
	closed int
	err    error
}

func (c *recordingCloser) Close() error {
	c.closed++
	return c.err
}

func TestDrainConnectionsClosesOldAfterTimeoutAndKeepsNewOpen(t *testing.T) {
	oldConn := &recordingCloser{}
	newConn := &recordingCloser{}

	if err := DrainConnections(context.Background(), oldConn, newConn, time.Millisecond, "endpoint_switched", nil); err != nil {
		t.Fatalf("DrainConnections() error = %v", err)
	}
	if oldConn.closed != 1 {
		t.Fatalf("old close count = %d, want 1", oldConn.closed)
	}
	if newConn.closed != 0 {
		t.Fatalf("new close count = %d, want 0", newConn.closed)
	}
}

func TestDrainConnectionsInvokesTerminalCallbackOnce(t *testing.T) {
	var calls []string
	if err := DrainConnections(context.Background(), nil, nil, time.Second, "reconnect_requested", func(streamID string) {
		calls = append(calls, streamID)
	}); err != nil {
		t.Fatalf("DrainConnections() error = %v", err)
	}
	if len(calls) != 1 || calls[0] != "" {
		t.Fatalf("callback calls = %#v, want one broadcast call", calls)
	}
}

func TestDrainConnectionsSkipsCallbackWithoutTerminalEvent(t *testing.T) {
	called := false
	if err := DrainConnections(context.Background(), nil, nil, time.Second, "", func(string) {
		called = true
	}); err != nil {
		t.Fatalf("DrainConnections() error = %v", err)
	}
	if called {
		t.Fatal("callback was called without terminal event")
	}
}

func TestDrainConnectionsReturnsContextAndCloseErrors(t *testing.T) {
	closeErr := errors.New("close failed")
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	err := DrainConnections(ctx, &recordingCloser{err: closeErr}, nil, time.Second, "", nil)
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("DrainConnections() error = %v, want context canceled", err)
	}
	if !errors.Is(err, closeErr) {
		t.Fatalf("DrainConnections() error = %v, want close error", err)
	}
}

func TestDrainConnectionsAcceptsAnyIOCloser(t *testing.T) {
	if err := DrainConnections(context.Background(), io.NopCloser(nil), nil, 0, "", nil); err != nil {
		t.Fatalf("DrainConnections() with NopCloser error = %v", err)
	}
}
