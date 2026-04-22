package wsapi

import (
	"encoding/json"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/gorilla/websocket"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
	registry "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/registry"
)

func TestMountRoutes_EmitsConnectionAndRuntimeEvents(t *testing.T) {
	bus := events.NewBus(16)
	router := chi.NewRouter()
	MountRoutes(router, registry.NewEventFeed(bus))

	server := httptest.NewServer(router)
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws"
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	_ = conn.SetReadDeadline(time.Now().Add(5 * time.Second))

	_, raw, err := conn.ReadMessage()
	if err != nil {
		t.Fatal(err)
	}
	var connected map[string]any
	if err := json.Unmarshal(raw, &connected); err != nil {
		t.Fatal(err)
	}
	if connected["type"] != "connection.established" {
		t.Fatalf("unexpected connection event: %#v", connected)
	}
	if connected["runtimeId"] != registry.DefaultRuntimeID {
		t.Fatalf("unexpected runtime id: %#v", connected)
	}

	bus.Publish("runtime.status", []byte(`{"status":"running"}`))

	_, raw, err = conn.ReadMessage()
	if err != nil {
		t.Fatal(err)
	}
	var runtimeEvent map[string]any
	if err := json.Unmarshal(raw, &runtimeEvent); err != nil {
		t.Fatal(err)
	}
	if runtimeEvent["type"] != "runtime.status" {
		t.Fatalf("unexpected runtime event: %#v", runtimeEvent)
	}
	payload, ok := runtimeEvent["payload"].(map[string]any)
	if !ok || payload["status"] != "running" {
		t.Fatalf("unexpected runtime payload: %#v", runtimeEvent)
	}
}

func TestMountRoutes_ReplaysFromLastEventIDAndSignalsGap(t *testing.T) {
	bus := events.NewBus(2)
	bus.Publish("runtime.status", []byte(`{"status":"booting"}`))
	second := bus.Publish("runtime.status", []byte(`{"status":"running"}`))
	third := bus.Publish("runtime.status", []byte(`{"status":"degraded"}`))

	router := chi.NewRouter()
	MountRoutes(router, registry.NewEventFeed(bus))

	server := httptest.NewServer(router)
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws?lastEventId=" + "1"
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	_ = conn.SetReadDeadline(time.Now().Add(5 * time.Second))

	// bootstrap
	if _, _, err := conn.ReadMessage(); err != nil {
		t.Fatal(err)
	}

	// gap
	_, raw, err := conn.ReadMessage()
	if err != nil {
		t.Fatal(err)
	}
	var gap map[string]any
	if err := json.Unmarshal(raw, &gap); err != nil {
		t.Fatal(err)
	}
	if gap["type"] != "projection.gap" {
		t.Fatalf("unexpected gap event: %#v", gap)
	}

	// replay second
	_, raw, err = conn.ReadMessage()
	if err != nil {
		t.Fatal(err)
	}
	var replay1 map[string]any
	if err := json.Unmarshal(raw, &replay1); err != nil {
		t.Fatal(err)
	}
	if replay1["eventId"] != "evt_"+jsonNumber(second.ID) {
		t.Fatalf("unexpected replay event 1: %#v", replay1)
	}

	// replay third
	_, raw, err = conn.ReadMessage()
	if err != nil {
		t.Fatal(err)
	}
	var replay2 map[string]any
	if err := json.Unmarshal(raw, &replay2); err != nil {
		t.Fatal(err)
	}
	if replay2["eventId"] != "evt_"+jsonNumber(third.ID) {
		t.Fatalf("unexpected replay event 2: %#v", replay2)
	}
}

func jsonNumber(id int64) string {
	return strconv.FormatInt(id, 10)
}

func TestMountRoutes_RuntimeScopedPath(t *testing.T) {
	bus := events.NewBus(16)
	router := chi.NewRouter()
	MountRoutes(router, registry.NewEventFeed(bus))

	server := httptest.NewServer(router)
	defer server.Close()

	t.Run("accepts the spec path for the default runtime", func(t *testing.T) {
		wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws/runtimes/" + registry.DefaultRuntimeID + "/events"
		conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
		if err != nil {
			t.Fatal(err)
		}
		defer conn.Close()
		_ = conn.SetReadDeadline(time.Now().Add(5 * time.Second))

		_, raw, err := conn.ReadMessage()
		if err != nil {
			t.Fatal(err)
		}
		var connected map[string]any
		if err := json.Unmarshal(raw, &connected); err != nil {
			t.Fatal(err)
		}
		if connected["type"] != "connection.established" {
			t.Fatalf("unexpected connection event: %#v", connected)
		}
	})

	t.Run("rejects unknown runtime path", func(t *testing.T) {
		wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws/runtimes/rt_other/events"
		_, res, err := websocket.DefaultDialer.Dial(wsURL, nil)
		if err == nil {
			t.Fatal("expected websocket handshake failure")
		}
		if res == nil || res.StatusCode != 404 {
			t.Fatalf("expected 404 for unknown runtime path, got err=%v status=%v", err, res)
		}
	})
}
