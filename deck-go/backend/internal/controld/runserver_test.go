package controld

import (
	"context"
	"net"
	"net/http"
	"sync/atomic"
	"testing"
	"time"

	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
)

type stubRuntimeShutdown struct {
	calls atomic.Int32
	err   error
}

func (s *stubRuntimeShutdown) Stop(ctx context.Context) (facade.RuntimeStatus, error) {
	s.calls.Add(1)
	if s.err != nil {
		return facade.RuntimeStatus{}, s.err
	}
	return facade.RuntimeStatus{Mode: "bundled"}, nil
}

func TestRunServer_DoesNotStopRuntimeGatewayOnContextCancel(t *testing.T) {
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

	stub := &stubRuntimeShutdown{}
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

	if stub.calls.Load() != 0 {
		t.Fatalf("expected RuntimeShutdown.Stop not to be called, got %d", stub.calls.Load())
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
