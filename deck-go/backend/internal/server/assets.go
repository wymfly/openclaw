package server

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
)

var (
	canvasReadySessions sync.Map
	canvasEvalResults   sync.Map
)

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
