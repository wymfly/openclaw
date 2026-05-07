package openclaw

import (
	"context"
	"errors"
	"testing"

	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway/generated"
)

type typedOnlyRequester struct {
	calls []typedCall
}

type typedCall struct {
	method string
	params any
}

func (r *typedOnlyRequester) Request(context.Context, string, map[string]any) (any, error) {
	return nil, errors.New("legacy Request should not be used for typed wrappers")
}

func (r *typedOnlyRequester) RequestTyped(_ context.Context, method string, params any) (any, error) {
	r.calls = append(r.calls, typedCall{method: method, params: params})
	switch method {
	case "commands.list":
		return map[string]any{"commands": []any{}}, nil
	case "exec.approval.list", "plugin.approval.list":
		return []any{}, nil
	case "logs.tail":
		return map[string]any{"file": "openclaw.log", "cursor": 0, "size": 0, "lines": []any{}}, nil
	case "node.invoke":
		return map[string]any{
			"ok":          true,
			"nodeId":      "node-1",
			"command":     "status.request",
			"payloadJSON": nil,
		}, nil
	case "node.pending.enqueue":
		return map[string]any{
			"nodeId":        "node-1",
			"revision":      1,
			"wakeTriggered": false,
			"queued": map[string]any{
				"id":          "pending-1",
				"type":        "status.request",
				"priority":    "normal",
				"createdAtMs": 1,
				"expiresAtMs": nil,
			},
		}, nil
	case "tools.catalog":
		return map[string]any{"agentId": "main", "profiles": []any{}, "groups": []any{}}, nil
	case "tools.effective":
		return map[string]any{"agentId": "main", "profile": "coding", "groups": []any{}}, nil
	}
	return map[string]any{}, nil
}

func TestGatewayQueriesAgentsDeletePreservesDeleteFilesFalse(t *testing.T) {
	requester := &typedOnlyRequester{}
	queries := NewGatewayQueries(requester)

	if _, err := queries.AgentsDelete(context.Background(), "ops", false); err != nil {
		t.Fatal(err)
	}
	if len(requester.calls) != 1 || requester.calls[0].method != "agents.delete" {
		t.Fatalf("unexpected calls: %#v", requester.calls)
	}
	params, ok := requester.calls[0].params.(map[string]any)
	if !ok {
		t.Fatalf("expected map params so false is not omitted, got %T", requester.calls[0].params)
	}
	if params["agentId"] != "ops" || params["deleteFiles"] != false {
		t.Fatalf("unexpected agents.delete params: %#v", params)
	}
}

