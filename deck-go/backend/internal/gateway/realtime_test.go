package gateway

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"sort"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
)

type mutableProvider struct {
	mu    sync.Mutex
	url   string
	token string
	ok    bool
	calls atomic.Int32
}

func (p *mutableProvider) GatewayConnection() (string, string, bool) {
	p.calls.Add(1)
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.url, p.token, p.ok
}

func (p *mutableProvider) set(url string, token string) {
	p.mu.Lock()
	p.url = url
	p.token = token
	p.ok = true
	p.mu.Unlock()
}

func TestRealtime_SingleConnectionAcrossRPCs(t *testing.T) {
	var connCount atomic.Int32
	server := newRPCGatewayServer(t, rpcGatewayOptions{
		onConnect: func(_ map[string]any) {
			connCount.Add(1)
		},
	})
	defer server.Close()

	provider := &mutableProvider{url: wsURL(server.URL), token: "token-1", ok: true}
	realtime := NewRealtime(provider, events.NewNoopBus())
	defer realtime.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	for i := 0; i < 3; i++ {
		payload, err := realtime.Request(ctx, "health", map[string]any{"i": i})
		if err != nil {
			t.Fatal(err)
		}
		result, _ := payload.(map[string]any)
		if result["method"] != "health" {
			t.Fatalf("unexpected payload: %#v", payload)
		}
	}
	if got := connCount.Load(); got != 1 {
		t.Fatalf("expected 1 websocket connection, got %d", got)
	}
}

func TestEnsureConnected_ConcurrentSingleflight(t *testing.T) {
	var connCount atomic.Int32
	server := newRPCGatewayServer(t, rpcGatewayOptions{
		onConnect: func(_ map[string]any) {
			connCount.Add(1)
		},
	})
	defer server.Close()

	provider := &mutableProvider{url: wsURL(server.URL), token: "token-1", ok: true}
	realtime := NewRealtime(provider, events.NewNoopBus())
	defer realtime.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var start sync.WaitGroup
	start.Add(1)
	var calls sync.WaitGroup
	errs := make(chan error, 10)
	for i := 0; i < 10; i++ {
		calls.Add(1)
		go func() {
			defer calls.Done()
			start.Wait()
			_, err := realtime.Request(ctx, "health", map[string]any{})
			errs <- err
		}()
	}
	start.Done()
	calls.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
	if got := connCount.Load(); got != 1 {
		t.Fatalf("expected concurrent first RPCs to share 1 connection, got %d", got)
	}
	if got := provider.calls.Load(); got != 1 {
		t.Fatalf("expected provider to be read once during singleflight connect, got %d", got)
	}
}

func TestEnsureConnected_DialFailureDuringConcurrent(t *testing.T) {
	var connCount atomic.Int32
	server := newHandshakeStallServer(t, 150*time.Millisecond, &connCount)
	defer server.Close()

	provider := &mutableProvider{url: wsURL(server.URL), token: "token-1", ok: true}
	realtime := NewRealtime(provider, events.NewNoopBus())
	defer realtime.Close()

	var start sync.WaitGroup
	start.Add(1)
	var calls sync.WaitGroup
	errs := make(chan error, 5)
	for i := 0; i < 5; i++ {
		calls.Add(1)
		go func() {
			defer calls.Done()
			ctx, cancel := context.WithTimeout(context.Background(), time.Second)
			defer cancel()
			start.Wait()
			_, err := realtime.Request(ctx, "health", map[string]any{})
			errs <- err
		}()
	}
	start.Done()
	calls.Wait()
	close(errs)
	for err := range errs {
		if err == nil {
			t.Fatal("expected dial/handshake error")
		}
	}
	if got := connCount.Load(); got != 1 {
		t.Fatalf("expected one stalled handshake attempt, got %d", got)
	}
}

