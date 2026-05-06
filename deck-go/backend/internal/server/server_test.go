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
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
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
	  "appearance":{"theme":"dark"},
	  "notifications":{"desktop":true},
	  "pairedDevices":[{"deviceId":"dev-1","displayName":"Dev One"}]
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
	if settings["accessToken"] != nil {
		t.Fatalf("settings response leaked access token: %#v", settings)
	}
	if settings["accessTokenConfigured"] != true {
		t.Fatalf("expected access token configured status: %#v", settings)
	}
	if settings["managedGateway"] != nil {
		t.Fatalf("settings response exposed managed gateway: %#v", settings)
	}
	appearance, ok := settings["appearance"].(map[string]any)
	if !ok || appearance["theme"] != "dark" {
		t.Fatalf("unexpected appearance payload: %#v", settings)
	}
	notifications, ok := settings["notifications"].(map[string]any)
	if !ok || notifications["desktop"] != true {
		t.Fatalf("unexpected notifications payload: %#v", settings)
	}
}

func TestSettingsRoute_RejectsRuntimeManagedFields(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")

	srv := httptest.NewServer(New())
	defer srv.Close()

	for _, tc := range []struct {
		name  string
		body  string
		field string
	}{
		{name: "access token", body: `{"accessToken":"secret"}`, field: "accessToken"},
		{name: "managed gateway", body: `{"managedGateway":{"command":"node"}}`, field: "managedGateway"},
		{name: "unknown field", body: `{"runtimeMode":"remote"}`, field: "runtimeMode"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodPut, srv.URL+"/api/settings", strings.NewReader(tc.body))
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
			if res.StatusCode != http.StatusBadRequest {
				t.Fatalf("unexpected status: %d", res.StatusCode)
			}
			var payload map[string]any
			if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
				t.Fatal(err)
			}
			if !strings.Contains(payload["message"].(string), tc.field) {
				t.Fatalf("expected rejected field %q in payload, got %#v", tc.field, payload)
			}
		})
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
	if statusPayload["needsOnboarding"] != false {
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
	if settings["accessToken"] != nil {
		t.Fatalf("settings response leaked access token: %#v", settings)
	}
	if settings["managedGateway"] != nil {
		t.Fatalf("settings response exposed managed gateway: %#v", settings)
	}
	if settings["accessTokenConfigured"] != true {
		t.Fatalf("expected token configured status: %#v", settings)
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

	invalidActionReq, err := http.NewRequest(http.MethodPost, srv.URL+"/api/alerts", strings.NewReader(`{
	  "name":"Invalid Action",
	  "entityType":"usage",
	  "condition":">=",
	  "threshold":80,
	  "action":"email"
	}`))
	if err != nil {
		t.Fatal(err)
	}
	invalidActionReq.Header.Set("Authorization", "Bearer admin-token")
	invalidActionReq.Header.Set("Content-Type", "application/json")
	invalidActionRes, err := http.DefaultClient.Do(invalidActionReq)
	if err != nil {
		t.Fatal(err)
	}
	defer invalidActionRes.Body.Close()
	if invalidActionRes.StatusCode != http.StatusBadRequest {
		t.Fatalf("unexpected invalid action status: %d", invalidActionRes.StatusCode)
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

	invalidPatchReq, err := http.NewRequest(http.MethodPatch, srv.URL+"/api/alerts/"+ruleID, strings.NewReader(`{"action":"email"}`))
	if err != nil {
		t.Fatal(err)
	}
	invalidPatchReq.Header.Set("Authorization", "Bearer admin-token")
	invalidPatchReq.Header.Set("Content-Type", "application/json")
	invalidPatchRes, err := http.DefaultClient.Do(invalidPatchReq)
	if err != nil {
		t.Fatal(err)
	}
	defer invalidPatchRes.Body.Close()
	if invalidPatchRes.StatusCode != http.StatusBadRequest {
		t.Fatalf("unexpected invalid patch status: %d", invalidPatchRes.StatusCode)
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

func TestCORSPreflightAllowsDelete(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")

	srv := httptest.NewServer(New())
	defer srv.Close()

	req, err := http.NewRequest(http.MethodOptions, srv.URL+"/api/alerts/ar-test", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Origin", "http://127.0.0.1:4174")
	req.Header.Set("Access-Control-Request-Method", http.MethodDelete)
	req.Header.Set("Access-Control-Request-Headers", "authorization")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusNoContent {
		t.Fatalf("unexpected preflight status: %d", res.StatusCode)
	}
	if methods := res.Header.Get("Access-Control-Allow-Methods"); !strings.Contains(methods, http.MethodDelete) {
		t.Fatalf("DELETE not allowed in CORS methods: %q", methods)
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
	  "secret":"receiver-secret",
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
	if created["secret"] != "***redacted" {
		t.Fatalf("expected create response to redact secret, got %#v", created)
	}

	listReq, err := http.NewRequest(http.MethodGet, srv.URL+"/api/webhooks", nil)
	if err != nil {
		t.Fatal(err)
	}
	listReq.Header.Set("Authorization", "Bearer admin-token")
	listRes, err := http.DefaultClient.Do(listReq)
	if err != nil {
		t.Fatal(err)
	}
	defer listRes.Body.Close()
	var listPayload struct {
		Webhooks []map[string]any `json:"webhooks"`
	}
	if err := json.NewDecoder(listRes.Body).Decode(&listPayload); err != nil {
		t.Fatal(err)
	}
	if len(listPayload.Webhooks) != 1 || listPayload.Webhooks[0]["secret"] != "***redacted" {
		t.Fatalf("expected list response to redact secret, got %#v", listPayload)
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

func TestWebhooksRoutes_RejectsNonHTTPReceiverURL(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")

	srv := httptest.NewServer(New())
	defer srv.Close()

	createReq, err := http.NewRequest(http.MethodPost, srv.URL+"/api/webhooks", strings.NewReader(`{
	  "name":"Audit",
	  "url":"not-a-receiver",
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
	if createRes.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected invalid receiver URL to be rejected, got status %d", createRes.StatusCode)
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

func TestAssetRoutes_CanvasUsesBundledRuntimeGatewayToken(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")
	t.Setenv("DECK_GO_GATEWAY_TOKEN", "stale-config-token")
	t.Setenv("RUNTIME_MODE", "bundled")
	t.Setenv("RUNTIME_BUNDLED_TOKEN", "runtime-gateway-token")

	gatewayServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer runtime-gateway-token" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		if r.URL.Path == "/__openclaw__/a2ui/index.html" {
			w.Header().Set("Content-Type", "text/html")
			_, _ = w.Write([]byte("<html><body>runtime canvas</body></html>"))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer gatewayServer.Close()

	t.Setenv("RUNTIME_BUNDLED_BIND_HOST", "127.0.0.1")
	t.Setenv("RUNTIME_BUNDLED_BIND_PORT", strconv.Itoa(mustPort(t, gatewayServer.URL)))

	srv := httptest.NewServer(New())
	defer srv.Close()

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
	var evaluated struct {
		Evaluations []struct {
			Current float64 `json:"current"`
			Status  string  `json:"status"`
		} `json:"evaluations"`
	}
	if err := json.NewDecoder(evalRes.Body).Decode(&evaluated); err != nil {
		t.Fatal(err)
	}
	if len(evaluated.Evaluations) != 1 || evaluated.Evaluations[0].Current != 12 || evaluated.Evaluations[0].Status != "warn" {
		t.Fatalf("unexpected budget evaluation payload: %#v", evaluated.Evaluations)
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

func TestBudgetRoutes_RejectInvalidThresholds(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")

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
			GatewayURL: "http://127.0.0.1:1",
			AutoStart:  false,
		},
	}
	srv := httptest.NewServer(newTestRouter(store, supervisor, bus))
	defer srv.Close()

	postBudget := func(body string) (*http.Response, map[string]any) {
		t.Helper()
		req, err := http.NewRequest(http.MethodPost, srv.URL+"/api/usage/budget", strings.NewReader(body))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Authorization", "Bearer admin-token")
		req.Header.Set("Content-Type", "application/json")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		var payload map[string]any
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		_ = res.Body.Close()
		return res, payload
	}
	patchBudget := func(ruleID string, body string) (*http.Response, map[string]any) {
		t.Helper()
		req, err := http.NewRequest(http.MethodPatch, srv.URL+"/api/usage/budget/"+ruleID, strings.NewReader(body))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Authorization", "Bearer admin-token")
		req.Header.Set("Content-Type", "application/json")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		var payload map[string]any
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		_ = res.Body.Close()
		return res, payload
	}

	res, payload := postBudget(`{"name":"Bad order","dimension":"cost","warnThreshold":20,"overThreshold":10}`)
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected bad threshold order to be rejected, got %d %#v", res.StatusCode, payload)
	}
	if !strings.Contains(payload["error"].(string), "less than over") {
		t.Fatalf("unexpected bad order payload: %#v", payload)
	}

	res, payload = postBudget(`{"name":"Bad negative","dimension":"cost","warnThreshold":-1,"overThreshold":10}`)
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected negative threshold to be rejected, got %d %#v", res.StatusCode, payload)
	}
	if !strings.Contains(payload["error"].(string), "zero or greater") {
		t.Fatalf("unexpected negative payload: %#v", payload)
	}

	res, payload = postBudget(`{"name":"Valid threshold","dimension":"cost","warnThreshold":10,"overThreshold":20}`)
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("expected valid budget rule, got %d %#v", res.StatusCode, payload)
	}
	ruleID, _ := payload["id"].(string)
	if ruleID == "" {
		t.Fatalf("missing created rule id: %#v", payload)
	}

	res, payload = patchBudget(ruleID, `{"warnThreshold":30}`)
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected invalid patch threshold order, got %d %#v", res.StatusCode, payload)
	}
	if !strings.Contains(payload["error"].(string), "less than over") {
		t.Fatalf("unexpected patch payload: %#v", payload)
	}

	res, payload = patchBudget(ruleID, `{"overThreshold":-1}`)
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected invalid patch threshold value, got %d %#v", res.StatusCode, payload)
	}
	if !strings.Contains(payload["error"].(string), "zero or greater") {
		t.Fatalf("unexpected patch negative payload: %#v", payload)
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
	if !strings.Contains(strings.ToLower(allowHeaders), "x-request-id") {
		t.Fatalf("X-Request-Id not allowed in CORS headers: %q", allowHeaders)
	}
}

func TestRuntimeGatewayRoutes_ExposeReadOnlyStatus(t *testing.T) {
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
	var payload map[string]any
	if err := json.NewDecoder(getRes.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	runtimePayload, ok := payload["runtime"].(map[string]any)
	if !ok || runtimePayload["status"] != "stopped" {
		t.Fatalf("unexpected runtime payload: %#v", payload)
	}
	for _, path := range []string{"/api/runtime/gateway/start", "/api/runtime/gateway/restart", "/api/runtime/gateway/stop"} {
		req, err := http.NewRequest(http.MethodPost, srv.URL+path, nil)
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Authorization", "Bearer admin-token")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		if res.StatusCode != http.StatusNotFound {
			t.Fatalf("%s status = %d, want 404", path, res.StatusCode)
		}
	}
	if supervisor.startCalls != 0 || supervisor.restartCalls != 0 || supervisor.stopCalls != 0 {
		t.Fatalf("HTTP runtime routes should be read-only, got start=%d restart=%d stop=%d", supervisor.startCalls, supervisor.restartCalls, supervisor.stopCalls)
	}
}

func TestRuntimeModeFixtures_ExposeBundledAndRemoteShapes(t *testing.T) {
	for _, tc := range []struct {
		name          string
		mode          string
		caps          facade.Capabilities
		status        facade.RuntimeStatus
		wantGateway   map[string]any
		forbidGateway string
	}{
		{
			name: "bundled",
			mode: "bundled",
			caps: facade.Capabilities{
				Mode:            "bundled",
				Configured:      true,
				EndpointMutable: false,
				SupervisorState: true,
			},
			status: facade.RuntimeStatus{
				Mode:            "bundled",
				PID:             intPtr(2468),
				OwnershipState:  "owned",
				RestartAttempts: 1,
			},
			wantGateway: map[string]any{
				"mode":            "bundled",
				"pid":             float64(2468),
				"ownershipState":  "owned",
				"restartAttempts": float64(1),
			},
			forbidGateway: "lastConnectedAt",
		},
		{
			name: "remote",
			mode: "remote",
			caps: facade.Capabilities{
				Mode:            "remote",
				Configured:      true,
				EndpointMutable: true,
				SupervisorState: false,
			},
			status: facade.RuntimeStatus{
				Mode:            "remote",
				LastConnectedAt: stringPtr("2026-04-28T10:00:00Z"),
				LastError:       stringPtr(""),
				LatencyP50:      intPtr(42),
				TLSVerified:     boolPtr(true),
			},
			wantGateway: map[string]any{
				"mode":            "remote",
				"lastConnectedAt": "2026-04-28T10:00:00Z",
				"lastError":       "",
				"latencyP50":      float64(42),
				"tlsVerified":     true,
			},
			forbidGateway: "pid",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("RUNTIME_MODE", tc.mode)
			t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
			t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")

			store, err := config.NewStore()
			if err != nil {
				t.Fatal(err)
			}
			rt := &fakeRuntimeFacade{caps: tc.caps, status: tc.status}
			srv := httptest.NewServer(newTestRouterWithFacade(store, &testSupervisor{}, events.NewBus(8), rt))
			defer srv.Close()

			capsPayload := getAuthorizedJSON(t, srv.URL+"/api/runtime/capabilities")
			if capsPayload["mode"] != tc.caps.Mode || capsPayload["configured"] != tc.caps.Configured || capsPayload["endpointMutable"] != tc.caps.EndpointMutable || capsPayload["supervisorState"] != tc.caps.SupervisorState {
				t.Fatalf("unexpected capabilities for %s: %#v", tc.mode, capsPayload)
			}

			gatewayPayload := getAuthorizedJSON(t, srv.URL+"/api/runtime/gateway")
			for key, want := range tc.wantGateway {
				if got := gatewayPayload[key]; got != want {
					t.Fatalf("%s gateway field %s = %#v, want %#v in %#v", tc.mode, key, got, want, gatewayPayload)
				}
			}
			if _, exists := gatewayPayload[tc.forbidGateway]; exists {
				t.Fatalf("%s gateway payload included forbidden field %q: %#v", tc.mode, tc.forbidGateway, gatewayPayload)
			}
		})
	}
}

func getAuthorizedJSON(t *testing.T, url string) map[string]any {
	t.Helper()
	req, err := http.NewRequest(http.MethodGet, url, nil)
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
		t.Fatalf("%s status = %d, want 200", url, res.StatusCode)
	}
	var payload map[string]any
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	return payload
}

func intPtr(value int) *int {
	return &value
}

func stringPtr(value string) *string {
	return &value
}

func boolPtr(value bool) *bool {
	return &value
}

func TestRuntimeGatewayStatusAPI_StateMatrix(t *testing.T) {
	cases := []struct {
		name     string
		snapshot openclawrt.ManagedSnapshot
		want     map[string]any
	}{
		{
			name: "connected",
			snapshot: openclawrt.ManagedSnapshot{
				Managed:        true,
				Configured:     true,
				Status:         openclawrt.ManagedStatusRunning,
				Health:         openclawrt.ManagedHealthHealthy,
				GatewayURL:     "ws://127.0.0.1:18789",
				AutoStart:      true,
				OwnershipState: "owned",
			},
			want: map[string]any{
				"status":         "running",
				"health":         "healthy",
				"gatewayUrl":     "ws://127.0.0.1:18789",
				"autoStart":      true,
				"ownershipState": "owned",
			},
		},
		{
			name: "reconnecting",
			snapshot: openclawrt.ManagedSnapshot{
				Managed:         true,
				Configured:      true,
				Status:          openclawrt.ManagedStatusStarting,
				Health:          openclawrt.ManagedHealthUnhealthy,
				GatewayURL:      "ws://127.0.0.1:18789",
				LastError:       "waiting for gateway health",
				FailurePhase:    "runtime",
				AutoStart:       true,
				OwnershipState:  "owned",
				RestartAttempts: 1,
				RestartDelayMs:  250,
			},
			want: map[string]any{
				"status":          "starting",
				"health":          "unhealthy",
				"lastError":       "waiting for gateway health",
				"failurePhase":    "runtime",
				"autoStart":       true,
				"ownershipState":  "owned",
				"restartAttempts": float64(1),
				"restartDelayMs":  float64(250),
			},
		},
		{
			name: "degraded",
			snapshot: openclawrt.ManagedSnapshot{
				Managed:         true,
				Configured:      true,
				Status:          openclawrt.ManagedStatusDegraded,
				Health:          openclawrt.ManagedHealthUnhealthy,
				GatewayURL:      "ws://127.0.0.1:18789",
				LastError:       "health probe failed",
				FailurePhase:    "runtime",
				AutoStart:       true,
				OwnershipState:  "owned",
				RestartAttempts: 2,
				RestartDelayMs:  500,
			},
			want: map[string]any{
				"status":          "degraded",
				"health":          "unhealthy",
				"lastError":       "health probe failed",
				"failurePhase":    "runtime",
				"autoStart":       true,
				"ownershipState":  "owned",
				"restartAttempts": float64(2),
				"restartDelayMs":  float64(500),
			},
		},
		{
			name: "failed",
			snapshot: openclawrt.ManagedSnapshot{
				Managed:      true,
				Configured:   true,
				Status:       openclawrt.ManagedStatusFailed,
				Health:       openclawrt.ManagedHealthUnknown,
				LastError:    "launch failed",
				FailurePhase: "launch",
				AutoStart:    true,
			},
			want: map[string]any{
				"status":       "failed",
				"health":       "unknown",
				"lastError":    "launch failed",
				"failurePhase": "launch",
				"autoStart":    true,
			},
		},
		{
			name: "port-conflict",
			snapshot: openclawrt.ManagedSnapshot{
				Managed:        true,
				Configured:     true,
				Status:         openclawrt.ManagedStatusFailed,
				Health:         openclawrt.ManagedHealthUnknown,
				LastError:      "managed gateway target port already in use by unowned listener",
				FailurePhase:   "preflight",
				AutoStart:      true,
				OwnershipState: "external",
			},
			want: map[string]any{
				"status":         "failed",
				"health":         "unknown",
				"lastError":      "managed gateway target port already in use by unowned listener",
				"failurePhase":   "preflight",
				"autoStart":      true,
				"ownershipState": "external",
			},
		},
		{
			name: "autostart-disabled",
			snapshot: openclawrt.ManagedSnapshot{
				Managed:        true,
				Configured:     true,
				Status:         openclawrt.ManagedStatusStopped,
				Health:         openclawrt.ManagedHealthUnknown,
				AutoStart:      false,
				OwnershipState: "none",
			},
			want: map[string]any{
				"status":         "stopped",
				"health":         "unknown",
				"autoStart":      false,
				"ownershipState": "none",
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
			t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")

			store, err := config.NewStore()
			if err != nil {
				t.Fatal(err)
			}
			bus := events.NewBus(8)
			supervisor := &testSupervisor{snapshot: tc.snapshot}
			srv := httptest.NewServer(newTestRouter(store, supervisor, bus))
			defer srv.Close()

			req, err := http.NewRequest(http.MethodGet, srv.URL+"/api/runtime/gateway", nil)
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
				t.Fatalf("unexpected runtime payload: %#v", payload)
			}
			for key, want := range tc.want {
				got, exists := runtimePayload[key]
				if !exists {
					t.Fatalf("expected runtime field %s in %#v", key, runtimePayload)
				}
				if got != want {
					t.Fatalf("expected runtime field %s=%#v, got %#v in %#v", key, want, got, runtimePayload)
				}
			}
		})
	}
}

func TestBootstrapStatus_ReportsAutostartDisabledState(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")

	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(config.Settings{
		ManagedGateway: config.ManagedGatewaySettings{
			AutoStart:           false,
			AutoStartConfigured: true,
		},
	}); err != nil {
		t.Fatal(err)
	}
	bus := events.NewBus(8)
	supervisor := &testSupervisor{
		snapshot: openclawrt.ManagedSnapshot{
			Managed:    true,
			Configured: true,
			Status:     openclawrt.ManagedStatusStopped,
			Health:     openclawrt.ManagedHealthUnknown,
			AutoStart:  false,
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
	settingsPayload, ok := payload["settings"].(map[string]any)
	if !ok || settingsPayload["autoStart"] != false {
		t.Fatalf("expected bootstrap settings to report autostart disabled, got %#v", payload)
	}
	runtimePayload, ok := payload["runtime"].(map[string]any)
	if !ok || runtimePayload["autoStart"] != false || runtimePayload["status"] != "stopped" {
		t.Fatalf("expected bootstrap runtime to report stopped autostart-disabled state, got %#v", payload)
	}
	gatewayPayload, ok := payload["gateway"].(map[string]any)
	if !ok || gatewayPayload["connected"] != false {
		t.Fatalf("expected bootstrap gateway disconnected while autostart disabled, got %#v", payload)
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

	if _, err := supervisor.Start(context.Background()); err != nil {
		t.Fatal(err)
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

	if _, err := supervisor.Restart(context.Background()); err != nil {
		t.Fatal(err)
	}
	waitForHTTPRuntimeStatus(t, srv.URL, "admin-token", "running")

	if _, err := supervisor.Stop(context.Background()); err != nil {
		t.Fatal(err)
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

	if _, err := supervisor.Start(context.Background()); err != nil {
		t.Fatal(err)
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

	if _, err := supervisor.Stop(context.Background()); err != nil {
		t.Fatal(err)
	}
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
