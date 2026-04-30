package views

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway/generated"
)

type batchCall struct {
	id     string
	method string
	params any
}

func (r *Registry) callBatch(ctx context.Context, view string, calls []batchCall) (map[string]any, error) {
	if r.batch == nil {
		return nil, fmt.Errorf("BFF view batch dispatcher is unavailable")
	}
	batchParams, err := newBatchParams(calls)
	if err != nil {
		return nil, err
	}
	result, err := r.batch(ctx, batchParams)
	if err != nil {
		return nil, err
	}
	if len(result.Results) != len(calls) {
		return nil, fmt.Errorf("BFF view %s expected %d batch results, got %d", view, len(calls), len(result.Results))
	}
	byID := make(map[string]any, len(result.Results))
	for _, entry := range result.Results {
		if !entry.Ok {
			if entry.Error.Message != "" {
				return nil, fmt.Errorf("BFF view %s sub-call %s failed: %s", view, entry.Id, entry.Error.Message)
			}
			return nil, fmt.Errorf("BFF view %s sub-call %s failed", view, entry.Id)
		}
		byID[entry.Id] = entry.Result
	}
	return byID, nil
}

func newBatchParams(calls []batchCall) (generated.GatewayBatchParams, error) {
	rawCalls := make([]map[string]any, 0, len(calls))
	for _, call := range calls {
		rawCalls = append(rawCalls, map[string]any{
			"id":     call.id,
			"method": call.method,
			"params": call.params,
		})
	}
	raw, err := json.Marshal(map[string]any{
		"calls": rawCalls,
		"options": map[string]any{
			"failFast": true,
		},
	})
	if err != nil {
		return generated.GatewayBatchParams{}, err
	}
	var batchParams generated.GatewayBatchParams
	if err := json.Unmarshal(raw, &batchParams); err != nil {
		return generated.GatewayBatchParams{}, err
	}
	return batchParams, nil
}
