package server

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
)

const (
	maxCanvasResponseSize = 5 * 1024 * 1024
	canvasFetchTimeout    = 10 * time.Second
)

var (
	canvasReadySessions sync.Map
	canvasEvalResults   sync.Map
)

const canvasBridgeScript = `
<script>
(() => {
  const DECK_ORIGIN = window.location.ancestorOrigins?.[0] ?? "*";
  window.addEventListener("message", (e) => {
    if (DECK_ORIGIN !== "*" && e.origin !== DECK_ORIGIN) return;
    if (e.data?.type === "a2ui:push") {
      globalThis.openclawA2UI?.applyMessages(e.data.messages);
      window.parent.postMessage(
        { type: "a2ui:surfaces-changed", surfaces: globalThis.openclawA2UI?.getSurfaces?.() ?? [] },
        DECK_ORIGIN,
      );
    } else if (e.data?.type === "a2ui:reset") {
      globalThis.openclawA2UI?.reset();
    } else if (e.data?.type === "a2ui:action-status") {
      window.dispatchEvent(new CustomEvent("openclaw:a2ui-action-status", {
        detail: { id: e.data.id, ok: e.data.ok, error: e.data.error },
      }));
    } else if (e.data?.type === "a2ui:get-tree") {
      const host = document.querySelector("openclaw-a2ui-host");
      let tree = null;
      try {
        const surfaces = host?.shadowRoot?.querySelector("#surfaces");
        if (surfaces) {
          tree = Array.from(surfaces.querySelectorAll("a2ui-surface")).map((el) => ({
            surfaceId: el.getAttribute("surface-id") ?? "unknown",
            componentCount: el.shadowRoot?.querySelectorAll("[data-component-id]")?.length ?? 0,
          }));
        }
      } catch {}
      window.parent.postMessage({ type: "a2ui:tree-data", tree }, DECK_ORIGIN);
    } else if (e.data?.type === "a2ui:eval") {
      if (DECK_ORIGIN === "*") {
        window.parent.postMessage(
          { type: "a2ui:eval-result", evalId: e.data.evalId, result: null, error: "origin verification failed" },
          "*"
        );
        return;
      }
      try {
        var result = eval(e.data.javaScript);
        window.parent.postMessage(
          { type: "a2ui:eval-result", evalId: e.data.evalId, result: result },
          DECK_ORIGIN,
        );
      } catch (err) {
        window.parent.postMessage(
          { type: "a2ui:eval-result", evalId: e.data.evalId, result: null, error: String(err) },
          DECK_ORIGIN,
        );
      }
    }
  });
  window.openclawCanvasA2UIAction = {
    postMessage: (payload) => {
      const parsed = JSON.parse(payload);
      window.parent.postMessage(
        { type: "a2ui:action", userAction: parsed.userAction ?? parsed },
        DECK_ORIGIN,
      );
    },
  };
  window.parent.postMessage({ type: "a2ui:ready" }, DECK_ORIGIN);
})();
</script>`

