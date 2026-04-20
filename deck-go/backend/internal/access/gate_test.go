package access

import (
	"net/http"
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
		req := httptest.NewRequest("GET", "/api/settings", nil)
		valid, _ := ValidateRequest(req, store)
		if valid {
			t.Fatal("expected request to be rejected")
		}
	})

	t.Run("matching bearer token", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/settings", nil)
		req.Header.Set("Authorization", "Bearer secret-token")
		valid, _ := ValidateRequest(req, store)
		if !valid {
			t.Fatal("expected request to be accepted")
		}
	})

	t.Run("matching x-deck-token", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/settings", nil)
		req.Header.Set("x-deck-token", "secret-token")
		valid, _ := ValidateRequest(req, store)
		if !valid {
			t.Fatal("expected request to be accepted")
		}
	})
}

func TestShouldBypassAuth_AllowsStaticShellButNotAPI(t *testing.T) {
	t.Run("static shell", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "http://example.com/", nil)
		if err != nil {
			t.Fatal(err)
		}
		if !ShouldBypassAuth(req) {
			t.Fatal("expected static shell request to bypass auth")
		}
	})

	t.Run("asset request", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "http://example.com/assets/app.js", nil)
		if err != nil {
			t.Fatal(err)
		}
		if !ShouldBypassAuth(req) {
			t.Fatal("expected asset request to bypass auth")
		}
	})

	t.Run("api remains protected", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "http://example.com/api/settings", nil)
		if err != nil {
			t.Fatal(err)
		}
		if ShouldBypassAuth(req) {
			t.Fatal("expected API request to remain protected")
		}
	})
}
