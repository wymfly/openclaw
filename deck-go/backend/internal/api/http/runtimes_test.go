package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
	runtimecoerce "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/coerce"
	runtimeprojection "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/projection"
	runtimeregistry "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/registry"
)

type stubRuntimeProvider struct {
	items []runtimeregistry.RuntimeSummary
}

func (s stubRuntimeProvider) ListRuntimes(context.Context) ([]runtimeregistry.RuntimeSummary, error) {
	return s.items, nil
}

func (s stubRuntimeProvider) GetRuntime(_ context.Context, runtimeID string) (runtimeregistry.RuntimeSummary, bool, error) {
	for _, item := range s.items {
		if item.RuntimeID == runtimeID {
			return item, true, nil
		}
	}
	return runtimeregistry.RuntimeSummary{}, false, nil
}

type stubSessionProvider struct {
	metas   []deckapi.DeckGoSessionMeta
	detail  deckapi.DeckGoSessionDetailResponse
	lastKey string
}

func (s *stubSessionProvider) ListSessions(_ context.Context, runtimeID string) ([]deckapi.DeckGoSessionMeta, error) {
	s.lastKey = runtimeID
	return s.metas, nil
}

func (s *stubSessionProvider) GetTimeline(_ context.Context, runtimeID string, sessionID string) (deckapi.DeckGoSessionDetailResponse, error) {
	s.lastKey = runtimeID + "/" + sessionID
	return s.detail, nil
}

type stubMonitorProvider struct {
	activity   []runtimeprojection.ActivityEventEntry
	runs       []runtimeprojection.RunRecord
	run        runtimeprojection.RunRecord
	runEvents  []runtimeprojection.RunEventRow
	stats      runtimeprojection.MonitorStats
	lastKey    string
	lastRunKey string
}

func (s *stubMonitorProvider) ListActivity(_ context.Context, runtimeID string, limit int) ([]runtimeprojection.ActivityEventEntry, error) {
	s.lastKey = runtimeID + "/activity/" + strconv.Itoa(limit)
	return s.activity, nil
}

func (s *stubMonitorProvider) ListRuns(_ context.Context, runtimeID string) ([]runtimeprojection.RunRecord, error) {
	s.lastKey = runtimeID
	return s.runs, nil
}

func (s *stubMonitorProvider) GetRun(_ context.Context, runtimeID string, runID string) (runtimeprojection.RunRecord, []runtimeprojection.RunEventRow, bool, error) {
	s.lastRunKey = runtimeID + "/" + runID
	if s.run.RunID != runID {
		return runtimeprojection.RunRecord{}, nil, false, nil
	}
	return s.run, s.runEvents, true, nil
}

func (s *stubMonitorProvider) GetStats(_ context.Context, runtimeID string) (runtimeprojection.MonitorStats, error) {
	s.lastKey = runtimeID + "/stats"
	return s.stats, nil
}

type stubGatewayDiagnosticProvider struct {
	describe map[string]any
	health   map[string]any
	status   map[string]any
	lastKey  string
}

func (s *stubGatewayDiagnosticProvider) GetGatewayDescribe(_ context.Context, runtimeID string, includeSchemas bool) (any, error) {
	s.lastKey = runtimeID + "/gateway/describe/" + strconv.FormatBool(includeSchemas)
	return s.describe, nil
}

func (s *stubGatewayDiagnosticProvider) GetGatewayHealth(_ context.Context, runtimeID string) (any, error) {
	s.lastKey = runtimeID + "/gateway/health"
	return s.health, nil
}

func (s *stubGatewayDiagnosticProvider) GetGatewayStatus(_ context.Context, runtimeID string) (any, error) {
	s.lastKey = runtimeID + "/gateway/status"
	return s.status, nil
}

type stubDeviceProvider struct {
	list     map[string]any
	deviceID string
	lastKey  string
}

func (s *stubDeviceProvider) ListDevices(_ context.Context, runtimeID string) (any, error) {
	s.lastKey = runtimeID + "/devices"
	return s.list, nil
}

func (s *stubDeviceProvider) GetCurrentDeviceID(runtimeID string) (string, error) {
	s.lastKey = runtimeID + "/devices/self"
	return s.deviceID, nil
}

func (s *stubDeviceProvider) ApproveDeviceRequest(_ context.Context, runtimeID string, requestID string) (any, error) {
	s.lastKey = runtimeID + "/devices/approve/" + requestID
	return map[string]any{"requestId": requestID, "deviceId": "dev-1"}, nil
}

func (s *stubDeviceProvider) RejectDeviceRequest(_ context.Context, runtimeID string, requestID string) (any, error) {
	s.lastKey = runtimeID + "/devices/reject/" + requestID
	return map[string]any{"requestId": requestID, "deviceId": "dev-1"}, nil
}

func (s *stubDeviceProvider) RemoveDevice(_ context.Context, runtimeID string, deviceID string) (any, error) {
	s.lastKey = runtimeID + "/devices/remove/" + deviceID
	return map[string]any{"deviceId": deviceID}, nil
}

func (s *stubDeviceProvider) RotateDeviceToken(_ context.Context, runtimeID string, deviceID string, role string) (any, error) {
	s.lastKey = runtimeID + "/devices/token/rotate/" + deviceID + "/" + role
	return map[string]any{"deviceId": deviceID, "role": role, "token": "tok-1"}, nil
}

func (s *stubDeviceProvider) RevokeDeviceToken(_ context.Context, runtimeID string, deviceID string, role string) (any, error) {
	s.lastKey = runtimeID + "/devices/token/revoke/" + deviceID + "/" + role
	return map[string]any{"deviceId": deviceID, "role": role, "revokedAtMs": 123}, nil
}

type stubConfigProvider struct {
	config  map[string]any
	schema  map[string]any
	lookup  map[string]any
	lastKey string
	lastRaw string
}

func (s *stubConfigProvider) GetConfig(_ context.Context, runtimeID string) (any, error) {
	s.lastKey = runtimeID + "/config"
	return s.config, nil
}

func (s *stubConfigProvider) PatchConfig(_ context.Context, runtimeID string, patch map[string]any, baseHash string) (any, error) {
	s.lastKey = runtimeID + "/config:patch/" + baseHash
	raw, _ := json.Marshal(patch)
	s.lastRaw = string(raw)
	return map[string]any{"ok": true, "baseHash": baseHash}, nil
}

func (s *stubConfigProvider) ApplyConfig(_ context.Context, runtimeID string, raw string, baseHash string) (any, error) {
	s.lastKey = runtimeID + "/config:apply/" + baseHash
	s.lastRaw = raw
	return map[string]any{"ok": true, "baseHash": baseHash}, nil
}

func (s *stubConfigProvider) GetConfigSchema(_ context.Context, runtimeID string) (any, error) {
	s.lastKey = runtimeID + "/config/schema"
	return s.schema, nil
}

func (s *stubConfigProvider) LookupConfigSchema(_ context.Context, runtimeID string, path string) (any, error) {
	s.lastKey = runtimeID + "/config/schema-lookup/" + path
	return s.lookup, nil
}

type stubAgentProvider struct {
	list     map[string]any
	identity map[string]any
	files    map[string]any
	file     map[string]any
	lastKey  string
	lastBody string
}

func (s *stubAgentProvider) ListAgents(_ context.Context, runtimeID string) (any, error) {
	s.lastKey = runtimeID + "/agents"
	return s.list, nil
}

func (s *stubAgentProvider) GetAgent(_ context.Context, runtimeID string, agentID string) (any, bool, error) {
	s.lastKey = runtimeID + "/agents/" + agentID
	items, _ := s.list["agents"].([]map[string]any)
	for _, item := range items {
		if item["id"] == agentID {
			return item, true, nil
		}
	}
	rawItems, _ := s.list["agents"].([]any)
	for _, item := range rawItems {
		record, ok := item.(map[string]any)
		if ok && record["id"] == agentID {
			return record, true, nil
		}
	}
	return nil, false, nil
}

func (s *stubAgentProvider) GetAgentIdentity(_ context.Context, runtimeID string, agentID string) (any, error) {
	s.lastKey = runtimeID + "/agents/" + agentID + "/identity"
	return s.identity, nil
}

func (s *stubAgentProvider) ListAgentFiles(_ context.Context, runtimeID string, agentID string) (any, error) {
	s.lastKey = runtimeID + "/agents/" + agentID + "/files"
	return s.files, nil
}

func (s *stubAgentProvider) GetAgentFile(_ context.Context, runtimeID string, agentID string, name string) (any, error) {
	s.lastKey = runtimeID + "/agents/" + agentID + "/files/" + name
	return s.file, nil
}

func (s *stubAgentProvider) CreateAgent(_ context.Context, runtimeID string, body map[string]any) (any, error) {
	s.lastKey = runtimeID + "/agents:create"
	s.lastBody = runtimecoerce.String(body["workspace"], "")
	return map[string]any{"ok": true, "id": runtimecoerce.String(body["name"], "")}, nil
}

func (s *stubAgentProvider) UpdateAgent(_ context.Context, runtimeID string, agentID string, body map[string]any) (any, error) {
	s.lastKey = runtimeID + "/agents/" + agentID + ":patch"
	s.lastBody = runtimecoerce.String(body["name"], "")
	return map[string]any{"ok": true, "agentId": agentID}, nil
}

func (s *stubAgentProvider) DeleteAgent(_ context.Context, runtimeID string, agentID string) (any, error) {
	s.lastKey = runtimeID + "/agents/" + agentID + ":delete"
	return map[string]any{"ok": true, "agentId": agentID}, nil
}

