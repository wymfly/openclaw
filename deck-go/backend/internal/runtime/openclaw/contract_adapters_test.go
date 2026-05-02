package openclaw

import (
	"encoding/json"
	"testing"

	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway/generated"
)

func TestContractAdaptersConvertGeneratedGatewayDTOs(t *testing.T) {
	var agents generated.AgentsListResult
	mustDecode(t, `{
		"agents": [
			{
				"id": "main",
				"name": "Main",
				"identity": {"emoji": "M", "avatarUrl": "https://example.test/main.png"},
				"workspace": "/work/main",
				"model": {"primary": "gpt-5.4"}
			}
		],
		"defaultId": "main",
		"mainKey": "agent-main",
		"scope": "local"
	}`, &agents)
	agentResponse := normalizeAgentsList(agents)
	if agentResponse.DefaultId != "main" || len(agentResponse.Agents) != 1 {
		t.Fatalf("unexpected agent response: %#v", agentResponse)
	}
	if agentResponse.Agents[0].Id != "main" ||
		agentResponse.Agents[0].Model != "gpt-5.4" ||
		agentResponse.Agents[0].Avatar == "" ||
		!agentResponse.Agents[0].IsDefault ||
		agentResponse.Agents[0].Status != "idle" {
		t.Fatalf("agent fields were not converted to Deck DTO: %#v", agentResponse.Agents[0])
	}

	var usage generated.SessionsUsageResult
	mustDecode(t, `{
		"updatedAt": 1714560000,
		"startDate": "2026-04-01",
		"endDate": "2026-04-02",
		"totals": {"input": 10, "output": 5, "cacheRead": 2, "cacheWrite": 1, "totalTokens": 18, "totalCost": 0.42},
		"aggregates": {"byAgent": [{"agentId": "main", "totals": {"totalTokens": 18}}]},
		"sessions": [
			{
				"key": "session-1",
				"label": "Ops",
				"sessionId": "raw-session-1",
				"updatedAt": 1714560100,
				"agentId": "main",
				"channel": "web",
				"usage": {"totalTokens": 18, "totalCost": 0.42},
				"contextWeight": {
					"source": "gateway",
					"generatedAt": 1714560100,
					"sessionKey": "session-1",
					"systemPrompt": {},
					"injectedWorkspaceFiles": [],
					"skills": {},
					"tools": {}
				}
			}
		]
	}`, &usage)
	usageResponse := normalizeUsageSessions(usage)
	if usageResponse.Totals.TotalTokens != 18 || usageResponse.Totals.TotalCost != 0.42 {
		t.Fatalf("usage totals were not converted: %#v", usageResponse.Totals)
	}
	if len(usageResponse.Sessions) != 1 || usageResponse.Sessions[0].Usage["totalTokens"] != float64(18) {
		t.Fatalf("usage sessions were not converted: %#v", usageResponse.Sessions)
	}

	var cost generated.UsageCostResult
	mustDecode(t, `{
		"updatedAt": 1714560200,
		"days": 7,
		"daily": [
			{"date": "2026-04-01", "input": 10, "inputCost": 0.1, "output": 5, "outputCost": 0.2, "cacheRead": 2, "cacheReadCost": 0.01, "cacheWrite": 1, "cacheWriteCost": 0.02, "totalTokens": 18, "totalCost": 0.33, "missingCostEntries": 0}
		],
		"totals": {"input": 10, "inputCost": 0.1, "output": 5, "outputCost": 0.2, "cacheRead": 2, "cacheReadCost": 0.01, "cacheWrite": 1, "cacheWriteCost": 0.02, "totalTokens": 18, "totalCost": 0.33, "missingCostEntries": 0}
	}`, &cost)
	costResponse := normalizeUsageCost(cost)
	if costResponse.Days != 7 || len(costResponse.Daily) != 1 || costResponse.Daily[0].TotalCost != 0.33 {
		t.Fatalf("cost response was not converted: %#v", costResponse)
	}

	var approvals generated.ExecApprovalsGetResult
	mustDecode(t, `{
		"exists": true,
		"hash": "hash-1",
		"path": "/tmp/approvals.json",
		"file": {
			"version": 1,
			"defaults": {"security": "on-request", "ask": "auto", "autoAllowSkills": true},
			"agents": {"main": {"security": "restricted", "allowlist": [{"pattern": "ls"}]}},
			"socket": {"path": "/tmp/openclaw.sock"}
		}
	}`, &approvals)
	approvalResponse := normalizeApprovalPolicyFromGet(approvals)
	defaults, _ := approvalResponse.File["defaults"].(map[string]any)
	if approvalResponse.Hash != "hash-1" || defaults["security"] != "on-request" {
		t.Fatalf("approval policy was not converted: %#v", approvalResponse)
	}
}

func TestContractAdaptersPreserveSelectedPreMigrationJSONShape(t *testing.T) {
	var agents generated.AgentsListResult
	mustDecode(t, `{
		"agents": [{"id": "main", "name": "Main", "workspace": "/work/main", "model": {"primary": "gpt-5.4"}}],
		"defaultId": "main",
		"mainKey": "agent-main",
		"scope": "local"
	}`, &agents)
	agentJSON := objectFromAny(normalizeAgentsList(agents))
	agentItems, _ := agentJSON["agents"].([]any)
	firstAgent, _ := agentItems[0].(map[string]any)
	if agentJSON["defaultId"] != "main" ||
		firstAgent["id"] != "main" ||
		firstAgent["workspace"] != "/work/main" ||
		firstAgent["name"] != "Main" ||
		firstAgent["isDefault"] != true ||
		firstAgent["status"] != "idle" {
		t.Fatalf("agent JSON compatibility shape changed: %#v", agentJSON)
	}

	var logs generated.SessionsUsageLogsResult
	mustDecode(t, `{"logs": [{"timestamp": 1714560300, "role": "assistant", "content": "done", "tokens": 12, "cost": 0.03}]}`, &logs)
	logsJSON := objectFromAny(normalizeUsageSessionLogs(logs))
	logItems, _ := logsJSON["logs"].([]any)
	firstLog, _ := logItems[0].(map[string]any)
	if firstLog["role"] != "assistant" || firstLog["content"] != "done" || firstLog["tokens"] != float64(12) {
		t.Fatalf("usage log JSON compatibility shape changed: %#v", logsJSON)
	}

	pending := normalizePendingApprovals([]any{
		map[string]any{
			"id":          "approval-1",
			"createdAtMs": float64(1714560400),
			"expiresAtMs": float64(1714560500),
			"request": map[string]any{
				"command":     "npm test",
				"commandArgv": []any{"npm", "test"},
				"agentId":     "main",
				"sessionKey":  "session-1",
				"cwd":         "/work/main",
			},
		},
	})
	pendingJSON := objectFromAny(pending)
	pendingItems, _ := pendingJSON["pending"].([]any)
	firstPending, _ := pendingItems[0].(map[string]any)
	if firstPending["id"] != "approval-1" || firstPending["command"] != "npm test" || firstPending["sessionKey"] != "session-1" {
		t.Fatalf("pending approval JSON compatibility shape changed: %#v", pendingJSON)
	}
}

func mustDecode(t *testing.T, raw string, target any) {
	t.Helper()
	if err := json.Unmarshal([]byte(raw), target); err != nil {
		t.Fatalf("decode fixture: %v", err)
	}
}
