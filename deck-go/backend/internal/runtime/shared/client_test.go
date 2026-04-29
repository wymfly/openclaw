package shared

import (
	"bytes"
	"context"
	"log"
	"strings"
	"testing"
	"time"
)

func TestClientRejectsMissingEndpointBeforeDial(t *testing.T) {
	client := NewClient(Endpoint{Token: "token"})
	_, err := client.Request(context.Background(), "gateway.describe", map[string]any{})
	if err == nil || !strings.Contains(err.Error(), "gateway url") {
		t.Fatalf("Request() error = %v, want missing URL", err)
	}
}

func TestClientAppliesDefaultTimeout(t *testing.T) {
	client := NewClient(Endpoint{
		URL:   "ws://127.0.0.1:1",
		Token: "token",
	})
	if client.Timeout() != 8*time.Second {
		t.Fatalf("Timeout() = %v", client.Timeout())
	}
}

func TestClientWarnsWhenTLSVerificationDisabledWithoutLoggingToken(t *testing.T) {
	var logs bytes.Buffer
	previousWriter := log.Writer()
	previousFlags := log.Flags()
	log.SetOutput(&logs)
	log.SetFlags(0)
	t.Cleanup(func() {
		log.SetOutput(previousWriter)
		log.SetFlags(previousFlags)
	})

	client := NewClient(Endpoint{
		URL:       "ws://127.0.0.1:1",
		Token:     "secret-token-42",
		TLSVerify: false,
	})
	_, _ = client.Request(context.Background(), "gateway.describe", map[string]any{})

	output := logs.String()
	if !strings.Contains(output, "WARN") || !strings.Contains(output, "tlsVerify=false") {
		t.Fatalf("log output = %q, want WARN tlsVerify=false", output)
	}
	if !strings.Contains(output, "ws://127.0.0.1:1") || !strings.Contains(output, "gateway.describe") {
		t.Fatalf("log output = %q, want endpoint URL and method", output)
	}
	if strings.Contains(output, "secret-token-42") {
		t.Fatalf("log output leaked token: %q", output)
	}
}
