package access

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"

	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
)

func ValidateRequest(r *http.Request, store *config.Store) (bool, string) {
	if ShouldBypassAuth(r) {
		return true, ""
	}
	settings := store.Effective()
	expected := strings.TrimSpace(settings.AccessToken)
	if expected == "" {
		return true, ""
	}
	provided := extractToken(r)
	if provided == "" {
		return false, "Missing authentication token."
	}
	if !safeEqual(provided, expected) {
		return false, "Invalid authentication token."
	}
	return true, ""
}

func extractToken(r *http.Request) string {
	auth := r.Header.Get("Authorization")
	if strings.HasPrefix(auth, "Bearer ") {
		return strings.TrimPrefix(auth, "Bearer ")
	}
	return r.Header.Get("x-deck-token")
}

func ShouldBypassAuth(r *http.Request) bool {
	if r == nil {
		return false
	}
	if strings.HasPrefix(r.URL.Path, "/api/") {
		return false
	}
	return r.Method == http.MethodGet || r.Method == http.MethodHead
}

func safeEqual(left, right string) bool {
	key := []byte("deck-go-compare-key")
	lh := hmac.New(sha256.New, key)
	lh.Write([]byte(left))
	rh := hmac.New(sha256.New, key)
	rh.Write([]byte(right))
	return hmac.Equal([]byte(hex.EncodeToString(lh.Sum(nil))), []byte(hex.EncodeToString(rh.Sum(nil))))
}
