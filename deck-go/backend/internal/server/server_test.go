package server

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
	openclawrt "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/openclaw"
)

type testSupervisor struct {
	snapshot     openclawrt.ManagedSnapshot
	startCalls   int
	stopCalls    int
	restartCalls int
}

func (s *testSupervisor) Snapshot() openclawrt.ManagedSnapshot {
	return s.snapshot
}

func (s *testSupervisor) Start(context.Context) (openclawrt.ManagedSnapshot, error) {
	s.startCalls++
	s.snapshot.Status = openclawrt.ManagedStatusRunning
	s.snapshot.Health = openclawrt.ManagedHealthHealthy
	return s.snapshot, nil
}

func (s *testSupervisor) Stop(context.Context) (openclawrt.ManagedSnapshot, error) {
	s.stopCalls++
	s.snapshot.Status = openclawrt.ManagedStatusStopped
	s.snapshot.Health = openclawrt.ManagedHealthUnknown
	return s.snapshot, nil
}

func (s *testSupervisor) Restart(context.Context) (openclawrt.ManagedSnapshot, error) {
	s.restartCalls++
	s.snapshot.Status = openclawrt.ManagedStatusRunning
	s.snapshot.Health = openclawrt.ManagedHealthHealthy
	return s.snapshot, nil
}

func (s *testSupervisor) GatewayConnection() (string, string, bool) {
	if s.snapshot.GatewayURL == "" {
		return "", "", false
	}
	return s.snapshot.GatewayURL, "gateway-token", true
}

func TestSettingsRoute_RoundTrip(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")

	srv := httptest.NewServer(New())
	defer srv.Close()

	putReq, err := http.NewRequest(http.MethodPut, srv.URL+"/api/settings", strings.NewReader(`{
	  "managedGateway":{
	    "command":"pnpm",
	    "args":["openclaw","gateway","run"],
	    "bindHost":"127.0.0.1",
	    "bindPort":18789,
	    "gatewayToken":"gateway-token",
	    "autoStart":true
	  }
	}`))
	if err != nil {
		t.Fatal(err)
	}
	putReq.Header.Set("Authorization", "Bearer admin-token")
	putReq.Header.Set("Content-Type", "application/json")
	putRes, err := http.DefaultClient.Do(putReq)
	if err != nil {
		t.Fatal(err)
	}
	defer putRes.Body.Close()
	if putRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: %d", putRes.StatusCode)
	}

	getReq, err := http.NewRequest(http.MethodGet, srv.URL+"/api/settings", nil)
	if err != nil {
		t.Fatal(err)
	}
	getReq.Header.Set("x-deck-token", "admin-token")
	getRes, err := http.DefaultClient.Do(getReq)
	if err != nil {
		t.Fatal(err)
	}
	defer getRes.Body.Close()
	if getRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: %d", getRes.StatusCode)
	}
	var payload map[string]any
	if err := json.NewDecoder(getRes.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	settings, ok := payload["settings"].(map[string]any)
	if !ok {
		t.Fatalf("unexpected payload: %#v", payload)
	}
	managed, ok := settings["managedGateway"].(map[string]any)
	if !ok {
		t.Fatalf("unexpected settings payload: %#v", settings)
	}
	if managed["gatewayToken"] != "gateway-token" {
		t.Fatalf("unexpected managed gateway payload: %#v", managed)
	}
}

func TestSettingsVersionRoute(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")

	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	bus := events.NewBus(4)
	supervisor := &testSupervisor{
		snapshot: openclawrt.ManagedSnapshot{
			Managed: true,
			Status:  openclawrt.ManagedStatusRunning,
			Health:  openclawrt.ManagedHealthHealthy,
		},
	}
	srv := httptest.NewServer(newTestRouter(store, supervisor, bus))
	defer srv.Close()

	req, err := http.NewRequest(http.MethodGet, srv.URL+"/api/settings/version", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer admin-token")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: %d", res.StatusCode)
	}
	var payload map[string]any
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if payload["deck"] == "" || payload["gateway"] != "connected" || payload["cli"] != "connected" {
		t.Fatalf("unexpected payload: %#v", payload)
	}
}

func TestSettingsTestConnectionRoute(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")

	healthServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer healthServer.Close()

	wsURL := "ws" + strings.TrimPrefix(healthServer.URL, "http")

	srv := httptest.NewServer(New())
	defer srv.Close()

	req, err := http.NewRequest(http.MethodPost, srv.URL+"/api/settings/test-connection", strings.NewReader(`{"url":"`+wsURL+`","token":"token-1"}`))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer admin-token")
	req.Header.Set("Content-Type", "application/json")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: %d", res.StatusCode)
	}
	var payload map[string]any
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if payload["ok"] != true {
		t.Fatalf("unexpected payload: %#v", payload)
	}
}

