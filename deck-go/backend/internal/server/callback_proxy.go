package server

import (
	"io"
	"net/http"
	"strings"

	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
)

func registerGatewayCallbackProxyRoutes(mux interface {
	MethodFunc(string, string, http.HandlerFunc)
}, store *config.Store) {
	if mux == nil || store == nil {
		return
	}

	handler := func(w http.ResponseWriter, r *http.Request) {
		targetURL, ok := resolveGatewayCallbackTarget(store, r)
		if !ok {
			writeJSON(w, http.StatusBadGateway, map[string]any{"error": "Gateway URL not configured"})
			return
		}

		req, err := http.NewRequestWithContext(r.Context(), r.Method, targetURL, r.Body)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"error": "Failed to proxy callback"})
			return
		}
		req.Header = r.Header.Clone()

		res, err := http.DefaultClient.Do(req)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"error": "Failed to proxy callback"})
			return
		}
		defer res.Body.Close()

		for name, values := range res.Header {
			if strings.EqualFold(name, "Content-Length") || strings.EqualFold(name, "Transfer-Encoding") {
				continue
			}
			for _, value := range values {
				w.Header().Add(name, value)
			}
		}
		w.WriteHeader(res.StatusCode)
		_, _ = io.Copy(w, res.Body)
	}

	for _, path := range []string{"/plugins/*", "/wecom/*"} {
		mux.MethodFunc(http.MethodGet, path, handler)
		mux.MethodFunc(http.MethodPost, path, handler)
	}
}

func resolveGatewayCallbackTarget(store *config.Store, r *http.Request) (string, bool) {
	if store == nil || r == nil {
		return "", false
	}
	settings := store.Effective().ManagedGateway
	if strings.TrimSpace(settings.Mode) != "" && settings.Mode != "managed" {
		return "", false
	}
	wsURL := config.ManagedGatewayURL(settings)
	if strings.TrimSpace(wsURL) == "" {
		return "", false
	}
	httpURL := strings.Replace(wsURL, "ws://", "http://", 1)
	httpURL = strings.Replace(httpURL, "wss://", "https://", 1)
	return strings.TrimRight(httpURL, "/") + r.URL.Path + rawQuerySuffix(r), true
}

func rawQuerySuffix(r *http.Request) string {
	if r == nil || strings.TrimSpace(r.URL.RawQuery) == "" {
		return ""
	}
	return "?" + r.URL.RawQuery
}
