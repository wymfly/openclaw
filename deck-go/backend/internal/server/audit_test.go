package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
)

func TestControlAuditRecordsAuthenticatedMutations(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")

	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(newTestRouter(store, &testSupervisor{}, events.NewBus(8)))
	defer srv.Close()

	putReq, err := http.NewRequest(http.MethodPut, srv.URL+"/api/settings", strings.NewReader(`{
	  "appearance":{"theme":"dark"}
	}`))
	if err != nil {
		t.Fatal(err)
	}
	putReq.Header.Set("Authorization", "Bearer admin-token")
	putReq.Header.Set("Content-Type", "application/json")
	putReq.Header.Set("X-Request-Id", "req-audit-1")
	putReq.Header.Set("X-Deck-Actor", "operator-test")
	putRes, err := http.DefaultClient.Do(putReq)
	if err != nil {
		t.Fatal(err)
	}
	defer putRes.Body.Close()
	if putRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected settings status: %d", putRes.StatusCode)
	}

	getReq, err := http.NewRequest(http.MethodGet, srv.URL+"/api/settings", nil)
	if err != nil {
		t.Fatal(err)
	}
	getReq.Header.Set("Authorization", "Bearer admin-token")
	getRes, err := http.DefaultClient.Do(getReq)
	if err != nil {
		t.Fatal(err)
	}
	defer getRes.Body.Close()
	if getRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected settings get status: %d", getRes.StatusCode)
	}

	auditReq, err := http.NewRequest(http.MethodGet, srv.URL+"/api/audit/events?limit=10", nil)
	if err != nil {
		t.Fatal(err)
	}
	auditReq.Header.Set("Authorization", "Bearer admin-token")
	auditRes, err := http.DefaultClient.Do(auditReq)
	if err != nil {
		t.Fatal(err)
	}
	defer auditRes.Body.Close()
	if auditRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected audit status: %d", auditRes.StatusCode)
	}
	var payload struct {
		Events []struct {
			Action     string `json:"action"`
			Actor      string `json:"actor"`
			Method     string `json:"method"`
			OK         bool   `json:"ok"`
			Path       string `json:"path"`
			RequestID  string `json:"requestId"`
			StatusCode int    `json:"statusCode"`
		} `json:"events"`
		Retention struct {
			MaxEntries int    `json:"maxEntries"`
			Mode       string `json:"mode"`
		} `json:"retention"`
	}
	if err := json.NewDecoder(auditRes.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if payload.Retention.Mode != "process-memory" || payload.Retention.MaxEntries <= 0 {
		t.Fatalf("unexpected retention: %#v", payload.Retention)
	}
	if len(payload.Events) != 1 {
		t.Fatalf("expected only PUT mutation to be audited, got %#v", payload.Events)
	}
	event := payload.Events[0]
	if event.RequestID != "req-audit-1" || event.Actor != "operator-test" {
		t.Fatalf("unexpected audit actor/request: %#v", event)
	}
	if event.Method != http.MethodPut || event.Path != "/api/settings" || event.Action != "PUT /api/settings" {
		t.Fatalf("unexpected audit target: %#v", event)
	}
	if !event.OK || event.StatusCode != http.StatusOK {
		t.Fatalf("unexpected audit result: %#v", event)
	}
}