func TestOnboardingRoutes_StatusTestAndSave(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")

	upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	healthServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("upgrade failed: %v", err)
			return
		}
		defer conn.Close()

		if err := conn.WriteJSON(map[string]any{
			"type":  "event",
			"event": "connect.challenge",
			"payload": map[string]any{
				"nonce": "nonce-1",
			},
		}); err != nil {
			t.Errorf("challenge write failed: %v", err)
			return
		}

		_, raw, err := conn.ReadMessage()
		if err != nil {
			t.Errorf("connect read failed: %v", err)
			return
		}
		var connectFrame map[string]any
		if err := json.Unmarshal(raw, &connectFrame); err != nil {
			t.Errorf("connect frame parse failed: %v", err)
			return
		}
		if connectFrame["method"] != "connect" {
			t.Errorf("expected connect method, got %#v", connectFrame["method"])
			return
		}
		if err := conn.WriteJSON(map[string]any{
			"type": "res",
			"id":   connectFrame["id"],
			"ok":   true,
			"payload": map[string]any{
				"ready": true,
			},
		}); err != nil {
			t.Errorf("connect response write failed: %v", err)
			return
		}

		_, raw, err = conn.ReadMessage()
		if err != nil {
			t.Errorf("request read failed: %v", err)
			return
		}
		var reqFrame map[string]any
		if err := json.Unmarshal(raw, &reqFrame); err != nil {
			t.Errorf("request frame parse failed: %v", err)
			return
		}
		if reqFrame["method"] != "health" {
			t.Errorf("expected health method, got %#v", reqFrame["method"])
			return
		}
		if err := conn.WriteJSON(map[string]any{
			"type": "res",
			"id":   reqFrame["id"],
			"ok":   true,
			"payload": map[string]any{
				"ok": true,
			},
		}); err != nil {
			t.Errorf("health response write failed: %v", err)
			return
		}
	}))
	defer healthServer.Close()
	wsURL := "ws" + strings.TrimPrefix(healthServer.URL, "http")

	srv := httptest.NewServer(New())
	defer srv.Close()

	statusReq, err := http.NewRequest(http.MethodGet, srv.URL+"/api/onboarding/status", nil)
	if err != nil {
		t.Fatal(err)
	}
	statusReq.Header.Set("Authorization", "Bearer admin-token")
	statusRes, err := http.DefaultClient.Do(statusReq)
	if err != nil {
		t.Fatal(err)
	}
	defer statusRes.Body.Close()
	if statusRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected onboarding status code: %d", statusRes.StatusCode)
	}
	var statusPayload map[string]any
	if err := json.NewDecoder(statusRes.Body).Decode(&statusPayload); err != nil {
		t.Fatal(err)
	}
	if statusPayload["needsOnboarding"] != true {
		t.Fatalf("unexpected onboarding payload: %#v", statusPayload)
	}

	testReq, err := http.NewRequest(http.MethodPost, srv.URL+"/api/onboarding/test-connection", strings.NewReader(`{"url":"`+wsURL+`","token":"token-1"}`))
	if err != nil {
		t.Fatal(err)
	}
	testReq.Header.Set("Authorization", "Bearer admin-token")
	testReq.Header.Set("Content-Type", "application/json")
	testRes, err := http.DefaultClient.Do(testReq)
	if err != nil {
		t.Fatal(err)
	}
	defer testRes.Body.Close()
	if testRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected onboarding test status: %d", testRes.StatusCode)
	}
	var testPayload map[string]any
	if err := json.NewDecoder(testRes.Body).Decode(&testPayload); err != nil {
		t.Fatal(err)
	}
	if testPayload["success"] != true {
		t.Fatalf("unexpected onboarding test payload: %#v", testPayload)
	}

	saveReq, err := http.NewRequest(http.MethodPost, srv.URL+"/api/onboarding/save-settings", strings.NewReader(`{"gatewayUrl":"`+wsURL+`","gatewayToken":"token-1"}`))
	if err != nil {
		t.Fatal(err)
	}
	saveReq.Header.Set("Authorization", "Bearer admin-token")
	saveReq.Header.Set("Content-Type", "application/json")
	saveRes, err := http.DefaultClient.Do(saveReq)
	if err != nil {
		t.Fatal(err)
	}
	defer saveRes.Body.Close()
	if saveRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected onboarding save status: %d", saveRes.StatusCode)
	}

	settingsReq, err := http.NewRequest(http.MethodGet, srv.URL+"/api/settings", nil)
	if err != nil {
		t.Fatal(err)
	}
	settingsReq.Header.Set("Authorization", "Bearer admin-token")
	settingsRes, err := http.DefaultClient.Do(settingsReq)
	if err != nil {
		t.Fatal(err)
	}
	defer settingsRes.Body.Close()
	var settingsPayload map[string]any
	if err := json.NewDecoder(settingsRes.Body).Decode(&settingsPayload); err != nil {
		t.Fatal(err)
	}
	settings, ok := settingsPayload["settings"].(map[string]any)
	if !ok {
		t.Fatalf("unexpected settings payload: %#v", settingsPayload)
	}
	managed, ok := settings["managedGateway"].(map[string]any)
	if !ok {
		t.Fatalf("unexpected managed gateway payload: %#v", settings)
	}
	if managed["gatewayToken"] != "token-1" {
		t.Fatalf("unexpected managed gateway settings: %#v", managed)
	}
}

func TestStaticShell_BypassesAuthWhileAPIStaysProtected(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")

	distDir := t.TempDir()
	if err := os.WriteFile(filepath.Join(distDir, "index.html"), []byte("<!doctype html><div>deck-go shell</div>"), 0o644); err != nil {
		t.Fatal(err)
	}
	t.Setenv("DECK_GO_FRONTEND_DIST", distDir)

	srv := httptest.NewServer(New())
	defer srv.Close()

	rootRes, err := http.Get(srv.URL + "/")
	if err != nil {
		t.Fatal(err)
	}
	defer rootRes.Body.Close()
	if rootRes.StatusCode != http.StatusOK {
		t.Fatalf("expected static shell to load without auth, got %d", rootRes.StatusCode)
	}

	apiRes, err := http.Get(srv.URL + "/api/settings")
	if err != nil {
		t.Fatal(err)
	}
	defer apiRes.Body.Close()
	if apiRes.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected api route to remain protected, got %d", apiRes.StatusCode)
	}
}

func TestAlertsRoutes_CRUD(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")

	srv := httptest.NewServer(New())
	defer srv.Close()

	createReq, err := http.NewRequest(http.MethodPost, srv.URL+"/api/alerts", strings.NewReader(`{
	  "name":"High Usage",
	  "entityType":"usage",
	  "condition":">=",
	  "threshold":80,
	  "action":"toast",
	  "cooldownMs":60000,
	  "enabled":true
	}`))
	if err != nil {
		t.Fatal(err)
	}
	createReq.Header.Set("Authorization", "Bearer admin-token")
	createReq.Header.Set("Content-Type", "application/json")
	createRes, err := http.DefaultClient.Do(createReq)
	if err != nil {
		t.Fatal(err)
	}
	defer createRes.Body.Close()
	if createRes.StatusCode != http.StatusCreated {
		t.Fatalf("unexpected create status: %d", createRes.StatusCode)
	}
	var createdPayload map[string]any
	if err := json.NewDecoder(createRes.Body).Decode(&createdPayload); err != nil {
		t.Fatal(err)
	}
	rule, ok := createdPayload["rule"].(map[string]any)
	if !ok {
		t.Fatalf("unexpected create payload: %#v", createdPayload)
	}
	ruleID, _ := rule["id"].(string)
	if ruleID == "" {
		t.Fatalf("missing rule id: %#v", createdPayload)
	}

	listReq, err := http.NewRequest(http.MethodGet, srv.URL+"/api/alerts", nil)
	if err != nil {
		t.Fatal(err)
	}
	listReq.Header.Set("Authorization", "Bearer admin-token")
	listRes, err := http.DefaultClient.Do(listReq)
	if err != nil {
		t.Fatal(err)
	}
	defer listRes.Body.Close()
	if listRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected list status: %d", listRes.StatusCode)
	}
	var listPayload map[string]any
	if err := json.NewDecoder(listRes.Body).Decode(&listPayload); err != nil {
		t.Fatal(err)
	}
	rules, ok := listPayload["rules"].([]any)
	if !ok || len(rules) != 1 {
		t.Fatalf("unexpected list payload: %#v", listPayload)
	}

	patchReq, err := http.NewRequest(http.MethodPatch, srv.URL+"/api/alerts/"+ruleID, strings.NewReader(`{"enabled":false}`))
	if err != nil {
		t.Fatal(err)
	}
	patchReq.Header.Set("Authorization", "Bearer admin-token")
	patchReq.Header.Set("Content-Type", "application/json")
	patchRes, err := http.DefaultClient.Do(patchReq)
	if err != nil {
		t.Fatal(err)
	}
	defer patchRes.Body.Close()
	if patchRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected patch status: %d", patchRes.StatusCode)
	}

	deleteReq, err := http.NewRequest(http.MethodDelete, srv.URL+"/api/alerts/"+ruleID, nil)
	if err != nil {
		t.Fatal(err)
	}
	deleteReq.Header.Set("Authorization", "Bearer admin-token")
	deleteRes, err := http.DefaultClient.Do(deleteReq)
	if err != nil {
		t.Fatal(err)
	}
	defer deleteRes.Body.Close()
	if deleteRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected delete status: %d", deleteRes.StatusCode)
	}
}