func (s *stubAgentProvider) SetAgentFile(_ context.Context, runtimeID string, agentID string, name string, content string) (any, error) {
	s.lastKey = runtimeID + "/agents/" + agentID + "/files:set"
	s.lastBody = name + "=" + content
	return map[string]any{"ok": true, "name": name}, nil
}

type stubMiscQueryProvider struct {
	commands   map[string]any
	tools      map[string]any
	usage      map[string]any
	cronStatus map[string]any
	discover   map[string]any
	effective  map[string]any
	lastKey    string
}

func (s *stubMiscQueryProvider) ListCommands(_ context.Context, runtimeID string) (any, error) {
	s.lastKey = runtimeID + "/commands"
	return s.commands, nil
}

func (s *stubMiscQueryProvider) ToolsCatalog(_ context.Context, runtimeID string, body map[string]any) (any, error) {
	s.lastKey = runtimeID + "/tools/catalog"
	return s.tools, nil
}

func (s *stubMiscQueryProvider) GetUsage(_ context.Context, runtimeID string) (any, error) {
	s.lastKey = runtimeID + "/usage"
	return s.usage, nil
}

func (s *stubMiscQueryProvider) ListCronJobs(_ context.Context, runtimeID string, params map[string]any) (any, error) {
	s.lastKey = runtimeID + "/cron"
	return map[string]any{"items": []map[string]any{{"id": "job-1"}}}, nil
}

func (s *stubMiscQueryProvider) AddCronJob(_ context.Context, runtimeID string, body map[string]any) (any, error) {
	s.lastKey = runtimeID + "/cron:add"
	return map[string]any{"ok": true, "id": "job-1"}, nil
}

func (s *stubMiscQueryProvider) UpdateCronJob(_ context.Context, runtimeID string, jobID string, patch map[string]any) (any, error) {
	s.lastKey = runtimeID + "/cron/" + jobID + ":patch"
	return map[string]any{"ok": true, "id": jobID}, nil
}

func (s *stubMiscQueryProvider) RemoveCronJob(_ context.Context, runtimeID string, jobID string) (any, error) {
	s.lastKey = runtimeID + "/cron/" + jobID + ":delete"
	return map[string]any{"ok": true, "id": jobID}, nil
}

func (s *stubMiscQueryProvider) RunCronJob(_ context.Context, runtimeID string, body map[string]any) (any, error) {
	s.lastKey = runtimeID + "/cron/" + runtimecoerce.String(body["id"], "") + ":run"
	return map[string]any{"ok": true}, nil
}

func (s *stubMiscQueryProvider) ListCronRuns(_ context.Context, runtimeID string, params map[string]any) (any, error) {
	s.lastKey = runtimeID + "/cron/" + runtimecoerce.String(params["jobId"], "") + "/runs"
	return map[string]any{"items": []map[string]any{{"jobId": params["jobId"]}}}, nil
}

func (s *stubMiscQueryProvider) GetCronStatus(_ context.Context, runtimeID string) (any, error) {
	s.lastKey = runtimeID + "/cron/status"
	return s.cronStatus, nil
}

func (s *stubMiscQueryProvider) DiscoverDeckCommands(_ context.Context, runtimeID string, body map[string]any) (any, error) {
	s.lastKey = runtimeID + "/deck/commands/discover"
	return s.discover, nil
}

func (s *stubMiscQueryProvider) GetDeckToolsEffective(_ context.Context, runtimeID string, body map[string]any) (any, error) {
	s.lastKey = runtimeID + "/deck/tools-effective"
	return s.effective, nil
}

type stubDeckProvider struct {
	plugins   map[string]any
	agent     map[string]any
	identity  map[string]any
	routing   map[string]any
	subagents map[string]any
	threads   map[string]any
	lastKey   string
	lastBody  string
}

func (s *stubDeckProvider) ListDeckPlugins(_ context.Context, runtimeID string, params map[string]any) (any, error) {
	s.lastKey = runtimeID + "/deck/plugins"
	return s.plugins, nil
}

func (s *stubDeckProvider) GetDeckAgentDetail(_ context.Context, runtimeID string, agentID string) (any, error) {
	s.lastKey = runtimeID + "/deck/agents/" + agentID
	return s.agent, nil
}

func (s *stubDeckProvider) RunDeckAgentAction(_ context.Context, runtimeID string, action string, body map[string]any) (any, error) {
	s.lastKey = runtimeID + "/deck/agents/" + action
	if action == "config.patch" {
		s.lastBody = runtimecoerce.String(body["path"], "")
	}
	return map[string]any{"ok": true, "action": action}, nil
}

func (s *stubDeckProvider) ListDeckIdentity(_ context.Context, runtimeID string) (any, error) {
	s.lastKey = runtimeID + "/deck/identity"
	return s.identity, nil
}

func (s *stubDeckProvider) LinkDeckIdentity(_ context.Context, runtimeID string, body map[string]any) (any, error) {
	s.lastKey = runtimeID + "/deck/identity/link"
	return map[string]any{"ok": true, "action": "link", "canonical": body["canonical"]}, nil
}

func (s *stubDeckProvider) UnlinkDeckIdentity(_ context.Context, runtimeID string, body map[string]any) (any, error) {
	s.lastKey = runtimeID + "/deck/identity/unlink"
	return map[string]any{"ok": true, "action": "unlink", "canonical": body["canonical"]}, nil
}

func (s *stubDeckProvider) ListDeckRouting(_ context.Context, runtimeID string, params map[string]any) (any, error) {
	s.lastKey = runtimeID + "/deck/routing"
	return s.routing, nil
}

func (s *stubDeckProvider) AddDeckRouting(_ context.Context, runtimeID string, body map[string]any) (any, error) {
	s.lastKey = runtimeID + "/deck/routing/add"
	return map[string]any{"ok": true, "action": "add", "agentId": body["agentId"]}, nil
}

func (s *stubDeckProvider) RemoveDeckRouting(_ context.Context, runtimeID string, body map[string]any) (any, error) {
	s.lastKey = runtimeID + "/deck/routing/remove"
	return map[string]any{"ok": true, "action": "remove", "id": body["id"]}, nil
}

func (s *stubDeckProvider) ValidateDeckRouting(_ context.Context, runtimeID string, body map[string]any) (any, error) {
	s.lastKey = runtimeID + "/deck/routing/validate"
	return map[string]any{"ok": true, "action": "validate"}, nil
}

func (s *stubDeckProvider) SimulateDeckRouting(_ context.Context, runtimeID string, body map[string]any) (any, error) {
	s.lastKey = runtimeID + "/deck/routing/simulate"
	return map[string]any{"ok": true, "action": "simulate", "channel": body["channel"]}, nil
}

func (s *stubDeckProvider) ListDeckSubagents(_ context.Context, runtimeID string, params map[string]any) (any, error) {
	s.lastKey = runtimeID + "/deck/subagents"
	return s.subagents, nil
}

func (s *stubDeckProvider) KillDeckSubagent(_ context.Context, runtimeID string, body map[string]any) (any, error) {
	s.lastKey = runtimeID + "/deck/subagents/kill"
	return map[string]any{"ok": true, "action": "kill", "runId": body["runId"]}, nil
}

func (s *stubDeckProvider) GetDeckSubagentLineage(_ context.Context, runtimeID string, body map[string]any) (any, error) {
	s.lastKey = runtimeID + "/deck/subagents/lineage"
	return map[string]any{"ok": true, "action": "lineage", "sessionKey": body["sessionKey"]}, nil
}

func (s *stubDeckProvider) SteerDeckSubagent(_ context.Context, runtimeID string, body map[string]any) (any, error) {
	s.lastKey = runtimeID + "/deck/subagents/steer"
	return map[string]any{"ok": true, "action": "steer", "runId": body["runId"]}, nil
}

func (s *stubDeckProvider) ListDeckThreads(_ context.Context, runtimeID string, params map[string]any) (any, error) {
	s.lastKey = runtimeID + "/deck/threads"
	return s.threads, nil
}

type stubApprovalProvider struct {
	approvals map[string]any
	pending   map[string]any
	plugins   []map[string]any
	lastKey   string
}

func (s *stubApprovalProvider) GetApprovals(_ context.Context, runtimeID string) (any, error) {
	s.lastKey = runtimeID + "/approvals"
	return s.approvals, nil
}

func (s *stubApprovalProvider) ResolveApproval(_ context.Context, runtimeID string, body map[string]any) (any, error) {
	s.lastKey = runtimeID + "/approvals/resolve"
	return map[string]any{"ok": true, "id": body["id"], "decision": body["decision"]}, nil
}

type stubMemoryProvider struct {
	health  map[string]any
	lastKey string
}

func (s *stubMemoryProvider) GetMemoryHealth(_ context.Context, runtimeID string) (any, error) {
	s.lastKey = runtimeID + "/memory/health"
	return s.health, nil
}

func (s *stubMemoryProvider) RunMemoryDreamAction(_ context.Context, runtimeID string, action string) (any, error) {
	s.lastKey = runtimeID + "/memory/dreams/" + action
	return map[string]any{"ok": true, "action": action}, nil
}

type stubNodeProvider struct {
	list    map[string]any
	pairs   map[string]any
	lastKey string
}

func (s *stubNodeProvider) ListNodes(_ context.Context, runtimeID string) (any, error) {
	s.lastKey = runtimeID + "/nodes"
	return s.list, nil
}

func (s *stubNodeProvider) RunNodeAction(_ context.Context, runtimeID string, action string, body map[string]any) (any, error) {
	s.lastKey = runtimeID + "/nodes/" + action
	return map[string]any{"ok": true, "action": action}, nil
}

