package openclaw

import (
	"context"
	"encoding/json"
	"log/slog"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway/generated"
)

const (
	defaultTypedSubscriptionBuffer = 64
	defaultRawSubscriptionBuffer   = 64
)

type SubscriptionOption func(*subscriptionOptions)

type subscriptionOptions struct {
	bufferSize int
}

type typedSessionSubscriptionController interface {
	SubscribeSessions(context.Context) error
	UnsubscribeSessions(context.Context) error
	RegisterEventChannel(eventName string, sessionKey string, ch chan json.RawMessage) func()
}

type typedMessageSubscriptionController interface {
	SubscribeSession(context.Context, string) error
	UnsubscribeSession(context.Context, string) error
	RegisterEventChannel(eventName string, sessionKey string, ch chan json.RawMessage) func()
}

type unsubscribeErrorRecorder interface {
	RecordUnsubscribeError(error)
}

type subscriptionDecodeErrorRecorder interface {
	RecordSubscriptionDecodeError(error)
}

func WithBufferSize(n int) SubscriptionOption {
	return func(options *subscriptionOptions) {
		if n > 0 {
			options.bufferSize = n
		}
	}
}

func SubscribeSessions(
	ctx context.Context,
	controller typedSessionSubscriptionController,
	opts ...SubscriptionOption,
) (<-chan generated.SessionsChangedEventPayload, func(), error) {
	options := applySubscriptionOptions(opts)
	rawCh := make(chan json.RawMessage, defaultRawSubscriptionBuffer)
	unregister := controller.RegisterEventChannel("sessions.changed", "", rawCh)
	if err := controller.SubscribeSessions(ctx); err != nil {
		unregister()
		return nil, func() {}, err
	}

	out := make(chan generated.SessionsChangedEventPayload, options.bufferSize)
	done := make(chan struct{})
	var once sync.Once
	cancel := func() {
		once.Do(func() {
			unregister()
			unsubscribeCtx, cancelCtx := context.WithTimeout(context.Background(), unsubscribeTimeout())
			defer cancelCtx()
			if err := controller.UnsubscribeSessions(unsubscribeCtx); err != nil {
				recordUnsubscribeError(controller, "", err)
			}
			close(done)
		})
	}
	// Explicit cancel closes done, which also releases the ctx watcher below
	// when callers use a never-cancelled parent context.
	go func() {
		select {
		case <-ctx.Done():
			cancel()
		case <-done:
		}
	}()
	go decodeSubscriptionEvents(rawCh, out, done, "sessions.changed", func(err error) {
		recordSubscriptionDecodeError(controller, "sessions.changed", err)
	})
	return out, cancel, nil
}

func SubscribeMessages(
	ctx context.Context,
	controller typedMessageSubscriptionController,
	sessionKey string,
	opts ...SubscriptionOption,
) (<-chan generated.SessionMessageEventPayload, func(), error) {
	options := applySubscriptionOptions(opts)
	rawCh := make(chan json.RawMessage, defaultRawSubscriptionBuffer)
	unregister := controller.RegisterEventChannel("session.message", sessionKey, rawCh)
	if err := controller.SubscribeSession(ctx, sessionKey); err != nil {
		unregister()
		return nil, func() {}, err
	}

	out := make(chan generated.SessionMessageEventPayload, options.bufferSize)
	done := make(chan struct{})
	var once sync.Once
	cancel := func() {
		once.Do(func() {
			unregister()
			unsubscribeCtx, cancelCtx := context.WithTimeout(context.Background(), unsubscribeTimeout())
			defer cancelCtx()
			if err := controller.UnsubscribeSession(unsubscribeCtx, sessionKey); err != nil {
				recordUnsubscribeError(controller, sessionKey, err)
			}
			close(done)
		})
	}
	// Explicit cancel closes done, which also releases the ctx watcher below
	// when callers use a never-cancelled parent context.
	go func() {
		select {
		case <-ctx.Done():
			cancel()
		case <-done:
		}
	}()
	go decodeSubscriptionEvents(rawCh, out, done, "session.message", func(err error) {
		recordSubscriptionDecodeError(controller, "session.message", err)
	})
	return out, cancel, nil
}

func applySubscriptionOptions(opts []SubscriptionOption) subscriptionOptions {
	options := subscriptionOptions{bufferSize: defaultTypedSubscriptionBuffer}
	for _, opt := range opts {
		if opt != nil {
			opt(&options)
		}
	}
	return options
}

func decodeSubscriptionEvents[T any](
	rawCh <-chan json.RawMessage,
	out chan<- T,
	done <-chan struct{},
	eventName string,
	onDecodeError func(error),
) {
	defer close(out)
	for {
		select {
		case <-done:
			return
		case raw, ok := <-rawCh:
			if !ok {
				return
			}
			var payload T
			if err := json.Unmarshal(raw, &payload); err != nil {
				if onDecodeError != nil {
					onDecodeError(err)
				}
				slog.Warn("gateway subscription decode failed", "event", eventName, "err", err)
				continue
			}
			select {
			case out <- payload:
			case <-done:
				return
			}
		}
	}
}

func recordUnsubscribeError(controller any, sessionKey string, err error) {
	if recorder, ok := controller.(unsubscribeErrorRecorder); ok {
		recorder.RecordUnsubscribeError(err)
	}
	args := []any{"err", err}
	if strings.TrimSpace(sessionKey) != "" {
		args = append(args, "session_key", sessionKey)
	}
	slog.Warn("gateway subscription unsubscribe failed", args...)
}

func recordSubscriptionDecodeError(controller any, eventName string, err error) {
	if recorder, ok := controller.(subscriptionDecodeErrorRecorder); ok {
		recorder.RecordSubscriptionDecodeError(err)
	}
}

func unsubscribeTimeout() time.Duration {
	const defaultTimeout = time.Second
	raw := strings.TrimSpace(os.Getenv("GATEWAY_UNSUBSCRIBE_TIMEOUT_MS"))
	if raw == "" {
		return defaultTimeout
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value <= 0 {
		return defaultTimeout
	}
	return time.Duration(value) * time.Millisecond
}
