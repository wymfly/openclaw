package openclaw

import (
	"context"
	"errors"
	"testing"
)

type stubStatusRequester struct {
	t       *testing.T
	calls   []string
	payload map[string]any
	errs    map[string]error
}

func (s *stubStatusRequester) Request(_ context.Context, method string, params map[string]any) (any, error) {
	s.calls = append(s.calls, method)
	if err := s.errs[method]; err != nil {
		return nil, err
	}
	switch method {
	case "health":
		return map[string]any{"ok": true}, nil
	case "gateway.describe":
		if params["filter"] != "all" || params["includeSchemas"] != false {
			s.t.Fatalf("unexpected gateway.describe params: %#v", params)
		}
		return s.payload["gateway.describe"], nil
	default:
		s.t.Fatalf("unexpected method: %s", method)
		return nil, nil
	}
}

func TestGatewayStatusLoad_HealthyWithCapabilities(t *testing.T) {
	loader := NewGatewayStatus(&stubStatusRequester{
		t: t,
		payload: map[string]any{
			"gateway.describe": map[string]any{
				"schemaVersion": "3.1",
				"methods":       map[string]any{"health": map[string]any{}, "gateway.describe": map[string]any{}},
				"events":        map[string]any{"runtime.status": map[string]any{}},
			},
		},
		errs: map[string]error{},
	})

	status, err := loader.Load(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if !status.Connected || status.SchemaVersion != "3.1" {
		t.Fatalf("unexpected gateway status: %#v", status)
	}
	if status.MethodCount != 2 || status.EventCount != 1 {
		t.Fatalf("unexpected gateway status counts: %#v", status)
	}
}

func TestGatewayStatusLoad_HealthFailure(t *testing.T) {
	loader := NewGatewayStatus(&stubStatusRequester{
		t:    t,
		errs: map[string]error{"health": errors.New("health failed")},
	})

	status, err := loader.Load(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if status.Connected || status.Error != "health failed" {
		t.Fatalf("unexpected health failure status: %#v", status)
	}
}

func TestGatewayStatusLoad_DescribeFailureKeepsConnected(t *testing.T) {
	loader := NewGatewayStatus(&stubStatusRequester{
		t:    t,
		errs: map[string]error{"gateway.describe": errors.New("missing scope: operator.read")},
	})

	status, err := loader.Load(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if !status.Connected || status.Error == "" {
		t.Fatalf("unexpected describe failure status: %#v", status)
	}
}