type stubSkillProvider struct {
	status  map[string]any
	search  map[string]any
	detail  map[string]any
	install map[string]any
	update  map[string]any
	bins    map[string]any
	lastKey string
}

func (s *stubSkillProvider) ListSkills(_ context.Context, runtimeID string, params map[string]any) (any, error) {
	s.lastKey = runtimeID + "/skills"
	return s.status, nil
}

func (s *stubSkillProvider) UpdateSkill(_ context.Context, runtimeID string, skillKey string, body map[string]any) (any, error) {
	s.lastKey = runtimeID + "/skills/" + skillKey
	return s.update, nil
}

type stubModelProvider struct {
	list       map[string]any
	auth       map[string]any
	catalog    map[string]any
	configured map[string]any
	probe      map[string]any
	lastKey    string
}

func (s *stubModelProvider) ListModels(_ context.Context, runtimeID string) (any, error) {
	s.lastKey = runtimeID + "/models"
	return s.list, nil
}

func (s *stubModelProvider) GetModelAuthOverview(_ context.Context, runtimeID string) (any, error) {
	s.lastKey = runtimeID + "/models/auth"
	return s.auth, nil
}

func (s *stubModelProvider) ListModelCatalogProviders(_ context.Context, runtimeID string) (any, error) {
	s.lastKey = runtimeID + "/models/catalog-providers"
	return s.catalog, nil
}

func (s *stubModelProvider) ListConfiguredModels(_ context.Context, runtimeID string) (any, error) {
	s.lastKey = runtimeID + "/models/configured"
	return s.configured, nil
}

func (s *stubModelProvider) ProbeModelAuth(_ context.Context, runtimeID string, body map[string]any) (any, error) {
	s.lastKey = runtimeID + "/models/probe"
	return s.probe, nil
}

type stubChannelProvider struct {
	channels   map[string]any
	logout     map[string]any
	test       map[string]any
	throughput map[string]any
	patch      map[string]any
	lastKey    string
}

func (s *stubChannelProvider) GetChannels(_ context.Context, runtimeID string, params map[string]any) (any, error) {
	s.lastKey = runtimeID + "/channels"
	return s.channels, nil
}

func (s *stubChannelProvider) LogoutChannel(_ context.Context, runtimeID string, channelID string) (any, error) {
	s.lastKey = runtimeID + "/channels/" + channelID + "/logout"
	return s.logout, nil
}

func (s *stubChannelProvider) TestChannel(_ context.Context, runtimeID string, channelID string) (any, error) {
	s.lastKey = runtimeID + "/channels/" + channelID + "/test"
	return s.test, nil
}

func (s *stubChannelProvider) GetChannelThroughput(_ context.Context, runtimeID string, channelID string) (any, error) {
	s.lastKey = runtimeID + "/channels/" + channelID + "/throughput"
	return s.throughput, nil
}

func (s *stubChannelProvider) PatchChannel(_ context.Context, runtimeID string, channelID string, patch map[string]any) (any, error) {
	s.lastKey = runtimeID + "/channels/" + channelID + "/patch"
	return s.patch, nil
}

func (s *stubSkillProvider) InstallSkill(_ context.Context, runtimeID string, body map[string]any) (any, error) {
	s.lastKey = runtimeID + "/skills/install"
	return s.install, nil
}

func (s *stubSkillProvider) RunSkillsHubAction(_ context.Context, runtimeID string, body map[string]any) (any, error) {
	action, _ := body["action"].(string)
	s.lastKey = runtimeID + "/skills/hub/" + action
	switch action {
	case "search":
		return s.search, nil
	case "detail":
		return s.detail, nil
	case "install":
		return s.install, nil
	case "update":
		return s.update, nil
	case "bins":
		return s.bins, nil
	default:
		return map[string]any{"error": "unsupported"}, nil
	}
}

func (s *stubSkillProvider) UpdateClawhubSkill(_ context.Context, runtimeID string, body map[string]any) (any, error) {
	s.lastKey = runtimeID + "/skills/update-clawhub"
	return s.update, nil
}

func (s *stubNodeProvider) ListNodePairing(_ context.Context, runtimeID string) (any, error) {
	s.lastKey = runtimeID + "/nodes/pair"
	return s.pairs, nil
}

func (s *stubNodeProvider) RunNodePairAction(_ context.Context, runtimeID string, action string, body map[string]any) (any, error) {
	s.lastKey = runtimeID + "/nodes/pair/" + action
	return map[string]any{"ok": true, "action": action}, nil
}

func (s *stubApprovalProvider) ListPendingApprovals(_ context.Context, runtimeID string) (any, error) {
	s.lastKey = runtimeID + "/approvals/pending"
	return s.pending, nil
}

func (s *stubApprovalProvider) SetApprovalPolicy(_ context.Context, runtimeID string, body map[string]any) (any, error) {
	s.lastKey = runtimeID + "/approvals/policy"
	return map[string]any{"ok": true, "baseHash": body["baseHash"]}, nil
}

func (s *stubApprovalProvider) ListPluginApprovals(_ context.Context, runtimeID string) (any, error) {
	s.lastKey = runtimeID + "/approvals/plugins"
	return s.plugins, nil
}

func (s *stubApprovalProvider) ResolvePluginApproval(_ context.Context, runtimeID string, body map[string]any) (any, error) {
	s.lastKey = runtimeID + "/approvals/plugins/resolve"
	return map[string]any{"ok": true, "id": body["id"], "decision": body["decision"]}, nil
}

