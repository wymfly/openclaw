package server

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway/generated"
	openclawrt "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/openclaw"
)

var validMemoryAgentID = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)

func registerMemoryRoutes(mux interface {
	MethodFunc(string, string, http.HandlerFunc)
}, managed openclawrt.ManagedRuntimeSurface) {
	mux.MethodFunc("GET", "/memory/browse", func(w http.ResponseWriter, r *http.Request) {
		agentID := r.URL.Query().Get("agentId")
		subPath := r.URL.Query().Get("path")
		readMode := r.URL.Query().Get("read") == "1"
		if agentID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "agentId is required"})
			return
		}
		if !validMemoryAgentID.MatchString(agentID) {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Invalid agentId — must be alphanumeric, hyphens, or underscores"})
			return
		}
		if !isValidMemorySubPath(subPath) {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Invalid path — must be relative without '..' segments"})
			return
		}
		basePath, err := resolveMemoryWorkspacePath(r.Context(), managed, agentID)
		if err != nil || basePath == "" {
			writeJSON(w, http.StatusServiceUnavailable, map[string]any{"error": "Could not resolve memory path"})
			return
		}
		targetPath, ok := safeMemoryPath(basePath, subPath)
		if !ok {
			writeJSON(w, http.StatusForbidden, map[string]any{"error": "Invalid path — traversal detected"})
			return
		}
		info, err := os.Stat(targetPath)
		if err != nil {
			if os.IsNotExist(err) {
				writeJSON(w, http.StatusOK, map[string]any{"files": []any{}})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "Failed to browse memory files"})
			return
		}
		if readMode || !info.IsDir() {
			if info.IsDir() {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Not a file"})
				return
			}
			content, err := os.ReadFile(targetPath)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "Failed to read file"})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"content": string(content), "path": subPath})
			return
		}
		entries, err := os.ReadDir(targetPath)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "Failed to browse memory files"})
			return
		}
		files := make([]map[string]any, 0, len(entries))
		for _, entry := range entries {
			if strings.HasPrefix(entry.Name(), ".") {
				continue
			}
			entryPath := entry.Name()
			if subPath != "" {
				entryPath = subPath + "/" + entry.Name()
			}
			item := map[string]any{
				"name": entry.Name(),
				"path": entryPath,
			}
			if entry.IsDir() {
				item["type"] = "directory"
			} else {
				item["type"] = "file"
				if info, err := entry.Info(); err == nil {
					item["size"] = info.Size()
				}
			}
			files = append(files, item)
		}
		writeJSON(w, http.StatusOK, map[string]any{"files": files})
	})

	mux.MethodFunc("GET", "/memory/health", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := managed.DoctorMemoryStatus(ctx)
		if err != nil {
			writeJSON(w, http.StatusOK, map[string]any{"entries": []any{}, "lanceDbEnabled": false})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("POST", "/memory/dreams", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Action  string `json:"action"`
			AgentID string `json:"agentId"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		switch body.Action {
		case "read":
			payload, err := managed.DoctorMemoryDreamDiary(ctx)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		case "backfill":
			payload, err := managed.DoctorMemoryBackfillDreamDiary(ctx)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		case "reset":
			payload, err := managed.DoctorMemoryResetDreamDiary(ctx)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		case "resetShortTerm":
			payload, err := managed.DoctorMemoryResetGroundedShortTerm(ctx)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		case "repair":
			payload, err := managed.DoctorMemoryRepairDreamingArtifacts(ctx)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		case "dedupe":
			payload, err := managed.DoctorMemoryDedupeDreamDiary(ctx)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		default:
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": `unknown action "` + body.Action + `"`})
		}
	})

	handleSearch := func(w http.ResponseWriter, r *http.Request, query string, agentID string, scope string) {
		if strings.TrimSpace(query) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "q is required"})
			return
		}
		writeJSON(w, http.StatusNotImplemented, map[string]any{"error": "Not implemented — requires LanceDB extension"})
	}

	mux.MethodFunc("GET", "/memory/search", func(w http.ResponseWriter, r *http.Request) {
		handleSearch(w, r, r.URL.Query().Get("q"), r.URL.Query().Get("agentId"), r.URL.Query().Get("scope"))
	})

	mux.MethodFunc("POST", "/memory/search", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Query   string `json:"query"`
			AgentID string `json:"agentId"`
			Scope   string `json:"scope"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
			return
		}
		handleSearch(w, r, body.Query, body.AgentID, body.Scope)
	})
}

func resolveMemoryWorkspacePath(ctx context.Context, managed openclawrt.ManagedRuntimeSurface, agentID string) (string, error) {
	payload, err := managed.AgentFilesList(ctx, agentID)
	if err != nil {
		return "", err
	}
	if result, ok := payload.(generated.AgentsFilesListResult); ok {
		return result.Workspace, nil
	}
	record, _ := payload.(map[string]any)
	if workspace, _ := record["workspace"].(string); workspace != "" {
		return workspace, nil
	}
	if basePath, _ := record["basePath"].(string); basePath != "" {
		return basePath, nil
	}
	return "", nil
}

func isValidMemorySubPath(value string) bool {
	if value == "" {
		return true
	}
	if strings.HasPrefix(value, "/") || strings.HasPrefix(value, `\`) {
		return false
	}
	for _, segment := range strings.FieldsFunc(value, func(r rune) bool { return r == '/' || r == '\\' }) {
		if segment == ".." {
			return false
		}
	}
	return true
}

func safeMemoryPath(base string, subPath string) (string, bool) {
	resolvedBase := filepath.Clean(base)
	candidate := resolvedBase
	if subPath != "" {
		candidate = filepath.Clean(filepath.Join(resolvedBase, subPath))
	}
	rel, err := filepath.Rel(resolvedBase, candidate)
	if err != nil || strings.HasPrefix(rel, "..") {
		return "", false
	}
	if realBase, err := filepath.EvalSymlinks(resolvedBase); err == nil {
		if realTarget, err := filepath.EvalSymlinks(candidate); err == nil {
			rel, relErr := filepath.Rel(realBase, realTarget)
			if relErr != nil || strings.HasPrefix(rel, "..") {
				return "", false
			}
			return realTarget, true
		}
	}
	return candidate, true
}
