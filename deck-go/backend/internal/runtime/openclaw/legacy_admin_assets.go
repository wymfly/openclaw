package openclaw

import (
	"context"
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

type AssetResponse struct {
	Status  int
	Headers map[string]string
	Body    []byte
	JSON    any
}

func (m *ManagedRuntime) GetMedia(ctx context.Context, filePath string, download bool) (AssetResponse, error) {
	resolved := filepath.Clean(filePath)
	if !isAllowedMediaPath(resolved) {
		return AssetResponse{Status: http.StatusForbidden, JSON: map[string]any{"error": "access denied"}}, nil
	}
	info, err := os.Stat(resolved)
	if err != nil || !info.Mode().IsRegular() {
		return AssetResponse{Status: http.StatusNotFound, JSON: map[string]any{"error": "file not found"}}, nil
	}
	buffer, err := os.ReadFile(resolved)
	if err != nil {
		return AssetResponse{Status: http.StatusNotFound, JSON: map[string]any{"error": "file not found"}}, nil
	}
	disposition := "inline"
	if download {
		disposition = `attachment; filename="` + filepath.Base(resolved) + `"`
	}
	return AssetResponse{
		Status: http.StatusOK,
		Headers: map[string]string{
			"Content-Type":        mimeFromPath(resolved),
			"Content-Length":      strconv.Itoa(len(buffer)),
			"Content-Disposition": disposition,
			"Cache-Control":       "private, max-age=300",
		},
		Body: buffer,
	}, nil
}

func (m *ManagedRuntime) GetCanvasAsset(ctx context.Context, subPath string) (AssetResponse, error) {
	baseURL, token, ok := m.resolveGatewayHTTPBase()
	if !ok {
		return AssetResponse{Status: http.StatusBadGateway, JSON: map[string]any{"error": "Gateway URL not configured"}}, nil
	}
	if subPath == "" {
		subPath = "index.html"
	}
	if strings.Contains(subPath, "..") || invalidCanvasPath(subPath) {
		return AssetResponse{Status: http.StatusBadRequest, JSON: map[string]any{"error": "Invalid path"}}, nil
	}
	targetURL := strings.TrimRight(baseURL, "/") + "/__openclaw__/a2ui/" + subPath
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return AssetResponse{Status: http.StatusBadGateway, JSON: map[string]any{"error": "Failed to fetch canvas host"}}, nil
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	client := &http.Client{Timeout: canvasFetchTimeout}
	res, err := client.Do(req)
	if err != nil {
		return AssetResponse{Status: http.StatusBadGateway, JSON: map[string]any{"error": "Failed to fetch canvas host"}}, nil
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return AssetResponse{Status: statusToProxyStatus(res.StatusCode), JSON: map[string]any{"error": "Gateway returned " + res.Status}}, nil
	}
	contentType := res.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	if strings.Contains(contentType, "text/html") {
		body, err := io.ReadAll(io.LimitReader(res.Body, maxCanvasResponseSize+1))
		if err != nil || len(body) > maxCanvasResponseSize {
			return AssetResponse{Status: http.StatusBadGateway, JSON: map[string]any{"error": "Response too large"}}, nil
		}
		html := string(body)
		idx := strings.LastIndex(strings.ToLower(html), "</body>")
		if idx >= 0 {
			html = html[:idx] + canvasBridgeScript + html[idx:]
		} else {
			html += canvasBridgeScript
		}
		return AssetResponse{
			Status: http.StatusOK,
			Headers: map[string]string{
				"Content-Type":  "text/html; charset=utf-8",
				"Cache-Control": "no-store",
			},
			Body: []byte(html),
		}, nil
	}
	body, err := io.ReadAll(io.LimitReader(res.Body, maxCanvasResponseSize+1))
	if err != nil || len(body) > maxCanvasResponseSize {
		return AssetResponse{Status: http.StatusBadGateway, JSON: map[string]any{"error": "Response too large"}}, nil
	}
	cacheControl := "no-store"
	if strings.Contains(contentType, "javascript") {
		cacheControl = "public, max-age=3600"
	}
	return AssetResponse{
		Status: http.StatusOK,
		Headers: map[string]string{
			"Content-Type":  contentType,
			"Cache-Control": cacheControl,
		},
		Body: body,
	}, nil
}

func (m *ManagedRuntime) HandleDeckCanvas(ctx context.Context, body map[string]any) (AssetResponse, error) {
	action, _ := body["action"].(string)
	sessionKey, _ := body["sessionKey"].(string)
	evalID, _ := body["evalId"].(string)
	switch action {
	case "ready":
		if strings.TrimSpace(sessionKey) == "" {
			return AssetResponse{Status: http.StatusBadRequest, JSON: map[string]any{"error": "sessionKey required"}}, nil
		}
		canvasReadySessions.Store(sessionKey, true)
		return AssetResponse{Status: http.StatusOK, JSON: map[string]any{"ok": true}}, nil
	case "unready":
		if strings.TrimSpace(sessionKey) == "" {
			return AssetResponse{Status: http.StatusBadRequest, JSON: map[string]any{"error": "sessionKey required"}}, nil
		}
		canvasReadySessions.Delete(sessionKey)
		return AssetResponse{Status: http.StatusOK, JSON: map[string]any{"ok": true}}, nil
	case "resolve":
		if strings.TrimSpace(evalID) == "" {
			return AssetResponse{Status: http.StatusBadRequest, JSON: map[string]any{"error": "evalId required"}}, nil
		}
		canvasEvalResults.Store(evalID, body["result"])
		return AssetResponse{Status: http.StatusOK, JSON: map[string]any{"ok": true}}, nil
	default:
		return AssetResponse{Status: http.StatusBadRequest, JSON: map[string]any{"error": "invalid body"}}, nil
	}
}

func (m *ManagedRuntime) resolveGatewayHTTPBase() (string, string, bool) {
	if baseURL, token, ok := resolveBundledGatewayHTTPBaseFromEnv(); ok {
		return baseURL, token, true
	}
	if m == nil || m.store == nil {
		return "", "", false
	}
	settings := m.store.Effective().ManagedGateway
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

func statusToProxyStatus(status int) int {
	if status >= 500 {
		return http.StatusBadGateway
	}
	return status
}
