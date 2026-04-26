package controld

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gorilla/websocket"
	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
	openclawrt "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/openclaw"
)

func TestResolveListenAddr(t *testing.T) {
	t.Run("prefers controld-specific env", func(t *testing.T) {
		addr := ResolveListenAddr(func(key string) string {
			switch key {
			case "CONTROLD_ADDR":
				return "127.0.0.1:29666"
			case "DECK_GO_ADDR":
				return "127.0.0.1:19528"
			default:
				return ""
			}
		})
		if addr != "127.0.0.1:29666" {
			t.Fatalf("expected controld addr, got %q", addr)
		}
	})

	t.Run("falls back to deck-go env", func(t *testing.T) {
		addr := ResolveListenAddr(func(key string) string {
			if key == "DECK_GO_ADDR" {
				return "127.0.0.1:19528"
			}
			return ""
		})
		if addr != "127.0.0.1:19528" {
			t.Fatalf("expected deck-go fallback addr, got %q", addr)
		}
	})

	t.Run("uses default when unset", func(t *testing.T) {
		addr := ResolveListenAddr(func(string) string { return "" })
		if addr != defaultListenAddr {
			t.Fatalf("expected default addr %q, got %q", defaultListenAddr, addr)
		}
	})
}

func TestNewHandlerWithDependencies_ExposesStage2RuntimeRoutes(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	bus := events.NewBus(8)
	managed := openclawrt.NewManagedRuntime(store, bus)

	handler := NewHandlerWithDependencies(&Dependencies{
		Store:   store,
		Runtime: managed,
	})

	server := httptest.NewServer(handler)
	defer server.Close()

	stage2Res, err := http.Get(server.URL + "/api/v1/runtimes")
	if err != nil {
		t.Fatal(err)
	}
	defer stage2Res.Body.Close()
	if stage2Res.StatusCode != http.StatusOK {
		t.Fatalf("unexpected stage2 status: %d", stage2Res.StatusCode)
	}

	var stage2Payload struct {
		Runtimes []map[string]any `json:"runtimes"`
	}
	if err := json.NewDecoder(stage2Res.Body).Decode(&stage2Payload); err != nil {
		t.Fatal(err)
	}
	if len(stage2Payload.Runtimes) != 1 {
		t.Fatalf("unexpected stage2 payload: %#v", stage2Payload)
	}

	settingsRes, err := http.Get(server.URL + "/api/v1/settings")
	if err != nil {
		t.Fatal(err)
	}
	defer settingsRes.Body.Close()
	if settingsRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected settings status: %d", settingsRes.StatusCode)
	}

	alertsRes, err := http.Get(server.URL + "/api/v1/alerts")
	if err != nil {
		t.Fatal(err)
	}
	defer alertsRes.Body.Close()
	if alertsRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected alerts status: %d", alertsRes.StatusCode)
	}

	stage2WS := "ws" + strings.TrimPrefix(server.URL, "http") + "/api/v1/ws"
	conn, _, err := websocket.DefaultDialer.Dial(stage2WS, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()

	healthRes, err := http.Get(server.URL + "/healthz")
	if err != nil {
		t.Fatal(err)
	}
	defer healthRes.Body.Close()
	if healthRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected healthz status: %d", healthRes.StatusCode)
	}
}

func TestNewHandlerWithDependencies_CorsAllowsStreamResumeHeader(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	handler := NewHandlerWithDependencies(&Dependencies{
		Store:   store,
		Runtime: openclawrt.NewManagedRuntime(store, events.NewBus(4)),
	})

	req := httptest.NewRequest(http.MethodOptions, "/api/v1/logs/stream", nil)
	req.Header.Set("Origin", "http://127.0.0.1:4176")
	req.Header.Set("Access-Control-Request-Method", http.MethodGet)
	req.Header.Set("Access-Control-Request-Headers", "Last-Event-ID, x-deck-token")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("unexpected preflight status: %d", rec.Code)
	}
	allowHeaders := rec.Header().Get("Access-Control-Allow-Headers")
	if !strings.Contains(strings.ToLower(allowHeaders), "last-event-id") {
		t.Fatalf("Last-Event-ID not allowed in CORS headers: %q", allowHeaders)
	}
}