func TestCompleteConnect_CtxCancelDuringRead(t *testing.T) {
	var connCount atomic.Int32
	server := newHandshakeStallServer(t, 5*time.Second, &connCount)
	defer server.Close()

	provider := &mutableProvider{url: wsURL(server.URL), token: "token-1", ok: true}
	realtime := NewRealtime(provider, events.NewNoopBus())
	defer realtime.Close()

	ctx, cancel := context.WithCancel(context.Background())
	errCh := make(chan error, 1)
	started := time.Now()
	go func() {
		_, err := realtime.Request(ctx, "health", map[string]any{})
		errCh <- err
	}()
	time.Sleep(20 * time.Millisecond)
	cancel()

	select {
	case err := <-errCh:
		if !errors.Is(err, context.Canceled) {
			t.Fatalf("expected context.Canceled, got %v", err)
		}
		if elapsed := time.Since(started); elapsed > 100*time.Millisecond {
			t.Fatalf("expected handshake cancellation within 100ms, took %s", elapsed)
		}
	case <-time.After(time.Second):
		t.Fatal("request did not return after context cancellation")
	}
}

func TestRealtime_RequestContextCancelClearsPending(t *testing.T) {
	release := make(chan struct{})
	server := newRPCGatewayServer(t, rpcGatewayOptions{
		blockMethods: map[string]chan struct{}{"health": release},
	})
	defer server.Close()
	defer close(release)

	provider := &mutableProvider{url: wsURL(server.URL), token: "token-1", ok: true}
	realtime := NewRealtime(provider, events.NewNoopBus())
	defer realtime.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Millisecond)
	defer cancel()
	_, err := realtime.Request(ctx, "health", map[string]any{})
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("expected deadline exceeded, got %v", err)
	}
	realtime.mu.Lock()
	pendingLen := len(realtime.pending)
	realtime.mu.Unlock()
	if pendingLen != 0 {
		t.Fatalf("expected pending map to be empty after ctx cancel, got %d", pendingLen)
	}
}

func TestRealtime_PendingReceivesErrConnectionLost(t *testing.T) {
	release := make(chan struct{})
	server := newRPCGatewayServer(t, rpcGatewayOptions{
		closeOnMethod: map[string]chan struct{}{"health": release},
	})
	defer server.Close()
	close(release)

	provider := &mutableProvider{url: wsURL(server.URL), token: "token-1", ok: true}
	realtime := NewRealtime(provider, events.NewNoopBus())
	defer realtime.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := realtime.Request(ctx, "health", map[string]any{})
	if !errors.Is(err, ErrConnectionLost) {
		t.Fatalf("expected ErrConnectionLost, got %v", err)
	}
}

func TestRealtime_ProviderTokenRotation(t *testing.T) {
	tokens := make(chan string, 2)
	first := newRPCGatewayServer(t, rpcGatewayOptions{
		onToken: func(token string) {
			tokens <- token
		},
		closeAfterResponses: 1,
	})
	defer first.Close()
	second := newRPCGatewayServer(t, rpcGatewayOptions{
		onToken: func(token string) {
			tokens <- token
		},
	})
	defer second.Close()

	provider := &mutableProvider{url: wsURL(first.URL), token: "token-1", ok: true}
	realtime := NewRealtime(provider, events.NewNoopBus())
	defer realtime.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if _, err := realtime.Request(ctx, "health", map[string]any{}); err != nil {
		t.Fatal(err)
	}
	expectToken(t, tokens, "token-1")
	waitForDisconnected(t, realtime)

	provider.set(wsURL(second.URL), "token-2")
	if _, err := realtime.Request(ctx, "health", map[string]any{}); err != nil {
		t.Fatal(err)
	}
	expectToken(t, tokens, "token-2")
}

func TestRealtime_ProviderURLChange(t *testing.T) {
	var firstConnections atomic.Int32
	first := newRPCGatewayServer(t, rpcGatewayOptions{
		onConnect: func(_ map[string]any) {
			firstConnections.Add(1)
		},
		closeAfterResponses: 1,
	})
	defer first.Close()
	var secondConnections atomic.Int32
	second := newRPCGatewayServer(t, rpcGatewayOptions{
		onConnect: func(_ map[string]any) {
			secondConnections.Add(1)
		},
	})
	defer second.Close()

	provider := &mutableProvider{url: wsURL(first.URL), token: "token-1", ok: true}
	realtime := NewRealtime(provider, events.NewNoopBus())
	defer realtime.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if _, err := realtime.Request(ctx, "health", map[string]any{}); err != nil {
		t.Fatal(err)
	}
	waitForDisconnected(t, realtime)

	provider.set(wsURL(second.URL), "token-1")
	if _, err := realtime.Request(ctx, "health", map[string]any{}); err != nil {
		t.Fatal(err)
	}
	if firstConnections.Load() != 1 || secondConnections.Load() != 1 {
		t.Fatalf("expected reconnect to move from first to second URL, got first=%d second=%d", firstConnections.Load(), secondConnections.Load())
	}
}