func registerAssetRoutes(mux interface {
	MethodFunc(string, string, http.HandlerFunc)
}, store *config.Store) {
	mux.MethodFunc("GET", "/media", func(w http.ResponseWriter, r *http.Request) {
		rawPath := r.URL.Query().Get("path")
		if rawPath == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "path is required"})
			return
		}
		resolved := filepath.Clean(rawPath)
		if !isAllowedMediaPath(resolved) {
			writeJSON(w, http.StatusForbidden, map[string]any{"error": "access denied"})
			return
		}
		info, err := os.Stat(resolved)
		if err != nil || !info.Mode().IsRegular() {
			writeJSON(w, http.StatusNotFound, map[string]any{"error": "file not found"})
			return
		}
		buffer, err := os.ReadFile(resolved)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]any{"error": "file not found"})
			return
		}
		disposition := "inline"
		if r.URL.Query().Get("dl") == "1" {
			disposition = `attachment; filename="` + filepath.Base(resolved) + `"`
		}
		if disposition == "inline" {
			disposition = "inline"
		}
		w.Header().Set("Content-Type", mimeFromPath(resolved))
		w.Header().Set("Content-Length", strconv.Itoa(len(buffer)))
		w.Header().Set("Content-Disposition", disposition)
		w.Header().Set("Cache-Control", "private, max-age=300")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(buffer)
	})

	mux.MethodFunc("GET", "/canvas/*", func(w http.ResponseWriter, r *http.Request) {
		baseURL, token, ok := resolveGatewayHTTPBase(store)
		if !ok {
			writeJSON(w, http.StatusBadGateway, map[string]any{"error": "Gateway URL not configured"})
			return
		}
		subPath := strings.TrimPrefix(r.URL.Path, "/api/canvas/")
		if subPath == "" {
			subPath = "index.html"
		}
		if strings.Contains(subPath, "..") || invalidCanvasPath(subPath) {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Invalid path"})
			return
		}
		targetPath := "/__openclaw__/a2ui/" + subPath
		if strings.HasPrefix(subPath, "documents/") {
			targetPath = "/__openclaw__/canvas/" + subPath
		}
		targetURL := strings.TrimRight(baseURL, "/") + targetPath
		req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, targetURL, nil)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"error": "Failed to fetch canvas host"})
			return
		}
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		client := &http.Client{Timeout: canvasFetchTimeout}
		res, err := client.Do(req)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"error": "Failed to fetch canvas host"})
			return
		}
		defer res.Body.Close()
		if res.StatusCode < 200 || res.StatusCode >= 300 {
			writeJSON(w, statusToProxyStatus(res.StatusCode), map[string]any{"error": "Gateway returned " + res.Status})
			return
		}
		contentType := res.Header.Get("Content-Type")
		if contentType == "" {
			contentType = "application/octet-stream"
		}
		if strings.Contains(contentType, "text/html") {
			body, err := io.ReadAll(io.LimitReader(res.Body, maxCanvasResponseSize+1))
			if err != nil || len(body) > maxCanvasResponseSize {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": "Response too large"})
				return
			}
			html := string(body)
			idx := strings.LastIndex(strings.ToLower(html), "</body>")
			if idx >= 0 {
				html = html[:idx] + canvasBridgeScript + html[idx:]
			} else {
				html += canvasBridgeScript
			}
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Header().Set("Cache-Control", "no-store")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(html))
			return
		}
		body, err := io.ReadAll(io.LimitReader(res.Body, maxCanvasResponseSize+1))
		if err != nil || len(body) > maxCanvasResponseSize {
			writeJSON(w, http.StatusBadGateway, map[string]any{"error": "Response too large"})
			return
		}
		w.Header().Set("Content-Type", contentType)
		if strings.Contains(contentType, "javascript") {
			w.Header().Set("Cache-Control", "public, max-age=3600")
		} else {
			w.Header().Set("Cache-Control", "no-store")
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(body)
	})

	mux.MethodFunc("POST", "/deck/canvas", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Action     string `json:"action"`
			SessionKey string `json:"sessionKey"`
			EvalID     string `json:"evalId"`
			Result     any    `json:"result"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid body"})
			return
		}
		switch body.Action {
		case "ready":
			if strings.TrimSpace(body.SessionKey) == "" {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "sessionKey required"})
				return
			}
			canvasReadySessions.Store(body.SessionKey, true)
			writeJSON(w, http.StatusOK, map[string]any{"ok": true})
			return
		case "unready":
			if strings.TrimSpace(body.SessionKey) == "" {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "sessionKey required"})
				return
			}
			canvasReadySessions.Delete(body.SessionKey)
			writeJSON(w, http.StatusOK, map[string]any{"ok": true})
			return
		case "resolve":
			if strings.TrimSpace(body.EvalID) == "" {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "evalId required"})
				return
			}
			canvasEvalResults.Store(body.EvalID, body.Result)
			writeJSON(w, http.StatusOK, map[string]any{"ok": true})
			return
		default:
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid body"})
			return
		}
	})
}

func resolveGatewayHTTPBase(store *config.Store) (string, string, bool) {
	if baseURL, token, ok := resolveBundledGatewayHTTPBaseFromEnv(); ok {
		return baseURL, token, true
	}
	settings := store.Effective().ManagedGateway
	if strings.TrimSpace(settings.GatewayToken) == "" {
		return "", "", false
	}
	wsURL := config.ManagedGatewayURL(settings)
	if wsURL == "" {
		return "", "", false
	}
	httpURL := strings.Replace(wsURL, "ws://", "http://", 1)
	httpURL = strings.Replace(httpURL, "wss://", "https://", 1)
	return httpURL, settings.GatewayToken, true
}

func resolveBundledGatewayHTTPBaseFromEnv() (string, string, bool) {
	if strings.TrimSpace(os.Getenv("RUNTIME_MODE")) != "bundled" {
		return "", "", false
	}
	token := strings.TrimSpace(os.Getenv("RUNTIME_BUNDLED_TOKEN"))
	if token == "" {
		return "", "", false
	}
	host := strings.TrimSpace(os.Getenv("RUNTIME_BUNDLED_BIND_HOST"))
	if host == "" {
		host = "127.0.0.1"
	}
	port := strings.TrimSpace(os.Getenv("RUNTIME_BUNDLED_BIND_PORT"))
	if port == "" {
		port = "18789"
	}
	return "http://" + host + ":" + port, token, true
}

func invalidCanvasPath(path string) bool {
	for _, r := range path {
		if r == '_' || r == '-' || r == '/' || r == '.' ||
			(r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			continue
		}
		return true
	}
	return false
}

func isAllowedMediaPath(path string) bool {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		homeDir = "."
	}
	allowed := []string{
		filepath.Join(homeDir, ".openclaw", "media"),
		filepath.Join(homeDir, ".openclaw", "agents"),
		filepath.Join(homeDir, ".openclaw", "sessions"),
	}
	if dataDir := os.Getenv("DECK_GO_DATA_DIR"); dataDir != "" {
		allowed = append(allowed, filepath.Clean(dataDir))
	}
	resolved := filepath.Clean(path)
	for _, prefix := range allowed {
		prefix = filepath.Clean(prefix)
		if strings.HasPrefix(resolved, prefix) {
			return true
		}
	}
	return false
}

func mimeFromPath(filePath string) string {
	switch strings.ToLower(filepath.Ext(filePath)) {
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".gif":
		return "image/gif"
	case ".webp":
		return "image/webp"
	case ".svg":
		return "image/svg+xml"
	case ".pdf":
		return "application/pdf"
	case ".json":
		return "application/json"
	case ".csv":
		return "text/csv"
	case ".txt":
		return "text/plain"
	case ".md":
		return "text/markdown"
	case ".html":
		return "text/html"
	case ".js":
		return "text/javascript"
	case ".ts":
		return "text/typescript"
	case ".py":
		return "text/x-python"
	case ".mp3":
		return "audio/mpeg"
	case ".wav":
		return "audio/wav"
	case ".mp4":
		return "video/mp4"
	default:
		return "application/octet-stream"
	}
}

func statusToProxyStatus(status int) int {
	if status >= 500 {
		return http.StatusBadGateway
	}
	return status
}
