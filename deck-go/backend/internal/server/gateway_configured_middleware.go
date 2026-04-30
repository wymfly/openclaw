package server

import (
	"context"
	"net/http"
	"strings"

	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
)

func GatewayConfiguredMiddleware(runtimeFacade facade.RuntimeFacade) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		if runtimeFacade == nil {
			return next
		}
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !isGatewayPassthroughPath(r.URL.Path) {
				next.ServeHTTP(w, r)
				return
			}
			caps, err := runtimeFacade.Capabilities(r.Context())
			if err != nil {
				writeRuntimeError(w, http.StatusInternalServerError, "runtime_capabilities_failed", err.Error())
				return
			}
			if caps.Mode == "remote" && !caps.Configured {
				writeGatewayNotConfigured(w, r.Context(), runtimeFacade)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func isGatewayPassthroughPath(path string) bool {
	switch {
	case path == "/api/runtime/gateway":
		return true
	case path == "/api/gateway/health" || path == "/api/gateway/status" || path == "/api/gateway/describe":
		return true
	case path == "/api/activity" || strings.HasPrefix(path, "/api/activity/"):
		return true
	case path == "/api/monitor/runs" || strings.HasPrefix(path, "/api/monitor/runs/"):
		return true
	case path == "/api/agents" || strings.HasPrefix(path, "/api/agents/"):
		return true
	case path == "/api/chat" || strings.HasPrefix(path, "/api/chat/"):
		return true
	case strings.HasPrefix(path, "/api/v1/runtimes/"):
		return true
	default:
		return false
	}
}

func writeGatewayNotConfigured(w http.ResponseWriter, ctx context.Context, runtimeFacade facade.RuntimeFacade) {
	payload := map[string]any{
		"code":    facade.CodeGatewayNotConfigured,
		"message": "runtime gateway is not configured",
	}
	if runtimeFacade != nil {
		if status, err := runtimeFacade.RuntimeGatewayStatus(ctx); err == nil && status.LastError != nil && *status.LastError != "" {
			payload["lastError"] = *status.LastError
		}
	}
	writeJSON(w, http.StatusServiceUnavailable, payload)
}