func TestRealtime_RetriesReconnectWhenSubscriptionRestoreFails(t *testing.T) {
	bus := events.NewBus(16)
	sub := bus.Subscribe()
	defer bus.Unsubscribe(sub)

	first := newRPCGatewayServer(t, rpcGatewayOptions{closeAfterResponses: 2})
	defer first.Close()

	second := newRPCGatewayServer(t, rpcGatewayOptions{
		errorMethods: map[string]string{
			"sessions.messages.subscribe": "restore failed",
		},
	})
	defer second.Close()

	third := newRPCGatewayServer(t, rpcGatewayOptions{
		eventsAfterMethod: map[string][]map[string]any{
			"sessions.messages.subscribe": {{
				"type":  "event",
				"event": "session.message",
				"payload": map[string]any{
					"sessionKey": "session-1",
				},
			}},
		},
	})
	defer third.Close()

	provider := &mutableProvider{url: wsURL(first.URL), token: "token-1", ok: true}
	realtime := NewRealtime(provider, bus)
	defer realtime.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := realtime.SubscribeSession(ctx, "session-1"); err != nil {
		t.Fatal(err)
	}
	waitForDisconnected(t, realtime)

	provider.set(wsURL(second.URL), "token-1")
	if _, err := realtime.Request(ctx, "health", map[string]any{}); err == nil {
		t.Fatal("expected restore failure on second connection")
	}
	waitForDisconnected(t, realtime)

	provider.set(wsURL(third.URL), "token-1")
	if _, err := realtime.Request(ctx, "health", map[string]any{}); err != nil {
		t.Fatal(err)
	}
	expectBusEvent(t, sub, "session.message")
}

func TestRealtime_BlocksConcurrentRequestsUntilSubscriptionRestoreCompletes(t *testing.T) {
	bus := events.NewBus(16)
	sub := bus.Subscribe()
	defer bus.Unsubscribe(sub)

	first := newRPCGatewayServer(t, rpcGatewayOptions{closeAfterResponses: 2})
	defer first.Close()

	restoreRelease := make(chan struct{})
	secondRequests := make(chan string, 16)
	second := newRPCGatewayServer(t, rpcGatewayOptions{
		blockMethods: map[string]chan struct{}{
			"sessions.messages.subscribe": restoreRelease,
		},
		errorMethods: map[string]string{
			"sessions.messages.subscribe": "restore failed",
		},
		onRequest: func(method string) {
			secondRequests <- method
		},
	})
	defer second.Close()

	third := newRPCGatewayServer(t, rpcGatewayOptions{
		eventsAfterMethod: map[string][]map[string]any{
			"sessions.messages.subscribe": {{
				"type":  "event",
				"event": "session.message",
				"payload": map[string]any{
					"sessionKey": "session-1",
				},
			}},
		},
	})
	defer third.Close()

	provider := &mutableProvider{url: wsURL(first.URL), token: "token-1", ok: true}
	realtime := NewRealtime(provider, bus)
	defer realtime.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := realtime.SubscribeSession(ctx, "session-1"); err != nil {
		t.Fatal(err)
	}
	waitForDisconnected(t, realtime)

	provider.set(wsURL(second.URL), "token-1")
	restoreErrCh := make(chan error, 1)
	go func() {
		_, err := realtime.Request(ctx, "health", map[string]any{})
		restoreErrCh <- err
	}()
	expectRequestMethod(t, secondRequests, "sessions.messages.subscribe")

	concurrentErrCh := make(chan error, 1)
	go func() {
		_, err := realtime.Request(ctx, "health", map[string]any{})
		concurrentErrCh <- err
	}()
	assertNoRequestMethod(t, secondRequests, "health", 100*time.Millisecond)

	close(restoreRelease)
	if err := <-restoreErrCh; err == nil {
		t.Fatal("expected restore-driving request to fail")
	}
	if err := <-concurrentErrCh; err == nil {
		t.Fatal("expected concurrent request to wait for and receive restore failure")
	}
	assertNoRequestMethod(t, secondRequests, "health", 100*time.Millisecond)

	waitForDisconnected(t, realtime)
	provider.set(wsURL(third.URL), "token-1")
	if _, err := realtime.Request(ctx, "health", map[string]any{}); err != nil {
		t.Fatal(err)
	}
	expectBusEvent(t, sub, "session.message")
}

