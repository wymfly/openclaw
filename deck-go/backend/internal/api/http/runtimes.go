package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway"
	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway/generated"
	runtimecoerce "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/coerce"
	runtimeprojection "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/projection"
	runtimeregistry "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/registry"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/runtimeid"
)

const DefaultRuntimeID = runtimeid.Default

type RuntimeQueryProvider interface {
	ListRuntimes(ctx context.Context) ([]runtimeregistry.RuntimeSummary, error)
	GetRuntime(ctx context.Context, runtimeID string) (runtimeregistry.RuntimeSummary, bool, error)
}

type SessionQueryProvider interface {
	ListSessions(ctx context.Context, runtimeID string) ([]deckapi.DeckGoSessionMeta, error)
	GetTimeline(ctx context.Context, runtimeID string, sessionID string) (deckapi.DeckGoSessionDetailResponse, error)
}

type MonitorQueryProvider interface {
	ListActivity(ctx context.Context, runtimeID string, limit int) ([]runtimeprojection.ActivityEventEntry, error)
	ListRuns(ctx context.Context, runtimeID string) ([]runtimeprojection.RunRecord, error)
	GetRun(ctx context.Context, runtimeID string, runID string) (runtimeprojection.RunRecord, []runtimeprojection.RunEventRow, bool, error)
	GetStats(ctx context.Context, runtimeID string) (runtimeprojection.MonitorStats, error)
}

type GatewayDiagnosticProvider interface {
	GetGatewayDescribe(ctx context.Context, runtimeID string, includeSchemas bool) (any, error)
	GetGatewayHealth(ctx context.Context, runtimeID string) (any, error)
	GetGatewayStatus(ctx context.Context, runtimeID string) (any, error)
}

type GatewayRPCProvider interface {
	RequestGateway(ctx context.Context, runtimeID string, method string, params any) (any, error)
}

type GatewayBatchProvider interface {
	GatewayBatch(ctx context.Context, runtimeID string, params generated.GatewayBatchParams) (generated.GatewayBatchResult, error)
}

type GatewayWSProvider interface {
	GatewayUpgradeWS(w http.ResponseWriter, r *http.Request, runtimeID string)
}

func prepareGatewayBatchDispatch(params generated.GatewayBatchParams) (generated.GatewayBatchParams, []int, []map[string]any) {
	dispatch := generated.GatewayBatchParams{Options: params.Options}
	slots := make([]int, 0, len(params.Calls))
	results := make([]map[string]any, len(params.Calls))
	for index, call := range params.Calls {
		method := strings.TrimSpace(call.Method)
		call.Method = method
		if method == "" {
			results[index] = gatewayBatchErrorEntry(call.Id, "INVALID_GATEWAY_METHOD", "Gateway method is required.", nil)
		} else if method == "gateway.batch" {
			results[index] = gatewayBatchErrorEntry(call.Id, "INVALID_REQUEST", "gateway.batch cannot include gateway.batch", nil)
		} else if strings.HasSuffix(method, ".subscribe") || strings.HasSuffix(method, ".unsubscribe") {
			results[index] = gatewayBatchErrorEntry(call.Id, "INVALID_REQUEST", "gateway.batch does not support subscription method: "+method, nil)
		} else if _, ok := generated.TypedMethodNames[method]; !ok {
			results[index] = gatewayBatchErrorEntry(call.Id, "INVALID_GATEWAY_METHOD", "Gateway method is not available through the typed Deck transport.", map[string]any{"method": method})
		} else {
			dispatch.Calls = append(dispatch.Calls, call)
			slots = append(slots, index)
		}
		if results[index] != nil && params.Options.FailFast {
			return dispatch, slots, results[:index+1]
		}
	}
	return dispatch, slots, results
}

func gatewayBatchErrorEntry(id string, code string, message string, details any) map[string]any {
	return map[string]any{
		"id": id,
		"ok": false,
		"error": map[string]any{
			"code":    code,
			"message": message,
			"details": details,
		},
	}
}

func mergeGatewayBatchResults(results []map[string]any, slots []int, payload generated.GatewayBatchResult, failFast bool) []map[string]any {
	for index, entry := range payload.Results {
		if index >= len(slots) {
			break
		}
		slot := slots[index]
		if slot >= len(results) {
			continue
		}
		result := map[string]any{
			"id": entry.Id,
			"ok": entry.Ok,
		}
		if entry.Ok {
			result["result"] = entry.Result
		} else {
			errorEntry := map[string]any{
				"code":    entry.Error.Code,
				"message": entry.Error.Message,
			}
			if entry.Error.Details != nil {
				errorEntry["details"] = entry.Error.Details
			}
			if entry.Error.Retryable {
				errorEntry["retryable"] = entry.Error.Retryable
			}
			if entry.Error.RetryAfterMs > 0 {
				errorEntry["retryAfterMs"] = entry.Error.RetryAfterMs
			}
			result["error"] = errorEntry
		}
		results[slot] = result
	}
	for index, result := range results {
		if result == nil {
			if failFast {
				return results[:index]
			}
			results[index] = gatewayBatchErrorEntry("", "GATEWAY_BATCH_INCOMPLETE", "gateway.batch did not return a result for this call.", nil)
		}
	}
	return results
}

type DeviceProvider interface {
	ListDevices(ctx context.Context, runtimeID string) (any, error)
	GetCurrentDeviceID(runtimeID string) (string, error)
	ApproveDeviceRequest(ctx context.Context, runtimeID string, requestID string) (any, error)
	RejectDeviceRequest(ctx context.Context, runtimeID string, requestID string) (any, error)
	RemoveDevice(ctx context.Context, runtimeID string, deviceID string) (any, error)
	RotateDeviceToken(ctx context.Context, runtimeID string, deviceID string, role string) (any, error)
	RevokeDeviceToken(ctx context.Context, runtimeID string, deviceID string, role string) (any, error)
}

type ConfigProvider interface {
	GetConfig(ctx context.Context, runtimeID string) (any, error)
	PatchConfig(ctx context.Context, runtimeID string, patch map[string]any, baseHash string) (any, error)
	ApplyConfig(ctx context.Context, runtimeID string, raw string, baseHash string) (any, error)
	GetConfigSchema(ctx context.Context, runtimeID string) (any, error)
	LookupConfigSchema(ctx context.Context, runtimeID string, path string) (any, error)
}

type AgentProvider interface {
	ListAgents(ctx context.Context, runtimeID string) (any, error)
	GetAgent(ctx context.Context, runtimeID string, agentID string) (any, bool, error)
	GetAgentIdentity(ctx context.Context, runtimeID string, agentID string) (any, error)
	ListAgentFiles(ctx context.Context, runtimeID string, agentID string) (any, error)
	GetAgentFile(ctx context.Context, runtimeID string, agentID string, name string) (any, error)
	CreateAgent(ctx context.Context, runtimeID string, body map[string]any) (any, error)
	UpdateAgent(ctx context.Context, runtimeID string, agentID string, body map[string]any) (any, error)
	DeleteAgent(ctx context.Context, runtimeID string, agentID string) (any, error)
	SetAgentFile(ctx context.Context, runtimeID string, agentID string, name string, content string) (any, error)
}

type MiscQueryProvider interface {
	ListCommands(ctx context.Context, runtimeID string) (any, error)
	ToolsCatalog(ctx context.Context, runtimeID string, body map[string]any) (any, error)
	GetUsage(ctx context.Context, runtimeID string) (any, error)
	ListCronJobs(ctx context.Context, runtimeID string, params map[string]any) (any, error)
	AddCronJob(ctx context.Context, runtimeID string, body map[string]any) (any, error)
	UpdateCronJob(ctx context.Context, runtimeID string, jobID string, patch map[string]any) (any, error)
	RemoveCronJob(ctx context.Context, runtimeID string, jobID string) (any, error)
	RunCronJob(ctx context.Context, runtimeID string, body map[string]any) (any, error)
	ListCronRuns(ctx context.Context, runtimeID string, params map[string]any) (any, error)
	GetCronStatus(ctx context.Context, runtimeID string) (any, error)
	DiscoverDeckCommands(ctx context.Context, runtimeID string, body map[string]any) (any, error)
	GetDeckToolsEffective(ctx context.Context, runtimeID string, body map[string]any) (any, error)
}