func TestGatewayQueriesLowRiskWrappersUseTypedClient(t *testing.T) {
	requester := &typedOnlyRequester{}
	queries := NewGatewayQueries(requester)
	ctx := context.Background()

	cases := []struct {
		name       string
		call       func() (any, error)
		method     string
		assertType func(*testing.T, any)
	}{
		{
			name: "cron list",
			call: func() (any, error) {
				return queries.CronList(ctx, map[string]any{"limit": 5})
			},
			method: "cron.list",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(generated.CronListParams)
				if !ok || got.Limit != 5 {
					t.Fatalf("expected CronListParams limit=5, got %T %#v", params, params)
				}
			},
		},
		{
			name: "config get with params",
			call: func() (any, error) {
				return queries.ConfigGetWithParams(ctx, map[string]any{"path": "agents.defaults.workspace"})
			},
			method: "config.get",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(generated.ConfigGetParams)
				if !ok || got["path"] != "agents.defaults.workspace" {
					t.Fatalf("expected ConfigGetParams path, got %T %#v", params, params)
				}
			},
		},
		{
			name: "gateway describe",
			call: func() (any, error) {
				return queries.Describe(ctx, true)
			},
			method: "gateway.describe",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(generated.GatewayDescribeParams)
				if !ok || got.Filter != "all" || !got.IncludeSchemas {
					t.Fatalf("expected GatewayDescribeParams, got %T %#v", params, params)
				}
			},
		},
		{
			name: "config patch",
			call: func() (any, error) {
				return queries.ConfigPatch(ctx, `{"x":1}`, "hash-1", "note")
			},
			method: "config.patch",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(generated.ConfigPatchParams)
				if !ok || got.Raw != `{"x":1}` || got.BaseHash != "hash-1" || got.Note != "note" {
					t.Fatalf("expected ConfigPatchParams, got %T %#v", params, params)
				}
			},
		},
		{
			name: "channels logout",
			call: func() (any, error) {
				return queries.ChannelsLogout(ctx, "wechat")
			},
			method: "channels.logout",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(generated.ChannelsLogoutParams)
				if !ok || got.Channel != "wechat" {
					t.Fatalf("expected ChannelsLogoutParams, got %T %#v", params, params)
				}
			},
		},
		{
			name: "deck agents detail",
			call: func() (any, error) {
				return queries.DeckAgentsDetail(ctx, "main")
			},
			method: "deck.agents.detail",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(generated.DeckAgentsDetailParams)
				if !ok || got.AgentId != "main" {
					t.Fatalf("expected DeckAgentsDetailParams, got %T %#v", params, params)
				}
			},
		},
		{
			name: "deck plugins list",
			call: func() (any, error) {
				return queries.DeckPluginsList(ctx, map[string]any{"capability": "channels"})
			},
			method: "deck.plugins.list",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(generated.DeckPluginsListParams)
				if !ok || got.Capability != "channels" {
					t.Fatalf("expected DeckPluginsListParams, got %T %#v", params, params)
				}
			},
		},
		{
			name: "deck routing add",
			call: func() (any, error) {
				return queries.DeckRoutingAdd(ctx, map[string]any{
					"agentId":  "main",
					"baseHash": "hash-1",
					"match":    map[string]any{"channel": "telegram"},
				})
			},
			method: "deck.routing.add",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(generated.DeckRoutingAddParams)
				if !ok || got.AgentId != "main" || got.BaseHash != "hash-1" || got.Match.Channel != "telegram" {
					t.Fatalf("expected DeckRoutingAddParams, got %T %#v", params, params)
				}
			},
		},
		{
			name: "tools catalog",
			call: func() (any, error) {
				return queries.ToolsCatalog(ctx, map[string]any{"agentId": "main", "includePlugins": false})
			},
			method: "tools.catalog",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(generated.ToolsCatalogParams)
				if !ok || got.AgentId != "main" || got.IncludePlugins {
					t.Fatalf("expected ToolsCatalogParams, got %T %#v", params, params)
				}
			},
		},
		{
			name: "tools effective",
			call: func() (any, error) {
				return queries.ToolsEffective(ctx, map[string]any{"agentId": "main", "sessionKey": "session-1"})
			},
			method: "tools.effective",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(generated.ToolsEffectiveParams)
				if !ok || got.AgentId != "main" || got.SessionKey != "session-1" {
					t.Fatalf("expected ToolsEffectiveParams, got %T %#v", params, params)
				}
			},
		},
		{
			name: "exec approval list",
			call: func() (any, error) {
				return queries.ExecApprovalList(ctx)
			},
			method: "exec.approval.list",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(generated.ExecApprovalListParams)
				if !ok || len(got) != 0 {
					t.Fatalf("expected empty ExecApprovalListParams, got %T %#v", params, params)
				}
			},
		},
		{
			name: "exec approvals get",
			call: func() (any, error) {
				return queries.ExecApprovalsGet(ctx)
			},
			method: "exec.approvals.get",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(generated.ExecApprovalsGetParams)
				if !ok || len(got) != 0 {
					t.Fatalf("expected empty ExecApprovalsGetParams, got %T %#v", params, params)
				}
			},
		},
		{
			name: "exec approval resolve",
			call: func() (any, error) {
				return queries.ExecApprovalResolve(ctx, map[string]any{"id": "approval-1", "decision": "approved"})
			},
			method: "exec.approval.resolve",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(generated.ExecApprovalResolveParams)
				if !ok || got.Id != "approval-1" || got.Decision != "approved" {
					t.Fatalf("expected ExecApprovalResolveParams, got %T %#v", params, params)
				}
			},
		},
		{
			name: "plugin approval list",
			call: func() (any, error) {
				return queries.PluginApprovalList(ctx)
			},
			method: "plugin.approval.list",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(generated.PluginApprovalListParams)
				if !ok || len(got) != 0 {
					t.Fatalf("expected empty PluginApprovalListParams, got %T %#v", params, params)
				}
			},
		},
		{
			name: "plugin approval resolve",
			call: func() (any, error) {
				return queries.PluginApprovalResolve(ctx, map[string]any{"id": "plugin-1", "decision": "approved"})
			},
			method: "plugin.approval.resolve",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(generated.PluginApprovalResolveParams)
				if !ok || got.Id != "plugin-1" || got.Decision != "approved" {
					t.Fatalf("expected PluginApprovalResolveParams, got %T %#v", params, params)
				}
			},
		},
		{
			name: "sessions delete",
			call: func() (any, error) {
				return queries.SessionsDelete(ctx, "session-1")
			},
			method: "sessions.delete",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(generated.SessionsDeleteParams)
				if !ok || got.Key != "session-1" {
					t.Fatalf("expected SessionsDeleteParams, got %T %#v", params, params)
				}
			},
		},
		{
			name: "sessions create",
			call: func() (any, error) {
				return queries.SessionsCreate(ctx, map[string]any{"agentId": "main", "message": "hello"})
			},
			method: "sessions.create",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(generated.SessionsCreateParams)
				if !ok || got.AgentId != "main" || got.Message != "hello" {
					t.Fatalf("expected SessionsCreateParams, got %T %#v", params, params)
				}
			},
		},
		{
			name: "sessions compaction branch",
			call: func() (any, error) {
				return queries.SessionsCompactionBranch(ctx, "session-1", "checkpoint-1")
			},
			method: "sessions.compaction.branch",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(generated.SessionsCompactionBranchParams)
				if !ok || got.Key != "session-1" || got.CheckpointId != "checkpoint-1" {
					t.Fatalf("expected SessionsCompactionBranchParams, got %T %#v", params, params)
				}
			},
		},
		{
			name: "chat history",
			call: func() (any, error) {
				return queries.ChatHistory(ctx, map[string]any{"sessionKey": "session-1", "limit": 2})
			},
			method: "chat.history",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(generated.ChatHistoryParams)
				if !ok || got.SessionKey != "session-1" || got.Limit != 2 {
					t.Fatalf("expected ChatHistoryParams, got %T %#v", params, params)
				}
			},
		},
		{
			name: "logs tail",
			call: func() (any, error) {
				return queries.LogsTail(ctx, map[string]any{"limit": 10})
			},
			method: "logs.tail",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(generated.LogsTailParams)
				if !ok || got.Limit != 10 {
					t.Fatalf("expected LogsTailParams, got %T %#v", params, params)
				}
			},
		},
		{
			name: "commands list",
			call: func() (any, error) {
				return queries.CommandsList(ctx)
			},
			method: "commands.list",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				if got, ok := params.(generated.CommandsListParams); !ok || got.AgentId != "" {
					t.Fatalf("expected empty CommandsListParams, got %T %#v", params, params)
				}
			},
		},
		{
			name: "node describe",
			call: func() (any, error) {
				return queries.NodeDescribe(ctx, map[string]any{"nodeId": "node-1"})
			},
			method: "node.describe",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(generated.NodeDescribeParams)
				if !ok || got.NodeId != "node-1" {
					t.Fatalf("expected NodeDescribeParams, got %T %#v", params, params)
				}
			},
		},
		{
			name: "node invoke",
			call: func() (any, error) {
				return queries.NodeInvoke(ctx, map[string]any{
					"nodeId":         "node-1",
					"command":        "status.request",
					"idempotencyKey": "invoke-1",
				})
			},
			method: "node.invoke",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(generated.NodeInvokeParams)
				if !ok || got.NodeId != "node-1" || got.Command != "status.request" || got.IdempotencyKey != "invoke-1" {
					t.Fatalf("expected NodeInvokeParams, got %T %#v", params, params)
				}
			},
		},
		{
			name: "node pending enqueue",
			call: func() (any, error) {
				return queries.NodePendingEnqueue(ctx, map[string]any{
					"nodeId": "node-1",
					"type":   "status.request",
					"wake":   false,
				})
			},
			method: "node.pending.enqueue",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(generated.NodePendingEnqueueParams)
				if !ok || got.NodeId != "node-1" || got.Type != "status.request" || got.Wake {
					t.Fatalf("expected NodePendingEnqueueParams, got %T %#v", params, params)
				}
			},
		},
		{
			name: "models list",
			call: func() (any, error) {
				return queries.ModelsList(ctx)
			},
			method: "models.list",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(generated.ModelsListParams)
				if !ok || len(got) != 0 {
					t.Fatalf("expected empty ModelsListParams, got %T %#v", params, params)
				}
			},
		},
		{
			name: "talk config",
			call: func() (any, error) {
				return queries.TalkConfig(ctx, true)
			},
			method: "talk.config",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(generated.TalkConfigParams)
				if !ok || !got.IncludeSecrets {
					t.Fatalf("expected TalkConfigParams, got %T %#v", params, params)
				}
			},
		},
		{
			name: "talk mode",
			call: func() (any, error) {
				return queries.TalkMode(ctx, true, "listening")
			},
			method: "talk.mode",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(generated.TalkModeParams)
				if !ok || !got.Enabled || got.Phase != "listening" {
					t.Fatalf("expected TalkModeParams, got %T %#v", params, params)
				}
			},
		},
		{
			name: "talk speak",
			call: func() (any, error) {
				return queries.TalkSpeak(ctx, map[string]any{"text": "hello", "voiceId": "voice-1"})
			},
			method: "talk.speak",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(generated.TalkSpeakParams)
				if !ok || got.Text != "hello" || got.VoiceId != "voice-1" {
					t.Fatalf("expected TalkSpeakParams, got %T %#v", params, params)
				}
			},
		},
		{
			name: "wizard start",
			call: func() (any, error) {
				return queries.WizardStart(ctx, map[string]any{"mode": "setup", "workspace": "/tmp/workspace"})
			},
			method: "wizard.start",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(generated.WizardStartParams)
				if !ok || got.Mode != "setup" || got.Workspace != "/tmp/workspace" {
					t.Fatalf("expected WizardStartParams, got %T %#v", params, params)
				}
			},
		},
		{
			name: "wizard next",
			call: func() (any, error) {
				return queries.WizardNext(ctx, map[string]any{
					"sessionId": "wizard-1",
					"answer": map[string]any{
						"stepId": "step-1",
						"value":  "ok",
					},
				})
			},
			method: "wizard.next",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(generated.WizardNextParams)
				if !ok || got.SessionId != "wizard-1" || got.Answer.StepId != "step-1" || got.Answer.Value != "ok" {
					t.Fatalf("expected WizardNextParams, got %T %#v", params, params)
				}
			},
		},
		{
			name: "wizard cancel",
			call: func() (any, error) {
				return queries.WizardCancel(ctx, "wizard-1")
			},
			method: "wizard.cancel",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(generated.WizardCancelParams)
				if !ok || got.SessionId != "wizard-1" {
					t.Fatalf("expected WizardCancelParams, got %T %#v", params, params)
				}
			},
		},
		{
			name: "wizard status",
			call: func() (any, error) {
				return queries.WizardStatus(ctx, "wizard-1")
			},
			method: "wizard.status",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(generated.WizardStatusParams)
				if !ok || got.SessionId != "wizard-1" {
					t.Fatalf("expected WizardStatusParams, got %T %#v", params, params)
				}
			},
		},
		{
			name: "deck auth probe",
			call: func() (any, error) {
				return queries.DeckAuthProbe(ctx, map[string]any{"provider": "openai"})
			},
			method: "deck.auth.probe",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(map[string]any)
				if !ok || got["provider"] != "openai" {
					t.Fatalf("expected deck auth probe map params, got %T %#v", params, params)
				}
			},
		},
		{
			name: "agent identity get",
			call: func() (any, error) {
				return queries.AgentIdentityGet(ctx, "main")
			},
			method: "agent.identity.get",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(generated.AgentIdentityGetParams)
				if !ok || got.AgentId != "main" {
					t.Fatalf("expected AgentIdentityGetParams, got %T %#v", params, params)
				}
			},
		},
		{
			name: "agents files set",
			call: func() (any, error) {
				return queries.AgentFilesSet(ctx, "main", "AGENTS.md", "rules")
			},
			method: "agents.files.set",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(generated.AgentsFilesSetParams)
				if !ok || got.AgentId != "main" || got.Name != "AGENTS.md" || got.Content != "rules" {
					t.Fatalf("expected AgentsFilesSetParams, got %T %#v", params, params)
				}
			},
		},
		{
			name: "skills status",
			call: func() (any, error) {
				return queries.SkillsStatus(ctx, map[string]any{"agentId": "main"})
			},
			method: "skills.status",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(generated.SkillsStatusParams)
				if !ok || got.AgentId != "main" {
					t.Fatalf("expected SkillsStatusParams, got %T %#v", params, params)
				}
			},
		},
		{
			name: "cron status",
			call: func() (any, error) {
				return queries.CronStatus(ctx)
			},
			method: "cron.status",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				if got, ok := params.(generated.CronStatusParams); !ok || len(got) != 0 {
					t.Fatalf("expected empty CronStatusParams, got %T %#v", params, params)
				}
			},
		},
		{
			name: "device pair approve",
			call: func() (any, error) {
				return queries.DevicePairApprove(ctx, map[string]any{"requestId": "req-1"})
			},
			method: "device.pair.approve",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(generated.DevicePairApproveParams)
				if !ok || got.RequestId != "req-1" {
					t.Fatalf("expected DevicePairApproveParams, got %T %#v", params, params)
				}
			},
		},
		{
			name: "device token rotate",
			call: func() (any, error) {
				return queries.DeviceTokenRotate(ctx, map[string]any{"deviceId": "device-1", "role": "operator"})
			},
			method: "device.token.rotate",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(generated.DeviceTokenRotateParams)
				if !ok || got.DeviceId != "device-1" || got.Role != "operator" {
					t.Fatalf("expected DeviceTokenRotateParams, got %T %#v", params, params)
				}
			},
		},
		{
			name: "doctor memory status",
			call: func() (any, error) {
				return queries.DoctorMemoryStatus(ctx)
			},
			method: "doctor.memory.status",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(map[string]any)
				if !ok || len(got) != 0 {
					t.Fatalf("expected empty doctor memory status params, got %T %#v", params, params)
				}
			},
		},
		{
			name: "usage cost",
			call: func() (any, error) {
				return queries.UsageCost(ctx, map[string]any{"from": "today"})
			},
			method: "usage.cost",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(map[string]any)
				if !ok || got["from"] != "today" {
					t.Fatalf("expected usage cost map params, got %T %#v", params, params)
				}
			},
		},
		{
			name: "sessions usage",
			call: func() (any, error) {
				return queries.SessionsUsage(ctx, map[string]any{"mode": "daily", "limit": 3})
			},
			method: "sessions.usage",
			assertType: func(t *testing.T, params any) {
				t.Helper()
				got, ok := params.(generated.SessionsUsageParams)
				if !ok || got.Mode != "daily" || got.Limit != 3 {
					t.Fatalf("expected SessionsUsageParams, got %T %#v", params, params)
				}
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := tc.call(); err != nil {
				t.Fatal(err)
			}
			last := requester.calls[len(requester.calls)-1]
			if last.method != tc.method {
				t.Fatalf("expected method %q, got %q", tc.method, last.method)
			}
			tc.assertType(t, last.params)
		})
	}
}