func TestMountRoutes_ListAndDetail(t *testing.T) {
	router := chi.NewRouter()
	sessions := &stubSessionProvider{
		metas: []deckapi.DeckGoSessionMeta{{
			Key:       "session-1",
			AgentId:   "main",
			Title:     "Test Session",
			Status:    "running",
			UpdatedAt: 123,
		}},
		detail: deckapi.DeckGoSessionDetailResponse{
			Session: deckapi.DeckGoSessionMeta{
				Key:     "session-1",
				AgentId: "main",
				Title:   "Test Session",
				Status:  "running",
			},
			Messages: []deckapi.DeckGoTranscriptMessage{{
				Id:   "msg-1",
				Role: "assistant",
			}},
		},
	}
	monitor := &stubMonitorProvider{
		activity: []runtimeprojection.ActivityEventEntry{{
			ID:          "act-1",
			Timestamp:   123,
			Type:        "chat",
			AgentID:     "main",
			Description: "Chat run completed",
		}},
		runs: []runtimeprojection.RunRecord{{
			RunID:      "run-1",
			AgentID:    "main",
			SessionKey: "agent:main:session-1",
			Status:     "completed",
		}},
		run: runtimeprojection.RunRecord{
			RunID:      "run-1",
			AgentID:    "main",
			SessionKey: "agent:main:session-1",
			Status:     "completed",
		},
		runEvents: []runtimeprojection.RunEventRow{{
			ID:         1,
			RunID:      "run-1",
			Seq:        1,
			Stream:     "chat",
			Data:       "{}",
			AgentID:    "main",
			SessionKey: "agent:main:session-1",
			CreatedAt:  "2026-04-21T00:00:00Z",
		}},
		stats: runtimeprojection.MonitorStats{
			TotalRuns:     1,
			TodayRuns:     1,
			AvgDurationMs: 42,
			TopAgents: []runtimeprojection.TopAgent{{
				AgentID:  "main",
				RunCount: 1,
			}},
		},
	}
	diagnostics := &stubGatewayDiagnosticProvider{
		describe: map[string]any{
			"methods": []map[string]any{{"name": "sessions.create"}},
			"events":  []map[string]any{{"name": "chat"}},
		},
		health: map[string]any{
			"ok":         true,
			"durationMs": 12,
			"channels":   map[string]any{"discord": "connected"},
			"agents": []map[string]any{{
				"agentId":  "main",
				"sessions": map[string]any{"count": 1},
			}},
		},
		status: map[string]any{
			"sessions":  1,
			"channels":  map[string]any{"discord": "connected"},
			"heartbeat": "ok",
			"state":     "active",
		},
	}
	devices := &stubDeviceProvider{
		list: map[string]any{
			"pending":  []map[string]any{{"requestId": "req-1"}},
			"approved": []map[string]any{{"deviceId": "dev-1"}},
		},
		deviceID: "dev-local",
	}
	config := &stubConfigProvider{
		config: map[string]any{
			"config":   map[string]any{"agents": map[string]any{}},
			"baseHash": "cfg-1",
			"valid":    true,
			"exists":   true,
		},
		schema: map[string]any{
			"type": "object",
		},
		lookup: map[string]any{
			"path":   "agents.defaults",
			"schema": map[string]any{"type": "object"},
		},
	}
	agents := &stubAgentProvider{
		list: map[string]any{
			"agents": []map[string]any{{
				"id":   "main",
				"name": "Main",
			}},
		},
		identity: map[string]any{
			"agentId": "main",
			"name":    "Main",
		},
		files: map[string]any{
			"files": []map[string]any{{"name": "AGENTS.md"}},
		},
		file: map[string]any{
			"name":    "notes/README.md",
			"content": "hello",
		},
	}
	misc := &stubMiscQueryProvider{
		commands:   map[string]any{"commands": []map[string]any{{"name": "/help"}}},
		tools:      map[string]any{"groups": []map[string]any{{"name": "default"}}},
		usage:      map[string]any{"totals": map[string]any{"totalCost": 12}},
		cronStatus: map[string]any{"running": true},
		discover:   map[string]any{"commands": []map[string]any{{"name": "/deploy"}}},
		effective:  map[string]any{"groups": []map[string]any{{"name": "core"}}},
	}
	deck := &stubDeckProvider{
		plugins:   map[string]any{"plugins": []map[string]any{{"id": "plugin-1"}}},
		agent:     map[string]any{"agentId": "main", "name": "Main"},
		identity:  map[string]any{"identities": []map[string]any{{"canonical": "user:1"}}},
		routing:   map[string]any{"bindings": []map[string]any{{"id": "route-1"}}},
		subagents: map[string]any{"runs": []map[string]any{{"runId": "sub-1"}}},
		threads:   map[string]any{"threads": []map[string]any{{"id": "thread-1"}}},
	}
	approvals := &stubApprovalProvider{
		approvals: map[string]any{"path": "approvals.json", "exists": true, "hash": "h1", "file": map[string]any{"policy": "strict"}},
		pending:   map[string]any{"pending": []map[string]any{{"id": "ap-1"}}},
		plugins:   []map[string]any{{"id": "plugin-ap-1"}},
	}
	memory := &stubMemoryProvider{
		health: map[string]any{"entries": []map[string]any{{"agentId": "main"}}, "lanceDbEnabled": false},
	}
	nodes := &stubNodeProvider{
		list:  map[string]any{"nodes": []map[string]any{{"id": "node-1"}}},
		pairs: map[string]any{"requests": []map[string]any{{"pairingCode": "pair-1"}}},
	}
	skills := &stubSkillProvider{
		status:  map[string]any{"skills": []map[string]any{{"skillKey": "demo"}}},
		search:  map[string]any{"items": []map[string]any{{"slug": "demo"}}},
		detail:  map[string]any{"slug": "demo"},
		install: map[string]any{"ok": true},
		update:  map[string]any{"ok": true},
		bins:    map[string]any{"bins": []string{"tool-a"}},
	}
	models := &stubModelProvider{
		list:       map[string]any{"items": []map[string]any{{"id": "gpt-5.4"}}},
		auth:       map[string]any{"providers": []map[string]any{{"provider": "openai"}}},
		catalog:    map[string]any{"providers": []map[string]any{{"id": "openai"}}},
		configured: map[string]any{"models": []map[string]any{{"id": "gpt-5.4"}}},
		probe:      map[string]any{"ok": true, "provider": "openai"},
	}
	channels := &stubChannelProvider{
		channels:   map[string]any{"channelOrder": []string{"telegram"}},
		logout:     map[string]any{"ok": true},
		test:       map[string]any{"ok": true, "channelId": "telegram", "check": "probe"},
		throughput: map[string]any{"buckets": []any{}, "messagesIn": 0, "messagesOut": 0},
		patch:      map[string]any{"ok": true},
	}
	MountRoutes(router, stubRuntimeProvider{
		items: []runtimeregistry.RuntimeSummary{{
			RuntimeID:         DefaultRuntimeID,
			Managed:           true,
			Configured:        true,
			Status:            "running",
			Health:            "healthy",
			CapabilityVersion: pointerTo("3.1"),
			MethodCount:       pointerTo(81),
			EventCount:        pointerTo(5),
			GatewayURL:        pointerTo("ws://127.0.0.1:18789"),
			LastError:         pointerTo("none"),
			AutoStart:         true,
			OccurredAt:        "2026-04-21T00:00:00Z",
		}},
	}, sessions, monitor, diagnostics, devices, config, agents, misc, deck, approvals, memory, nodes, skills, models, channels, &stubCommandProvider{})

	server := httptest.NewServer(router)
	defer server.Close()

	t.Run("lists runtimes", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}

		var payload struct {
			Runtimes  []map[string]any `json:"runtimes"`
			RequestID string           `json:"requestId"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if len(payload.Runtimes) != 1 {
			t.Fatalf("expected one runtime, got %#v", payload)
		}
		if payload.Runtimes[0]["runtimeId"] != DefaultRuntimeID {
			t.Fatalf("unexpected runtime payload: %#v", payload.Runtimes[0])
		}
		if payload.Runtimes[0]["status"] != "running" {
			t.Fatalf("unexpected runtime status: %#v", payload.Runtimes[0])
		}
		if payload.Runtimes[0]["capabilityVersion"] != "3.1" {
			t.Fatalf("unexpected runtime capability payload: %#v", payload.Runtimes[0])
		}
		if payload.Runtimes[0]["methodCount"] != float64(81) || payload.Runtimes[0]["eventCount"] != float64(5) {
			t.Fatalf("unexpected runtime inventory payload: %#v", payload.Runtimes[0])
		}
		if payload.Runtimes[0]["managed"] != true || payload.Runtimes[0]["configured"] != true {
			t.Fatalf("unexpected runtime state payload: %#v", payload.Runtimes[0])
		}
		if payload.Runtimes[0]["gatewayUrl"] != "ws://127.0.0.1:18789" || payload.Runtimes[0]["lastError"] != "none" {
			t.Fatalf("unexpected runtime transport payload: %#v", payload.Runtimes[0])
		}
		if payload.Runtimes[0]["autoStart"] != true {
			t.Fatalf("unexpected runtime autostart payload: %#v", payload.Runtimes[0])
		}
		if payload.RequestID == "" {
			t.Fatalf("expected request id, got %#v", payload)
		}
	})

	t.Run("fetches one runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}

		var payload struct {
			Runtime map[string]any `json:"runtime"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.Runtime["runtimeId"] != DefaultRuntimeID {
			t.Fatalf("unexpected runtime payload: %#v", payload.Runtime)
		}
		if payload.Runtime["health"] != "healthy" {
			t.Fatalf("unexpected runtime payload: %#v", payload.Runtime)
		}
		if payload.Runtime["capabilityVersion"] != "3.1" {
			t.Fatalf("unexpected runtime capability payload: %#v", payload.Runtime)
		}
		if payload.Runtime["methodCount"] != float64(81) || payload.Runtime["eventCount"] != float64(5) {
			t.Fatalf("unexpected runtime inventory payload: %#v", payload.Runtime)
		}
		if payload.Runtime["managed"] != true || payload.Runtime["configured"] != true {
			t.Fatalf("unexpected runtime state payload: %#v", payload.Runtime)
		}
		if payload.Runtime["gatewayUrl"] != "ws://127.0.0.1:18789" || payload.Runtime["lastError"] != "none" {
			t.Fatalf("unexpected runtime transport payload: %#v", payload.Runtime)
		}
		if payload.Runtime["autoStart"] != true {
			t.Fatalf("unexpected runtime autostart payload: %#v", payload.Runtime)
		}
	})

	t.Run("returns not found for unknown runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/rt_other")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusNotFound {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}

		var payload map[string]any
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		errorEnvelope, ok := payload["error"].(map[string]any)
		if !ok || errorEnvelope["code"] != "RUNTIME_NOT_FOUND" {
			t.Fatalf("unexpected error payload: %#v", payload)
		}
	})

	t.Run("lists sessions for a runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/sessions")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}

		var payload struct {
			RuntimeID string                      `json:"runtimeId"`
			Sessions  []deckapi.DeckGoSessionMeta `json:"sessions"`
			RequestID string                      `json:"requestId"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID {
			t.Fatalf("unexpected runtime id: %#v", payload)
		}
		if len(payload.Sessions) != 1 || payload.Sessions[0].Key != "session-1" {
			t.Fatalf("unexpected sessions payload: %#v", payload)
		}
		if sessions.lastKey != DefaultRuntimeID {
			t.Fatalf("unexpected provider invocation: %q", sessions.lastKey)
		}
	})

	t.Run("returns timeline snapshot for a session", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/sessions/session-1/timeline")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}

		var payload struct {
			RuntimeID string                            `json:"runtimeId"`
			SessionID string                            `json:"sessionId"`
			Timeline  []deckapi.DeckGoTranscriptMessage `json:"timeline"`
			ActiveRun map[string]any                    `json:"activeRun"`
			RequestID string                            `json:"requestId"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || payload.SessionID != "session-1" {
			t.Fatalf("unexpected timeline ids: %#v", payload)
		}
		if len(payload.Timeline) != 1 || payload.Timeline[0].Id != "msg-1" {
			t.Fatalf("unexpected timeline payload: %#v", payload)
		}
		if payload.ActiveRun["status"] != "running" {
			t.Fatalf("expected active run summary, got %#v", payload.ActiveRun)
		}
		if sessions.lastKey != DefaultRuntimeID+"/session-1" {
			t.Fatalf("unexpected provider invocation: %q", sessions.lastKey)
		}
	})

	t.Run("lists runs for a runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/runs")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}

		var payload struct {
			RuntimeID string                        `json:"runtimeId"`
			Runs      []runtimeprojection.RunRecord `json:"runs"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || len(payload.Runs) != 1 || payload.Runs[0].RunID != "run-1" {
			t.Fatalf("unexpected runs payload: %#v", payload)
		}
		if monitor.lastKey != DefaultRuntimeID {
			t.Fatalf("unexpected monitor invocation: %q", monitor.lastKey)
		}
	})

	t.Run("filters and paginates runs for a runtime", func(t *testing.T) {
		monitor.runs = []runtimeprojection.RunRecord{
			{RunID: "run-3", AgentID: "main", SessionKey: "session-1", FirstEventAt: "2026-04-21T00:03:00Z", LastEventAt: "2026-04-21T00:05:00Z", Status: "completed"},
			{RunID: "run-2", AgentID: "main", SessionKey: "session-1", FirstEventAt: "2026-04-21T00:02:00Z", LastEventAt: "2026-04-21T00:04:00Z", Status: "completed"},
			{RunID: "run-1", AgentID: "other", SessionKey: "session-2", FirstEventAt: "2026-04-21T00:01:00Z", LastEventAt: "2026-04-21T00:03:00Z", Status: "error"},
		}
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/runs?agentId=main&status=completed&limit=1")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}

		var payload struct {
			RuntimeID  string                        `json:"runtimeId"`
			Runs       []runtimeprojection.RunRecord `json:"runs"`
			NextCursor string                        `json:"nextCursor"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || len(payload.Runs) != 1 || payload.Runs[0].RunID != "run-3" || payload.NextCursor != "run-3" {
			t.Fatalf("unexpected filtered runs payload: %#v", payload)
		}
	})

	t.Run("lists activity for a runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/activity?limit=25")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}

		var payload struct {
			RuntimeID string                                 `json:"runtimeId"`
			Events    []runtimeprojection.ActivityEventEntry `json:"events"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || len(payload.Events) != 1 || payload.Events[0].ID != "act-1" {
			t.Fatalf("unexpected activity payload: %#v", payload)
		}
		if monitor.lastKey != DefaultRuntimeID+"/activity/25" {
			t.Fatalf("unexpected activity invocation: %q", monitor.lastKey)
		}
	})

	t.Run("returns run detail", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/runs/run-1")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}

		var payload struct {
			RuntimeID string                          `json:"runtimeId"`
			RunID     string                          `json:"runId"`
			Run       runtimeprojection.RunRecord     `json:"run"`
			Events    []runtimeprojection.RunEventRow `json:"events"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || payload.RunID != "run-1" || payload.Run.RunID != "run-1" || len(payload.Events) != 1 {
			t.Fatalf("unexpected run detail payload: %#v", payload)
		}
		if monitor.lastRunKey != DefaultRuntimeID+"/run-1" {
			t.Fatalf("unexpected monitor run invocation: %q", monitor.lastRunKey)
		}
	})

	t.Run("returns stats for a runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/stats")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}

		var payload struct {
			RuntimeID string                         `json:"runtimeId"`
			Stats     runtimeprojection.MonitorStats `json:"stats"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || payload.Stats.TotalRuns != 1 || len(payload.Stats.TopAgents) != 1 {
			t.Fatalf("unexpected stats payload: %#v", payload)
		}
		if monitor.lastKey != DefaultRuntimeID+"/stats" {
			t.Fatalf("unexpected monitor stats invocation: %q", monitor.lastKey)
		}
	})

	t.Run("returns gateway health for a runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/gateway/health")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}

		var payload struct {
			RuntimeID string         `json:"runtimeId"`
			Health    map[string]any `json:"health"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || payload.Health["ok"] != true {
			t.Fatalf("unexpected gateway health payload: %#v", payload)
		}
		if diagnostics.lastKey != DefaultRuntimeID+"/gateway/health" {
			t.Fatalf("unexpected diagnostic invocation: %q", diagnostics.lastKey)
		}
	})

	t.Run("returns gateway describe for a runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/gateway/describe?includeSchemas=false")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}

		var payload struct {
			RuntimeID string         `json:"runtimeId"`
			Describe  map[string]any `json:"describe"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID {
			t.Fatalf("unexpected gateway describe payload: %#v", payload)
		}
		methods, ok := payload.Describe["methods"].([]any)
		if !ok || len(methods) != 1 {
			t.Fatalf("unexpected gateway describe methods: %#v", payload.Describe)
		}
		if diagnostics.lastKey != DefaultRuntimeID+"/gateway/describe/false" {
			t.Fatalf("unexpected diagnostic invocation: %q", diagnostics.lastKey)
		}
	})

	t.Run("returns gateway status for a runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/gateway/status")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}

		var payload struct {
			RuntimeID string         `json:"runtimeId"`
			Status    map[string]any `json:"status"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || payload.Status["state"] != "active" {
			t.Fatalf("unexpected gateway status payload: %#v", payload)
		}
		if diagnostics.lastKey != DefaultRuntimeID+"/gateway/status" {
			t.Fatalf("unexpected diagnostic invocation: %q", diagnostics.lastKey)
		}
	})

	t.Run("returns devices for a runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/devices")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload struct {
			RuntimeID string         `json:"runtimeId"`
			Devices   map[string]any `json:"devices"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || payload.Devices["pending"] == nil || payload.Devices["approved"] == nil {
			t.Fatalf("unexpected devices payload: %#v", payload)
		}
		if devices.lastKey != DefaultRuntimeID+"/devices" {
			t.Fatalf("unexpected device invocation: %q", devices.lastKey)
		}
	})

	t.Run("returns current device id for a runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/devices/self")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload struct {
			RuntimeID string `json:"runtimeId"`
			DeviceID  string `json:"deviceId"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || payload.DeviceID != "dev-local" {
			t.Fatalf("unexpected devices/self payload: %#v", payload)
		}
		if devices.lastKey != DefaultRuntimeID+"/devices/self" {
			t.Fatalf("unexpected device invocation: %q", devices.lastKey)
		}
	})

	t.Run("returns config for a runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/config")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload struct {
			RuntimeID string         `json:"runtimeId"`
			Config    map[string]any `json:"config"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || payload.Config["baseHash"] != "cfg-1" {
			t.Fatalf("unexpected config payload: %#v", payload)
		}
		if config.lastKey != DefaultRuntimeID+"/config" {
			t.Fatalf("unexpected config invocation: %q", config.lastKey)
		}
	})

	t.Run("returns config schema for a runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/config/schema")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload struct {
			RuntimeID string         `json:"runtimeId"`
			Schema    map[string]any `json:"schema"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || payload.Schema["type"] != "object" {
			t.Fatalf("unexpected config schema payload: %#v", payload)
		}
		if config.lastKey != DefaultRuntimeID+"/config/schema" {
			t.Fatalf("unexpected config invocation: %q", config.lastKey)
		}
	})

	t.Run("returns config schema lookup for a runtime", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/runtimes/"+DefaultRuntimeID+"/config/schema-lookup", strings.NewReader(`{"path":"agents.defaults"}`))
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
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload map[string]any
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload["path"] != "agents.defaults" {
			t.Fatalf("unexpected config lookup payload: %#v", payload)
		}
		if config.lastKey != DefaultRuntimeID+"/config/schema-lookup/agents.defaults" {
			t.Fatalf("unexpected config invocation: %q", config.lastKey)
		}
	})

	t.Run("returns agents for a runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/agents")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload struct {
			RuntimeID string         `json:"runtimeId"`
			Payload   map[string]any `json:"payload"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || payload.Payload["agents"] == nil {
			t.Fatalf("unexpected agents payload: %#v", payload)
		}
		if agents.lastKey != DefaultRuntimeID+"/agents" {
			t.Fatalf("unexpected agent invocation: %q", agents.lastKey)
		}
	})

	t.Run("returns one agent for a runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/agents/main")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload struct {
			RuntimeID string         `json:"runtimeId"`
			AgentID   string         `json:"agentId"`
			Payload   map[string]any `json:"payload"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || payload.AgentID != "main" || payload.Payload["id"] != "main" {
			t.Fatalf("unexpected agent payload: %#v", payload)
		}
	})

	t.Run("returns agent identity for a runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/agents/main/identity")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload struct {
			RuntimeID string         `json:"runtimeId"`
			AgentID   string         `json:"agentId"`
			Payload   map[string]any `json:"payload"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || payload.Payload["agentId"] != "main" {
			t.Fatalf("unexpected agent identity payload: %#v", payload)
		}
	})

	t.Run("returns agent files for a runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/agents/main/files")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload struct {
			RuntimeID string         `json:"runtimeId"`
			AgentID   string         `json:"agentId"`
			Payload   map[string]any `json:"payload"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || payload.Payload["files"] == nil {
			t.Fatalf("unexpected agent files payload: %#v", payload)
		}
	})

	t.Run("returns one agent file for a runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/agents/main/files/notes/README.md")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload struct {
			RuntimeID string         `json:"runtimeId"`
			AgentID   string         `json:"agentId"`
			Name      string         `json:"name"`
			Payload   map[string]any `json:"payload"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || payload.Name != "notes/README.md" || payload.Payload["name"] != "notes/README.md" {
			t.Fatalf("unexpected agent file payload: %#v", payload)
		}
	})

	t.Run("creates an agent for a runtime", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/runtimes/"+DefaultRuntimeID+"/agents", strings.NewReader(`{"name":"Ops","workspace":"/tmp/workspace-ops"}`))
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
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if agents.lastKey != DefaultRuntimeID+"/agents:create" {
			t.Fatalf("unexpected agent create invocation: %q", agents.lastKey)
		}
		if agents.lastBody != "/tmp/workspace-ops" {
			t.Fatalf("unexpected agent create workspace: %q", agents.lastBody)
		}
	})

	t.Run("returns commands for a runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/commands")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload struct {
			RuntimeID string         `json:"runtimeId"`
			Payload   map[string]any `json:"payload"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || payload.Payload["commands"] == nil {
			t.Fatalf("unexpected commands payload: %#v", payload)
		}
	})

	t.Run("returns tools catalog for a runtime", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/runtimes/"+DefaultRuntimeID+"/tools/catalog", strings.NewReader(`{"agentId":"main"}`))
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
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload struct {
			RuntimeID string         `json:"runtimeId"`
			Payload   map[string]any `json:"payload"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || payload.Payload["groups"] == nil {
			t.Fatalf("unexpected tools payload: %#v", payload)
		}
	})

	t.Run("returns usage for a runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/usage")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload struct {
			RuntimeID string         `json:"runtimeId"`
			Payload   map[string]any `json:"payload"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || payload.Payload["totals"] == nil {
			t.Fatalf("unexpected usage payload: %#v", payload)
		}
	})

	t.Run("returns cron jobs for a runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/cron?limit=10")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload struct {
			RuntimeID string         `json:"runtimeId"`
			Payload   map[string]any `json:"payload"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || payload.Payload["items"] == nil {
			t.Fatalf("unexpected cron payload: %#v", payload)
		}
	})

	t.Run("returns cron status for a runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/cron/status")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload struct {
			RuntimeID string         `json:"runtimeId"`
			Payload   map[string]any `json:"payload"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || payload.Payload["running"] != true {
			t.Fatalf("unexpected cron status payload: %#v", payload)
		}
	})

	t.Run("returns deck command discovery for a runtime", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/runtimes/"+DefaultRuntimeID+"/deck/commands/discover", strings.NewReader(`{"agentId":"main"}`))
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
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload struct {
			RuntimeID string         `json:"runtimeId"`
			Payload   map[string]any `json:"payload"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || payload.Payload["commands"] == nil {
			t.Fatalf("unexpected deck commands payload: %#v", payload)
		}
	})

	t.Run("returns deck tools effective for a runtime", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/runtimes/"+DefaultRuntimeID+"/deck/tools-effective", strings.NewReader(`{"agentId":"main","sessionKey":"agent:main:main"}`))
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
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload struct {
			RuntimeID string         `json:"runtimeId"`
			Payload   map[string]any `json:"payload"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || payload.Payload["groups"] == nil {
			t.Fatalf("unexpected tools effective payload: %#v", payload)
		}
	})

	t.Run("returns approvals snapshot for a runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/approvals")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload struct {
			RuntimeID string         `json:"runtimeId"`
			Payload   map[string]any `json:"payload"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || payload.Payload["path"] != "approvals.json" {
			t.Fatalf("unexpected approvals payload: %#v", payload)
		}
	})

	t.Run("returns pending approvals for a runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/approvals/pending")
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
		if payload["pending"] == nil {
			t.Fatalf("unexpected pending approvals payload: %#v", payload)
		}
	})

	t.Run("returns approvals policy snapshot for a runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/approvals/policy")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload struct {
			RuntimeID string         `json:"runtimeId"`
			Payload   map[string]any `json:"payload"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || payload.Payload["hash"] != "h1" {
			t.Fatalf("unexpected approvals policy payload: %#v", payload)
		}
	})

	t.Run("returns plugin approvals for a runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/approvals/plugins")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload []map[string]any
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if len(payload) != 1 || payload[0]["id"] != "plugin-ap-1" {
			t.Fatalf("unexpected plugin approvals payload: %#v", payload)
		}
	})

	t.Run("returns memory health for a runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/memory/health")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload struct {
			RuntimeID string         `json:"runtimeId"`
			Payload   map[string]any `json:"payload"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || payload.Payload["entries"] == nil {
			t.Fatalf("unexpected memory health payload: %#v", payload)
		}
	})

	t.Run("returns nodes for a runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/nodes")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload struct {
			RuntimeID string         `json:"runtimeId"`
			Payload   map[string]any `json:"payload"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || payload.Payload["nodes"] == nil {
			t.Fatalf("unexpected nodes payload: %#v", payload)
		}
	})

	t.Run("returns node pairing for a runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/nodes/pair")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload struct {
			RuntimeID string         `json:"runtimeId"`
			Payload   map[string]any `json:"payload"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || payload.Payload["requests"] == nil {
			t.Fatalf("unexpected node pairing payload: %#v", payload)
		}
	})

	t.Run("returns skills for a runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/skills?agentId=main")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload struct {
			RuntimeID string         `json:"runtimeId"`
			Payload   map[string]any `json:"payload"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || payload.Payload["skills"] == nil {
			t.Fatalf("unexpected skills payload: %#v", payload)
		}
	})

	t.Run("returns models for a runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/models")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload struct {
			RuntimeID string         `json:"runtimeId"`
			Payload   map[string]any `json:"payload"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || payload.Payload["items"] == nil {
			t.Fatalf("unexpected models payload: %#v", payload)
		}
	})

	t.Run("returns model auth overview for a runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/models/auth")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload struct {
			RuntimeID string         `json:"runtimeId"`
			Payload   map[string]any `json:"payload"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || payload.Payload["providers"] == nil {
			t.Fatalf("unexpected model auth payload: %#v", payload)
		}
	})

	t.Run("returns model catalog providers for a runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/models/catalog-providers")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload struct {
			RuntimeID string         `json:"runtimeId"`
			Payload   map[string]any `json:"payload"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || payload.Payload["providers"] == nil {
			t.Fatalf("unexpected catalog providers payload: %#v", payload)
		}
	})

	t.Run("returns configured models for a runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/models/configured")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload struct {
			RuntimeID string         `json:"runtimeId"`
			Payload   map[string]any `json:"payload"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || payload.Payload["models"] == nil {
			t.Fatalf("unexpected configured models payload: %#v", payload)
		}
	})

	t.Run("returns channels for a runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/channels?probe=true")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload struct {
			RuntimeID string         `json:"runtimeId"`
			Payload   map[string]any `json:"payload"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || payload.Payload["channelOrder"] == nil {
			t.Fatalf("unexpected channels payload: %#v", payload)
		}
	})

	t.Run("returns deck plugins for a runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/deck/plugins?capability=all")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload struct {
			RuntimeID string         `json:"runtimeId"`
			Payload   map[string]any `json:"payload"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || payload.Payload["plugins"] == nil {
			t.Fatalf("unexpected deck plugins payload: %#v", payload)
		}
		if deck.lastKey != DefaultRuntimeID+"/deck/plugins" {
			t.Fatalf("unexpected deck plugins invocation: %q", deck.lastKey)
		}
	})

	t.Run("returns deck agent detail for a runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/deck/agents?agentId=main")
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
		if payload["agentId"] != "main" {
			t.Fatalf("unexpected deck agent payload: %#v", payload)
		}
		if deck.lastKey != DefaultRuntimeID+"/deck/agents/main" {
			t.Fatalf("unexpected deck agent invocation: %q", deck.lastKey)
		}
	})

	t.Run("returns deck identity for a runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/deck/identity")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload struct {
			RuntimeID string         `json:"runtimeId"`
			Payload   map[string]any `json:"payload"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || payload.Payload["identities"] == nil {
			t.Fatalf("unexpected deck identity payload: %#v", payload)
		}
		if deck.lastKey != DefaultRuntimeID+"/deck/identity" {
			t.Fatalf("unexpected deck identity invocation: %q", deck.lastKey)
		}
	})

	t.Run("returns deck routing for a runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/deck/routing?agentId=main")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload struct {
			RuntimeID string         `json:"runtimeId"`
			Payload   map[string]any `json:"payload"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || payload.Payload["bindings"] == nil {
			t.Fatalf("unexpected deck routing payload: %#v", payload)
		}
		if deck.lastKey != DefaultRuntimeID+"/deck/routing" {
			t.Fatalf("unexpected deck routing invocation: %q", deck.lastKey)
		}
	})

	t.Run("returns deck subagents for a runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/deck/subagents?status=active")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload struct {
			RuntimeID string         `json:"runtimeId"`
			Payload   map[string]any `json:"payload"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || payload.Payload["runs"] == nil {
			t.Fatalf("unexpected deck subagents payload: %#v", payload)
		}
		if deck.lastKey != DefaultRuntimeID+"/deck/subagents" {
			t.Fatalf("unexpected deck subagents invocation: %q", deck.lastKey)
		}
	})

	t.Run("returns deck threads for a runtime", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/deck/threads?agentId=main")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload struct {
			RuntimeID string         `json:"runtimeId"`
			Payload   map[string]any `json:"payload"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.RuntimeID != DefaultRuntimeID || payload.Payload["threads"] == nil {
			t.Fatalf("unexpected deck threads payload: %#v", payload)
		}
		if deck.lastKey != DefaultRuntimeID+"/deck/threads" {
			t.Fatalf("unexpected deck threads invocation: %q", deck.lastKey)
		}
	})
}