type DeckProvider interface {
	ListDeckPlugins(ctx context.Context, runtimeID string, params map[string]any) (any, error)
	GetDeckAgentDetail(ctx context.Context, runtimeID string, agentID string) (any, error)
	RunDeckAgentAction(ctx context.Context, runtimeID string, action string, body map[string]any) (any, error)
	ListDeckIdentity(ctx context.Context, runtimeID string) (any, error)
	LinkDeckIdentity(ctx context.Context, runtimeID string, body map[string]any) (any, error)
	UnlinkDeckIdentity(ctx context.Context, runtimeID string, body map[string]any) (any, error)
	ListDeckRouting(ctx context.Context, runtimeID string, params map[string]any) (any, error)
	AddDeckRouting(ctx context.Context, runtimeID string, body map[string]any) (any, error)
	RemoveDeckRouting(ctx context.Context, runtimeID string, body map[string]any) (any, error)
	ValidateDeckRouting(ctx context.Context, runtimeID string, body map[string]any) (any, error)
	SimulateDeckRouting(ctx context.Context, runtimeID string, body map[string]any) (any, error)
	ListDeckSubagents(ctx context.Context, runtimeID string, params map[string]any) (any, error)
	KillDeckSubagent(ctx context.Context, runtimeID string, body map[string]any) (any, error)
	GetDeckSubagentLineage(ctx context.Context, runtimeID string, body map[string]any) (any, error)
	SteerDeckSubagent(ctx context.Context, runtimeID string, body map[string]any) (any, error)
	ListDeckThreads(ctx context.Context, runtimeID string, params map[string]any) (any, error)
}

type ApprovalProvider interface {
	GetApprovals(ctx context.Context, runtimeID string) (any, error)
	ResolveApproval(ctx context.Context, runtimeID string, body map[string]any) (any, error)
	ListPendingApprovals(ctx context.Context, runtimeID string) (any, error)
	SetApprovalPolicy(ctx context.Context, runtimeID string, body map[string]any) (any, error)
	ListPluginApprovals(ctx context.Context, runtimeID string) (any, error)
	ResolvePluginApproval(ctx context.Context, runtimeID string, body map[string]any) (any, error)
}

type MemoryProvider interface {
	GetMemoryHealth(ctx context.Context, runtimeID string) (any, error)
	RunMemoryDreamAction(ctx context.Context, runtimeID string, action string) (any, error)
}

type NodeProvider interface {
	ListNodes(ctx context.Context, runtimeID string) (any, error)
	RunNodeAction(ctx context.Context, runtimeID string, action string, body map[string]any) (any, error)
	ListNodePairing(ctx context.Context, runtimeID string) (any, error)
	RunNodePairAction(ctx context.Context, runtimeID string, action string, body map[string]any) (any, error)
}

type SkillProvider interface {
	ListSkills(ctx context.Context, runtimeID string, params map[string]any) (any, error)
	UpdateSkill(ctx context.Context, runtimeID string, skillKey string, body map[string]any) (any, error)
	InstallSkill(ctx context.Context, runtimeID string, body map[string]any) (any, error)
	RunSkillsHubAction(ctx context.Context, runtimeID string, body map[string]any) (any, error)
	UpdateClawhubSkill(ctx context.Context, runtimeID string, body map[string]any) (any, error)
}

type ModelProvider interface {
	ListModels(ctx context.Context, runtimeID string) (any, error)
	GetModelAuthOverview(ctx context.Context, runtimeID string) (any, error)
	ListModelCatalogProviders(ctx context.Context, runtimeID string) (any, error)
	ListConfiguredModels(ctx context.Context, runtimeID string) (any, error)
	ProbeModelAuth(ctx context.Context, runtimeID string, body map[string]any) (any, error)
}

type ChannelProvider interface {
	GetChannels(ctx context.Context, runtimeID string, params map[string]any) (any, error)
	LogoutChannel(ctx context.Context, runtimeID string, channelID string) (any, error)
	TestChannel(ctx context.Context, runtimeID string, channelID string) (any, error)
	GetChannelThroughput(ctx context.Context, runtimeID string, channelID string) (any, error)
	PatchChannel(ctx context.Context, runtimeID string, channelID string, patch map[string]any) (any, error)
}

type CommandProvider interface {
	CreateSession(ctx context.Context, runtimeID string, agentID string, message string, model string, label string, parentSessionKey string) (deckapi.DeckGoSessionCreateResponse, error)
	SendMessage(ctx context.Context, runtimeID string, sessionID string, text string, attachments []map[string]any, idempotencyKey string) error
	AbortRun(ctx context.Context, runtimeID string, runID string, idempotencyKey string) error
	CompactSession(ctx context.Context, runtimeID string, sessionID string, idempotencyKey string) error
	DeleteSession(ctx context.Context, runtimeID string, sessionID string, idempotencyKey string) error
	ResetSession(ctx context.Context, runtimeID string, sessionID string, reason string, idempotencyKey string) error
	ClearSession(ctx context.Context, runtimeID string, sessionID string, idempotencyKey string) error
	PatchSession(ctx context.Context, runtimeID string, sessionID string, patch map[string]any, idempotencyKey string) error
}

