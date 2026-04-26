package server

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/coerce"
	openclawrt "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/openclaw"
)

func registerInventoryRoutes(mux interface {
	MethodFunc(string, string, http.HandlerFunc)
}, adapter *openclawrt.LegacyInventorySurface) {
	mux.MethodFunc("GET", "/agents", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.AgentsList(ctx)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "agents.list", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("POST", "/agents", func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err.Error() != "EOF" {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"ok":    false,
				"error": "invalid json body",
			})
			return
		}
		if body == nil {
			body = map[string]any{}
		}

		name, _ := body["name"].(string)
		name = strings.TrimSpace(name)
		if name == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"ok":    false,
				"error": "name is required",
			})
			return
		}

		workspace, _ := body["workspace"].(string)
		workspace = strings.TrimSpace(workspace)
		if workspace == "" {
			workspace = resolveDefaultAgentWorkspace(r.Context(), adapter, name)
		}

		params := map[string]any{
			"name":      name,
			"workspace": workspace,
		}
		if emoji, _ := body["emoji"].(string); strings.TrimSpace(emoji) != "" {
			params["emoji"] = emoji
		}
		if avatar, _ := body["avatar"].(string); avatar != "" {
			params["avatar"] = avatar
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.AgentsCreate(ctx, params)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "agents.create", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("DELETE", "/agents", func(w http.ResponseWriter, r *http.Request) {
		agentID := r.URL.Query().Get("agentId")
		if agentID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"ok":    false,
				"error": "agentId is required",
			})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.AgentsDelete(ctx, agentID)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "agents.delete", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("GET", "/agents/{agentId}", func(w http.ResponseWriter, r *http.Request) {
		agentID := chi.URLParam(r, "agentId")
		if agentID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"ok":    false,
				"error": "agentId is required",
			})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.AgentsList(ctx)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{
				"ok":    false,
				"error": err.Error(),
			})
			return
		}
		payloadMap, ok := payload.(map[string]any)
		if !ok {
			writeJSON(w, http.StatusBadGateway, map[string]any{
				"ok":    false,
				"error": "unexpected agents.list payload shape",
			})
			return
		}
		agents, _ := payloadMap["agents"].([]any)
		for _, candidate := range agents {
			record, ok := candidate.(map[string]any)
			if !ok {
				continue
			}
			if recordID, _ := record["id"].(string); recordID == agentID {
				writeJSON(w, http.StatusOK, record)
				return
			}
		}
		writeJSON(w, http.StatusNotFound, map[string]any{"error": "Agent not found"})
	})

	mux.MethodFunc("PATCH", "/agents/{agentId}", func(w http.ResponseWriter, r *http.Request) {
		agentID := chi.URLParam(r, "agentId")
		if agentID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"ok":    false,
				"error": "agentId is required",
			})
			return
		}
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err.Error() != "EOF" {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"ok":    false,
				"error": "invalid json body",
			})
			return
		}
		if body == nil {
			body = map[string]any{}
		}
		body["agentId"] = agentID
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.AgentsUpdate(ctx, body)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "agents.update", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("GET", "/agents/{agentId}/files", func(w http.ResponseWriter, r *http.Request) {
		agentID := chi.URLParam(r, "agentId")
		if agentID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"ok":    false,
				"error": "agentId is required",
			})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.AgentFilesList(ctx, agentID)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "agents.files.list", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("POST", "/agents/{agentId}/files", func(w http.ResponseWriter, r *http.Request) {
		agentID := chi.URLParam(r, "agentId")
		if agentID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"ok":    false,
				"error": "agentId is required",
			})
			return
		}
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err.Error() != "EOF" {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"ok":    false,
				"error": "invalid json body",
			})
			return
		}
		if body == nil {
			body = map[string]any{}
		}
		name, _ := body["name"].(string)
		name = strings.TrimSpace(name)
		content, ok := body["content"].(string)
		if name == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "name is required"})
			return
		}
		if !ok {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "content is required"})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.AgentFilesSet(ctx, agentID, name, content)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "agents.files.set", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("GET", "/agents/{agentId}/files/*", func(w http.ResponseWriter, r *http.Request) {
		agentID := chi.URLParam(r, "agentId")
		name := chi.URLParam(r, "*")
		if agentID == "" || name == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"ok":    false,
				"error": "agentId and path are required",
			})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.AgentFilesGet(ctx, agentID, name)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "agents.files.get", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("GET", "/agents/{agentId}/identity", func(w http.ResponseWriter, r *http.Request) {
		agentID := chi.URLParam(r, "agentId")
		if agentID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"ok":    false,
				"error": "agentId is required",
			})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.AgentIdentityGet(ctx, agentID)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "agent.identity.get", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("POST", "/tools/catalog", func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err.Error() != "EOF" {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"ok":    false,
				"error": "invalid json body",
			})
			return
		}
		if body == nil {
			body = map[string]any{}
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.ToolsCatalog(ctx, body)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "tools.catalog", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("GET", "/skills", func(w http.ResponseWriter, r *http.Request) {
		params := map[string]any{}
		if agentID := r.URL.Query().Get("agentId"); agentID != "" {
			params["agentId"] = agentID
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.SkillsStatus(ctx, params)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "skills.status", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("PATCH", "/skills/{skillKey}", func(w http.ResponseWriter, r *http.Request) {
		skillKey := chi.URLParam(r, "skillKey")
		if skillKey == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "skillKey is required"})
			return
		}
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err.Error() != "EOF" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
			return
		}
		if body == nil {
			body = map[string]any{}
		}
		body["skillKey"] = skillKey
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.SkillsUpdate(ctx, body)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "skills.update", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("POST", "/skills/install", func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err.Error() != "EOF" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
			return
		}
		if body == nil {
			body = map[string]any{}
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.SkillsInstall(ctx, body)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "skills.install", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("POST", "/skills/update-clawhub", func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err.Error() != "EOF" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
			return
		}
		if body == nil {
			body = map[string]any{}
		}
		body["source"] = "clawhub"
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.SkillsUpdate(ctx, body)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "skills.update", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("POST", "/skills/hub", func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err.Error() != "EOF" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
			return
		}
		if body == nil {
			body = map[string]any{}
		}

		action, _ := body["action"].(string)
		delete(body, "action")
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		switch action {
		case "search":
			payload, err := adapter.SkillsSearch(ctx, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "skills.search", "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		case "detail":
			payload, err := adapter.SkillsDetail(ctx, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "skills.detail", "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		case "install":
			body["source"] = "clawhub"
			payload, err := adapter.SkillsInstall(ctx, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "skills.install", "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		case "update":
			body["source"] = "clawhub"
			if _, ok := body["slug"]; !ok {
				body["all"] = true
			}
			payload, err := adapter.SkillsUpdate(ctx, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "skills.update", "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		case "bins":
			payload, err := adapter.SkillsBins(ctx)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "skills.bins", "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		default:
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"error": `unknown action "` + action + `"`,
			})
		}
	})

	mux.MethodFunc("GET", "/devices", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.DevicePairList(ctx)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "device.pair.list", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("POST", "/devices/approve", func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err.Error() != "EOF" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
			return
		}
		if body == nil {
			body = map[string]any{}
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.DevicePairApprove(ctx, body)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "device.pair.approve", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("POST", "/devices/reject", func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err.Error() != "EOF" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
			return
		}
		if body == nil {
			body = map[string]any{}
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.DevicePairReject(ctx, body)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "device.pair.reject", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("POST", "/devices/remove", func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err.Error() != "EOF" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
			return
		}
		if body == nil {
			body = map[string]any{}
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.DevicePairRemove(ctx, body)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "device.pair.remove", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("POST", "/devices/token/rotate", func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err.Error() != "EOF" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
			return
		}
		if body == nil {
			body = map[string]any{}
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.DeviceTokenRotate(ctx, body)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "device.token.rotate", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("POST", "/devices/token/revoke", func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err.Error() != "EOF" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
			return
		}
		if body == nil {
			body = map[string]any{}
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.DeviceTokenRevoke(ctx, body)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "device.token.revoke", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("GET", "/devices/self", func(w http.ResponseWriter, _ *http.Request) {
		deviceID, err := adapter.CurrentDeviceID()
		if err != nil {
			writeJSON(w, http.StatusOK, map[string]any{"deviceId": nil})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"deviceId": deviceID})
	})

	mux.MethodFunc("GET", "/commands", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.CommandsList(ctx)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "commands.list", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("GET", "/nodes", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.NodeList(ctx)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "node.list", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("POST", "/nodes", func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err.Error() != "EOF" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
			return
		}
		if body == nil {
			body = map[string]any{}
		}
		action, _ := body["action"].(string)
		delete(body, "action")
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		switch action {
		case "describe":
			payload, err := adapter.NodeDescribe(ctx, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "node.describe", "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		case "rename":
			payload, err := adapter.NodeRename(ctx, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "node.rename", "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		case "invoke":
			payload, err := adapter.NodeInvoke(ctx, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "node.invoke", "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		case "pending.enqueue":
			payload, err := adapter.NodePendingEnqueue(ctx, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "node.pending.enqueue", "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		default:
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Invalid action"})
		}
	})

	mux.MethodFunc("GET", "/nodes/pair", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.NodePairList(ctx)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "node.pair.list", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("POST", "/nodes/pair", func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err.Error() != "EOF" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
			return
		}
		if body == nil {
			body = map[string]any{}
		}
		action, _ := body["action"].(string)
		delete(body, "action")
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		switch action {
		case "request":
			payload, err := adapter.NodePairRequest(ctx, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "node.pair.request", "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		case "approve":
			payload, err := adapter.NodePairApprove(ctx, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "node.pair.approve", "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		case "reject":
			payload, err := adapter.NodePairReject(ctx, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "node.pair.reject", "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		case "verify":
			payload, err := adapter.NodePairVerify(ctx, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "node.pair.verify", "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		default:
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Invalid action"})
		}
	})

	mux.MethodFunc("GET", "/cron", func(w http.ResponseWriter, r *http.Request) {
		params := map[string]any{}
		sp := r.URL.Query()
		if limitRaw := sp.Get("limit"); limitRaw != "" {
			if limit, err := strconv.Atoi(limitRaw); err == nil {
				params["limit"] = limit
			}
		}
		if offsetRaw := sp.Get("offset"); offsetRaw != "" {
			if offset, err := strconv.Atoi(offsetRaw); err == nil {
				params["offset"] = offset
			}
		}
		if query := sp.Get("query"); query != "" {
			params["query"] = query
		}
		if enabled := sp.Get("enabled"); enabled != "" {
			params["enabled"] = enabled
		}
		if sortBy := sp.Get("sortBy"); sortBy != "" {
			params["sortBy"] = sortBy
		}
		if sortDir := sp.Get("sortDir"); sortDir != "" {
			params["sortDir"] = sortDir
		}
		if includeDisabledRaw := sp.Get("includeDisabled"); includeDisabledRaw != "" {
			params["includeDisabled"] = includeDisabledRaw == "true"
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.CronList(ctx, params)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "cron.list", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("POST", "/cron", func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err.Error() != "EOF" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
			return
		}
		if body == nil {
			body = map[string]any{}
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.CronAdd(ctx, body)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "cron.add", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("PATCH", "/cron/{jobId}", func(w http.ResponseWriter, r *http.Request) {
		jobID := chi.URLParam(r, "jobId")
		if jobID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "jobId is required"})
			return
		}
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err.Error() != "EOF" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
			return
		}
		if body == nil {
			body = map[string]any{}
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.CronUpdate(ctx, jobID, body)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "cron.update", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("DELETE", "/cron/{jobId}", func(w http.ResponseWriter, r *http.Request) {
		jobID := chi.URLParam(r, "jobId")
		if jobID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "jobId is required"})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.CronRemove(ctx, jobID)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "cron.remove", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("POST", "/cron/{jobId}/run", func(w http.ResponseWriter, r *http.Request) {
		jobID := chi.URLParam(r, "jobId")
		if jobID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "jobId is required"})
			return
		}
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err.Error() != "EOF" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
			return
		}
		params := map[string]any{"id": jobID}
		if body != nil {
			if mode, _ := body["mode"].(string); mode != "" {
				params["mode"] = mode
			}
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.CronRun(ctx, params)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "cron.run", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("GET", "/cron/{jobId}/runs", func(w http.ResponseWriter, r *http.Request) {
		jobID := chi.URLParam(r, "jobId")
		if jobID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "jobId is required"})
			return
		}
		params := map[string]any{
			"scope": "job",
			"jobId": jobID,
		}
		sp := r.URL.Query()
		if limitRaw := sp.Get("limit"); limitRaw != "" {
			if limit, err := strconv.Atoi(limitRaw); err == nil {
				params["limit"] = limit
			}
		}
		if offsetRaw := sp.Get("offset"); offsetRaw != "" {
			if offset, err := strconv.Atoi(offsetRaw); err == nil {
				params["offset"] = offset
			}
		}
		if sortDir := sp.Get("sortDir"); sortDir != "" {
			params["sortDir"] = sortDir
		}
		if statuses := sp.Get("statuses"); statuses != "" {
			params["statuses"] = strings.Split(statuses, ",")
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.CronRuns(ctx, params)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "cron.runs", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("GET", "/cron/status", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.CronStatus(ctx)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "cron.status", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("GET", "/models/usage/cost", func(w http.ResponseWriter, r *http.Request) {
		params := map[string]any{}
		if daysRaw := r.URL.Query().Get("days"); daysRaw != "" {
			if days, err := strconv.Atoi(daysRaw); err == nil {
				params["days"] = days
			}
		}
		if len(params) == 0 {
			params["days"] = 7
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.UsageCost(ctx, params)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "usage.cost", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("GET", "/models/usage/providers", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.UsageStatus(ctx)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "usage.status", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("GET", "/usage/sessions", func(w http.ResponseWriter, r *http.Request) {
		params := map[string]any{}
		for _, key := range []string{"startDate", "endDate", "key"} {
			if value := r.URL.Query().Get(key); value != "" {
				params[key] = value
			}
		}
		if r.URL.Query().Get("includeContextWeight") == "true" {
			params["includeContextWeight"] = true
		}
		if raw := r.URL.Query().Get("limit"); raw != "" {
			limit, err := strconv.Atoi(raw)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid limit"})
				return
			}
			params["limit"] = limit
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.SessionsUsage(ctx, params)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "sessions.usage", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("GET", "/usage/sessions/logs", func(w http.ResponseWriter, r *http.Request) {
		params := map[string]any{"key": r.URL.Query().Get("key")}
		if raw := r.URL.Query().Get("limit"); raw != "" {
			limit, err := strconv.Atoi(raw)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid limit"})
				return
			}
			params["limit"] = limit
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.SessionsUsageLogs(ctx, params)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "sessions.usage.logs", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("GET", "/usage/timeseries", func(w http.ResponseWriter, r *http.Request) {
		params := map[string]any{}
		for _, key := range []string{"key", "startDate", "endDate", "mode", "utcOffset"} {
			if value := r.URL.Query().Get(key); value != "" {
				params[key] = value
			}
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.SessionsUsageTimeseries(ctx, params)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "sessions.usage.timeseries", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("GET", "/models/config", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.ConfigGet(ctx)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "config.get", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("PATCH", "/models/config", func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err.Error() != "EOF" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
			return
		}
		if body == nil {
			body = map[string]any{}
		}
		raw, _ := body["raw"].(string)
		if strings.TrimSpace(raw) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "raw config content is required"})
			return
		}
		baseHash, _ := body["baseHash"].(string)
		note, _ := body["note"].(string)
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.ConfigPatch(ctx, raw, baseHash, note)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "config.patch", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("GET", "/channels", func(w http.ResponseWriter, r *http.Request) {
		params := map[string]any{}
		if probe := r.URL.Query().Get("probe"); probe == "1" || probe == "true" {
			params["probe"] = true
		}
		if timeoutRaw := r.URL.Query().Get("timeoutMs"); timeoutRaw != "" {
			if timeout, err := strconv.Atoi(timeoutRaw); err == nil {
				params["timeoutMs"] = timeout
			}
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.ChannelsStatus(ctx, params)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "channels.status", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("POST", "/channels/{channelId}/logout", func(w http.ResponseWriter, r *http.Request) {
		channelID := chi.URLParam(r, "channelId")
		if channelID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "channelId is required"})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.ChannelsLogout(ctx, channelID)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "channels.logout", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("POST", "/channels/{channelId}/test", func(w http.ResponseWriter, r *http.Request) {
		channelID := chi.URLParam(r, "channelId")
		if channelID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "channelId is required"})
			return
		}
		startedAt := time.Now()
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.ChannelsStatus(ctx, map[string]any{"probe": true})
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{
				"ok":        false,
				"channelId": channelID,
				"check":     "probe",
				"error":     err.Error(),
				"latencyMs": time.Since(startedAt).Milliseconds(),
			})
			return
		}
		record, _ := payload.(map[string]any)
		channelAccounts, _ := record["channelAccounts"].(map[string]any)
		channelEntries, _ := channelAccounts[channelID].([]any)
		anyOK := false
		firstError := ""
		for _, rawAccount := range channelEntries {
			account, _ := rawAccount.(map[string]any)
			probe, _ := account["probe"].(map[string]any)
			if ok, _ := probe["ok"].(bool); ok {
				anyOK = true
				break
			}
			if firstError == "" {
				firstError = coerce.String(probe["error"], "")
			}
		}
		latencyMs := time.Since(startedAt).Milliseconds()
		if anyOK {
			writeJSON(w, http.StatusOK, map[string]any{
				"ok":        true,
				"channelId": channelID,
				"check":     "probe",
				"latencyMs": latencyMs,
				"checkedAt": time.Now().UnixMilli(),
			})
			return
		}
		if firstError == "" {
			firstError = "Channel " + channelID + " did not pass connectivity probe"
		}
		writeJSON(w, http.StatusBadGateway, map[string]any{
			"ok":        false,
			"channelId": channelID,
			"check":     "probe",
			"error":     firstError,
			"latencyMs": latencyMs,
		})
	})

	mux.MethodFunc("GET", "/channels/{channelId}/throughput", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"buckets":     []any{},
			"messagesIn":  0,
			"messagesOut": 0,
		})
	})

	mux.MethodFunc("PATCH", "/channels/{channelId}", func(w http.ResponseWriter, r *http.Request) {
		channelID := chi.URLParam(r, "channelId")
		if channelID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "channelId is required"})
			return
		}
		var patch map[string]any
		if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid json body"})
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.ConfigGet(ctx)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{
				"ok":    false,
				"error": err.Error(),
			})
			return
		}
		configPayload, ok := payload.(map[string]any)
		if !ok {
			writeJSON(w, http.StatusBadGateway, map[string]any{
				"ok":    false,
				"error": "unexpected config.get payload shape",
			})
			return
		}
		baseHash, _ := configPayload["baseHash"].(string)

		payload, err = adapter.ConfigPatch(ctx, mustJSONString(map[string]any{
			"channels": map[string]any{
				channelID: patch,
			},
		}), baseHash, "")
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "config.patch", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("GET", "/sessions", func(w http.ResponseWriter, r *http.Request) {
		params := map[string]any{}
		query := r.URL.Query()
		agentID := query.Get("agentId")
		if agentID != "" {
			params["agentId"] = agentID
		}
		if search := query.Get("search"); search != "" {
			params["search"] = search
		}
		if limitRaw := query.Get("limit"); limitRaw != "" {
			if limit, err := strconv.Atoi(limitRaw); err == nil {
				params["limit"] = limit
			}
		}
		if activeMinutesRaw := query.Get("activeMinutes"); activeMinutesRaw != "" {
			if activeMinutes, err := strconv.Atoi(activeMinutesRaw); err == nil {
				params["activeMinutes"] = activeMinutes
			}
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		items, err := adapter.ListSessionsWithParams(ctx, params, agentID)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{
				"ok":    false,
				"error": err.Error(),
			})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"sessions": items,
		})
	})

	mux.MethodFunc("GET", "/sessions/{sessionKey}", func(w http.ResponseWriter, r *http.Request) {
		sessionKey := chi.URLParam(r, "sessionKey")
		if sessionKey == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "sessionKey is required"})
			return
		}

		query := r.URL.Query()
		agentID := query.Get("agentId")
		var limit int
		if limitRaw := query.Get("limit"); limitRaw != "" {
			if parsed, err := strconv.Atoi(limitRaw); err == nil && parsed > 0 {
				limit = parsed
			}
		}

		ctx := r.Context()
		detail, err := adapter.GetTimelineWithParams(ctx, sessionKey, agentID, limit)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, detail)
	})

	mux.MethodFunc("GET", "/deck/plugins", func(w http.ResponseWriter, r *http.Request) {
		params := map[string]any{}
		if capability := r.URL.Query().Get("capability"); capability == "all" {
			params["capability"] = capability
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.DeckPluginsList(ctx, params)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "deck.plugins.list", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("GET", "/deck/agents", func(w http.ResponseWriter, r *http.Request) {
		agentID := r.URL.Query().Get("agentId")
		if agentID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"ok":    false,
				"error": "agentId is required",
			})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.DeckAgentsDetail(ctx, agentID)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "deck.agents.detail", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("POST", "/deck/agents", func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err.Error() != "EOF" {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"ok":    false,
				"error": "invalid json body",
			})
			return
		}
		if body == nil {
			body = map[string]any{}
		}
		action, _ := body["action"].(string)
		delete(body, "action")
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()

		switch action {
		case "health":
			payload, err := adapter.HealthWithParams(ctx, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "health", "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		case "skills.get":
			payload, err := adapter.DeckAgentsSkillsGet(ctx, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "deck.agents.skills.get", "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		case "skills.set":
			payload, err := adapter.DeckAgentsSkillsSet(ctx, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "deck.agents.skills.set", "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		case "subagents.get":
			payload, err := adapter.DeckAgentsSubagentsGet(ctx, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "deck.agents.subagents.get", "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		case "subagents.set":
			payload, err := adapter.DeckAgentsSubagentsSet(ctx, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "deck.agents.subagents.set", "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		case "toolPolicy.preview":
			payload, err := adapter.DeckAgentsToolPolicyPreview(ctx, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "deck.agents.toolPolicy.preview", "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		case "systemPrompt.preview":
			payload, err := adapter.DeckAgentsSystemPromptPreview(ctx, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "deck.agents.systemPrompt.preview", "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		case "eventStreams.get":
			payload, err := adapter.DeckAgentsEventStreamsGet(ctx, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "deck.agents.eventStreams.get", "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		case "eventStreams.set":
			payload, err := adapter.DeckAgentsEventStreamsSet(ctx, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "deck.agents.eventStreams.set", "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		case "config.patch":
			path, _ := body["path"].(string)
			if path == "" {
				writeJSON(w, http.StatusBadRequest, map[string]any{
					"ok":    false,
					"error": "Invalid config path",
				})
				return
			}
			if strings.Contains(path, "..") {
				writeJSON(w, http.StatusBadRequest, map[string]any{
					"ok":    false,
					"error": "Invalid config path",
				})
				return
			}
			value := body["value"]
			configPayload, err := adapter.ConfigGet(ctx)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{
					"ok":    false,
					"error": err.Error(),
				})
				return
			}
			configRecord, ok := configPayload.(map[string]any)
			if !ok {
				writeJSON(w, http.StatusBadGateway, map[string]any{
					"ok":    false,
					"error": "unexpected config.get payload shape",
				})
				return
			}
			baseHash, _ := configRecord["baseHash"].(string)
			payload, err := adapter.ConfigPatch(ctx, mustJSONString(buildNestedPatch(path, value)), baseHash, "")
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "config.patch", "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		default:
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"ok":    false,
				"error": "Invalid action",
			})
		}
	})

	mux.MethodFunc("POST", "/deck/commands/discover", func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err.Error() != "EOF" {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"ok":    false,
				"error": "invalid json body",
			})
			return
		}
		if body == nil {
			body = map[string]any{}
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.DeckCommandsDiscover(ctx, body)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "deck.commands.discover", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("POST", "/deck/tools-effective", func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err.Error() != "EOF" {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"ok":    false,
				"error": "invalid json body",
			})
			return
		}
		if body == nil {
			body = map[string]any{}
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.ToolsEffective(ctx, body)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "tools.effective", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("GET", "/approvals", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.ExecApprovalsGet(ctx)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "exec.approvals.get", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("POST", "/approvals", func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"ok":    false,
				"error": "invalid json body",
			})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.ExecApprovalResolve(ctx, body)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "exec.approval.resolve", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("GET", "/approvals/pending", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.ExecApprovalList(ctx)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"error": err.Error()})
			return
		}
		items, _ := payload.([]any)
		pending := make([]map[string]any, 0, len(items))
		for _, rawItem := range items {
			record, _ := rawItem.(map[string]any)
			request, _ := record["request"].(map[string]any)
			pending = append(pending, map[string]any{
				"id":          coerce.String(record["id"], ""),
				"command":     coerce.String(request["command"], ""),
				"commandArgv": request["commandArgv"],
				"agentId":     coerce.String(request["agentId"], ""),
				"sessionKey":  coerce.String(request["sessionKey"], ""),
				"runId":       coerce.String(request["runId"], ""),
				"cwd":         coerce.String(request["cwd"], ""),
				"createdAtMs": coerce.Number(record["createdAtMs"]),
				"expiresAtMs": coerce.Number(record["expiresAtMs"]),
			})
		}
		writeJSON(w, http.StatusOK, map[string]any{"pending": pending})
	})

	mux.MethodFunc("POST", "/exec/approval", func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"ok":    false,
				"error": "invalid json body",
			})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.ExecApprovalResolve(ctx, body)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "exec.approval.resolve", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("GET", "/approvals/policy", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.ExecApprovalsGet(ctx)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "exec.approvals.get", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("PUT", "/approvals/policy", func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"ok":    false,
				"error": "invalid json body",
			})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.ExecApprovalsSet(ctx, body)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "exec.approvals.set", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("GET", "/approvals/plugins", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.PluginApprovalList(ctx)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "plugin.approval.list", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("POST", "/approvals/plugins", func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"ok":    false,
				"error": "invalid json body",
			})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.PluginApprovalResolve(ctx, body)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "plugin.approval.resolve", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("GET", "/deck/identity", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.DeckIdentityList(ctx)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "deck.identity.list", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("POST", "/deck/identity", func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err.Error() != "EOF" {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"ok":    false,
				"error": "invalid json body",
			})
			return
		}
		if body == nil {
			body = map[string]any{}
		}
		action, _ := body["action"].(string)
		delete(body, "action")
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		switch action {
		case "link":
			payload, err := adapter.DeckIdentityLink(ctx, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "deck.identity.link", "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		case "unlink":
			payload, err := adapter.DeckIdentityUnlink(ctx, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "deck.identity.unlink", "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		default:
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"ok":    false,
				"error": "invalid action",
			})
		}
	})

	mux.MethodFunc("GET", "/deck/routing", func(w http.ResponseWriter, r *http.Request) {
		params := map[string]any{}
		query := r.URL.Query()
		if agentID := query.Get("agentId"); agentID != "" {
			params["agentId"] = agentID
		}
		if channel := query.Get("channel"); channel != "" {
			params["channel"] = channel
		}
		if accountID := query.Get("accountId"); accountID != "" {
			params["accountId"] = accountID
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.DeckRoutingList(ctx, params)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "deck.routing.list", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("POST", "/deck/routing", func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err.Error() != "EOF" {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"ok":    false,
				"error": "invalid json body",
			})
			return
		}
		if body == nil {
			body = map[string]any{}
		}
		action, _ := body["action"].(string)
		delete(body, "action")
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		switch action {
		case "add":
			payload, err := adapter.DeckRoutingAdd(ctx, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "deck.routing.add", "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		case "remove":
			payload, err := adapter.DeckRoutingRemove(ctx, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "deck.routing.remove", "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		case "validate":
			payload, err := adapter.DeckRoutingValidate(ctx, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "deck.routing.validate", "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		case "simulate":
			payload, err := adapter.DeckRoutingSimulate(ctx, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "deck.routing.simulate", "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		default:
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"ok":    false,
				"error": "invalid action",
			})
		}
	})

	mux.MethodFunc("GET", "/deck/subagents", func(w http.ResponseWriter, r *http.Request) {
		params := map[string]any{}
		query := r.URL.Query()
		if status := query.Get("status"); status != "" {
			params["status"] = status
		}
		if requesterAgentID := query.Get("requesterAgentId"); requesterAgentID != "" {
			params["requesterAgentId"] = requesterAgentID
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.DeckSubagentsList(ctx, params)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "deck.subagents.list", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("POST", "/deck/subagents", func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err.Error() != "EOF" {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"ok":    false,
				"error": "invalid json body",
			})
			return
		}
		if body == nil {
			body = map[string]any{}
		}
		action, _ := body["action"].(string)
		delete(body, "action")
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		switch action {
		case "kill":
			payload, err := adapter.DeckSubagentsKill(ctx, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "deck.subagents.kill", "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		case "lineage":
			payload, err := adapter.DeckSubagentsLineage(ctx, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "deck.subagents.lineage", "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		case "steer":
			payload, err := adapter.DeckSubagentsSteer(ctx, body)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "deck.subagents.steer", "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		default:
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"ok":    false,
				"error": "invalid action",
			})
		}
	})

	mux.MethodFunc("GET", "/deck/threads", func(w http.ResponseWriter, r *http.Request) {
		params := map[string]any{}
		query := r.URL.Query()
		if agentID := query.Get("agentId"); agentID != "" {
			params["agentId"] = agentID
		}
		if channel := query.Get("channel"); channel != "" {
			params["channel"] = channel
		}
		if status := query.Get("status"); status != "" {
			params["status"] = status
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.DeckThreadsList(ctx, params)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "deck.threads.list", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("GET", "/logs", func(w http.ResponseWriter, r *http.Request) {
		params := map[string]any{}
		query := r.URL.Query()
		if cursorRaw := query.Get("cursor"); cursorRaw != "" {
			if cursor, err := strconv.Atoi(cursorRaw); err == nil {
				params["cursor"] = cursor
			}
		}
		if limitRaw := query.Get("limit"); limitRaw != "" {
			if limit, err := strconv.Atoi(limitRaw); err == nil {
				params["limit"] = limit
			}
		}
		if maxBytesRaw := query.Get("maxBytes"); maxBytesRaw != "" {
			if maxBytes, err := strconv.Atoi(maxBytesRaw); err == nil {
				params["maxBytes"] = maxBytes
			}
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := adapter.LogsTail(ctx, params)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "logs.tail", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})
}

func buildNestedPatch(path string, value any) map[string]any {
	parts := strings.Split(path, ".")
	root := map[string]any{}
	current := root
	for i := 0; i < len(parts)-1; i++ {
		next := map[string]any{}
		current[parts[i]] = next
		current = next
	}
	current[parts[len(parts)-1]] = value
	return root
}

func resolveDefaultAgentWorkspace(ctx context.Context, adapter *openclawrt.LegacyInventorySurface, name string) string {
	workspace := ""
	if payload, err := adapter.ConfigGetWithParams(ctx, map[string]any{
		"path": "agents.defaults.workspace",
	}); err == nil {
		if record, ok := payload.(map[string]any); ok {
			if raw, _ := record["raw"].(string); strings.TrimSpace(raw) != "" {
				workspace = raw
			}
		}
	}
	if workspace != "" {
		return workspace
	}

	stateDir := strings.TrimSpace(os.Getenv("OPENCLAW_STATE_DIR"))
	if stateDir == "" {
		homeDir, err := os.UserHomeDir()
		if err == nil && homeDir != "" {
			stateDir = filepath.Join(homeDir, ".openclaw")
		} else {
			stateDir = ".openclaw"
		}
	}
	return filepath.Join(stateDir, "workspace-"+strings.ToLower(strings.Join(strings.Fields(name), "-")))
}
