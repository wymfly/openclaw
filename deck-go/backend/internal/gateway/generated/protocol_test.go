package generated

import (
	"context"
	"reflect"
	"testing"
)

type captureRequester struct {
	method string
	params any
}

func (r *captureRequester) RequestTyped(_ context.Context, method string, params any) (any, error) {
	r.method = method
	r.params = params
	return map[string]any{
		"events":        map[string]any{},
		"methods":       map[string]any{},
		"protocol":      3,
		"schemaVersion": "test",
		"untyped":       []any{},
	}, nil
}

func TestAllowlistContainsScopedUntypedMethods(t *testing.T) {
	for _, method := range []string{"plugin.approval.list", "plugin.approval.waitDecision"} {
		if _, ok := AllowlistMethodNames[method]; !ok {
			t.Fatalf("expected allowlist to contain %s", method)
		}
		if _, ok := TypedMethodNames[method]; ok {
			t.Fatalf("expected typed methods to exclude untyped scoped method %s", method)
		}
	}
}

func TestTypedMethodsAreAllowlistSubset(t *testing.T) {
	for method := range TypedMethodNames {
		if _, ok := AllowlistMethodNames[method]; !ok {
			t.Fatalf("typed method %s is missing from allowlist", method)
		}
	}
	if len(TypedMethodNames) >= len(AllowlistMethodNames) {
		t.Fatalf("expected typed methods to be a strict subset of allowlist")
	}
}

func TestTypedClientUsesRequestTypedWithTypedParams(t *testing.T) {
	requester := &captureRequester{}
	client := NewTypedClient(requester)
	params := GatewayDescribeParams{
		Filter:         "all",
		IncludeSchemas: true,
	}

	if _, err := client.GatewayDescribe(context.Background(), params); err != nil {
		t.Fatal(err)
	}
	if requester.method != "gateway.describe" {
		t.Fatalf("expected gateway.describe, got %q", requester.method)
	}
	got, ok := requester.params.(GatewayDescribeParams)
	if !ok {
		t.Fatalf("expected typed GatewayDescribeParams, got %T", requester.params)
	}
	if !reflect.DeepEqual(got, params) {
		t.Fatalf("unexpected params: %#v", got)
	}
}

func TestGeneratedEventPayloadTypesExposeRegistry(t *testing.T) {
	for _, tc := range []struct {
		name   string
		event  string
		target any
		fields []string
	}{
		{
			name:   "session message",
			event:  "session.message",
			target: SessionMessageEventPayload{},
			fields: []string{"sessionKey", "message"},
		},
		{
			name:   "sessions changed",
			event:  "sessions.changed",
			target: SessionsChangedEventPayload{},
			fields: []string{"sessionKey", "status", "ts"},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := GatewayEventPayloadMap[tc.event]
			if !ok {
				t.Fatalf("expected event registry to contain %s", tc.event)
			}
			expected := reflect.TypeOf(tc.target)
			if got != expected {
				t.Fatalf("expected %s payload type %v, got %v", tc.event, expected, got)
			}
			for _, jsonField := range tc.fields {
				if !hasJSONField(got, jsonField) {
					t.Fatalf("expected %s to include json field %q", got.Name(), jsonField)
				}
			}
		})
	}
}

func hasJSONField(typ reflect.Type, field string) bool {
	for i := 0; i < typ.NumField(); i++ {
		if typ.Field(i).Tag.Get("json") == field || typ.Field(i).Tag.Get("json") == field+",omitempty" {
			return true
		}
	}
	return false
}
