package openclaw

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway/generated"
	"go.uber.org/goleak"
)

type fakeTypedSubscriptionController struct {
	mu                   sync.Mutex
	sessionsSubscribed   bool
	sessionsUnsubscribed bool
	messageSubscribed    string
	messageUnsubscribed  string
	unsubscribeCtxLive   bool
	unsubscribeErr       error
	unsubscribeErrors    int64
	decodeErrors         int64
	channels             map[string]chan json.RawMessage
}

func (f *fakeTypedSubscriptionController) SubscribeSessions(context.Context) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.sessionsSubscribed = true
	return nil
}

func (f *fakeTypedSubscriptionController) UnsubscribeSessions(ctx context.Context) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.sessionsUnsubscribed = true
	f.unsubscribeCtxLive = ctx.Err() == nil
	return f.unsubscribeErr
}

func (f *fakeTypedSubscriptionController) SubscribeSession(_ context.Context, key string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.messageSubscribed = key
	return nil
}

func (f *fakeTypedSubscriptionController) UnsubscribeSession(ctx context.Context, key string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.messageUnsubscribed = key
	f.unsubscribeCtxLive = ctx.Err() == nil
	return f.unsubscribeErr
}

func (f *fakeTypedSubscriptionController) RegisterEventChannel(eventName string, sessionKey string, ch chan json.RawMessage) func() {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.channels == nil {
		f.channels = map[string]chan json.RawMessage{}
	}
	f.channels[eventName+":"+sessionKey] = ch
	return func() {
		f.mu.Lock()
		defer f.mu.Unlock()
		delete(f.channels, eventName+":"+sessionKey)
	}
}

func (f *fakeTypedSubscriptionController) rawChannel(key string) chan json.RawMessage {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.channels[key]
}

func (f *fakeTypedSubscriptionController) RecordUnsubscribeError(error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.unsubscribeErrors++
}

func (f *fakeTypedSubscriptionController) UnsubscribeErrorsTotal() int64 {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.unsubscribeErrors
}

func (f *fakeTypedSubscriptionController) RecordSubscriptionDecodeError(error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.decodeErrors++
}

func (f *fakeTypedSubscriptionController) SubscriptionDecodeErrorsTotal() int64 {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.decodeErrors
}

func (f *fakeTypedSubscriptionController) snapshot() fakeTypedSubscriptionSnapshot {
	f.mu.Lock()
	defer f.mu.Unlock()
	return fakeTypedSubscriptionSnapshot{
		sessionsSubscribed:   f.sessionsSubscribed,
		sessionsUnsubscribed: f.sessionsUnsubscribed,
		messageSubscribed:    f.messageSubscribed,
		messageUnsubscribed:  f.messageUnsubscribed,
		unsubscribeCtxLive:   f.unsubscribeCtxLive,
	}
}

type fakeTypedSubscriptionSnapshot struct {
	sessionsSubscribed   bool
	sessionsUnsubscribed bool
	messageSubscribed    string
	messageUnsubscribed  string
	unsubscribeCtxLive   bool
}

