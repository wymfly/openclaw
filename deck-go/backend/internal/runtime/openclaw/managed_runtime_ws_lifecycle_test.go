package openclaw

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func newTestWSUpgradeHandler(t *testing.T) http.HandlerFunc {
	t.Helper()
	upgrader := websocket.Upgrader{
		CheckOrigin: func(*http.Request) bool { return true },
	}
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		session := &deckGatewayWSSession{
			managed:       nil,
			conn:          conn,
			request:       r.Clone(r.Context()),
			runtimeID:     "rt_test",
			clientID:      "deck-go-bff-ws-test",
			subscriptions: map[string]func(){},
		}
		session.run()
	}
}

func dialTestWS(t *testing.T, server *httptest.Server) *websocket.Conn {
	t.Helper()
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws"
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatal(err)
	}
	return conn
}

// TestWSLifecycleIdleKeepsConnectionAlive (spec WS-013): an idle client that
// honors ping frames stays connected across multiple heartbeat cycles.
func TestWSLifecycleIdleKeepsConnectionAlive(t *testing.T) {
	t.Setenv("DECK_GO_WS_PING_INTERVAL_MS", "20")
	t.Setenv("DECK_GO_WS_PONG_TIMEOUT_MS", "120")

	server := httptest.NewServer(newTestWSUpgradeHandler(t))
	defer server.Close()

	conn := dialTestWS(t, server)
	defer conn.Close()

	// Default gorilla client auto-pongs to server pings, so the connection
	// should survive multiple ping cycles without a deadline trip.
	deadline := time.Now().Add(150 * time.Millisecond)
	_ = conn.SetReadDeadline(deadline)
	_, _, err := conn.ReadMessage()
	if err == nil {
		t.Fatalf("did not expect a server frame on idle connection")
	}
	netErr, ok := err.(interface{ Timeout() bool })
	if !ok || !netErr.Timeout() {
		t.Fatalf("expected client read deadline timeout, got %v", err)
	}
	// If the server had closed the connection during the wait window, gorilla
	// would surface a CloseError instead of a Timeout. Reaching this point
	// proves the server kept the session alive across at least 5 ping cycles.
}

// TestWSLifecycleNoPongClosesWithLegalCode (spec WS-014): when the client fails
// to respond to pings within the pong timeout, the BFF closes with the
// app-defined timeout close code 4000, never the reserved 1006.
func TestWSLifecycleNoPongClosesWithLegalCode(t *testing.T) {
	t.Setenv("DECK_GO_WS_PING_INTERVAL_MS", "20")
	t.Setenv("DECK_GO_WS_PONG_TIMEOUT_MS", "80")

	server := httptest.NewServer(newTestWSUpgradeHandler(t))
	defer server.Close()

	conn := dialTestWS(t, server)
	defer conn.Close()

	// Suppress the gorilla default auto-pong handler so the server's pong
	// timeout fires deterministically.
	conn.SetPingHandler(func(string) error { return nil })

	_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, _, err := conn.ReadMessage()
	if err == nil {
		t.Fatalf("expected close error after pong timeout")
	}
	closeErr, ok := err.(*websocket.CloseError)
	if !ok {
		t.Fatalf("expected *websocket.CloseError, got %T: %v", err, err)
	}
	if closeErr.Code == websocket.CloseAbnormalClosure {
		t.Fatalf("server closed with reserved code 1006 (abnormal closure); spec WS-014 forbids this")
	}
	if closeErr.Code != deckGatewayWSTimeoutCloseCode {
		t.Fatalf("expected close code %d, got %d (text=%q)", deckGatewayWSTimeoutCloseCode, closeErr.Code, closeErr.Text)
	}
}