func TestWebhooksRoutes_CRUDAndTestDelivery(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")

	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))
	defer target.Close()

	srv := httptest.NewServer(New())
	defer srv.Close()

	createReq, err := http.NewRequest(http.MethodPost, srv.URL+"/api/webhooks", strings.NewReader(`{
	  "name":"Audit",
	  "url":"`+target.URL+`",
	  "events":["alert.fired"],
	  "enabled":true
	}`))
	if err != nil {
		t.Fatal(err)
	}
	createReq.Header.Set("Authorization", "Bearer admin-token")
	createReq.Header.Set("Content-Type", "application/json")
	createRes, err := http.DefaultClient.Do(createReq)
	if err != nil {
		t.Fatal(err)
	}
	defer createRes.Body.Close()
	if createRes.StatusCode != http.StatusCreated {
		t.Fatalf("unexpected create status: %d", createRes.StatusCode)
	}
	var created map[string]any
	if err := json.NewDecoder(createRes.Body).Decode(&created); err != nil {
		t.Fatal(err)
	}
	webhookID, _ := created["id"].(string)
	if webhookID == "" {
		t.Fatalf("missing webhook id: %#v", created)
	}

	testReq, err := http.NewRequest(http.MethodPost, srv.URL+"/api/webhooks/"+webhookID+"/test", nil)
	if err != nil {
		t.Fatal(err)
	}
	testReq.Header.Set("Authorization", "Bearer admin-token")
	testRes, err := http.DefaultClient.Do(testReq)
	if err != nil {
		t.Fatal(err)
	}
	defer testRes.Body.Close()
	if testRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected test status: %d", testRes.StatusCode)
	}

	deliveriesReq, err := http.NewRequest(http.MethodGet, srv.URL+"/api/webhooks/"+webhookID+"/deliveries", nil)
	if err != nil {
		t.Fatal(err)
	}
	deliveriesReq.Header.Set("Authorization", "Bearer admin-token")
	deliveriesRes, err := http.DefaultClient.Do(deliveriesReq)
	if err != nil {
		t.Fatal(err)
	}
	defer deliveriesRes.Body.Close()
	if deliveriesRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected deliveries status: %d", deliveriesRes.StatusCode)
	}
	var deliveriesPayload map[string]any
	if err := json.NewDecoder(deliveriesRes.Body).Decode(&deliveriesPayload); err != nil {
		t.Fatal(err)
	}
	deliveries, ok := deliveriesPayload["deliveries"].([]any)
	if !ok || len(deliveries) != 1 {
		t.Fatalf("unexpected deliveries payload: %#v", deliveriesPayload)
	}
	delivery, ok := deliveries[0].(map[string]any)
	if !ok {
		t.Fatalf("unexpected delivery payload: %#v", deliveries[0])
	}
	if delivery["isRetry"] != false {
		t.Fatalf("expected non-retry delivery, got %#v", delivery)
	}
	if delivery["attempt"] != float64(0) {
		t.Fatalf("expected attempt 0 for test delivery, got %#v", delivery)
	}

	patchReq, err := http.NewRequest(http.MethodPatch, srv.URL+"/api/webhooks/"+webhookID, strings.NewReader(`{"enabled":false}`))
	if err != nil {
		t.Fatal(err)
	}
	patchReq.Header.Set("Authorization", "Bearer admin-token")
	patchReq.Header.Set("Content-Type", "application/json")
	patchRes, err := http.DefaultClient.Do(patchReq)
	if err != nil {
		t.Fatal(err)
	}
	defer patchRes.Body.Close()
	if patchRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected patch status: %d", patchRes.StatusCode)
	}

	deleteReq, err := http.NewRequest(http.MethodDelete, srv.URL+"/api/webhooks/"+webhookID, nil)
	if err != nil {
		t.Fatal(err)
	}
	deleteReq.Header.Set("Authorization", "Bearer admin-token")
	deleteRes, err := http.DefaultClient.Do(deleteReq)
	if err != nil {
		t.Fatal(err)
	}
	defer deleteRes.Body.Close()
	if deleteRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected delete status: %d", deleteRes.StatusCode)
	}
}

func TestWebhooksRoutes_FailedDeliveryStoresResponseBody(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")

	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		_, _ = w.Write([]byte(`{"error":"receiver unavailable"}`))
	}))
	defer target.Close()

	srv := httptest.NewServer(New())
	defer srv.Close()

	createReq, err := http.NewRequest(http.MethodPost, srv.URL+"/api/webhooks", strings.NewReader(`{
	  "name":"Failing Audit",
	  "url":"`+target.URL+`",
	  "events":["alert.fired"],
	  "enabled":true
	}`))
	if err != nil {
		t.Fatal(err)
	}
	createReq.Header.Set("Authorization", "Bearer admin-token")
	createReq.Header.Set("Content-Type", "application/json")
	createRes, err := http.DefaultClient.Do(createReq)
	if err != nil {
		t.Fatal(err)
	}
	defer createRes.Body.Close()
	var created map[string]any
	if err := json.NewDecoder(createRes.Body).Decode(&created); err != nil {
		t.Fatal(err)
	}
	webhookID, _ := created["id"].(string)
	if webhookID == "" {
		t.Fatalf("missing webhook id: %#v", created)
	}

	testReq, err := http.NewRequest(http.MethodPost, srv.URL+"/api/webhooks/"+webhookID+"/test", nil)
	if err != nil {
		t.Fatal(err)
	}
	testReq.Header.Set("Authorization", "Bearer admin-token")
	testRes, err := http.DefaultClient.Do(testReq)
	if err != nil {
		t.Fatal(err)
	}
	defer testRes.Body.Close()

	deliveriesReq, err := http.NewRequest(http.MethodGet, srv.URL+"/api/webhooks/"+webhookID+"/deliveries", nil)
	if err != nil {
		t.Fatal(err)
	}
	deliveriesReq.Header.Set("Authorization", "Bearer admin-token")
	deliveriesRes, err := http.DefaultClient.Do(deliveriesReq)
	if err != nil {
		t.Fatal(err)
	}
	defer deliveriesRes.Body.Close()
	var deliveriesPayload struct {
		Deliveries []map[string]any `json:"deliveries"`
	}
	if err := json.NewDecoder(deliveriesRes.Body).Decode(&deliveriesPayload); err != nil {
		t.Fatal(err)
	}
	if len(deliveriesPayload.Deliveries) != 1 {
		t.Fatalf("unexpected deliveries payload: %#v", deliveriesPayload)
	}
	if deliveriesPayload.Deliveries[0]["success"] != false {
		t.Fatalf("expected failed delivery, got %#v", deliveriesPayload.Deliveries[0])
	}
	if deliveriesPayload.Deliveries[0]["isRetry"] != false {
		t.Fatalf("expected failed test delivery to remain non-retry, got %#v", deliveriesPayload.Deliveries[0])
	}
	if deliveriesPayload.Deliveries[0]["attempt"] != float64(0) {
		t.Fatalf("expected failed test delivery attempt 0, got %#v", deliveriesPayload.Deliveries[0])
	}
	if deliveriesPayload.Deliveries[0]["responseBody"] != `{"error":"receiver unavailable"}` {
		t.Fatalf("expected response body capture, got %#v", deliveriesPayload.Deliveries[0])
	}
}