func MountRoutes(r chi.Router, runtimes RuntimeQueryProvider, sessions SessionQueryProvider, monitor MonitorQueryProvider, diagnostics GatewayDiagnosticProvider, devices DeviceProvider, config ConfigProvider, agents AgentProvider, misc MiscQueryProvider, deck DeckProvider, approvals ApprovalProvider, memory MemoryProvider, nodes NodeProvider, skills SkillProvider, models ModelProvider, channels ChannelProvider, commands CommandProvider) {
	r.Get("/runtimes", func(w http.ResponseWriter, req *http.Request) {
		requestID := nextRequestID()
		items, err := runtimes.ListRuntimes(req.Context())
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{
				"error": map[string]any{
					"code":    "RUNTIME_QUERY_FAILED",
					"message": err.Error(),
					"details": nil,
				},
				"requestId": requestID,
			})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"runtimes":  items,
			"requestId": requestID,
		})
	})

	r.Get("/runtimes/{runtimeId}", func(w http.ResponseWriter, r *http.Request) {
		requestID := nextRequestID()
		runtimeID := chi.URLParam(r, "runtimeId")
		item, ok, err := runtimes.GetRuntime(r.Context(), runtimeID)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{
				"error": map[string]any{
					"code":    "RUNTIME_QUERY_FAILED",
					"message": err.Error(),
					"details": nil,
				},
				"requestId": requestID,
			})
			return
		}
		if !ok {
			writeJSON(w, http.StatusNotFound, map[string]any{
				"error": map[string]any{
					"code":    "RUNTIME_NOT_FOUND",
					"message": "Runtime was not found.",
					"details": nil,
				},
				"requestId": requestID,
			})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"runtime":   item,
			"requestId": requestID,
		})
	})

	if sessions != nil {
		r.Get("/runtimes/{runtimeId}/sessions", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{
					"error": map[string]any{
						"code":    "RUNTIME_NOT_FOUND",
						"message": "Runtime was not found.",
						"details": nil,
					},
					"requestId": requestID,
				})
				return
			}
			items, err := sessions.ListSessions(r.Context(), runtimeID)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{
					"error": map[string]any{
						"code":    "RUNTIME_QUERY_FAILED",
						"message": err.Error(),
						"details": nil,
					},
					"requestId": requestID,
				})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{
				"runtimeId": runtimeID,
				"sessions":  items,
				"requestId": requestID,
			})
		})

		r.Get("/runtimes/{runtimeId}/sessions/{sessionId}/timeline", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{
					"error": map[string]any{
						"code":    "RUNTIME_NOT_FOUND",
						"message": "Runtime was not found.",
						"details": nil,
					},
					"requestId": requestID,
				})
				return
			}
			sessionID := chi.URLParam(r, "sessionId")
			detail, err := sessions.GetTimeline(r.Context(), runtimeID, sessionID)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{
					"error": map[string]any{
						"code":    "RUNTIME_QUERY_FAILED",
						"message": err.Error(),
						"details": nil,
					},
					"requestId": requestID,
				})
				return
			}
			snapshot := runtimeprojection.BuildTimelineSnapshot(runtimeID, sessionID, detail)
			writeJSON(w, http.StatusOK, map[string]any{
				"runtimeId": snapshot.RuntimeID,
				"sessionId": snapshot.SessionID,
				"timeline":  snapshot.Timeline,
				"activeRun": snapshot.ActiveRun,
				"requestId": requestID,
			})
		})
	}

	if monitor != nil {
		r.Get("/runtimes/{runtimeId}/runs", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{
					"error": map[string]any{
						"code":    "RUNTIME_NOT_FOUND",
						"message": "Runtime was not found.",
						"details": nil,
					},
					"requestId": requestID,
				})
				return
			}
			items, err := monitor.ListRuns(r.Context(), runtimeID)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{
					"error": map[string]any{
						"code":    "RUNTIME_QUERY_FAILED",
						"message": err.Error(),
						"details": nil,
					},
					"requestId": requestID,
				})
				return
			}
			page, nextCursor := filterMonitorRuns(items, r.URL.Query())
			writeJSON(w, http.StatusOK, map[string]any{
				"runtimeId":  runtimeID,
				"runs":       page,
				"nextCursor": nextCursor,
				"requestId":  requestID,
			})
		})

		r.Get("/runtimes/{runtimeId}/activity", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{
					"error": map[string]any{
						"code":    "RUNTIME_NOT_FOUND",
						"message": "Runtime was not found.",
						"details": nil,
					},
					"requestId": requestID,
				})
				return
			}
			limit := 100
			if raw := r.URL.Query().Get("limit"); raw != "" {
				if parsed, err := strconv.Atoi(raw); err == nil {
					if parsed < 1 {
						parsed = 1
					}
					if parsed > 500 {
						parsed = 500
					}
					limit = parsed
				}
			}
			items, err := monitor.ListActivity(r.Context(), runtimeID, limit)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{
					"error": map[string]any{
						"code":    "RUNTIME_QUERY_FAILED",
						"message": err.Error(),
						"details": nil,
					},
					"requestId": requestID,
				})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{
				"runtimeId": runtimeID,
				"events":    items,
				"requestId": requestID,
			})
		})

		r.Get("/runtimes/{runtimeId}/runs/{runId}", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{
					"error": map[string]any{
						"code":    "RUNTIME_NOT_FOUND",
						"message": "Runtime was not found.",
						"details": nil,
					},
					"requestId": requestID,
				})
				return
			}
			runID := chi.URLParam(r, "runId")
			run, rows, ok, err := monitor.GetRun(r.Context(), runtimeID, runID)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{
					"error": map[string]any{
						"code":    "RUNTIME_QUERY_FAILED",
						"message": err.Error(),
						"details": nil,
					},
					"requestId": requestID,
				})
				return
			}
			if !ok {
				writeJSON(w, http.StatusNotFound, map[string]any{
					"error": map[string]any{
						"code":    "RUN_NOT_FOUND",
						"message": "Run was not found.",
						"details": nil,
					},
					"requestId": requestID,
				})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{
				"runtimeId": runtimeID,
				"runId":     runID,
				"run":       run,
				"events":    rows,
				"requestId": requestID,
			})
		})

		r.Get("/runtimes/{runtimeId}/stats", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{
					"error": map[string]any{
						"code":    "RUNTIME_NOT_FOUND",
						"message": "Runtime was not found.",
						"details": nil,
					},
					"requestId": requestID,
				})
				return
			}
			stats, err := monitor.GetStats(r.Context(), runtimeID)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{
					"error": map[string]any{
						"code":    "RUNTIME_QUERY_FAILED",
						"message": err.Error(),
						"details": nil,
					},
					"requestId": requestID,
				})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{
				"runtimeId": runtimeID,
				"stats":     stats,
				"requestId": requestID,
			})
		})
	}

	if diagnostics != nil {
		r.Get("/runtimes/{runtimeId}/gateway/describe", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{
					"error": map[string]any{
						"code":    "RUNTIME_NOT_FOUND",
						"message": "Runtime was not found.",
						"details": nil,
					},
					"requestId": requestID,
				})
				return
			}
			includeSchemas := r.URL.Query().Get("includeSchemas") != "false"
			payload, err := diagnostics.GetGatewayDescribe(r.Context(), runtimeID, includeSchemas)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{
					"error": map[string]any{
						"code":    "RUNTIME_QUERY_FAILED",
						"message": err.Error(),
						"details": nil,
					},
					"requestId": requestID,
				})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{
				"runtimeId": runtimeID,
				"describe":  payload,
				"requestId": requestID,
			})
		})

		r.Get("/runtimes/{runtimeId}/gateway/health", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{
					"error": map[string]any{
						"code":    "RUNTIME_NOT_FOUND",
						"message": "Runtime was not found.",
						"details": nil,
					},
					"requestId": requestID,
				})
				return
			}
			payload, err := diagnostics.GetGatewayHealth(r.Context(), runtimeID)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{
					"error": map[string]any{
						"code":    "RUNTIME_QUERY_FAILED",
						"message": err.Error(),
						"details": nil,
					},
					"requestId": requestID,
				})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{
				"runtimeId": runtimeID,
				"health":    payload,
				"requestId": requestID,
			})
		})

		r.Get("/runtimes/{runtimeId}/gateway/status", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{
					"error": map[string]any{
						"code":    "RUNTIME_NOT_FOUND",
						"message": "Runtime was not found.",
						"details": nil,
					},
					"requestId": requestID,
				})
				return
			}
			payload, err := diagnostics.GetGatewayStatus(r.Context(), runtimeID)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{
					"error": map[string]any{
						"code":    "RUNTIME_QUERY_FAILED",
						"message": err.Error(),
						"details": nil,
					},
					"requestId": requestID,
				})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{
				"runtimeId": runtimeID,
				"status":    payload,
				"requestId": requestID,
			})
		})

		if rpc, ok := diagnostics.(GatewayRPCProvider); ok {
			r.Post("/runtimes/{runtimeId}/gateway/rpc", func(w http.ResponseWriter, r *http.Request) {
				requestID := strings.TrimSpace(r.Header.Get("X-Request-Id"))
				if requestID == "" {
					requestID = nextRequestID()
				}
				runtimeID := chi.URLParam(r, "runtimeId")
				if runtimeID != DefaultRuntimeID {
					writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
					return
				}
				var body struct {
					Method    string `json:"method"`
					Params    any    `json:"params"`
					TimeoutMs int    `json:"timeoutMs"`
				}
				if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
					writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_BODY", "message": "Request body is invalid.", "details": nil}, "requestId": requestID})
					return
				}
				method := strings.TrimSpace(body.Method)
				if method == "" {
					writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_GATEWAY_METHOD", "message": "Gateway method is required.", "details": nil}, "requestId": requestID})
					return
				}
				if _, ok := generated.TypedMethodNames[method]; !ok {
					writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_GATEWAY_METHOD", "message": "Gateway method is not available through the typed Deck transport.", "details": map[string]any{"method": method}}, "requestId": requestID})
					return
				}
				params := body.Params
				if params == nil {
					params = map[string]any{}
				}
				ctx := r.Context()
				if body.TimeoutMs > 0 {
					var cancel context.CancelFunc
					ctx, cancel = context.WithTimeout(ctx, time.Duration(body.TimeoutMs)*time.Millisecond)
					defer cancel()
				}
				payload, err := rpc.RequestGateway(ctx, runtimeID, method, params)
				if err != nil {
					status := http.StatusBadGateway
					code := "GATEWAY_RPC_FAILED"
					details := map[string]any(nil)
					var errCode *gateway.ErrCode
					if errors.As(err, &errCode) {
						code = errCode.Code
						details = errCode.Details
						if errors.Is(err, gateway.ErrScopeDenied) {
							status = http.StatusForbidden
						}
					}
					writeJSON(w, status, map[string]any{"error": map[string]any{"code": code, "message": err.Error(), "details": details}, "requestId": requestID})
					return
				}
				writeJSON(w, http.StatusOK, map[string]any{"runtimeId": runtimeID, "requestId": requestID, "result": payload})
			})
		}
		if batch, ok := diagnostics.(GatewayBatchProvider); ok {
			r.Post("/runtimes/{runtimeId}/gateway/batch", func(w http.ResponseWriter, r *http.Request) {
				requestID := strings.TrimSpace(r.Header.Get("X-Request-Id"))
				if requestID == "" {
					requestID = nextRequestID()
				}
				runtimeID := chi.URLParam(r, "runtimeId")
				if runtimeID != DefaultRuntimeID {
					writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
					return
				}
				var body generated.GatewayBatchParams
				if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
					writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_BODY", "message": "Request body is invalid.", "details": nil}, "requestId": requestID})
					return
				}
				if len(body.Calls) == 0 {
					writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_REQUEST", "message": "gateway.batch requires at least one call.", "details": nil}, "requestId": requestID})
					return
				}
				if len(body.Calls) > 32 {
					writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_REQUEST", "message": "gateway.batch accepts at most 32 calls.", "details": map[string]any{"max": 32}}, "requestId": requestID})
					return
				}

				dispatchParams, slots, results := prepareGatewayBatchDispatch(body)
				if len(dispatchParams.Calls) > 0 {
					payload, err := batch.GatewayBatch(r.Context(), runtimeID, dispatchParams)
					if err != nil {
						status := http.StatusBadGateway
						code := "GATEWAY_BATCH_FAILED"
						details := map[string]any(nil)
						var errCode *gateway.ErrCode
						if errors.As(err, &errCode) {
							code = errCode.Code
							details = errCode.Details
							if errors.Is(err, gateway.ErrScopeDenied) {
								status = http.StatusForbidden
							}
						}
						writeJSON(w, status, map[string]any{"error": map[string]any{"code": code, "message": err.Error(), "details": details}, "requestId": requestID})
						return
					}
					results = mergeGatewayBatchResults(results, slots, payload, body.Options.FailFast)
				}
				writeJSON(w, http.StatusOK, map[string]any{"runtimeId": runtimeID, "requestId": requestID, "results": results})
			})
		}
		if ws, ok := diagnostics.(GatewayWSProvider); ok {
			r.Get("/runtimes/{runtimeId}/gateway/ws", func(w http.ResponseWriter, r *http.Request) {
				runtimeID := chi.URLParam(r, "runtimeId")
				if runtimeID != DefaultRuntimeID {
					writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": nextRequestID()})
					return
				}
				ws.GatewayUpgradeWS(w, r, runtimeID)
			})
		}
	}

	if devices != nil {
		r.Get("/runtimes/{runtimeId}/devices", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{
					"error": map[string]any{
						"code":    "RUNTIME_NOT_FOUND",
						"message": "Runtime was not found.",
						"details": nil,
					},
					"requestId": requestID,
				})
				return
			}
			payload, err := devices.ListDevices(r.Context(), runtimeID)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{
					"error": map[string]any{
						"code":    "RUNTIME_QUERY_FAILED",
						"message": err.Error(),
						"details": nil,
					},
					"requestId": requestID,
				})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{
				"runtimeId": runtimeID,
				"devices":   payload,
				"requestId": requestID,
			})
		})

		r.Get("/runtimes/{runtimeId}/devices/self", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{
					"error": map[string]any{
						"code":    "RUNTIME_NOT_FOUND",
						"message": "Runtime was not found.",
						"details": nil,
					},
					"requestId": requestID,
				})
				return
			}
			deviceID, err := devices.GetCurrentDeviceID(runtimeID)
			if err != nil {
				deviceID = ""
			}
			writeJSON(w, http.StatusOK, map[string]any{
				"runtimeId": runtimeID,
				"deviceId": func() any {
					if deviceID == "" {
						return nil
					}
					return deviceID
				}(),
				"requestId": requestID,
			})
		})

		postDeviceBody := func(r *http.Request) (map[string]any, error) {
			var body map[string]any
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				return nil, err
			}
			if body == nil {
				body = map[string]any{}
			}
			return body, nil
		}

		r.Post("/runtimes/{runtimeId}/devices/approve", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			body, err := postDeviceBody(r)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_BODY", "message": "Request body is invalid.", "details": nil}, "requestId": requestID})
				return
			}
			requestIDParam, _ := body["requestId"].(string)
			payload, err := devices.ApproveDeviceRequest(r.Context(), runtimeID, requestIDParam)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Post("/runtimes/{runtimeId}/devices/reject", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			body, err := postDeviceBody(r)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_BODY", "message": "Request body is invalid.", "details": nil}, "requestId": requestID})
				return
			}
			requestIDParam, _ := body["requestId"].(string)
			payload, err := devices.RejectDeviceRequest(r.Context(), runtimeID, requestIDParam)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Post("/runtimes/{runtimeId}/devices/remove", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			body, err := postDeviceBody(r)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_BODY", "message": "Request body is invalid.", "details": nil}, "requestId": requestID})
				return
			}
			deviceID, _ := body["deviceId"].(string)
			payload, err := devices.RemoveDevice(r.Context(), runtimeID, deviceID)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Post("/runtimes/{runtimeId}/devices/token/rotate", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			body, err := postDeviceBody(r)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_BODY", "message": "Request body is invalid.", "details": nil}, "requestId": requestID})
				return
			}
			deviceID, _ := body["deviceId"].(string)
			role, _ := body["role"].(string)
			payload, err := devices.RotateDeviceToken(r.Context(), runtimeID, deviceID, role)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Post("/runtimes/{runtimeId}/devices/token/revoke", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			body, err := postDeviceBody(r)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_BODY", "message": "Request body is invalid.", "details": nil}, "requestId": requestID})
				return
			}
			deviceID, _ := body["deviceId"].(string)
			role, _ := body["role"].(string)
			payload, err := devices.RevokeDeviceToken(r.Context(), runtimeID, deviceID, role)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})
	}

	if config != nil {
		r.Get("/runtimes/{runtimeId}/config", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			payload, err := config.GetConfig(r.Context(), runtimeID)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "RUNTIME_QUERY_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"runtimeId": runtimeID, "config": payload, "requestId": requestID})
		})

		r.Post("/runtimes/{runtimeId}/config:patch", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			var body struct {
				Patch    map[string]any `json:"patch"`
				BaseHash string         `json:"baseHash"`
			}
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_BODY", "message": "Request body is invalid.", "details": nil}, "requestId": requestID})
				return
			}
			if body.Patch == nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_BODY", "message": "patch object is required.", "details": nil}, "requestId": requestID})
				return
			}
			payload, err := config.PatchConfig(r.Context(), runtimeID, body.Patch, body.BaseHash)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Post("/runtimes/{runtimeId}/config:apply", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			var body struct {
				Raw      string `json:"raw"`
				BaseHash string `json:"baseHash"`
			}
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_BODY", "message": "Request body is invalid.", "details": nil}, "requestId": requestID})
				return
			}
			if body.Raw == "" {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_BODY", "message": "raw config is required.", "details": nil}, "requestId": requestID})
				return
			}
			payload, err := config.ApplyConfig(r.Context(), runtimeID, body.Raw, body.BaseHash)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Get("/runtimes/{runtimeId}/config/schema", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			payload, err := config.GetConfigSchema(r.Context(), runtimeID)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "RUNTIME_QUERY_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"runtimeId": runtimeID, "schema": payload, "requestId": requestID})
		})

		r.Post("/runtimes/{runtimeId}/config/schema-lookup", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			var body struct {
				Path string `json:"path"`
			}
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_BODY", "message": "Request body is invalid.", "details": nil}, "requestId": requestID})
				return
			}
			payload, err := config.LookupConfigSchema(r.Context(), runtimeID, body.Path)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "RUNTIME_QUERY_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})
	}

	if agents != nil {
		r.Post("/runtimes/{runtimeId}/agents", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			var body map[string]any
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_BODY", "message": "Request body is invalid.", "details": nil}, "requestId": requestID})
				return
			}
			if body == nil {
				body = map[string]any{}
			}
			if strings.TrimSpace(runtimecoerce.String(body["name"], "")) == "" {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_BODY", "message": "name is required", "details": nil}, "requestId": requestID})
				return
			}
			payload, err := agents.CreateAgent(r.Context(), runtimeID, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Get("/runtimes/{runtimeId}/agents/{agentId}", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			agentID := chi.URLParam(r, "agentId")
			payload, ok, err := agents.GetAgent(r.Context(), runtimeID, agentID)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "RUNTIME_QUERY_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			if !ok {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "AGENT_NOT_FOUND", "message": "Agent was not found.", "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"runtimeId": runtimeID, "agentId": agentID, "payload": payload, "requestId": requestID})
		})

		r.Patch("/runtimes/{runtimeId}/agents/{agentId}", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			agentID := chi.URLParam(r, "agentId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			var body map[string]any
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_BODY", "message": "Request body is invalid.", "details": nil}, "requestId": requestID})
				return
			}
			if body == nil {
				body = map[string]any{}
			}
			payload, err := agents.UpdateAgent(r.Context(), runtimeID, agentID, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Delete("/runtimes/{runtimeId}/agents/{agentId}", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			agentID := chi.URLParam(r, "agentId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			payload, err := agents.DeleteAgent(r.Context(), runtimeID, agentID)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Get("/runtimes/{runtimeId}/agents/{agentId}/identity", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			agentID := chi.URLParam(r, "agentId")
			payload, err := agents.GetAgentIdentity(r.Context(), runtimeID, agentID)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "RUNTIME_QUERY_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"runtimeId": runtimeID, "agentId": agentID, "payload": payload, "requestId": requestID})
		})

		r.Get("/runtimes/{runtimeId}/agents/{agentId}/files", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			agentID := chi.URLParam(r, "agentId")
			payload, err := agents.ListAgentFiles(r.Context(), runtimeID, agentID)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "RUNTIME_QUERY_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"runtimeId": runtimeID, "agentId": agentID, "payload": payload, "requestId": requestID})
		})

		r.Post("/runtimes/{runtimeId}/agents/{agentId}/files", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			agentID := chi.URLParam(r, "agentId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			var body map[string]any
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_BODY", "message": "Request body is invalid.", "details": nil}, "requestId": requestID})
				return
			}
			if body == nil {
				body = map[string]any{}
			}
			name := strings.TrimSpace(runtimecoerce.String(body["name"], ""))
			content, ok := body["content"].(string)
			if name == "" {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_BODY", "message": "name is required", "details": nil}, "requestId": requestID})
				return
			}
			if !ok {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_BODY", "message": "content is required", "details": nil}, "requestId": requestID})
				return
			}
			payload, err := agents.SetAgentFile(r.Context(), runtimeID, agentID, name, content)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Get("/runtimes/{runtimeId}/agents/{agentId}/files/*", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			agentID := chi.URLParam(r, "agentId")
			fileName := chi.URLParam(r, "*")
			payload, err := agents.GetAgentFile(r.Context(), runtimeID, agentID, fileName)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "RUNTIME_QUERY_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"runtimeId": runtimeID, "agentId": agentID, "name": fileName, "payload": payload, "requestId": requestID})
		})
	}

	if misc != nil {
		r.Get("/runtimes/{runtimeId}/commands", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			payload, err := misc.ListCommands(r.Context(), runtimeID)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "RUNTIME_QUERY_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"runtimeId": runtimeID, "payload": payload, "requestId": requestID})
		})

		r.Post("/runtimes/{runtimeId}/tools/catalog", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			var body map[string]any
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err.Error() != "EOF" {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_BODY", "message": "Request body is invalid.", "details": nil}, "requestId": requestID})
				return
			}
			if body == nil {
				body = map[string]any{}
			}
			payload, err := misc.ToolsCatalog(r.Context(), runtimeID, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "RUNTIME_QUERY_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"runtimeId": runtimeID, "payload": payload, "requestId": requestID})
		})

		r.Get("/runtimes/{runtimeId}/usage", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			payload, err := misc.GetUsage(r.Context(), runtimeID)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "RUNTIME_QUERY_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"runtimeId": runtimeID, "payload": payload, "requestId": requestID})
		})

		r.Get("/runtimes/{runtimeId}/cron", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			params := map[string]any{}
			query := r.URL.Query()
			for _, key := range []string{"query", "enabled", "sortBy", "sortDir"} {
				if value := query.Get(key); value != "" {
					params[key] = value
				}
			}
			for _, key := range []string{"limit", "offset"} {
				if value := query.Get(key); value != "" {
					parsed, err := strconv.Atoi(value)
					if err != nil {
						writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_QUERY", "message": "Query parameter is invalid.", "details": map[string]any{"parameter": key}}, "requestId": requestID})
						return
					}
					params[key] = parsed
				}
			}
			if includeDisabled := query.Get("includeDisabled"); includeDisabled != "" {
				params["includeDisabled"] = includeDisabled == "true"
			}
			payload, err := misc.ListCronJobs(r.Context(), runtimeID, params)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "RUNTIME_QUERY_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"runtimeId": runtimeID, "payload": payload, "requestId": requestID})
		})

		r.Post("/runtimes/{runtimeId}/cron", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			var body map[string]any
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_BODY", "message": "Request body is invalid.", "details": nil}, "requestId": requestID})
				return
			}
			if body == nil {
				body = map[string]any{}
			}
			payload, err := misc.AddCronJob(r.Context(), runtimeID, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Patch("/runtimes/{runtimeId}/cron/{jobId}", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			jobID := chi.URLParam(r, "jobId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			var patch map[string]any
			if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_BODY", "message": "Request body is invalid.", "details": nil}, "requestId": requestID})
				return
			}
			if patch == nil {
				patch = map[string]any{}
			}
			payload, err := misc.UpdateCronJob(r.Context(), runtimeID, jobID, patch)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Delete("/runtimes/{runtimeId}/cron/{jobId}", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			jobID := chi.URLParam(r, "jobId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			payload, err := misc.RemoveCronJob(r.Context(), runtimeID, jobID)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Post("/runtimes/{runtimeId}/cron/{jobId}/run", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			jobID := chi.URLParam(r, "jobId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			var body map[string]any
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err.Error() != "EOF" {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_BODY", "message": "Request body is invalid.", "details": nil}, "requestId": requestID})
				return
			}
			if body == nil {
				body = map[string]any{}
			}
			body["id"] = jobID
			payload, err := misc.RunCronJob(r.Context(), runtimeID, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Get("/runtimes/{runtimeId}/cron/{jobId}/runs", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			jobID := chi.URLParam(r, "jobId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			params := map[string]any{
				"scope": "job",
				"jobId": jobID,
			}
			query := r.URL.Query()
			for _, key := range []string{"limit", "offset"} {
				if value := query.Get(key); value != "" {
					parsed, err := strconv.Atoi(value)
					if err != nil {
						writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_QUERY", "message": "Query parameter is invalid.", "details": map[string]any{"parameter": key}}, "requestId": requestID})
						return
					}
					params[key] = parsed
				}
			}
			if sortDir := query.Get("sortDir"); sortDir != "" {
				params["sortDir"] = sortDir
			}
			if statuses := query.Get("statuses"); statuses != "" {
				params["statuses"] = strings.Split(statuses, ",")
			}
			payload, err := misc.ListCronRuns(r.Context(), runtimeID, params)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "RUNTIME_QUERY_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"runtimeId": runtimeID, "payload": payload, "requestId": requestID})
		})

		r.Get("/runtimes/{runtimeId}/cron/status", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			payload, err := misc.GetCronStatus(r.Context(), runtimeID)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "RUNTIME_QUERY_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"runtimeId": runtimeID, "payload": payload, "requestId": requestID})
		})

		r.Post("/runtimes/{runtimeId}/deck/commands/discover", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			var body map[string]any
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err.Error() != "EOF" {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_BODY", "message": "Request body is invalid.", "details": nil}, "requestId": requestID})
				return
			}
			if body == nil {
				body = map[string]any{}
			}
			payload, err := misc.DiscoverDeckCommands(r.Context(), runtimeID, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "RUNTIME_QUERY_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"runtimeId": runtimeID, "payload": payload, "requestId": requestID})
		})

		r.Post("/runtimes/{runtimeId}/deck/tools-effective", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			var body map[string]any
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err.Error() != "EOF" {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_BODY", "message": "Request body is invalid.", "details": nil}, "requestId": requestID})
				return
			}
			if body == nil {
				body = map[string]any{}
			}
			payload, err := misc.GetDeckToolsEffective(r.Context(), runtimeID, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "RUNTIME_QUERY_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"runtimeId": runtimeID, "payload": payload, "requestId": requestID})
		})
	}

	if deck != nil {
		readBody := func(r *http.Request) (map[string]any, error) {
			var body map[string]any
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				return nil, err
			}
			if body == nil {
				body = map[string]any{}
			}
			return body, nil
		}

		r.Get("/runtimes/{runtimeId}/deck/plugins", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			params := map[string]any{}
			if capability := r.URL.Query().Get("capability"); capability != "" {
				params["capability"] = capability
			}
			payload, err := deck.ListDeckPlugins(r.Context(), runtimeID, params)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "RUNTIME_QUERY_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"runtimeId": runtimeID, "payload": payload, "requestId": requestID})
		})

		r.Get("/runtimes/{runtimeId}/deck/agents", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			agentID := strings.TrimSpace(r.URL.Query().Get("agentId"))
			if agentID == "" {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_QUERY", "message": "agentId is required", "details": nil}, "requestId": requestID})
				return
			}
			payload, err := deck.GetDeckAgentDetail(r.Context(), runtimeID, agentID)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "RUNTIME_QUERY_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Post("/runtimes/{runtimeId}/deck/agents", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			var body map[string]any
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_BODY", "message": "Request body is invalid.", "details": nil}, "requestId": requestID})
				return
			}
			if body == nil {
				body = map[string]any{}
			}
			action := strings.TrimSpace(runtimecoerce.String(body["action"], ""))
			delete(body, "action")
			payload, err := deck.RunDeckAgentAction(r.Context(), runtimeID, action, body)
			if err == http.ErrNotSupported {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_ACTION", "message": "Deck agent action is invalid.", "details": nil}, "requestId": requestID})
				return
			}
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Get("/runtimes/{runtimeId}/deck/identity", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			payload, err := deck.ListDeckIdentity(r.Context(), runtimeID)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "RUNTIME_QUERY_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"runtimeId": runtimeID, "payload": payload, "requestId": requestID})
		})

		r.Post("/runtimes/{runtimeId}/deck/identity", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			body, err := readBody(r)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_BODY", "message": "Request body is invalid.", "details": nil}, "requestId": requestID})
				return
			}
			action, _ := body["action"].(string)
			delete(body, "action")
			var payload any
			switch action {
			case "link":
				payload, err = deck.LinkDeckIdentity(r.Context(), runtimeID, body)
			case "unlink":
				payload, err = deck.UnlinkDeckIdentity(r.Context(), runtimeID, body)
			default:
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_ACTION", "message": "Deck identity action is invalid.", "details": nil}, "requestId": requestID})
				return
			}
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Get("/runtimes/{runtimeId}/deck/routing", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			params := map[string]any{}
			for _, key := range []string{"agentId", "channel", "accountId"} {
				if value := r.URL.Query().Get(key); value != "" {
					params[key] = value
				}
			}
			payload, err := deck.ListDeckRouting(r.Context(), runtimeID, params)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "RUNTIME_QUERY_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"runtimeId": runtimeID, "payload": payload, "requestId": requestID})
		})

		r.Post("/runtimes/{runtimeId}/deck/routing", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			body, err := readBody(r)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_BODY", "message": "Request body is invalid.", "details": nil}, "requestId": requestID})
				return
			}
			action, _ := body["action"].(string)
			delete(body, "action")
			var payload any
			switch action {
			case "add":
				payload, err = deck.AddDeckRouting(r.Context(), runtimeID, body)
			case "remove":
				payload, err = deck.RemoveDeckRouting(r.Context(), runtimeID, body)
			case "validate":
				payload, err = deck.ValidateDeckRouting(r.Context(), runtimeID, body)
			case "simulate":
				payload, err = deck.SimulateDeckRouting(r.Context(), runtimeID, body)
			default:
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_ACTION", "message": "Deck routing action is invalid.", "details": nil}, "requestId": requestID})
				return
			}
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Get("/runtimes/{runtimeId}/deck/subagents", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			params := map[string]any{}
			for _, key := range []string{"status", "agentId", "requesterAgentId"} {
				if value := r.URL.Query().Get(key); value != "" {
					params[key] = value
				}
			}
			for _, key := range []string{"limit", "offset"} {
				if value := r.URL.Query().Get(key); value != "" {
					parsed, err := strconv.Atoi(value)
					if err != nil {
						writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_QUERY", "message": "Query parameter is invalid.", "details": map[string]any{"parameter": key}}, "requestId": requestID})
						return
					}
					params[key] = parsed
				}
			}
			payload, err := deck.ListDeckSubagents(r.Context(), runtimeID, params)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "RUNTIME_QUERY_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"runtimeId": runtimeID, "payload": payload, "requestId": requestID})
		})

		r.Post("/runtimes/{runtimeId}/deck/subagents", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			body, err := readBody(r)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_BODY", "message": "Request body is invalid.", "details": nil}, "requestId": requestID})
				return
			}
			action, _ := body["action"].(string)
			delete(body, "action")
			var payload any
			switch action {
			case "kill":
				payload, err = deck.KillDeckSubagent(r.Context(), runtimeID, body)
			case "lineage":
				payload, err = deck.GetDeckSubagentLineage(r.Context(), runtimeID, body)
			case "steer":
				payload, err = deck.SteerDeckSubagent(r.Context(), runtimeID, body)
			default:
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_ACTION", "message": "Deck subagent action is invalid.", "details": nil}, "requestId": requestID})
				return
			}
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Get("/runtimes/{runtimeId}/deck/threads", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			params := map[string]any{}
			for _, key := range []string{"agentId", "channel", "status"} {
				if value := r.URL.Query().Get(key); value != "" {
					params[key] = value
				}
			}
			if value := r.URL.Query().Get("limit"); value != "" {
				parsed, err := strconv.Atoi(value)
				if err != nil {
					writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_QUERY", "message": "Query parameter is invalid.", "details": map[string]any{"parameter": "limit"}}, "requestId": requestID})
					return
				}
				params["limit"] = parsed
			}
			payload, err := deck.ListDeckThreads(r.Context(), runtimeID, params)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "RUNTIME_QUERY_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"runtimeId": runtimeID, "payload": payload, "requestId": requestID})
		})
	}

	if approvals != nil {
		readBody := func(r *http.Request) (map[string]any, error) {
			var body map[string]any
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				return nil, err
			}
			if body == nil {
				body = map[string]any{}
			}
			return body, nil
		}

		r.Get("/runtimes/{runtimeId}/approvals", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			payload, err := approvals.GetApprovals(r.Context(), runtimeID)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "RUNTIME_QUERY_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"runtimeId": runtimeID, "payload": payload, "requestId": requestID})
		})

		r.Post("/runtimes/{runtimeId}/approvals/resolve", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			body, err := readBody(r)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_BODY", "message": "Request body is invalid.", "details": nil}, "requestId": requestID})
				return
			}
			payload, err := approvals.ResolveApproval(r.Context(), runtimeID, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Get("/runtimes/{runtimeId}/approvals/pending", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			payload, err := approvals.ListPendingApprovals(r.Context(), runtimeID)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "RUNTIME_QUERY_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Get("/runtimes/{runtimeId}/approvals/policy", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			payload, err := approvals.GetApprovals(r.Context(), runtimeID)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "RUNTIME_QUERY_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"runtimeId": runtimeID, "payload": payload, "requestId": requestID})
		})

		r.Put("/runtimes/{runtimeId}/approvals/policy", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			body, err := readBody(r)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_BODY", "message": "Request body is invalid.", "details": nil}, "requestId": requestID})
				return
			}
			payload, err := approvals.SetApprovalPolicy(r.Context(), runtimeID, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Get("/runtimes/{runtimeId}/approvals/plugins", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			payload, err := approvals.ListPluginApprovals(r.Context(), runtimeID)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "RUNTIME_QUERY_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Post("/runtimes/{runtimeId}/approvals/plugins/resolve", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			body, err := readBody(r)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_BODY", "message": "Request body is invalid.", "details": nil}, "requestId": requestID})
				return
			}
			payload, err := approvals.ResolvePluginApproval(r.Context(), runtimeID, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})
	}

	if memory != nil {
		r.Get("/runtimes/{runtimeId}/memory/health", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			payload, err := memory.GetMemoryHealth(r.Context(), runtimeID)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "RUNTIME_QUERY_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"runtimeId": runtimeID, "payload": payload, "requestId": requestID})
		})

		r.Post("/runtimes/{runtimeId}/memory/dreams", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			var body struct {
				Action string `json:"action"`
			}
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_BODY", "message": "Request body is invalid.", "details": nil}, "requestId": requestID})
				return
			}
			payload, err := memory.RunMemoryDreamAction(r.Context(), runtimeID, body.Action)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})
	}

	if nodes != nil {
		r.Get("/runtimes/{runtimeId}/nodes", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			payload, err := nodes.ListNodes(r.Context(), runtimeID)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "RUNTIME_QUERY_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"runtimeId": runtimeID, "payload": payload, "requestId": requestID})
		})

		r.Post("/runtimes/{runtimeId}/nodes", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			var body map[string]any
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_BODY", "message": "Request body is invalid.", "details": nil}, "requestId": requestID})
				return
			}
			if body == nil {
				body = map[string]any{}
			}
			action, _ := body["action"].(string)
			delete(body, "action")
			payload, err := nodes.RunNodeAction(r.Context(), runtimeID, action, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Get("/runtimes/{runtimeId}/nodes/pair", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			payload, err := nodes.ListNodePairing(r.Context(), runtimeID)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "RUNTIME_QUERY_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"runtimeId": runtimeID, "payload": payload, "requestId": requestID})
		})

		r.Post("/runtimes/{runtimeId}/nodes/pair", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			var body map[string]any
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_BODY", "message": "Request body is invalid.", "details": nil}, "requestId": requestID})
				return
			}
			if body == nil {
				body = map[string]any{}
			}
			action, _ := body["action"].(string)
			delete(body, "action")
			payload, err := nodes.RunNodePairAction(r.Context(), runtimeID, action, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})
	}

	if skills != nil {
		r.Get("/runtimes/{runtimeId}/skills", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			params := map[string]any{}
			if agentID := r.URL.Query().Get("agentId"); agentID != "" {
				params["agentId"] = agentID
			}
			payload, err := skills.ListSkills(r.Context(), runtimeID, params)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "RUNTIME_QUERY_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"runtimeId": runtimeID, "payload": payload, "requestId": requestID})
		})

		r.Patch("/runtimes/{runtimeId}/skills/{skillKey}", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			var body map[string]any
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err.Error() != "EOF" {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_BODY", "message": "Request body is invalid.", "details": nil}, "requestId": requestID})
				return
			}
			if body == nil {
				body = map[string]any{}
			}
			skillKey := chi.URLParam(r, "skillKey")
			payload, err := skills.UpdateSkill(r.Context(), runtimeID, skillKey, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Post("/runtimes/{runtimeId}/skills/install", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			var body map[string]any
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_BODY", "message": "Request body is invalid.", "details": nil}, "requestId": requestID})
				return
			}
			if body == nil {
				body = map[string]any{}
			}
			payload, err := skills.InstallSkill(r.Context(), runtimeID, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Post("/runtimes/{runtimeId}/skills/hub", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			var body map[string]any
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_BODY", "message": "Request body is invalid.", "details": nil}, "requestId": requestID})
				return
			}
			if body == nil {
				body = map[string]any{}
			}
			payload, err := skills.RunSkillsHubAction(r.Context(), runtimeID, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Post("/runtimes/{runtimeId}/skills/update-clawhub", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			var body map[string]any
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_BODY", "message": "Request body is invalid.", "details": nil}, "requestId": requestID})
				return
			}
			if body == nil {
				body = map[string]any{}
			}
			payload, err := skills.UpdateClawhubSkill(r.Context(), runtimeID, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})
	}

	if channels != nil {
		r.Get("/runtimes/{runtimeId}/channels", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			params := map[string]any{}
			if probe := r.URL.Query().Get("probe"); probe == "1" || probe == "true" {
				params["probe"] = true
			}
			if timeoutRaw := r.URL.Query().Get("timeoutMs"); timeoutRaw != "" {
				if timeout, err := strconv.Atoi(timeoutRaw); err == nil {
					params["timeoutMs"] = timeout
				}
			}
			payload, err := channels.GetChannels(r.Context(), runtimeID, params)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "RUNTIME_QUERY_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"runtimeId": runtimeID, "payload": payload, "requestId": requestID})
		})

		r.Post("/runtimes/{runtimeId}/channels/{channelId}/logout", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			channelID := chi.URLParam(r, "channelId")
			payload, err := channels.LogoutChannel(r.Context(), runtimeID, channelID)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Post("/runtimes/{runtimeId}/channels/{channelId}/test", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			channelID := chi.URLParam(r, "channelId")
			payload, err := channels.TestChannel(r.Context(), runtimeID, channelID)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Get("/runtimes/{runtimeId}/channels/{channelId}/throughput", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			channelID := chi.URLParam(r, "channelId")
			payload, err := channels.GetChannelThroughput(r.Context(), runtimeID, channelID)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "RUNTIME_QUERY_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"runtimeId": runtimeID, "channelId": channelID, "payload": payload, "requestId": requestID})
		})

		r.Patch("/runtimes/{runtimeId}/channels/{channelId}", func(w http.ResponseWriter, r *http.Request) {
			requestID := nextRequestID()
			runtimeID := chi.URLParam(r, "runtimeId")
			if runtimeID != DefaultRuntimeID {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil}, "requestId": requestID})
				return
			}
			channelID := chi.URLParam(r, "channelId")
			var patch map[string]any
			if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]any{"code": "INVALID_BODY", "message": "Request body is invalid.", "details": nil}, "requestId": requestID})
				return
			}
			payload, err := channels.PatchChannel(r.Context(), runtimeID, channelID, patch)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil}, "requestId": requestID})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})
	}

	if commands == nil {
		return
	}

	r.Post("/runtimes/{runtimeId}/sessions:create", func(w http.ResponseWriter, r *http.Request) {
		requestID := nextRequestID()
		runtimeID := chi.URLParam(r, "runtimeId")
		if runtimeID != DefaultRuntimeID {
			writeJSON(w, http.StatusNotFound, map[string]any{
				"error":     map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil},
				"requestId": requestID,
			})
			return
		}
		var body struct {
			AgentID          string `json:"agentId"`
			Message          string `json:"message"`
			Model            string `json:"model"`
			Label            string `json:"label"`
			ParentSessionKey string `json:"parentSessionKey"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err.Error() != "EOF" {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"error":     map[string]any{"code": "INVALID_BODY", "message": "Request body is invalid.", "details": nil},
				"requestId": requestID,
			})
			return
		}
		payload, err := commands.CreateSession(
			r.Context(),
			runtimeID,
			body.AgentID,
			body.Message,
			body.Model,
			body.Label,
			body.ParentSessionKey,
		)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{
				"error":     map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil},
				"requestId": requestID,
			})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	r.Post("/runtimes/{runtimeId}/sessions/{sessionId}/messages:send", func(w http.ResponseWriter, r *http.Request) {
		requestID := nextRequestID()
		runtimeID := chi.URLParam(r, "runtimeId")
		if runtimeID != DefaultRuntimeID {
			writeJSON(w, http.StatusNotFound, map[string]any{
				"error":     map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil},
				"requestId": requestID,
			})
			return
		}
		sessionID := chi.URLParam(r, "sessionId")
		var body struct {
			Text        string           `json:"text"`
			Attachments []map[string]any `json:"attachments"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"error":     map[string]any{"code": "INVALID_BODY", "message": "Request body is invalid.", "details": nil},
				"requestId": requestID,
			})
			return
		}
		if body.Text == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"error":     map[string]any{"code": "INVALID_BODY", "message": "text is required.", "details": nil},
				"requestId": requestID,
			})
			return
		}
		idempotencyKey := r.Header.Get("idempotencyKey")
		if err := commands.SendMessage(r.Context(), runtimeID, sessionID, body.Text, body.Attachments, idempotencyKey); err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{
				"error":     map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil},
				"requestId": requestID,
			})
			return
		}
		writeJSON(w, http.StatusAccepted, commandAcceptedEnvelope(requestID))
	})

	r.Post("/runtimes/{runtimeId}/runs/{runId}:abort", func(w http.ResponseWriter, r *http.Request) {
		requestID := nextRequestID()
		runtimeID := chi.URLParam(r, "runtimeId")
		if runtimeID != DefaultRuntimeID {
			writeJSON(w, http.StatusNotFound, map[string]any{
				"error":     map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil},
				"requestId": requestID,
			})
			return
		}
		runID := chi.URLParam(r, "runId")
		idempotencyKey := r.Header.Get("idempotencyKey")
		if err := commands.AbortRun(r.Context(), runtimeID, runID, idempotencyKey); err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{
				"error":     map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil},
				"requestId": requestID,
			})
			return
		}
		writeJSON(w, http.StatusAccepted, commandAcceptedEnvelope(requestID))
	})

	r.Post("/runtimes/{runtimeId}/sessions/{sessionId}:compact", func(w http.ResponseWriter, r *http.Request) {
		requestID := nextRequestID()
		runtimeID := chi.URLParam(r, "runtimeId")
		if runtimeID != DefaultRuntimeID {
			writeJSON(w, http.StatusNotFound, map[string]any{
				"error":     map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil},
				"requestId": requestID,
			})
			return
		}
		sessionID := chi.URLParam(r, "sessionId")
		idempotencyKey := r.Header.Get("idempotencyKey")
		if err := commands.CompactSession(r.Context(), runtimeID, sessionID, idempotencyKey); err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{
				"error":     map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil},
				"requestId": requestID,
			})
			return
		}
		writeJSON(w, http.StatusAccepted, commandAcceptedEnvelope(requestID))
	})

	r.Delete("/runtimes/{runtimeId}/sessions/{sessionId}", func(w http.ResponseWriter, r *http.Request) {
		requestID := nextRequestID()
		runtimeID := chi.URLParam(r, "runtimeId")
		if runtimeID != DefaultRuntimeID {
			writeJSON(w, http.StatusNotFound, map[string]any{
				"error":     map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil},
				"requestId": requestID,
			})
			return
		}
		sessionID := chi.URLParam(r, "sessionId")
		idempotencyKey := r.Header.Get("idempotencyKey")
		if err := commands.DeleteSession(r.Context(), runtimeID, sessionID, idempotencyKey); err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{
				"error":     map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil},
				"requestId": requestID,
			})
			return
		}
		writeJSON(w, http.StatusAccepted, commandAcceptedEnvelope(requestID))
	})

	r.Post("/runtimes/{runtimeId}/sessions/{sessionId}:reset", func(w http.ResponseWriter, r *http.Request) {
		requestID := nextRequestID()
		runtimeID := chi.URLParam(r, "runtimeId")
		if runtimeID != DefaultRuntimeID {
			writeJSON(w, http.StatusNotFound, map[string]any{
				"error":     map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil},
				"requestId": requestID,
			})
			return
		}
		sessionID := chi.URLParam(r, "sessionId")
		var body struct {
			Reason string `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err.Error() != "EOF" {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"error":     map[string]any{"code": "INVALID_BODY", "message": "Request body is invalid.", "details": nil},
				"requestId": requestID,
			})
			return
		}
		reason := body.Reason
		if reason == "" {
			reason = "reset"
		}
		idempotencyKey := r.Header.Get("idempotencyKey")
		if err := commands.ResetSession(r.Context(), runtimeID, sessionID, reason, idempotencyKey); err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{
				"error":     map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil},
				"requestId": requestID,
			})
			return
		}
		writeJSON(w, http.StatusAccepted, commandAcceptedEnvelope(requestID))
	})

	r.Post("/runtimes/{runtimeId}/sessions/{sessionId}:clear", func(w http.ResponseWriter, r *http.Request) {
		requestID := nextRequestID()
		runtimeID := chi.URLParam(r, "runtimeId")
		if runtimeID != DefaultRuntimeID {
			writeJSON(w, http.StatusNotFound, map[string]any{
				"error":     map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil},
				"requestId": requestID,
			})
			return
		}
		sessionID := chi.URLParam(r, "sessionId")
		idempotencyKey := r.Header.Get("idempotencyKey")
		if err := commands.ClearSession(r.Context(), runtimeID, sessionID, idempotencyKey); err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{
				"error":     map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil},
				"requestId": requestID,
			})
			return
		}
		writeJSON(w, http.StatusAccepted, commandAcceptedEnvelope(requestID))
	})

	r.Post("/runtimes/{runtimeId}/sessions/{sessionId}:patch", func(w http.ResponseWriter, r *http.Request) {
		requestID := nextRequestID()
		runtimeID := chi.URLParam(r, "runtimeId")
		if runtimeID != DefaultRuntimeID {
			writeJSON(w, http.StatusNotFound, map[string]any{
				"error":     map[string]any{"code": "RUNTIME_NOT_FOUND", "message": "Runtime was not found.", "details": nil},
				"requestId": requestID,
			})
			return
		}
		sessionID := chi.URLParam(r, "sessionId")
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"error":     map[string]any{"code": "INVALID_BODY", "message": "Request body is invalid.", "details": nil},
				"requestId": requestID,
			})
			return
		}
		if body == nil {
			body = map[string]any{}
		}
		idempotencyKey := r.Header.Get("idempotencyKey")
		if err := commands.PatchSession(r.Context(), runtimeID, sessionID, body, idempotencyKey); err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{
				"error":     map[string]any{"code": "COMMAND_SUBMIT_FAILED", "message": err.Error(), "details": nil},
				"requestId": requestID,
			})
			return
		}
		writeJSON(w, http.StatusAccepted, commandAcceptedEnvelope(requestID))
	})
}

func filterMonitorRuns(items []runtimeprojection.RunRecord, query map[string][]string) ([]runtimeprojection.RunRecord, string) {
	value := func(key string) string {
		if query == nil {
			return ""
		}
		values := query[key]
		if len(values) == 0 {
			return ""
		}
		return values[0]
	}

	filtered := make([]runtimeprojection.RunRecord, 0, len(items))
	agentID := value("agentId")
	sessionKey := value("sessionKey")
	status := value("status")
	since := value("since")
	until := value("until")
	for _, run := range items {
		if agentID != "" && run.AgentID != agentID {
			continue
		}
		if sessionKey != "" && run.SessionKey != sessionKey {
			continue
		}
		if status != "" && run.Status != status {
			continue
		}
		if since != "" && run.FirstEventAt < since {
			continue
		}
		if until != "" && run.FirstEventAt > until {
			continue
		}
		filtered = append(filtered, run)
	}
	sort.Slice(filtered, func(i, j int) bool { return filtered[i].LastEventAt > filtered[j].LastEventAt })

	limit := 20
	if raw := value("limit"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			limit = parsed
		}
	}
	startIdx := 0
	if cursor := value("cursor"); cursor != "" {
		for idx, run := range filtered {
			if run.RunID == cursor {
				startIdx = idx + 1
				break
			}
		}
	}
	pageEnd := startIdx + limit
	if pageEnd > len(filtered) {
		pageEnd = len(filtered)
	}
	page := filtered[startIdx:pageEnd]
	nextCursor := ""
	if pageEnd < len(filtered) && len(page) > 0 {
		nextCursor = page[len(page)-1].RunID
	}
	return page, nextCursor
}

func nextRequestID() string {
	return fmt.Sprintf("req_%d", time.Now().UTC().UnixNano())
}

func nextCommandID() string {
	return fmt.Sprintf("cmd_%d", time.Now().UTC().UnixNano())
}

func commandAcceptedEnvelope(requestID string) map[string]any {
	return map[string]any{
		"accepted":    true,
		"requestId":   requestID,
		"commandId":   nextCommandID(),
		"submittedAt": time.Now().UTC().Format(time.RFC3339),
	}
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
