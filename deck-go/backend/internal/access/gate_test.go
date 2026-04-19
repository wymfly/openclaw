package access

import (
	"net/http/httptest"
	"testing"

	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
)

func TestValidateRequest_NoTokenConfigured_AllowsRequest(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest("GET", "/", nil)
	valid, message := ValidateRequest(req, store)
	if !valid || message != "" {
		t.Fatalf("expected request to be allowed, got valid=%v message=%q", valid, message)
	}
}

func TestValidateRequest_RequiresMatchingToken(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(config.Settings{AccessToken: "secret-token"}); err != nil {
		t.Fatal(err)
	}

	t.Run("missing token", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/", nil)
		valid, _ := ValidateRequest(req, store)
		if valid {
			t.Fatal("expected request to be rejected")
		}
	})

	t.Run("matching bearer token", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/", nil)
		req.Header.Set("Authorization", "Bearer secret-token")
		valid, _ := ValidateRequest(req, store)
		if !valid {
			t.Fatal("expected request to be accepted")
		}
	})

	t.Run("matching x-deck-token", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/", nil)
		req.Header.Set("x-deck-token", "secret-token")
		valid, _ := ValidateRequest(req, store)
		if !valid {
			t.Fatal("expected request to be accepted")
		}
	})
}