func TestActivityAndMonitorRoutes(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")

	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	bus := events.NewBus(32)
	supervisor := &testSupervisor{}

	now := time.Now().UnixMilli()
	activityPayload, _ := json.Marshal(map[string]any{
		"id":          "act-1",
		"timestamp":   now,
		"type":        "alert",
		"agentId":     "main",
		"agentName":   "Main",
		"description": "Alert fired",
		"details":     "details",
	})
	bus.Publish("activity.event", activityPayload)

	chatPayload, _ := json.Marshal(map[string]any{
		"runId":      "run-1",
		"sessionKey": "agent:main:session-1",
		"state":      "final",
		"usage": map[string]any{
			"input_tokens":  10,
			"output_tokens": 20,
		},
	})
	bus.Publish("chat", chatPayload)

	agentPayload, _ := json.Marshal(map[string]any{
		"runId":      "run-1",
		"sessionKey": "agent:main:session-1",
		"stream":     "tool",
		"data": map[string]any{
			"name": "write",
		},
	})
	bus.Publish("agent", agentPayload)

	srv := httptest.NewServer(newTestRouter(store, supervisor, bus))
	defer srv.Close()

	for _, path := range []string{
		"/api/activity?limit=10",
		"/api/monitor/runs",
		"/api/monitor/runs/run-1",
		"/api/monitor/stats",
	} {
		req, err := http.NewRequest(http.MethodGet, srv.URL+path, nil)
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Authorization", "Bearer admin-token")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status for %s: %d", path, res.StatusCode)
		}
	}

	activityReq, err := http.NewRequest(http.MethodGet, srv.URL+"/api/activity?limit=10", nil)
	if err != nil {
		t.Fatal(err)
	}
	activityReq.Header.Set("Authorization", "Bearer admin-token")
	activityRes, err := http.DefaultClient.Do(activityReq)
	if err != nil {
		t.Fatal(err)
	}
	defer activityRes.Body.Close()
	var activityBody struct {
		Events []struct {
			Type        string `json:"type"`
			Description string `json:"description"`
		} `json:"events"`
	}
	if err := json.NewDecoder(activityRes.Body).Decode(&activityBody); err != nil {
		t.Fatal(err)
	}
	foundChat := false
	foundTool := false
	for _, event := range activityBody.Events {
		if event.Type == "chat" && event.Description == "Chat run completed" {
			foundChat = true
		}
		if event.Type == "tool_call" && event.Description == "Tool write" {
			foundTool = true
		}
	}
	if !foundChat || !foundTool {
		t.Fatalf("expected synthesized activity entries, got %#v", activityBody.Events)
	}

	runDetailReq, err := http.NewRequest(http.MethodGet, srv.URL+"/api/monitor/runs/run-1", nil)
	if err != nil {
		t.Fatal(err)
	}
	runDetailReq.Header.Set("Authorization", "Bearer admin-token")
	runDetailRes, err := http.DefaultClient.Do(runDetailReq)
	if err != nil {
		t.Fatal(err)
	}
	defer runDetailRes.Body.Close()
	var runDetailBody struct {
		Summary map[string]any   `json:"summary"`
		Events  []map[string]any `json:"events"`
	}
	if err := json.NewDecoder(runDetailRes.Body).Decode(&runDetailBody); err != nil {
		t.Fatal(err)
	}
	if len(runDetailBody.Events) == 0 {
		t.Fatalf("expected run detail events, got %#v", runDetailBody)
	}
}

func TestDevicesSelfRoute(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")

	srv := httptest.NewServer(New())
	defer srv.Close()

	req, err := http.NewRequest(http.MethodGet, srv.URL+"/api/devices/self", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer admin-token")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("unexpected devices/self status: %d", res.StatusCode)
	}
	var payload map[string]any
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if payload["deviceId"] == nil || payload["deviceId"] == "" {
		t.Fatalf("unexpected devices/self payload: %#v", payload)
	}
}

func TestAssetRoutes_MediaCanvasAndDeckCanvas(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")

	gatewayServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/__openclaw__/a2ui/index.html" {
			w.Header().Set("Content-Type", "text/html")
			_, _ = w.Write([]byte("<html><body>canvas</body></html>"))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer gatewayServer.Close()

	t.Setenv("DECK_GO_GATEWAY_BIND_PORT", strconv.Itoa(mustPort(t, gatewayServer.URL)))
	t.Setenv("DECK_GO_GATEWAY_TOKEN", "gateway-token")

	mediaFile := filepath.Join(t.TempDir(), "artifact.txt")
	if err := os.WriteFile(mediaFile, []byte("artifact"), 0o644); err != nil {
		t.Fatal(err)
	}
	t.Setenv("DECK_GO_DATA_DIR", filepath.Dir(mediaFile))

	srv := httptest.NewServer(New())
	defer srv.Close()

	mediaReq, err := http.NewRequest(http.MethodGet, srv.URL+"/api/media?path="+url.QueryEscape(mediaFile), nil)
	if err != nil {
		t.Fatal(err)
	}
	mediaReq.Header.Set("Authorization", "Bearer admin-token")
	mediaRes, err := http.DefaultClient.Do(mediaReq)
	if err != nil {
		t.Fatal(err)
	}
	defer mediaRes.Body.Close()
	if mediaRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected media status: %d", mediaRes.StatusCode)
	}

	canvasReq, err := http.NewRequest(http.MethodGet, srv.URL+"/api/canvas/index.html", nil)
	if err != nil {
		t.Fatal(err)
	}
	canvasReq.Header.Set("Authorization", "Bearer admin-token")
	canvasRes, err := http.DefaultClient.Do(canvasReq)
	if err != nil {
		t.Fatal(err)
	}
	defer canvasRes.Body.Close()
	if canvasRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected canvas status: %d", canvasRes.StatusCode)
	}
	canvasBody, err := io.ReadAll(canvasRes.Body)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(canvasBody), "a2ui:ready") {
		t.Fatalf("expected injected canvas bridge script, got: %s", string(canvasBody))
	}

	deckCanvasReq, err := http.NewRequest(http.MethodPost, srv.URL+"/api/deck/canvas", strings.NewReader(`{"action":"ready","sessionKey":"session-1"}`))
	if err != nil {
		t.Fatal(err)
	}
	deckCanvasReq.Header.Set("Authorization", "Bearer admin-token")
	deckCanvasReq.Header.Set("Content-Type", "application/json")
	deckCanvasRes, err := http.DefaultClient.Do(deckCanvasReq)
	if err != nil {
		t.Fatal(err)
	}
	defer deckCanvasRes.Body.Close()
	if deckCanvasRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected deck canvas status: %d", deckCanvasRes.StatusCode)
	}
	if ready, ok := canvasReadySessions.Load("session-1"); !ok || ready != true {
		t.Fatalf("expected ready session to be tracked, got %#v", ready)
	}

	resolveReq, err := http.NewRequest(http.MethodPost, srv.URL+"/api/deck/canvas", strings.NewReader(`{"action":"resolve","evalId":"eval-1","result":{"ok":true,"value":42}}`))
	if err != nil {
		t.Fatal(err)
	}
	resolveReq.Header.Set("Authorization", "Bearer admin-token")
	resolveReq.Header.Set("Content-Type", "application/json")
	resolveRes, err := http.DefaultClient.Do(resolveReq)
	if err != nil {
		t.Fatal(err)
	}
	defer resolveRes.Body.Close()
	if resolveRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected deck canvas resolve status: %d", resolveRes.StatusCode)
	}
	resolved, ok := canvasEvalResults.Load("eval-1")
	if !ok {
		t.Fatal("expected canvas eval result to be recorded")
	}
	resultMap, ok := resolved.(map[string]any)
	if !ok || resultMap["ok"] != true || resultMap["value"] != float64(42) {
		t.Fatalf("unexpected canvas eval result: %#v", resolved)
	}
}