func TestRealtimeReconnectDelayBackoff(t *testing.T) {
	expected := []time.Duration{
		time.Second,
		2 * time.Second,
		4 * time.Second,
		8 * time.Second,
		16 * time.Second,
		30 * time.Second,
		30 * time.Second,
	}
	for attempt, want := range expected {
		if got := reconnectDelay(attempt); got != want {
			t.Fatalf("attempt %d: expected %s, got %s", attempt, want, got)
		}
	}
	if got := reconnectDelay(-1); got != time.Second {
		t.Fatalf("expected negative attempt to clamp to 1s, got %s", got)
	}
}

func TestEnsureConnected_NoDoubleClose(t *testing.T) {
	server := newRPCGatewayServer(t, rpcGatewayOptions{})
	defer server.Close()

	provider := &mutableProvider{url: wsURL(server.URL), token: "token-1", ok: true}
	realtime := NewRealtime(provider, events.NewNoopBus())
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if _, err := realtime.Request(ctx, "health", map[string]any{}); err != nil {
		t.Fatal(err)
	}
	if err := realtime.Close(); err != nil {
		t.Fatal(err)
	}
	if err := realtime.Close(); err != nil {
		t.Fatal(err)
	}
}

func TestRealtimeRequest_P50Below10ms(t *testing.T) {
	server := newRPCGatewayServer(t, rpcGatewayOptions{})
	defer server.Close()

	provider := &mutableProvider{url: wsURL(server.URL), token: "token-1", ok: true}
	realtime := NewRealtime(provider, events.NewNoopBus())
	defer realtime.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if _, err := realtime.Request(ctx, "health", map[string]any{}); err != nil {
		t.Fatal(err)
	}

	durations := make([]time.Duration, 0, 100)
	for i := 0; i < 100; i++ {
		started := time.Now()
		if _, err := realtime.Request(ctx, "health", map[string]any{}); err != nil {
			t.Fatal(err)
		}
		durations = append(durations, time.Since(started))
	}
	sort.Slice(durations, func(i int, j int) bool { return durations[i] < durations[j] })
	p50 := durations[len(durations)/2]
	t.Logf("p50_ms=%.3f", float64(p50.Microseconds())/1000)
	if p50 >= 10*time.Millisecond {
		t.Fatalf("expected p50 below 10ms, got %s", p50)
	}
}

func TestRequestDirectBaseline_P50Recorded(t *testing.T) {
	server := newRPCGatewayServer(t, rpcGatewayOptions{})
	defer server.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	durations := make([]time.Duration, 0, 100)
	for i := 0; i < 100; i++ {
		started := time.Now()
		payload, err := RequestDirect(ctx, wsURL(server.URL), "token-1", "health", map[string]any{})
		if err != nil {
			t.Fatal(err)
		}
		result, _ := payload.(map[string]any)
		if result["method"] != "health" {
			t.Fatalf("unexpected payload: %#v", payload)
		}
		durations = append(durations, time.Since(started))
	}
	sort.Slice(durations, func(i int, j int) bool { return durations[i] < durations[j] })
	p50 := durations[len(durations)/2]
	t.Logf("request_direct_p50_ms=%.3f", float64(p50.Microseconds())/1000)
	if p50 <= 0 {
		t.Fatalf("expected positive p50, got %s", p50)
	}
}

