package server

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway"
	runtimecontrol "github.com/openclaw/openclaw/deck-go/backend/internal/runtime"
)

func registerGatewayRoutes(
	mux interface {
		MethodFunc(string, string, http.HandlerFunc)
	},
	client *gateway.Client,
	store *config.Store,
	supervisor gatewaySupervisor,
) {
	mux.MethodFunc("GET", "/bootstrap/status", func(w http.ResponseWriter, _ *http.Request) {
		effective := store.Effective()
		runtimeSnapshot := supervisor.Snapshot()
		payload := deckapi.DeckGoBootstrapStatusResponse{
			Ok: true,
			Settings: deckapi.DeckGoBootstrapSettingsStatus{
				Path:                     store.Path(),
				AccessTokenConfigured:    effective.AccessToken != "",
				ManagedGatewayConfigured: runtimeSnapshot.Configured,
				CommandConfigured:        effective.ManagedGateway.Command != "",
				GatewayTokenConfigured:   effective.ManagedGateway.GatewayToken != "",
				AutoStart:                effective.ManagedGateway.AutoStart,
			},
			Runtime: toRuntimeStatus(runtimeSnapshot),
			Gateway: deckapi.DeckGoBootstrapGatewayStatus{
				Connected: false,
			},
		}

		if runtimeSnapshot.Status == runtimecontrol.StatusRunning || runtimeSnapshot.Status == runtimecontrol.StatusDegraded {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			_, healthErr := client.Request(ctx, "health", map[string]any{})
			if healthErr != nil {
				payload.Gateway = deckapi.DeckGoBootstrapGatewayStatus{
					Connected: false,
					Error:     healthErr.Error(),
				}
			} else {
				payload.Gateway = deckapi.DeckGoBootstrapGatewayStatus{Connected: true}
				describePayload, err := client.Request(ctx, "gateway.describe", map[string]any{
					"filter":         "all",
					"includeSchemas": false,
				})
				if err != nil {
					payload.Gateway.Error = err.Error()
				} else {
					summary := summarizeDescribe(describePayload)
					payload.Gateway.CapabilitySnapshotAvailable = summary.CapabilitySnapshotAvailable
					payload.Gateway.MethodCount = summary.MethodCount
					payload.Gateway.EventCount = summary.EventCount
					payload.Gateway.SchemaVersion = summary.SchemaVersion
				}
			}
		}

		writeJSON(w, http.StatusOK, payload)
	})

	registerGatewayRPCGet(mux, client, "/gateway/describe", "gateway.describe", map[string]any{
		"filter":         "all",
		"includeSchemas": true,
	})
	registerGatewayRPCGet(mux, client, "/gateway/health", "health", map[string]any{})
	registerGatewayRPCGet(mux, client, "/gateway/status", "status", map[string]any{})

	mux.MethodFunc("POST", "/config/schema-lookup", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Path string `json:"path"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Path == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"ok":    false,
				"error": "path is required",
			})
			return
		}
		callGateway(w, r, client, "config.schema.lookup", map[string]any{"path": body.Path})
	})
}

type describeSummary struct {
	CapabilitySnapshotAvailable bool
	MethodCount                 float64
	EventCount                  float64
	SchemaVersion               string
}

func summarizeDescribe(payload any) describeSummary {
	record, ok := payload.(map[string]any)
	if !ok {
		return describeSummary{}
	}
	summary := describeSummary{CapabilitySnapshotAvailable: true}
	if methods, ok := record["methods"].(map[string]any); ok {
		summary.MethodCount = float64(len(methods))
	}
	if events, ok := record["events"].(map[string]any); ok {
		summary.EventCount = float64(len(events))
	}
	if schemaVersion, ok := record["schemaVersion"].(string); ok {
		summary.SchemaVersion = schemaVersion
	}
	return summary
}

func toRuntimeStatus(snapshot runtimecontrol.Snapshot) deckapi.DeckGoRuntimeGatewayStatus {
	return deckapi.DeckGoRuntimeGatewayStatus{
		Managed:      snapshot.Managed,
		Configured:   snapshot.Configured,
		Status:       string(snapshot.Status),
		FailurePhase: snapshot.FailurePhase,
		Pid:          float64(snapshot.PID),
		StartedAt:    snapshot.StartedAt,
		LastExitAt:   snapshot.LastExitAt,
		LastExitCode: float64(snapshot.LastExitCode),
		Health:       string(snapshot.Health),
		GatewayUrl:   snapshot.GatewayURL,
		LastError:    snapshot.LastError,
		AutoStart:    snapshot.AutoStart,
	}
}

func registerGatewayRPCGet(mux interface {
	MethodFunc(string, string, http.HandlerFunc)
}, client *gateway.Client, path string, method string, params map[string]any) {
	mux.MethodFunc("GET", path, func(w http.ResponseWriter, r *http.Request) {
		callGateway(w, r, client, method, params)
	})
}

func callGateway(w http.ResponseWriter, r *http.Request, client *gateway.Client, method string, params map[string]any) {
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	payload, err := client.Request(ctx, method, params)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]any{
			"ok":     false,
			"method": method,
			"error":  err.Error(),
		})
		return
	}
	writeJSON(w, http.StatusOK, payload)
}