func TestGatewayCallbackProxyRoutes_BypassAuthAndForwardToGateway(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())

	var seenAuth string
	var seenMethod string
	var seenPath string
	var seenQuery string
	var seenBody string
	gatewayServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seenAuth = r.Header.Get("Authorization")
		seenMethod = r.Method
		seenPath = r.URL.Path
		seenQuery = r.URL.RawQuery
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatal(err)
		}
		seenBody = string(body)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer gatewayServer.Close()

	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(config.Settings{
		AccessToken: "admin-token",
		ManagedGateway: config.ManagedGatewaySettings{
			BindHost:  "127.0.0.1",
			BindPort:  mustPort(t, gatewayServer.URL),
			AutoStart: false,
		},
	}); err != nil {
		t.Fatal(err)
	}

	bus := events.NewBus(16)
	srv := httptest.NewServer(newManagedTestRouter(store, &testSupervisor{}, bus))
	defer srv.Close()

	req, err := http.NewRequest(
		http.MethodPost,
		srv.URL+"/wecom/agent/callback?msg_signature=abc&timestamp=123",
		strings.NewReader(`{"event":"message"}`),
	)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("unexpected callback proxy status: %d", res.StatusCode)
	}
	if seenAuth != "" {
		t.Fatalf("expected callback proxy to forward without deck auth header, got %q", seenAuth)
	}
	if seenMethod != http.MethodPost {
		t.Fatalf("unexpected proxied method: %s", seenMethod)
	}
	if seenPath != "/wecom/agent/callback" {
		t.Fatalf("unexpected proxied path: %s", seenPath)
	}
	if seenQuery != "msg_signature=abc&timestamp=123" {
		t.Fatalf("unexpected proxied query: %s", seenQuery)
	}
	if seenBody != `{"event":"message"}` {
		t.Fatalf("unexpected proxied body: %s", seenBody)
	}
}

func TestBudgetRoutes_CRUDAndEvaluate(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")

	upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	wsServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("upgrade failed: %v", err)
			return
		}
		defer conn.Close()
		_ = conn.WriteJSON(map[string]any{
			"type":    "event",
			"event":   "connect.challenge",
			"payload": map[string]any{"nonce": "nonce-1"},
		})
		_, raw, _ := conn.ReadMessage()
		var connectFrame map[string]any
		_ = json.Unmarshal(raw, &connectFrame)
		_ = conn.WriteJSON(map[string]any{
			"type":    "res",
			"id":      connectFrame["id"],
			"ok":      true,
			"payload": map[string]any{"ready": true},
		})
		_, raw, _ = conn.ReadMessage()
		var reqFrame map[string]any
		_ = json.Unmarshal(raw, &reqFrame)
		_ = conn.WriteJSON(map[string]any{
			"type": "res",
			"id":   reqFrame["id"],
			"ok":   true,
			"payload": map[string]any{
				"totals": map[string]any{
					"totalCost":   12,
					"input":       100,
					"output":      50,
					"totalTokens": 150,
				},
			},
		})
	}))
	defer wsServer.Close()

	t.Setenv("DECK_GO_GATEWAY_BIND_PORT", strconv.Itoa(mustPort(t, wsServer.URL)))
	t.Setenv("DECK_GO_GATEWAY_TOKEN", "gateway-token")

	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	bus := events.NewBus(16)
	supervisor := &testSupervisor{
		snapshot: openclawrt.ManagedSnapshot{
			Managed:    true,
			Configured: true,
			Status:     openclawrt.ManagedStatusRunning,
			Health:     openclawrt.ManagedHealthHealthy,
			GatewayURL: config.ManagedGatewayURL(store.Effective().ManagedGateway),
			AutoStart:  false,
		},
	}
	srv := httptest.NewServer(newTestRouter(store, supervisor, bus))
	defer srv.Close()

	createReq, err := http.NewRequest(http.MethodPost, srv.URL+"/api/usage/budget", strings.NewReader(`{"name":"Monthly cost","dimension":"cost","warnThreshold":10,"overThreshold":20}`))
	if err != nil {
		t.Fatal(err)
	}
	createReq.Header.Set("Authorization", "Bearer admin-token")
	createReq.Header.Set("Content-Type", "application/json")
	createRes, err := http.DefaultClient.Do(createReq)
	if err != nil {
		t.Fatal(err)
	}
	defer createRes.Body.Close()
	if createRes.StatusCode != http.StatusCreated {
		t.Fatalf("unexpected create status: %d", createRes.StatusCode)
	}
	var created map[string]any
	if err := json.NewDecoder(createRes.Body).Decode(&created); err != nil {
		t.Fatal(err)
	}
	ruleID, _ := created["id"].(string)
	if ruleID == "" {
		t.Fatalf("missing budget rule id: %#v", created)
	}

	evalReq, err := http.NewRequest(http.MethodGet, srv.URL+"/api/usage/budget/evaluate", nil)
	if err != nil {
		t.Fatal(err)
	}
	evalReq.Header.Set("Authorization", "Bearer admin-token")
	evalRes, err := http.DefaultClient.Do(evalReq)
	if err != nil {
		t.Fatal(err)
	}
	defer evalRes.Body.Close()
	if evalRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected evaluate status: %d", evalRes.StatusCode)
	}

	patchReq, err := http.NewRequest(http.MethodPatch, srv.URL+"/api/usage/budget/"+ruleID, strings.NewReader(`{"enabled":false}`))
	if err != nil {
		t.Fatal(err)
	}
	patchReq.Header.Set("Authorization", "Bearer admin-token")
	patchReq.Header.Set("Content-Type", "application/json")
	patchRes, err := http.DefaultClient.Do(patchReq)
	if err != nil {
		t.Fatal(err)
	}
	defer patchRes.Body.Close()
	if patchRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected patch status: %d", patchRes.StatusCode)
	}

	deleteReq, err := http.NewRequest(http.MethodDelete, srv.URL+"/api/usage/budget/"+ruleID, nil)
	if err != nil {
		t.Fatal(err)
	}
	deleteReq.Header.Set("Authorization", "Bearer admin-token")
	deleteRes, err := http.DefaultClient.Do(deleteReq)
	if err != nil {
		t.Fatal(err)
	}
	defer deleteRes.Body.Close()
	if deleteRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected delete status: %d", deleteRes.StatusCode)
	}
}