func TestRealtimeClose_NoGoroutineLeak(t *testing.T) {
	release := make(chan struct{})
	server := newRPCGatewayServer(t, rpcGatewayOptions{
		blockMethods: map[string]chan struct{}{"health": release},
	})
	defer server.Close()
	defer close(release)

	provider := &mutableProvider{url: wsURL(server.URL), token: "token-1", ok: true}
	realtime := NewRealtime(provider, events.NewNoopBus())
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	errCh := make(chan error, 1)
	go func() {
		_, err := realtime.Request(ctx, "health", map[string]any{})
		errCh <- err
	}()
	time.Sleep(30 * time.Millisecond)
	if err := realtime.Close(); err != nil {
		t.Fatal(err)
	}
	select {
	case err := <-errCh:
		if !errors.Is(err, ErrConnectionLost) {
			t.Fatalf("expected ErrConnectionLost after Close, got %v", err)
		}
	case <-time.After(time.Second):
		t.Fatal("pending request did not unblock after Realtime.Close")
	}
	realtime.mu.Lock()
	pendingLen := len(realtime.pending)
	realtime.mu.Unlock()
	if pendingLen != 0 {
		t.Fatalf("expected pending map to be empty after Close, got %d", pendingLen)
	}
}

func TestRealtime_SubscribeSessionPublishesSessionEventsToBus(t *testing.T) {
	upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("upgrade failed: %v", err)
			return
		}
		defer conn.Close()

		_ = conn.WriteJSON(map[string]any{
			"type":  "event",
			"event": "connect.challenge",
			"payload": map[string]any{
				"nonce": "nonce-1",
			},
		})

		_, raw, _ := conn.ReadMessage()
		var connectFrame map[string]any
		_ = json.Unmarshal(raw, &connectFrame)
		_ = conn.WriteJSON(map[string]any{
			"type":    "res",
			"id":      connectFrame["id"],
			"payload": map[string]any{"ready": true},
		})

		for i := 0; i < 2; i++ {
			_, raw, _ = conn.ReadMessage()
			var reqFrame map[string]any
			_ = json.Unmarshal(raw, &reqFrame)
			method, _ := reqFrame["method"].(string)
			_ = conn.WriteJSON(map[string]any{
				"type":    "res",
				"id":      reqFrame["id"],
				"payload": map[string]any{"ok": true, "method": method},
			})
		}

		_ = conn.WriteJSON(map[string]any{
			"type":  "event",
			"event": "session.message",
			"payload": map[string]any{
				"sessionKey": "session-1",
				"message": map[string]any{
					"id":   "msg-1",
					"role": "assistant",
					"content": []map[string]any{{
						"type": "text",
						"text": "hello",
					}},
					"timestamp": 1,
				},
			},
		})
		_ = conn.WriteJSON(map[string]any{
			"type":  "event",
			"event": "session.tool",
			"payload": map[string]any{
				"runId":      "run-1",
				"seq":        1,
				"stream":     "tool",
				"ts":         1,
				"sessionKey": "session-1",
				"data": map[string]any{
					"phase": "completed",
				},
			},
		})
		_ = conn.WriteJSON(map[string]any{
			"type":  "event",
			"event": "sessions.changed",
			"payload": map[string]any{
				"sessionKey": "session-1",
				"ts":         1,
				"reason":     "send",
			},
		})
		time.Sleep(100 * time.Millisecond)
	}))
	defer server.Close()

	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(config.Settings{
		ManagedGateway: config.ManagedGatewaySettings{
			BindHost:     "127.0.0.1",
			BindPort:     mustPort(t, server.URL),
			GatewayToken: "test-token",
		},
	}); err != nil {
		t.Fatal(err)
	}

	bus := events.NewBus(16)
	sub := bus.Subscribe()
	defer bus.Unsubscribe(sub)

	realtime := NewRealtime(store, bus)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := realtime.SubscribeSession(ctx, "session-1"); err != nil {
		t.Fatal(err)
	}

	expectBusEvent(t, sub, "session.message")
	expectBusEvent(t, sub, "session.tool")
	expectBusEvent(t, sub, "sessions.changed")
}
