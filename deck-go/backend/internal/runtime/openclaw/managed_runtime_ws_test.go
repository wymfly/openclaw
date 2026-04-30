package openclaw

import (
	"encoding/json"
	"testing"

	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway/generated"
)

func TestPrepareWSBatchDispatchEnforcesClientEdgeBoundary(t *testing.T) {
	params := mustWSBatchParams(t, `{"calls":[
		{"id":"ok","method":"agents.list","params":{}},
		{"id":"nested","method":"gateway.batch","params":{"calls":[]}},
		{"id":"sub","method":"sessions.messages.subscribe","params":{"key":"main"}},
		{"id":"bad","method":"internal.debug","params":{}}
	]}`)

	dispatch, localEntries, err := prepareWSBatchDispatch(params)
	if err != nil {
		t.Fatal(err)
	}
	if len(dispatch.Calls) != 1 || dispatch.Calls[0].Id != "ok" {
		t.Fatalf("unexpected dispatch params: %#v", dispatch)
	}
	if localEntries[1] == nil || localEntries[2] == nil || localEntries[3] == nil {
		t.Fatalf("expected local errors for invalid calls: %#v", localEntries)
	}
	result := mergeWSBatchResults(params, localEntries, mustWSBatchResult(t, `{"results":[{"id":"ok","ok":true,"result":{"agents":[]}}]}`))
	if len(result.Results) != 4 {
		t.Fatalf("expected four ordered result entries, got %#v", result.Results)
	}
	if !result.Results[0].Ok || result.Results[1].Ok || result.Results[2].Ok || result.Results[3].Ok {
		t.Fatalf("unexpected merged result: %#v", result.Results)
	}
}

func TestPrepareWSBatchDispatchHonorsFailFastLocalError(t *testing.T) {
	params := mustWSBatchParams(t, `{"calls":[
		{"id":"nested","method":"gateway.batch","params":{"calls":[]}},
		{"id":"ok","method":"agents.list","params":{}}
	],"options":{"failFast":true}}`)

	dispatch, localEntries, err := prepareWSBatchDispatch(params)
	if err != nil {
		t.Fatal(err)
	}
	if len(dispatch.Calls) != 0 {
		t.Fatalf("expected failFast to stop dispatch, got %#v", dispatch.Calls)
	}
	result := mergeWSBatchResults(params, localEntries, generated.GatewayBatchResult{})
	if len(result.Results) != 1 || result.Results[0].Id != "nested" || result.Results[0].Ok {
		t.Fatalf("unexpected failFast result: %#v", result.Results)
	}
}

func mustWSBatchParams(t *testing.T, raw string) generated.GatewayBatchParams {
	t.Helper()
	var params generated.GatewayBatchParams
	if err := json.Unmarshal([]byte(raw), &params); err != nil {
		t.Fatal(err)
	}
	return params
}

func mustWSBatchResult(t *testing.T, raw string) generated.GatewayBatchResult {
	t.Helper()
	var result generated.GatewayBatchResult
	if err := json.Unmarshal([]byte(raw), &result); err != nil {
		t.Fatal(err)
	}
	return result
}