func TestBootstrapStatus_UsesGatewayDescribeAndRuntimeSnapshot(t *testing.T) {
	upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	wsServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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
			"type": "res",
			"id":   connectFrame["id"],
			"ok":   true,
			"payload": map[string]any{
				"ready": true,
			},
		})
		_, raw, _ = conn.ReadMessage()
		var reqFrame map[string]any
		_ = json.Unmarshal(raw, &reqFrame)
		_ = conn.WriteJSON(map[string]any{
			"type": "res",
			"id":   reqFrame["id"],
			"ok":   true,
			"payload": map[string]any{
				"protocol": 3,
				"methods":  map[string]any{},
				"events":   map[string]any{},
				"untyped":  []any{},
			},
		})
	}))
	defer wsServer.Close()

	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")
	t.Setenv("DECK_GO_GATEWAY_BIND_PORT", strconv.Itoa(mustPort(t, wsServer.URL)))
	t.Setenv("DECK_GO_GATEWAY_TOKEN", "gateway-token")

	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	bus := events.NewBus(4)
	supervisor := &testSupervisor{
		snapshot: openclawrt.ManagedSnapshot{
			Managed:    true,
			Configured: true,
			Status:     openclawrt.ManagedStatusRunning,
			Health:     openclawrt.ManagedHealthHealthy,
			GatewayURL: config.ManagedGatewayURL(store.Effective().ManagedGateway),
			AutoStart:  true,
		},
	}
	srv := httptest.NewServer(newTestRouter(store, supervisor, bus))
	defer srv.Close()

	req, err := http.NewRequest(http.MethodGet, srv.URL+"/api/bootstrap/status", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer admin-token")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: %d", res.StatusCode)
	}

	var payload map[string]any
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	runtimePayload, ok := payload["runtime"].(map[string]any)
	if !ok {
		t.Fatalf("unexpected payload: %#v", payload)
	}
	if runtimePayload["status"] != "running" {
		t.Fatalf("expected runtime running, got %#v", runtimePayload)
	}
	gatewayPayload, ok := payload["gateway"].(map[string]any)
	if !ok || gatewayPayload["connected"] != true {
		t.Fatalf("expected connected gateway payload, got %#v", payload)
	}
}

func TestBootstrapStatus_RemainsConnectedWhenDescribeScopeIsMissing(t *testing.T) {
	upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	var callMu sync.Mutex
	var callCount int
	wsServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("upgrade failed: %v", err)
			return
		}
		defer conn.Close()

		_ = conn.WriteJSON(map[string]any{
			"type":    "event",
			"event":   "connect.challenge",
			"payload": map[string]any{"nonce": "nonce-1"},
		})
		_, raw, _ := conn.ReadMessage()
		var connectFrame map[string]any
		_ = json.Unmarshal(raw, &connectFrame)
		_ = conn.WriteJSON(map[string]any{
			"type":    "res",
			"id":      connectFrame["id"],
			"payload": map[string]any{"ready": true},
		})
		_, raw, _ = conn.ReadMessage()
		var reqFrame map[string]any
		_ = json.Unmarshal(raw, &reqFrame)

		callMu.Lock()
		defer callMu.Unlock()
		switch callCount {
		case 0:
			_ = conn.WriteJSON(map[string]any{
				"type":    "res",
				"id":      reqFrame["id"],
				"payload": map[string]any{"ok": true},
			})
		default:
			_ = conn.WriteJSON(map[string]any{
				"type": "res",
				"id":   reqFrame["id"],
				"error": map[string]any{
					"code":    "INVALID_REQUEST",
					"message": "missing scope: operator.read",
				},
			})
		}
		callCount++
	}))
	defer wsServer.Close()

	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")
	t.Setenv("DECK_GO_GATEWAY_BIND_PORT", strconv.Itoa(mustPort(t, wsServer.URL)))
	t.Setenv("DECK_GO_GATEWAY_TOKEN", "gateway-token")

	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	bus := events.NewBus(4)
	supervisor := &testSupervisor{
		snapshot: openclawrt.ManagedSnapshot{
			Managed:    true,
			Configured: true,
			Status:     openclawrt.ManagedStatusRunning,
			Health:     openclawrt.ManagedHealthHealthy,
			GatewayURL: config.ManagedGatewayURL(store.Effective().ManagedGateway),
			AutoStart:  true,
		},
	}
	srv := httptest.NewServer(newTestRouter(store, supervisor, bus))
	defer srv.Close()

	req, err := http.NewRequest(http.MethodGet, srv.URL+"/api/bootstrap/status", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer admin-token")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()

	var payload map[string]any
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	gatewayPayload, ok := payload["gateway"].(map[string]any)
	if !ok || gatewayPayload["connected"] != true {
		t.Fatalf("unexpected bootstrap payload: %#v", payload)
	}
	if gatewayPayload["error"] == nil {
		t.Fatalf("expected describe warning in bootstrap payload: %#v", payload)
	}
}

func TestStreamRoute_ReplaysEventFromBus(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	bus := events.NewBus(4)
	bus.Publish("runtime.gateway.status", []byte(`{"status":"running"}`))
	supervisor := &testSupervisor{}
	handler := newTestRouter(store, supervisor, bus)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	req := httptest.NewRequest(http.MethodGet, "/api/stream", nil).WithContext(ctx)
	req.Header.Set("Authorization", "Bearer admin-token")
	req.Header.Set("Last-Event-ID", "0")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	body := rec.Body.String()
	if !strings.Contains(body, "event: runtime.gateway.status") {
		t.Fatalf("unexpected body: %s", body)
	}
}

