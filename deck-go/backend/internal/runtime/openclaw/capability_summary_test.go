package openclaw

import (
	"context"
	"errors"
	"testing"
)

type stubCapabilityRequester struct {
	t       *testing.T
	payload any
	err     error
}

func (s stubCapabilityRequester) Request(_ context.Context, method string, params map[string]any) (any, error) {
	if method != "gateway.describe" {
		s.t.Fatalf("unexpected method: %s", method)
	}
	if params["filter"] != "all" || params["includeSchemas"] != false {
		s.t.Fatalf("unexpected params: %#v", params)
	}
	if s.err != nil {
		return nil, s.err
	}
	return s.payload, nil
}

func TestCapabilitySummaryLoad(t *testing.T) {
	summary, err := NewCapabilitySummary(stubCapabilityRequester{
		t: t,
		payload: map[string]any{
			"schemaVersion": "3.1",
			"methods": map[string]any{
				"health":           map[string]any{},
				"gateway.describe": map[string]any{},
			},
			"events": map[string]any{
				"runtime.status": map[string]any{},
			},
		},
	}).Load(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if !summary.Available || summary.SchemaVersion != "3.1" {
		t.Fatalf("unexpected summary: %#v", summary)
	}
	if summary.MethodCount != 2 || summary.EventCount != 1 {
		t.Fatalf("unexpected summary counts: %#v", summary)
	}
}

func TestCapabilitySummaryLoadPropagatesError(t *testing.T) {
	_, err := NewCapabilitySummary(stubCapabilityRequester{
		t:   t,
		err: errors.New("describe failed"),
	}).Load(context.Background())
	if err == nil {
		t.Fatal("expected error")
	}
}