type stubCommandProvider struct {
	lastKey  string
	lastBody string
}

func (s *stubCommandProvider) CreateSession(_ context.Context, runtimeID string, agentID string, message string, model string, label string, parentSessionKey string) (deckapi.DeckGoSessionCreateResponse, error) {
	s.lastKey = runtimeID + "/create/" + agentID + "/" + parentSessionKey
	s.lastBody = message + "|" + model + "|" + label
	return deckapi.DeckGoSessionCreateResponse{
		Ok:         true,
		Key:        "agent:main:new",
		SessionId:  "session-new",
		RunStarted: true,
		RunId:      "run-new",
		Status:     "started",
	}, nil
}

func (s *stubCommandProvider) SendMessage(_ context.Context, runtimeID string, sessionID string, text string, attachments []map[string]any, idempotencyKey string) error {
	s.lastKey = runtimeID + "/" + sessionID + "/send/" + idempotencyKey
	s.lastBody = text
	return nil
}

func (s *stubCommandProvider) AbortRun(_ context.Context, runtimeID string, runID string, idempotencyKey string) error {
	s.lastKey = runtimeID + "/" + runID + "/abort/" + idempotencyKey
	return nil
}

func (s *stubCommandProvider) CompactSession(_ context.Context, runtimeID string, sessionID string, idempotencyKey string) error {
	s.lastKey = runtimeID + "/" + sessionID + "/compact/" + idempotencyKey
	return nil
}

