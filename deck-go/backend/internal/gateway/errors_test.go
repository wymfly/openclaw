package gateway

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway/generated"
)

var _ generated.Requester = (*Client)(nil)
var _ generated.Requester = (*Realtime)(nil)
var _ generated.Requester = (*MockTypedRequester)(nil)

func TestFromEnvelopeBuildsErrCode(t *testing.T) {
	for _, code := range []string{
		"scope_denied",
		"validation_failed",
		"not_found",
		"conflict",
		"rate_limited",
		"internal_error",
		"protocol_error",
	} {
		t.Run(code, func(t *testing.T) {
			err := FromEnvelope(&responseError{
				Code:    code,
				Message: "missing field x",
				Details: map[string]any{
					"field": "x",
				},
			})

			var errCode *ErrCode
			if !errors.As(err, &errCode) {
				t.Fatalf("expected ErrCode, got %T", err)
			}
			if errCode.Code != code || errCode.Message != "missing field x" {
				t.Fatalf("unexpected ErrCode: %#v", errCode)
			}
			if errCode.Details["field"] != "x" {
				t.Fatalf("expected details to round-trip, got %#v", errCode.Details)
			}
			if err.Error() != code+": missing field x" {
				t.Fatalf("unexpected error string %q", err.Error())
			}
			if !errors.Is(err, &ErrCode{Code: code}) {
				t.Fatal("expected errors.Is to match ErrCode code")
			}
		})
	}
}

func TestErrScopeDeniedSentinelIsImmutable(t *testing.T) {
	if _, ok := ErrScopeDenied.(*ErrCode); ok {
		t.Fatal("ErrScopeDenied must not expose mutable ErrCode fields")
	}
	err := &ErrCode{Code: "scope_denied", Message: "missing scope"}
	if !errors.Is(err, ErrScopeDenied) {
		t.Fatal("expected ErrCode scope_denied to match immutable sentinel")
	}
	if !errors.Is(ErrScopeDenied, &ErrCode{Code: "scope_denied"}) {
		t.Fatal("expected immutable sentinel to match scope_denied ErrCode")
	}
	if errors.Is(&ErrCode{Code: "validation_failed"}, ErrScopeDenied) {
		t.Fatal("unexpected validation_failed match with ErrScopeDenied")
	}
}

func TestScopeDeniedEnvelopeMatchesSentinel(t *testing.T) {
	err := FromEnvelope(&responseError{
		Code:    "scope_denied",
		Message: "missing scope",
		Details: map[string]any{
			"required": "operator.write",
		},
	})

	if !errors.Is(err, ErrScopeDenied) {
		t.Fatalf("expected scope_denied envelope to match ErrScopeDenied, got %v", err)
	}
	var errCode *ErrCode
	if !errors.As(err, &errCode) {
		t.Fatal("expected scope denied envelope to remain inspectable as ErrCode")
	}
	if errCode.Details["required"] != "operator.write" {
		t.Fatalf("expected required scope detail, got %#v", errCode.Details)
	}
}

func TestRealtimeRequestTyped_ReturnsTypedEnvelopeError(t *testing.T) {
	server := newRPCGatewayServer(t, rpcGatewayOptions{
		errorFrames: map[string]responseError{
			"agents.list": {
				Code:    "validation_failed",
				Message: "missing x",
				Details: map[string]any{
					"field": "x",
				},
			},
		},
	})
	defer server.Close()

	provider := &mutableProvider{url: wsURL(server.URL), token: "token-1", ok: true}
	realtime := NewRealtime(provider, events.NewNoopBus())
	defer realtime.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := generated.NewTypedClient(realtime).AgentsList(ctx, generated.AgentsListParams{})
	if err == nil {
		t.Fatal("expected envelope error")
	}
	var errCode *ErrCode
	if !errors.As(err, &errCode) {
		t.Fatalf("expected ErrCode, got %T %v", err, err)
	}
	if errCode.Code != "validation_failed" || errCode.Details["field"] != "x" {
		t.Fatalf("unexpected envelope error: %#v", errCode)
	}
}

func TestConnectionLostIsNotEnvelopeError(t *testing.T) {
	release := make(chan struct{})
	server := newRPCGatewayServer(t, rpcGatewayOptions{
		closeOnMethod: map[string]chan struct{}{"health": release},
	})
	defer server.Close()
	close(release)

	provider := &mutableProvider{url: wsURL(server.URL), token: "token-1", ok: true}
	realtime := NewRealtime(provider, events.NewNoopBus())
	defer realtime.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := realtime.RequestTyped(ctx, "health", map[string]any{})
	if !errors.Is(err, ErrConnectionLost) {
		t.Fatalf("expected ErrConnectionLost, got %v", err)
	}
	var errCode *ErrCode
	if errors.As(err, &errCode) {
		t.Fatalf("connection error should not be ErrCode: %#v", errCode)
	}
}