func TestCorsPreflight_AllowsStreamResumeHeader(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	handler := newTestRouter(store, &testSupervisor{}, events.NewBus(4))

	req := httptest.NewRequest(http.MethodOptions, "/api/logs/stream", nil)
	req.Header.Set("Origin", "http://127.0.0.1:4175")
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

func TestRuntimeGatewayRoutes_UseSupervisorStateMachine(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")

	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	bus := events.NewBus(8)
	supervisor := &testSupervisor{
		snapshot: openclawrt.ManagedSnapshot{
			Managed:    true,
			Configured: true,
			Status:     openclawrt.ManagedStatusStopped,
			Health:     openclawrt.ManagedHealthUnknown,
			GatewayURL: "ws://127.0.0.1:18789",
			AutoStart:  true,
		},
	}
	srv := httptest.NewServer(newTestRouter(store, supervisor, bus))
	defer srv.Close()

	getReq, err := http.NewRequest(http.MethodGet, srv.URL+"/api/runtime/gateway", nil)
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
		t.Fatalf("unexpected get status: %d", getRes.StatusCode)
	}

	startReq, err := http.NewRequest(http.MethodPost, srv.URL+"/api/runtime/gateway/start", nil)
	if err != nil {
		t.Fatal(err)
	}
	startReq.Header.Set("Authorization", "Bearer admin-token")
	startRes, err := http.DefaultClient.Do(startReq)
	if err != nil {
		t.Fatal(err)
	}
	defer startRes.Body.Close()
	if startRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected start status: %d", startRes.StatusCode)
	}

	var payload map[string]any
	if err := json.NewDecoder(startRes.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	runtimePayload, ok := payload["runtime"].(map[string]any)
	if !ok || runtimePayload["status"] != "running" {
		t.Fatalf("unexpected runtime payload: %#v", payload)
	}
	if supervisor.startCalls != 1 || supervisor.restartCalls != 0 || supervisor.stopCalls != 0 {
		t.Fatalf("expected only start to hit lifecycle state machine, got start=%d restart=%d stop=%d", supervisor.startCalls, supervisor.restartCalls, supervisor.stopCalls)
	}

	getReqAfterStart, err := http.NewRequest(http.MethodGet, srv.URL+"/api/runtime/gateway", nil)
	if err != nil {
		t.Fatal(err)
	}
	getReqAfterStart.Header.Set("Authorization", "Bearer admin-token")
	getResAfterStart, err := http.DefaultClient.Do(getReqAfterStart)
	if err != nil {
		t.Fatal(err)
	}
	defer getResAfterStart.Body.Close()
	if getResAfterStart.StatusCode != http.StatusOK {
		t.Fatalf("unexpected get-after-start status: %d", getResAfterStart.StatusCode)
	}
	if err := json.NewDecoder(getResAfterStart.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	runtimePayload, ok = payload["runtime"].(map[string]any)
	if !ok || runtimePayload["status"] != "running" || runtimePayload["health"] != "healthy" {
		t.Fatalf("expected runtime GET to reflect supervisor snapshot after start, got %#v", payload)
	}

	restartReq, err := http.NewRequest(http.MethodPost, srv.URL+"/api/runtime/gateway/restart", nil)
	if err != nil {
		t.Fatal(err)
	}
	restartReq.Header.Set("Authorization", "Bearer admin-token")
	restartRes, err := http.DefaultClient.Do(restartReq)
	if err != nil {
		t.Fatal(err)
	}
	defer restartRes.Body.Close()
	if restartRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected restart status: %d", restartRes.StatusCode)
	}
	if supervisor.startCalls != 1 || supervisor.restartCalls != 1 || supervisor.stopCalls != 0 {
		t.Fatalf("expected restart to hit lifecycle state machine, got start=%d restart=%d stop=%d", supervisor.startCalls, supervisor.restartCalls, supervisor.stopCalls)
	}

	stopReq, err := http.NewRequest(http.MethodPost, srv.URL+"/api/runtime/gateway/stop", nil)
	if err != nil {
		t.Fatal(err)
	}
	stopReq.Header.Set("Authorization", "Bearer admin-token")
	stopRes, err := http.DefaultClient.Do(stopReq)
	if err != nil {
		t.Fatal(err)
	}
	defer stopRes.Body.Close()
	if stopRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected stop status: %d", stopRes.StatusCode)
	}
	if supervisor.startCalls != 1 || supervisor.restartCalls != 1 || supervisor.stopCalls != 1 {
		t.Fatalf("expected stop to hit lifecycle state machine, got start=%d restart=%d stop=%d", supervisor.startCalls, supervisor.restartCalls, supervisor.stopCalls)
	}

	getReqAfterStop, err := http.NewRequest(http.MethodGet, srv.URL+"/api/runtime/gateway", nil)
	if err != nil {
		t.Fatal(err)
	}
	getReqAfterStop.Header.Set("Authorization", "Bearer admin-token")
	getResAfterStop, err := http.DefaultClient.Do(getReqAfterStop)
	if err != nil {
		t.Fatal(err)
	}
	defer getResAfterStop.Body.Close()
	if getResAfterStop.StatusCode != http.StatusOK {
		t.Fatalf("unexpected get-after-stop status: %d", getResAfterStop.StatusCode)
	}
	if err := json.NewDecoder(getResAfterStop.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	runtimePayload, ok = payload["runtime"].(map[string]any)
	if !ok || runtimePayload["status"] != "stopped" || runtimePayload["health"] != "unknown" {
		t.Fatalf("expected runtime GET to reflect supervisor snapshot after stop, got %#v", payload)
	}
}

func TestRuntimeGatewayManagedSmoke_StartRestartStop(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")

	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(config.Settings{
		ManagedGateway: config.ManagedGatewaySettings{
			Command:      os.Args[0],
			Args:         []string{"-test.run=TestServerHelperProcess", "--", "gateway-mock", "18896"},
			BindHost:     "127.0.0.1",
			BindPort:     18896,
			GatewayToken: "smoke-token",
			AutoStart:    false,
		},
	}); err != nil {
		t.Fatal(err)
	}
	bus := events.NewBus(16)
	supervisor := openclawrt.NewManagedSupervisorWithOptions(
		store,
		bus,
		openclawrt.WithManagedLauncher(func(cfg config.ManagedGatewaySettings) (*exec.Cmd, error) {
			cmd := exec.Command(os.Args[0], "-test.run=TestServerHelperProcess", "--", "gateway-mock", strconv.Itoa(cfg.BindPort))
			cmd.Env = append(os.Environ(), "GO_WANT_SERVER_HELPER_PROCESS=1", "OPENCLAW_GATEWAY_TOKEN="+cfg.GatewayToken)
			return cmd, nil
		}),
		openclawrt.WithManagedProbeInterval(20*time.Millisecond),
		openclawrt.WithManagedStartupTimeout(2*time.Second),
	)
	srv := httptest.NewServer(newTestRouter(store, supervisor, bus))
	defer srv.Close()

	startReq, err := http.NewRequest(http.MethodPost, srv.URL+"/api/runtime/gateway/start", nil)
	if err != nil {
		t.Fatal(err)
	}
	startReq.Header.Set("Authorization", "Bearer admin-token")
	startRes, err := http.DefaultClient.Do(startReq)
	if err != nil {
		t.Fatal(err)
	}
	startRes.Body.Close()
	if startRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected start status: %d", startRes.StatusCode)
	}

	waitForHTTPRuntimeStatus(t, srv.URL, "admin-token", "running")

	bootstrapReq, err := http.NewRequest(http.MethodGet, srv.URL+"/api/bootstrap/status", nil)
	if err != nil {
		t.Fatal(err)
	}
	bootstrapReq.Header.Set("Authorization", "Bearer admin-token")
	bootstrapRes, err := http.DefaultClient.Do(bootstrapReq)
	if err != nil {
		t.Fatal(err)
	}
	defer bootstrapRes.Body.Close()
	var bootstrapPayload map[string]any
	if err := json.NewDecoder(bootstrapRes.Body).Decode(&bootstrapPayload); err != nil {
		t.Fatal(err)
	}
	gatewayPayload, ok := bootstrapPayload["gateway"].(map[string]any)
	if !ok || gatewayPayload["connected"] != true {
		t.Fatalf("unexpected bootstrap payload: %#v", bootstrapPayload)
	}

	restartReq, err := http.NewRequest(http.MethodPost, srv.URL+"/api/runtime/gateway/restart", nil)
	if err != nil {
		t.Fatal(err)
	}
	restartReq.Header.Set("Authorization", "Bearer admin-token")
	restartRes, err := http.DefaultClient.Do(restartReq)
	if err != nil {
		t.Fatal(err)
	}
	restartRes.Body.Close()
	if restartRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected restart status: %d", restartRes.StatusCode)
	}
	waitForHTTPRuntimeStatus(t, srv.URL, "admin-token", "running")

	stopReq, err := http.NewRequest(http.MethodPost, srv.URL+"/api/runtime/gateway/stop", nil)
	if err != nil {
		t.Fatal(err)
	}
	stopReq.Header.Set("Authorization", "Bearer admin-token")
	stopRes, err := http.DefaultClient.Do(stopReq)
	if err != nil {
		t.Fatal(err)
	}
	stopRes.Body.Close()
	if stopRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected stop status: %d", stopRes.StatusCode)
	}
	waitForHTTPRuntimeStatus(t, srv.URL, "admin-token", "stopped")
}