func TestSubscribeMessagesDecodesTypedPayloadAndCancelsWithFreshContext(t *testing.T) {
	controller := &fakeTypedSubscriptionController{}
	ctx, stop := context.WithCancel(context.Background())
	eventsCh, cancel, err := SubscribeMessages(ctx, controller, "session-1", WithBufferSize(1))
	if err != nil {
		t.Fatal(err)
	}
	rawCh := controller.rawChannel("session.message:session-1")
	if rawCh == nil || controller.snapshot().messageSubscribed != "session-1" {
		t.Fatalf("subscription was not registered: %#v", controller)
	}

	rawCh <- mustRawEvent(t, map[string]any{
		"sessionKey": "session-1",
		"message": map[string]any{
			"id":   "msg-1",
			"role": "assistant",
		},
	})

	select {
	case event := <-eventsCh:
		if event.SessionKey != "session-1" || event.Message.Id != "msg-1" {
			t.Fatalf("unexpected typed event: %#v", event)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for typed message event")
	}

	stop()
	cancel()
	snapshot := controller.snapshot()
	if snapshot.messageUnsubscribed != "session-1" || !snapshot.unsubscribeCtxLive {
		t.Fatalf("unsubscribe did not use a fresh live context: %#v", snapshot)
	}
	if _, ok := <-eventsCh; ok {
		t.Fatal("expected typed channel to close after cancel")
	}
}

func TestSubscribeSessionsDecodesTypedPayload(t *testing.T) {
	controller := &fakeTypedSubscriptionController{}
	ctx, cancelCtx := context.WithCancel(context.Background())
	defer cancelCtx()
	eventsCh, cancel, err := SubscribeSessions(ctx, controller)
	if err != nil {
		t.Fatal(err)
	}
	rawCh := controller.rawChannel("sessions.changed:")
	if rawCh == nil || !controller.snapshot().sessionsSubscribed {
		t.Fatalf("sessions subscription was not registered: %#v", controller)
	}

	rawCh <- mustRawEvent(t, map[string]any{
		"sessionKey": "session-1",
		"reason":     "send",
		"ts":         1,
	})

	select {
	case event := <-eventsCh:
		if event.SessionKey != "session-1" || event.Reason != "send" {
			t.Fatalf("unexpected typed event: %#v", event)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for typed sessions event")
	}

	cancel()
	if !controller.snapshot().sessionsUnsubscribed {
		t.Fatal("expected sessions unsubscribe")
	}
}

func TestSubscribeMessagesConcurrentSubscriptionsCloseIndependently(t *testing.T) {
	controller := &fakeTypedSubscriptionController{}
	ctx, cancelCtx := context.WithCancel(context.Background())
	defer cancelCtx()

	first, cancelFirst, err := SubscribeMessages(ctx, controller, "session-1", WithBufferSize(1))
	if err != nil {
		t.Fatal(err)
	}
	second, cancelSecond, err := SubscribeMessages(ctx, controller, "session-2", WithBufferSize(1))
	if err != nil {
		t.Fatal(err)
	}
	defer cancelSecond()

	cancelFirst()
	if _, ok := <-first; ok {
		t.Fatal("expected first typed channel to close")
	}

	rawSecond := controller.rawChannel("session.message:session-2")
	if rawSecond == nil {
		t.Fatal("expected second raw channel to remain registered")
	}
	rawSecond <- mustRawEvent(t, map[string]any{
		"sessionKey": "session-2",
		"message": map[string]any{
			"id":   "msg-2",
			"role": "assistant",
		},
	})

	select {
	case event := <-second:
		if event.SessionKey != "session-2" || event.Message.Id != "msg-2" {
			t.Fatalf("unexpected second typed event: %#v", event)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for second typed event")
	}
}

func TestSubscribeMessagesUsesCustomBufferSize(t *testing.T) {
	controller := &fakeTypedSubscriptionController{}
	ctx, cancelCtx := context.WithCancel(context.Background())
	defer cancelCtx()
	eventsCh, cancel, err := SubscribeMessages(ctx, controller, "session-1", WithBufferSize(3))
	if err != nil {
		t.Fatal(err)
	}
	defer cancel()
	if got := cap(eventsCh); got != 3 {
		t.Fatalf("expected custom typed buffer size 3, got %d", got)
	}
}

func TestSubscribeMessages_UnsubscribeErrorIsObservable(t *testing.T) {
	controller := &fakeTypedSubscriptionController{
		unsubscribeErr: errors.New("unsubscribe failed"),
	}
	ctx, cancelCtx := context.WithCancel(context.Background())
	defer cancelCtx()
	eventsCh, cancel, err := SubscribeMessages(ctx, controller, "session-1", WithBufferSize(1))
	if err != nil {
		t.Fatal(err)
	}

	cancel()
	if _, ok := <-eventsCh; ok {
		t.Fatal("expected typed channel to close after cancel")
	}
	if got := controller.UnsubscribeErrorsTotal(); got != 1 {
		t.Fatalf("expected one observable unsubscribe error, got %d", got)
	}
	if snapshot := controller.snapshot(); snapshot.messageUnsubscribed != "session-1" {
		t.Fatalf("expected unsubscribe attempt to be recorded, got %#v", snapshot)
	}
}

func TestDecodeSubscriptionEvents_SchemaDriftCounter(t *testing.T) {
	controller := &fakeTypedSubscriptionController{}
	ctx, cancelCtx := context.WithCancel(context.Background())
	defer cancelCtx()
	eventsCh, cancel, err := SubscribeMessages(ctx, controller, "session-1", WithBufferSize(1))
	if err != nil {
		t.Fatal(err)
	}
	defer cancel()
	rawCh := controller.rawChannel("session.message:session-1")
	if rawCh == nil {
		t.Fatal("subscription was not registered")
	}

	rawCh <- json.RawMessage(`{"sessionKey":123,"message":{"id":"bad","role":"assistant"}}`)
	rawCh <- mustRawEvent(t, map[string]any{
		"sessionKey": "session-1",
		"message": map[string]any{
			"id":   "msg-1",
			"role": "assistant",
		},
	})

	select {
	case event := <-eventsCh:
		if event.SessionKey != "session-1" || event.Message.Id != "msg-1" {
			t.Fatalf("unexpected typed event after decode drift: %#v", event)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for valid typed message event")
	}
	if got := controller.SubscriptionDecodeErrorsTotal(); got != 1 {
		t.Fatalf("expected one observable decode error, got %d", got)
	}
}

func TestSubscribeMessagesNoGoroutineLeak(t *testing.T) {
	defer goleak.VerifyNone(t, goleak.IgnoreCurrent())

	controller := &fakeTypedSubscriptionController{}
	ctx, cancelCtx := context.WithCancel(context.Background())
	eventsCh, cancel, err := SubscribeMessages(ctx, controller, "session-1", WithBufferSize(1))
	if err != nil {
		t.Fatal(err)
	}
	cancel()
	cancelCtx()
	if _, ok := <-eventsCh; ok {
		t.Fatal("expected typed channel to close after cancel")
	}
	time.Sleep(20 * time.Millisecond)
}

func mustRawEvent(t *testing.T, payload map[string]any) json.RawMessage {
	t.Helper()
	raw, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

var _ = generated.SessionMessageEventPayload{}
