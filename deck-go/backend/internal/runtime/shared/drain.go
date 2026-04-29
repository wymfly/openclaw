package shared

import (
	"context"
	"errors"
	"io"
	"time"
)

type drainableConnection interface {
	Drain(context.Context) error
}

// DrainConnections gives callers a single primitive-only transition point for
// endpoint swaps. Stream registries live outside shared; a blank stream id asks
// the caller-owned callback to broadcast the terminal event it closed over.
func DrainConnections(
	ctx context.Context,
	oldConn io.Closer,
	newConn io.Closer,
	drainTimeout time.Duration,
	terminalEventName string,
	terminateStream func(streamID string),
) error {
	if ctx == nil {
		ctx = context.Background()
	}
	_ = newConn

	if terminalEventName != "" && terminateStream != nil {
		terminateStream("")
	}

	if oldConn == nil {
		return nil
	}
	if drainTimeout <= 0 {
		return oldConn.Close()
	}
	if drainable, ok := oldConn.(drainableConnection); ok {
		drainCtx, cancel := context.WithTimeout(ctx, drainTimeout)
		defer cancel()
		if err := drainable.Drain(drainCtx); err != nil {
			return errors.Join(err, oldConn.Close())
		}
		return oldConn.Close()
	}

	timer := time.NewTimer(drainTimeout)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return errors.Join(ctx.Err(), oldConn.Close())
	case <-timer.C:
		return oldConn.Close()
	}
}