func TestBootstrapStatus_DoesNotDriftAfterSettingsChangeWhileRuntimeIsRunning(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")

	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(config.Settings{
		ManagedGateway: config.ManagedGatewaySettings{
			Command:      os.Args[0],
			Args:         []string{"-test.run=TestServerHelperProcess", "--", "gateway-mock", "18897"},
			BindHost:     "127.0.0.1",
			BindPort:     18897,
			GatewayToken: "smoke-token-a",
			AutoStart:    false,
		},
	}); err != nil {
		t.Fatal(err)
	}
	bus := events.NewBus(16)
	supervisor := openclawrt.NewManagedSupervisorWithOptions(
		store,
		bus,
		openclawrt.WithManagedLauncher(func(cfg config.ManagedGatewaySettings) (*exec.Cmd, error) {
			cmd := exec.Command(os.Args[0], "-test.run=TestServerHelperProcess", "--", "gateway-mock", strconv.Itoa(cfg.BindPort))
			cmd.Env = append(os.Environ(), "GO_WANT_SERVER_HELPER_PROCESS=1", "OPENCLAW_GATEWAY_TOKEN="+cfg.GatewayToken)
			return cmd, nil
		}),
		openclawrt.WithManagedProbeInterval(20*time.Millisecond),
		openclawrt.WithManagedStartupTimeout(2*time.Second),
	)
	srv := httptest.NewServer(newTestRouter(store, supervisor, bus))
	defer srv.Close()

	startReq, err := http.NewRequest(http.MethodPost, srv.URL+"/api/runtime/gateway/start", nil)
	if err != nil {
		t.Fatal(err)
	}
	startReq.Header.Set("Authorization", "Bearer admin-token")
	startRes, err := http.DefaultClient.Do(startReq)
	if err != nil {
		t.Fatal(err)
	}
	startRes.Body.Close()
	if startRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected start status: %d", startRes.StatusCode)
	}
	waitForHTTPRuntimeStatus(t, srv.URL, "admin-token", "running")

	if err := store.Update(config.Settings{
		ManagedGateway: config.ManagedGatewaySettings{
			Command:      "node",
			Args:         []string{"dist/entry.js", "gateway", "run"},
			BindHost:     "127.0.0.1",
			BindPort:     19999,
			GatewayToken: "smoke-token-b",
			AutoStart:    false,
		},
	}); err != nil {
		t.Fatal(err)
	}

	bootstrapReq, err := http.NewRequest(http.MethodGet, srv.URL+"/api/bootstrap/status", nil)
	if err != nil {
		t.Fatal(err)
	}
	bootstrapReq.Header.Set("Authorization", "Bearer admin-token")
	bootstrapRes, err := http.DefaultClient.Do(bootstrapReq)
	if err != nil {
		t.Fatal(err)
	}
	defer bootstrapRes.Body.Close()
	var payload map[string]any
	if err := json.NewDecoder(bootstrapRes.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	runtimePayload, _ := payload["runtime"].(map[string]any)
	if runtimePayload["gatewayUrl"] != "ws://127.0.0.1:18897" {
		t.Fatalf("expected pinned runtime url, got %#v", runtimePayload)
	}
	gatewayPayload, _ := payload["gateway"].(map[string]any)
	if gatewayPayload["connected"] != true {
		t.Fatalf("expected connected bootstrap after settings drift, got %#v", payload)
	}

	stopReq, err := http.NewRequest(http.MethodPost, srv.URL+"/api/runtime/gateway/stop", nil)
	if err != nil {
		t.Fatal(err)
	}
	stopReq.Header.Set("Authorization", "Bearer admin-token")
	stopRes, err := http.DefaultClient.Do(stopReq)
	if err != nil {
		t.Fatal(err)
	}
	stopRes.Body.Close()
}

func waitForHTTPRuntimeStatus(t *testing.T, baseURL string, token string, expected string) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		req, err := http.NewRequest(http.MethodGet, baseURL+"/api/runtime/gateway", nil)
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Authorization", "Bearer "+token)
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		var payload map[string]any
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			res.Body.Close()
			t.Fatal(err)
		}
		res.Body.Close()
		runtimePayload, _ := payload["runtime"].(map[string]any)
		if runtimePayload["status"] == expected {
			return
		}
		time.Sleep(50 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for runtime status %s", expected)
}

func TestServerHelperProcess(t *testing.T) {
	if os.Getenv("GO_WANT_SERVER_HELPER_PROCESS") != "1" {
		return
	}
	mode := "gateway-mock"
	port := "18896"
	for idx, arg := range os.Args {
		if arg == "--" && idx+2 < len(os.Args) {
			mode = os.Args[idx+1]
			port = os.Args[idx+2]
			break
		}
	}
	if mode != "gateway-mock" {
		os.Exit(2)
	}

	token := os.Getenv("OPENCLAW_GATEWAY_TOKEN")
	upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	server := &http.Server{
		Addr: "127.0.0.1:" + port,
		Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			conn, err := upgrader.Upgrade(w, r, nil)
			if err != nil {
				os.Exit(3)
				return
			}
			defer conn.Close()

			_ = conn.WriteJSON(map[string]any{
				"type":    "event",
				"event":   "connect.challenge",
				"payload": map[string]any{"nonce": "nonce-1"},
			})

			for {
				_, raw, err := conn.ReadMessage()
				if err != nil {
					return
				}
				var frame map[string]any
				if err := json.Unmarshal(raw, &frame); err != nil {
					continue
				}
				method, _ := frame["method"].(string)
				id, _ := frame["id"].(string)
				params, _ := frame["params"].(map[string]any)

				switch method {
				case "connect":
					auth, _ := params["auth"].(map[string]any)
					if auth["token"] != token {
						_ = conn.WriteJSON(map[string]any{
							"type": "res",
							"id":   id,
							"error": map[string]any{
								"code":    "unauthorized",
								"message": "token mismatch",
							},
						})
						continue
					}
					_ = conn.WriteJSON(map[string]any{
						"type":    "res",
						"id":      id,
						"payload": map[string]any{"ready": true},
					})
				case "health":
					_ = conn.WriteJSON(map[string]any{
						"type":    "res",
						"id":      id,
						"payload": map[string]any{"ok": true},
					})
				case "gateway.describe":
					_ = conn.WriteJSON(map[string]any{
						"type": "res",
						"id":   id,
						"payload": map[string]any{
							"schemaVersion": "v1",
							"methods":       map[string]any{"health": map[string]any{}, "gateway.describe": map[string]any{}},
							"events":        map[string]any{"runtime.gateway.status": map[string]any{}},
						},
					})
				default:
					_ = conn.WriteJSON(map[string]any{
						"type":    "res",
						"id":      id,
						"payload": map[string]any{"ok": true},
					})
				}
			}
		}),
	}
	go func() {
		_ = server.ListenAndServe()
	}()
	select {}
}
