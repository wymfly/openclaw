package gateway

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
)

type rpcGatewayOptions struct {
	onConnect           func(map[string]any)
	onToken             func(string)
	onRequest           func(string)
	onFrame             func(frame)
	blockMethods        map[string]chan struct{}
	closeOnMethod       map[string]chan struct{}
	errorMethods        map[string]string
	errorFrames         map[string]responseError
	eventsAfterMethod   map[string][]map[string]any
	closeAfterResponses int
}

func newRPCGatewayServer(t *testing.T, opts rpcGatewayOptions) *httptest.Server {
	t.Helper()
	upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("upgrade failed: %v", err)
			return
		}
		defer conn.Close()

		connectParams, ok := completeTestGatewayHandshake(t, conn)
		if !ok {
			return
		}
		if opts.onConnect != nil {
			opts.onConnect(connectParams)
		}
		if opts.onToken != nil {
			auth, _ := connectParams["auth"].(map[string]any)
			token, _ := auth["token"].(string)
			opts.onToken(token)
		}

		responses := 0
		for {
			_, raw, err := conn.ReadMessage()
			if err != nil {
				return
			}
			var req frame
			if err := json.Unmarshal(raw, &req); err != nil {
				continue
			}
			if opts.onRequest != nil {
				opts.onRequest(req.Method)
			}
			if opts.onFrame != nil {
				opts.onFrame(req)
			}
			if release := opts.closeOnMethod[req.Method]; release != nil {
				<-release
				return
			}
			if release := opts.blockMethods[req.Method]; release != nil {
				<-release
			}
			if message := opts.errorMethods[req.Method]; message != "" {
				_ = conn.WriteJSON(map[string]any{
					"type": "res",
					"id":   req.ID,
					"error": map[string]any{
						"code":    "TEST_ERROR",
						"message": message,
					},
				})
				continue
			}
			if envelope, ok := opts.errorFrames[req.Method]; ok {
				_ = conn.WriteJSON(map[string]any{
					"type":  "res",
					"id":    req.ID,
					"error": envelope,
				})
				continue
			}
			if err := conn.WriteJSON(map[string]any{
				"type": "res",
				"id":   req.ID,
				"payload": map[string]any{
					"method": req.Method,
					"ok":     true,
				},
			}); err != nil {
				return
			}
			for _, event := range opts.eventsAfterMethod[req.Method] {
				if err := conn.WriteJSON(event); err != nil {
					return
				}
			}
			responses++
			if opts.closeAfterResponses > 0 && responses >= opts.closeAfterResponses {
				return
			}
		}
	}))
}

func newHandshakeStallServer(t *testing.T, delay time.Duration, connCount *atomic.Int32) *httptest.Server {
	t.Helper()
	stop := make(chan struct{})
	t.Cleanup(func() {
		select {
		case <-stop:
		default:
			close(stop)
		}
	})
	upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("upgrade failed: %v", err)
			return
		}
		connCount.Add(1)
		// Stall for the configured delay, but exit early when the test ends so
		// goroutines do not outlive the test (otherwise goleak.VerifyTestMain
		// catches them and we have to ignore the helper).
		select {
		case <-time.After(delay):
		case <-stop:
		}
		_ = conn.Close()
	}))
}

func completeTestGatewayHandshake(t *testing.T, conn *websocket.Conn) (map[string]any, bool) {
	t.Helper()
	if err := conn.WriteJSON(map[string]any{
		"type":    "event",
		"event":   "connect.challenge",
		"payload": map[string]any{"nonce": "nonce-1"},
	}); err != nil {
		t.Errorf("challenge write failed: %v", err)
		return nil, false
	}

	_, raw, err := conn.ReadMessage()
	if err != nil {
		t.Errorf("connect read failed: %v", err)
		return nil, false
	}
	var connectFrame frame
	if err := json.Unmarshal(raw, &connectFrame); err != nil {
		t.Errorf("connect frame parse failed: %v", err)
		return nil, false
	}
	if connectFrame.Method != "connect" {
		t.Errorf("expected connect method, got %q", connectFrame.Method)
		return nil, false
	}
	if err := conn.WriteJSON(map[string]any{
		"type":    "res",
		"id":      connectFrame.ID,
		"payload": map[string]any{"ready": true},
	}); err != nil {
		t.Errorf("connect response write failed: %v", err)
		return nil, false
	}
	return frameParamsMap(t, connectFrame.Params), true
}

func frameParamsMap(t *testing.T, params any) map[string]any {
	t.Helper()
	if params == nil {
		return map[string]any{}
	}
	result, ok := params.(map[string]any)
	if !ok {
		t.Fatalf("expected frame params map, got %T", params)
	}
	return result
}

func wsURL(serverURL string) string {
	return strings.Replace(serverURL, "http://", "ws://", 1)
}

func expectToken(t *testing.T, tokens <-chan string, expected string) {
	t.Helper()
	select {
	case token := <-tokens:
		if token != expected {
			t.Fatalf("expected token %q, got %q", expected, token)
		}
	case <-time.After(time.Second):
		t.Fatalf("timed out waiting for token %q", expected)
	}
}

func expectBusEvent(t *testing.T, sub chan events.Event, expected string) {
	t.Helper()
	deadline := time.After(5 * time.Second)
	for {
		select {
		case <-deadline:
			t.Fatalf("timed out waiting for bus event %s", expected)
		case event := <-sub:
			if event.Type == expected {
				return
			}
		}
	}
}

func expectRequestMethod(t *testing.T, requests <-chan string, expected string) {
	t.Helper()
	deadline := time.After(5 * time.Second)
	for {
		select {
		case <-deadline:
			t.Fatalf("timed out waiting for request method %s", expected)
		case method := <-requests:
			if method == expected {
				return
			}
		}
	}
}

func assertNoRequestMethod(
	t *testing.T,
	requests <-chan string,
	unexpected string,
	duration time.Duration,
) {
	t.Helper()
	timer := time.NewTimer(duration)
	defer timer.Stop()
	for {
		select {
		case <-timer.C:
			return
		case method := <-requests:
			if method == unexpected {
				t.Fatalf("unexpected request method %s before restore completed", unexpected)
			}
		}
	}
}

func waitForDisconnected(t *testing.T, realtime *Realtime) {
	t.Helper()
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		realtime.mu.Lock()
		disconnected := realtime.conn == nil
		realtime.mu.Unlock()
		if disconnected {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatal("timed out waiting for realtime disconnect")
}
