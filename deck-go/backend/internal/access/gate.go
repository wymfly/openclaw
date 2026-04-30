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
	if isWebSocketUpgrade(r) && isGatewayWebSocketPath(r.URL.Path) {
		if token := strings.TrimSpace(r.URL.Query().Get("token")); token != "" {
			return token
		}
	}
	return r.Header.Get("x-deck-token")
}

func isWebSocketUpgrade(r *http.Request) bool {
	return strings.EqualFold(r.Header.Get("Upgrade"), "websocket")
}

func isGatewayWebSocketPath(path string) bool {
	return strings.HasSuffix(path, "/gateway/ws")
}

func ShouldBypassAuth(r *http.Request) bool {
	if r == nil {
		return false
	}
	if isGatewayCallbackPath(r.URL.Path) {
		return true
	}
	if strings.HasPrefix(r.URL.Path, "/api/") {
		return false
	}
	return r.Method == http.MethodGet || r.Method == http.MethodHead
}

func isGatewayCallbackPath(path string) bool {
	return strings.HasPrefix(path, "/plugins/") || strings.HasPrefix(path, "/wecom/")
}

func safeEqual(left, right string) bool {
	key := []byte("deck-go-compare-key")
	lh := hmac.New(sha256.New, key)
	lh.Write([]byte(left))
	rh := hmac.New(sha256.New, key)
	rh.Write([]byte(right))
	return hmac.Equal([]byte(hex.EncodeToString(lh.Sum(nil))), []byte(hex.EncodeToString(rh.Sum(nil))))
}
