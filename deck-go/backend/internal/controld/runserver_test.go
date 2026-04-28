package controld

import (
	"context"
	"net"
	"net/http"
	"sync/atomic"
	"testing"
	"time"

	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
)

type stubRuntimeStopper struct {
	calls atomic.Int32
	err   error
}

func (s *stubRuntimeStopper) StopRuntimeGateway(ctx context.Context) (deckapi.DeckGoRuntimeGatewayActionResponse, error) {
	s.calls.Add(1)
	if s.err != nil {
		return deckapi.DeckGoRuntimeGatewayActionResponse{}, s.err
	}
	return deckapi.DeckGoRuntimeGatewayActionResponse{Ok: true}, nil
}

func TestRunServer_StopsRuntimeGatewayOnContextCancel(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	server := &http.Server{
		Addr:              listener.Addr().String(),
		Handler:           http.NewServeMux(),
		ReadHeaderTimeout: time.Second,
	}
	_ = listener.Close()

	stub := &stubRuntimeStopper{}
	ctx, cancel := context.WithCancel(context.Background())

	done := make(chan error, 1)
	go func() {
		done <- RunServer(ctx, server, stub, "test-service")
	}()

	time.Sleep(20 * time.Millisecond)
	cancel()

	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("RunServer returned error: %v", err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("RunServer did not return within 3s of ctx cancellation")
	}

	if stub.calls.Load() != 1 {
		t.Fatalf("expected StopRuntimeGateway to be called exactly once, got %d", stub.calls.Load())
	}
}

func TestRunServer_NilRuntimeIsTolerated(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	server := &http.Server{
		Addr:              listener.Addr().String(),
		Handler:           http.NewServeMux(),
		ReadHeaderTimeout: time.Second,
	}
	_ = listener.Close()

	ctx, cancel := context.WithCancel(context.Background())

	done := make(chan error, 1)
	go func() {
		done <- RunServer(ctx, server, nil, "test-service")
	}()

	time.Sleep(20 * time.Millisecond)
	cancel()

	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("RunServer returned error: %v", err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("RunServer did not return within 3s")
	}
}