func (s *stubCommandProvider) DeleteSession(_ context.Context, runtimeID string, sessionID string, idempotencyKey string) error {
	s.lastKey = runtimeID + "/" + sessionID + "/delete/" + idempotencyKey
	return nil
}

func (s *stubCommandProvider) ResetSession(_ context.Context, runtimeID string, sessionID string, reason string, idempotencyKey string) error {
	s.lastKey = runtimeID + "/" + sessionID + "/reset/" + reason + "/" + idempotencyKey
	return nil
}

func (s *stubCommandProvider) ClearSession(_ context.Context, runtimeID string, sessionID string, idempotencyKey string) error {
	s.lastKey = runtimeID + "/" + sessionID + "/clear/" + idempotencyKey
	return nil
}

func (s *stubCommandProvider) PatchSession(_ context.Context, runtimeID string, sessionID string, patch map[string]any, idempotencyKey string) error {
	s.lastKey = runtimeID + "/" + sessionID + "/patch/" + idempotencyKey
	if patch != nil {
		if model, ok := patch["model"].(string); ok {
			s.lastBody = model
		}
	}
	return nil
}

func TestMountRoutes_CommandEndpoints(t *testing.T) {
	router := chi.NewRouter()
	commands := &stubCommandProvider{}
	devices := &stubDeviceProvider{}
	config := &stubConfigProvider{}
	agents := &stubAgentProvider{}
	misc := &stubMiscQueryProvider{}
	deck := &stubDeckProvider{}
	approvals := &stubApprovalProvider{}
	memory := &stubMemoryProvider{}
	nodes := &stubNodeProvider{}
	skills := &stubSkillProvider{}
	models := &stubModelProvider{}
	channels := &stubChannelProvider{}
	MountRoutes(router, stubRuntimeProvider{items: nil}, nil, nil, nil, devices, config, agents, misc, deck, approvals, memory, nodes, skills, models, channels, commands)

	server := httptest.NewServer(router)
	defer server.Close()

	t.Run("creates session", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/runtimes/"+DefaultRuntimeID+"/sessions:create", strings.NewReader(`{"agentId":"main","message":"boot","model":"gpt-5.4","label":"Boot","parentSessionKey":"agent:main:parent"}`))
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
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload deckapi.DeckGoSessionCreateResponse
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if !payload.Ok || payload.Key != "agent:main:new" || payload.SessionId != "session-new" || payload.RunId != "run-new" {
			t.Fatalf("unexpected create payload: %#v", payload)
		}
		if commands.lastKey != DefaultRuntimeID+"/create/main/agent:main:parent" || commands.lastBody != "boot|gpt-5.4|Boot" {
			t.Fatalf("unexpected create invocation: %q / %q", commands.lastKey, commands.lastBody)
		}
	})

	t.Run("approves device request", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/runtimes/"+DefaultRuntimeID+"/devices/approve", strings.NewReader(`{"requestId":"req-1"}`))
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
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if devices.lastKey != DefaultRuntimeID+"/devices/approve/req-1" {
			t.Fatalf("unexpected approve invocation: %q", devices.lastKey)
		}
	})

	t.Run("rejects device request", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/runtimes/"+DefaultRuntimeID+"/devices/reject", strings.NewReader(`{"requestId":"req-1"}`))
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
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if devices.lastKey != DefaultRuntimeID+"/devices/reject/req-1" {
			t.Fatalf("unexpected reject invocation: %q", devices.lastKey)
		}
	})

	t.Run("removes device", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/runtimes/"+DefaultRuntimeID+"/devices/remove", strings.NewReader(`{"deviceId":"dev-1"}`))
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
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if devices.lastKey != DefaultRuntimeID+"/devices/remove/dev-1" {
			t.Fatalf("unexpected remove invocation: %q", devices.lastKey)
		}
	})

	t.Run("rotates device token", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/runtimes/"+DefaultRuntimeID+"/devices/token/rotate", strings.NewReader(`{"deviceId":"dev-1","role":"operator"}`))
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
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if devices.lastKey != DefaultRuntimeID+"/devices/token/rotate/dev-1/operator" {
			t.Fatalf("unexpected rotate invocation: %q", devices.lastKey)
		}
	})

	t.Run("revokes device token", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/runtimes/"+DefaultRuntimeID+"/devices/token/revoke", strings.NewReader(`{"deviceId":"dev-1","role":"operator"}`))
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
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if devices.lastKey != DefaultRuntimeID+"/devices/token/revoke/dev-1/operator" {
			t.Fatalf("unexpected revoke invocation: %q", devices.lastKey)
		}
	})

	t.Run("patches config", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/runtimes/"+DefaultRuntimeID+"/config:patch", strings.NewReader(`{"patch":{"a":1},"baseHash":"cfg-1"}`))
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
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if config.lastKey != DefaultRuntimeID+"/config:patch/cfg-1" || config.lastRaw != `{"a":1}` {
			t.Fatalf("unexpected config patch invocation: %q / %q", config.lastKey, config.lastRaw)
		}
	})

	t.Run("applies config", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/runtimes/"+DefaultRuntimeID+"/config:apply", strings.NewReader(`{"raw":"{\"a\":1}","baseHash":"cfg-2"}`))
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
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if config.lastKey != DefaultRuntimeID+"/config:apply/cfg-2" || config.lastRaw != `{"a":1}` {
			t.Fatalf("unexpected config apply invocation: %q / %q", config.lastKey, config.lastRaw)
		}
	})

	t.Run("resolves approval", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/runtimes/"+DefaultRuntimeID+"/approvals/resolve", strings.NewReader(`{"id":"ap-1","decision":"approve"}`))
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
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if approvals.lastKey != DefaultRuntimeID+"/approvals/resolve" {
			t.Fatalf("unexpected approvals resolve invocation: %q", approvals.lastKey)
		}
	})

	t.Run("sets approval policy", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPut, server.URL+"/runtimes/"+DefaultRuntimeID+"/approvals/policy", strings.NewReader(`{"file":{"policy":"strict"},"baseHash":"h1"}`))
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
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if approvals.lastKey != DefaultRuntimeID+"/approvals/policy" {
			t.Fatalf("unexpected approvals policy invocation: %q", approvals.lastKey)
		}
	})

	t.Run("resolves plugin approval", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/runtimes/"+DefaultRuntimeID+"/approvals/plugins/resolve", strings.NewReader(`{"id":"plugin-ap-1","decision":"approve"}`))
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
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if approvals.lastKey != DefaultRuntimeID+"/approvals/plugins/resolve" {
			t.Fatalf("unexpected plugin approvals invocation: %q", approvals.lastKey)
		}
	})

	t.Run("adds cron job", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/runtimes/"+DefaultRuntimeID+"/cron", strings.NewReader(`{"name":"Nightly"}`))
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
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if misc.lastKey != DefaultRuntimeID+"/cron:add" {
			t.Fatalf("unexpected cron add invocation: %q", misc.lastKey)
		}
	})

	t.Run("updates cron job", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPatch, server.URL+"/runtimes/"+DefaultRuntimeID+"/cron/job-1", strings.NewReader(`{"enabled":false}`))
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
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if misc.lastKey != DefaultRuntimeID+"/cron/job-1:patch" {
			t.Fatalf("unexpected cron update invocation: %q", misc.lastKey)
		}
	})

	t.Run("deletes cron job", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodDelete, server.URL+"/runtimes/"+DefaultRuntimeID+"/cron/job-1", nil)
		if err != nil {
			t.Fatal(err)
		}
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if misc.lastKey != DefaultRuntimeID+"/cron/job-1:delete" {
			t.Fatalf("unexpected cron delete invocation: %q", misc.lastKey)
		}
	})

	t.Run("runs cron job", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/runtimes/"+DefaultRuntimeID+"/cron/job-1/run", strings.NewReader(`{"mode":"force"}`))
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
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if misc.lastKey != DefaultRuntimeID+"/cron/job-1:run" {
			t.Fatalf("unexpected cron run invocation: %q", misc.lastKey)
		}
	})

	t.Run("lists cron runs", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/cron/job-1/runs?limit=20")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if misc.lastKey != DefaultRuntimeID+"/cron/job-1/runs" {
			t.Fatalf("unexpected cron runs invocation: %q", misc.lastKey)
		}
	})

	t.Run("links deck identity", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/runtimes/"+DefaultRuntimeID+"/deck/identity", strings.NewReader(`{"action":"link","canonical":"user:1","channel":"telegram","peerId":"42"}`))
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
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if deck.lastKey != DefaultRuntimeID+"/deck/identity/link" {
			t.Fatalf("unexpected deck identity invocation: %q", deck.lastKey)
		}
	})

	t.Run("gets deck agent skills", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/runtimes/"+DefaultRuntimeID+"/deck/agents", strings.NewReader(`{"action":"skills.get","agentId":"main"}`))
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
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if deck.lastKey != DefaultRuntimeID+"/deck/agents/skills.get" {
			t.Fatalf("unexpected deck agents action invocation: %q", deck.lastKey)
		}
	})

	t.Run("patches deck agent config helper path", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/runtimes/"+DefaultRuntimeID+"/deck/agents", strings.NewReader(`{"action":"config.patch","path":"agents.defaults.thinkingDefault","value":"low"}`))
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
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if deck.lastKey != DefaultRuntimeID+"/deck/agents/config.patch" || deck.lastBody != "agents.defaults.thinkingDefault" {
			t.Fatalf("unexpected deck agent config action invocation: %q / %q", deck.lastKey, deck.lastBody)
		}
	})

	t.Run("simulates deck routing", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/runtimes/"+DefaultRuntimeID+"/deck/routing", strings.NewReader(`{"action":"simulate","channel":"telegram"}`))
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
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if deck.lastKey != DefaultRuntimeID+"/deck/routing/simulate" {
			t.Fatalf("unexpected deck routing invocation: %q", deck.lastKey)
		}
	})

	t.Run("fetches deck subagent lineage", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/runtimes/"+DefaultRuntimeID+"/deck/subagents", strings.NewReader(`{"action":"lineage","sessionKey":"sess-1"}`))
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
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if deck.lastKey != DefaultRuntimeID+"/deck/subagents/lineage" {
			t.Fatalf("unexpected deck subagents invocation: %q", deck.lastKey)
		}
	})

	t.Run("runs memory dream action", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/runtimes/"+DefaultRuntimeID+"/memory/dreams", strings.NewReader(`{"action":"read"}`))
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
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if memory.lastKey != DefaultRuntimeID+"/memory/dreams/read" {
			t.Fatalf("unexpected memory action invocation: %q", memory.lastKey)
		}
	})

	t.Run("runs node action", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/runtimes/"+DefaultRuntimeID+"/nodes", strings.NewReader(`{"action":"describe","nodeId":"node-1"}`))
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
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if nodes.lastKey != DefaultRuntimeID+"/nodes/describe" {
			t.Fatalf("unexpected node action invocation: %q", nodes.lastKey)
		}
	})

	t.Run("runs node pair action", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/runtimes/"+DefaultRuntimeID+"/nodes/pair", strings.NewReader(`{"action":"request","pairingCode":"pair-1"}`))
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
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if nodes.lastKey != DefaultRuntimeID+"/nodes/pair/request" {
			t.Fatalf("unexpected node pair action invocation: %q", nodes.lastKey)
		}
	})

	t.Run("updates skill", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPatch, server.URL+"/runtimes/"+DefaultRuntimeID+"/skills/demo", strings.NewReader(`{"enabled":false}`))
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
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if skills.lastKey != DefaultRuntimeID+"/skills/demo" {
			t.Fatalf("unexpected skills update invocation: %q", skills.lastKey)
		}
	})

	t.Run("installs skill", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/runtimes/"+DefaultRuntimeID+"/skills/install", strings.NewReader(`{"name":"foo","installId":"bar"}`))
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
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if skills.lastKey != DefaultRuntimeID+"/skills/install" {
			t.Fatalf("unexpected skills install invocation: %q", skills.lastKey)
		}
	})

	t.Run("runs skills hub action", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/runtimes/"+DefaultRuntimeID+"/skills/hub", strings.NewReader(`{"action":"search","query":"tool"}`))
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
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if skills.lastKey != DefaultRuntimeID+"/skills/hub/search" {
			t.Fatalf("unexpected skills hub invocation: %q", skills.lastKey)
		}
	})

	t.Run("updates clawhub skill", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/runtimes/"+DefaultRuntimeID+"/skills/update-clawhub", strings.NewReader(`{"slug":"demo"}`))
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
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if skills.lastKey != DefaultRuntimeID+"/skills/update-clawhub" {
			t.Fatalf("unexpected skills update-clawhub invocation: %q", skills.lastKey)
		}
	})

	t.Run("probes model auth", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/runtimes/"+DefaultRuntimeID+"/models/probe", strings.NewReader(`{"provider":"openai"}`))
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
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if models.lastKey != DefaultRuntimeID+"/models/probe" {
			t.Fatalf("unexpected model probe invocation: %q", models.lastKey)
		}
	})

	t.Run("logs out channel", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/runtimes/"+DefaultRuntimeID+"/channels/telegram/logout", nil)
		if err != nil {
			t.Fatal(err)
		}
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if channels.lastKey != DefaultRuntimeID+"/channels/telegram/logout" {
			t.Fatalf("unexpected channel logout invocation: %q", channels.lastKey)
		}
	})

	t.Run("tests channel", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/runtimes/"+DefaultRuntimeID+"/channels/telegram/test", strings.NewReader(`{}`))
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
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if channels.lastKey != DefaultRuntimeID+"/channels/telegram/test" {
			t.Fatalf("unexpected channel test invocation: %q", channels.lastKey)
		}
	})

	t.Run("returns channel throughput", func(t *testing.T) {
		res, err := http.Get(server.URL + "/runtimes/" + DefaultRuntimeID + "/channels/telegram/throughput")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if channels.lastKey != DefaultRuntimeID+"/channels/telegram/throughput" {
			t.Fatalf("unexpected channel throughput invocation: %q", channels.lastKey)
		}
	})

	t.Run("patches channel", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPatch, server.URL+"/runtimes/"+DefaultRuntimeID+"/channels/telegram", strings.NewReader(`{"enabled":true}`))
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
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if channels.lastKey != DefaultRuntimeID+"/channels/telegram/patch" {
			t.Fatalf("unexpected channel patch invocation: %q", channels.lastKey)
		}
	})

	t.Run("patches agent", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPatch, server.URL+"/runtimes/"+DefaultRuntimeID+"/agents/main", strings.NewReader(`{"name":"Updated Main"}`))
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
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if agents.lastKey != DefaultRuntimeID+"/agents/main:patch" || agents.lastBody != "Updated Main" {
			t.Fatalf("unexpected agent patch invocation: %q / %q", agents.lastKey, agents.lastBody)
		}
	})

	t.Run("deletes agent", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodDelete, server.URL+"/runtimes/"+DefaultRuntimeID+"/agents/main", nil)
		if err != nil {
			t.Fatal(err)
		}
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if agents.lastKey != DefaultRuntimeID+"/agents/main:delete" {
			t.Fatalf("unexpected agent delete invocation: %q", agents.lastKey)
		}
	})

	t.Run("writes agent file", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/runtimes/"+DefaultRuntimeID+"/agents/main/files", strings.NewReader(`{"name":"AGENTS.md","content":"hello"}`))
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
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if agents.lastKey != DefaultRuntimeID+"/agents/main/files:set" || agents.lastBody != "AGENTS.md=hello" {
			t.Fatalf("unexpected agent file invocation: %q / %q", agents.lastKey, agents.lastBody)
		}
	})

	t.Run("accepts send command", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/runtimes/"+DefaultRuntimeID+"/sessions/session-1/messages:send", strings.NewReader(`{"text":"hello"}`))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("idempotencyKey", "idem-1")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusAccepted {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload map[string]any
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload["accepted"] != true || payload["commandId"] == "" || payload["requestId"] == "" {
			t.Fatalf("unexpected command envelope: %#v", payload)
		}
		if commands.lastKey != DefaultRuntimeID+"/session-1/send/idem-1" || commands.lastBody != "hello" {
			t.Fatalf("unexpected send invocation: %#v / %s", commands.lastKey, commands.lastBody)
		}
	})

	t.Run("accepts abort command", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/runtimes/"+DefaultRuntimeID+"/runs/run-1:abort", nil)
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("idempotencyKey", "idem-2")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusAccepted {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if commands.lastKey != DefaultRuntimeID+"/run-1/abort/idem-2" {
			t.Fatalf("unexpected abort invocation: %q", commands.lastKey)
		}
	})

	t.Run("accepts compact command", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/runtimes/"+DefaultRuntimeID+"/sessions/session-1:compact", nil)
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("idempotencyKey", "idem-3")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusAccepted {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if commands.lastKey != DefaultRuntimeID+"/session-1/compact/idem-3" {
			t.Fatalf("unexpected compact invocation: %q", commands.lastKey)
		}
	})

	t.Run("accepts delete command", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodDelete, server.URL+"/runtimes/"+DefaultRuntimeID+"/sessions/session-1", nil)
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("idempotencyKey", "idem-4")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusAccepted {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if commands.lastKey != DefaultRuntimeID+"/session-1/delete/idem-4" {
			t.Fatalf("unexpected delete invocation: %q", commands.lastKey)
		}
	})

	t.Run("accepts reset command", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/runtimes/"+DefaultRuntimeID+"/sessions/session-1:reset", strings.NewReader(`{"reason":"new"}`))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("idempotencyKey", "idem-5")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusAccepted {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if commands.lastKey != DefaultRuntimeID+"/session-1/reset/new/idem-5" {
			t.Fatalf("unexpected reset invocation: %q", commands.lastKey)
		}
	})

	t.Run("accepts clear command", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/runtimes/"+DefaultRuntimeID+"/sessions/session-1:clear", nil)
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("idempotencyKey", "idem-6")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusAccepted {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if commands.lastKey != DefaultRuntimeID+"/session-1/clear/idem-6" {
			t.Fatalf("unexpected clear invocation: %q", commands.lastKey)
		}
	})

	t.Run("accepts patch command", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/runtimes/"+DefaultRuntimeID+"/sessions/session-1:patch", strings.NewReader(`{"model":"gpt-5.4"}`))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("idempotencyKey", "idem-7")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusAccepted {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if commands.lastKey != DefaultRuntimeID+"/session-1/patch/idem-7" || commands.lastBody != "gpt-5.4" {
			t.Fatalf("unexpected patch invocation: %q / %q", commands.lastKey, commands.lastBody)
		}
	})
}

func pointerTo[T any](value T) *T {
	return &value
}
