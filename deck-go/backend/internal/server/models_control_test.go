package server

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway/generated"
)

// fakeModelsControlSurface stands in for the Gateway-backed adapter. The
// internal config is stored as a Go map so tests can inspect mutations
// directly. ConfigPatch overwrites the stored config with the supplied raw
// payload after validating the supplied base hash.
type fakeModelsControlSurface struct {
	config       map[string]any
	hash         string
	catalog      generated.ModelsCatalogProvidersResult
	catalogErr   error
	auth         generated.DeckAuthOverviewResult
	authErr      error
	patchErr     error
	patchCount   int
	lastPatchRaw string
	conflict     bool
}

func newFakeModelsControlSurface(initial map[string]any) *fakeModelsControlSurface {
	s := &fakeModelsControlSurface{}
	s.replaceConfig(initial)
	return s
}

func (s *fakeModelsControlSurface) replaceConfig(next map[string]any) {
	if next == nil {
		next = map[string]any{}
	}
	s.config = next
	raw, _ := json.Marshal(next)
	digest := sha256.Sum256(raw)
	s.hash = hex.EncodeToString(digest[:])
}

func (s *fakeModelsControlSurface) ConfigGet(_ context.Context) (any, error) {
	cloned := cloneConfigMap(s.config)
	return generated.ConfigGetResult{
		Config:       cloned,
		Exists:       true,
		Hash:         s.hash,
		Parsed:       cloned,
		Resolved:     cloned,
		Path:         "",
		Raw:          "",
		SourceConfig: cloned,
		Valid:        true,
	}, nil
}

func (s *fakeModelsControlSurface) ConfigPatch(_ context.Context, raw string, baseHash string, _ string) (any, error) {
	if s.patchErr != nil {
		return nil, s.patchErr
	}
	if s.conflict {
		return nil, errors.New("config base hash conflict detected")
	}
	if baseHash != s.hash {
		return nil, errors.New("base hash mismatch; please reload")
	}
	var next map[string]any
	if err := json.Unmarshal([]byte(raw), &next); err != nil {
		return nil, fmt.Errorf("invalid raw payload: %w", err)
	}
	s.replaceConfig(next)
	s.patchCount++
	s.lastPatchRaw = raw
	return generated.ConfigPatchResult{Ok: true, Path: "", Config: map[string]any{"hash": s.hash}}, nil
}

func (s *fakeModelsControlSurface) ModelsCatalogProviders(_ context.Context) (any, error) {
	if s.catalogErr != nil {
		return nil, s.catalogErr
	}
	return s.catalog, nil
}

func (s *fakeModelsControlSurface) ModelsConfigured(_ context.Context) (any, error) {
	return generated.ModelsConfiguredResult{}, nil
}

func (s *fakeModelsControlSurface) DeckAuthOverview(_ context.Context) (any, error) {
	if s.authErr != nil {
		return nil, s.authErr
	}
	return s.auth, nil
}

func newModelsControlTestServer(t *testing.T, fake *fakeModelsControlSurface) *httptest.Server {
	t.Helper()
	r := chi.NewRouter()
	store := newModelsControlImpactStore()
	mountModelsControlRoutes(r, fake, store)
	return httptest.NewServer(r)
}

func sampleConfig() map[string]any {
	return map[string]any{
		"agents": map[string]any{
			"defaults": map[string]any{
				"imageModel":   "openai/gpt-image",
				"pdfModel":     "anthropic/claude",
				"summaryModel": "openai/gpt-4o",
				"compaction": map[string]any{
					"model": "anthropic/claude-haiku",
				},
				"memorySearch": map[string]any{
					"model": "openai/text-embed",
				},
			},
			"list": []any{
				map[string]any{"id": "main", "model": "openai/gpt-4o"},
				map[string]any{"id": "scout", "model": "anthropic/claude"},
			},
		},
		"channels": map[string]any{
			"modelByChannel": map[string]any{
				"slack-ops": "openai/gpt-4o",
			},
		},
		"hooks": map[string]any{
			"mappings": []any{
				map[string]any{"id": "router", "model": "openai/gpt-4o"},
			},
			"gmail": map[string]any{"model": "anthropic/claude-haiku"},
		},
		"tools": map[string]any{
			"search": map[string]any{
				"embedding": map[string]any{
					"model": "openai/text-embed",
				},
			},
			"media": map[string]any{
				"embedding": map[string]any{
					"models": map[string]any{
						"primary": "openai/text-embed",
					},
				},
			},
		},
		"sessions": map[string]any{
			"keyed-session": map[string]any{"model": "openai/gpt-4o"},
			"list": []any{
				map[string]any{"id": "task-1", "model": "anthropic/claude"},
			},
		},
		"models": map[string]any{
			"mode": "merge",
			"providers": map[string]any{
				"openai": map[string]any{
					"baseUrl": "https://api.openai.com/v1",
					"api":     "openai-completions",
					"auth":    "api-key",
					"apiKey": map[string]any{
						"ref":         "OPENAI_API_KEY",
						"refTemplate": "${OPENAI_API_KEY}",
					},
					"request": map[string]any{
						"auth": map[string]any{
							"type": "bearer",
						},
					},
					"headers": map[string]any{
						"X-Custom": map[string]any{"ref": "CUSTOM"},
					},
					"models": map[string]any{
						"gpt-4o": map[string]any{
							"id":            "gpt-4o",
							"name":          "GPT-4o",
							"contextWindow": float64(128000),
							"input":         []any{"text", "image"},
							"compat": map[string]any{
								"supportsTools":      true,
								"supportsStrictMode": true,
								"thinkingFormat":     "openrouter",
							},
						},
						"gpt-image": map[string]any{
							"id":   "gpt-image",
							"name": "GPT Image",
						},
						"text-embed": map[string]any{
							"id":   "text-embed",
							"name": "OpenAI Embed",
							"compat": map[string]any{
								"embedding": true,
							},
						},
					},
				},
				"anthropic": map[string]any{
					"baseUrl": "https://api.anthropic.com",
					"api":     "anthropic-messages",
					"auth":    "api-key",
					"apiKey": map[string]any{"ref": "ANTHROPIC_API_KEY"},
					"models": map[string]any{
						"claude": map[string]any{
							"id":   "claude",
							"name": "Claude 3.5 Sonnet",
						},
						"claude-haiku": map[string]any{
							"id":   "claude-haiku",
							"name": "Claude 3.5 Haiku",
						},
					},
				},
			},
		},
	}
}

func decodeJSON(t *testing.T, body io.Reader, into any) {
	t.Helper()
	if err := json.NewDecoder(body).Decode(into); err != nil {
		t.Fatalf("decode response: %v", err)
	}
}

func TestModelsControlConfigDetail_HappyPath(t *testing.T) {
	fake := newFakeModelsControlSurface(sampleConfig())
	srv := newModelsControlTestServer(t, fake)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/models/config/detail")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: %d", resp.StatusCode)
	}
	var payload deckapi.DeckGoModelsConfigDetailResponse
	decodeJSON(t, resp.Body, &payload)
	if payload.Detail.Hash == "" {
		t.Fatal("expected hash in detail")
	}
	if payload.Detail.Mode != "merge" {
		t.Fatalf("unexpected mode: %q", payload.Detail.Mode)
	}
	if payload.Detail.ModeSource != "config" {
		t.Fatalf("expected modeSource=config, got %q", payload.Detail.ModeSource)
	}
	if len(payload.Detail.Providers) != 2 {
		t.Fatalf("expected 2 providers, got %d", len(payload.Detail.Providers))
	}
	if payload.Detail.Providers[0].Id != "anthropic" {
		t.Fatalf("expected anthropic first (sorted), got %q", payload.Detail.Providers[0].Id)
	}
	openai := payload.Detail.Providers[1]
	if openai.Id != "openai" {
		t.Fatalf("expected openai second, got %q", openai.Id)
	}
	if !openai.IsReferenced {
		t.Fatal("expected openai to be referenced")
	}
	if openai.ModelCount != 3 {
		t.Fatalf("expected 3 models, got %v", openai.ModelCount)
	}
	if openai.ApiKeyStatus["state"] != "ref" {
		t.Fatalf("expected ref state, got %#v", openai.ApiKeyStatus)
	}
	if openai.Request.HasAuth != true {
		t.Fatal("expected hasAuth=true on openai.request")
	}
	defaults := payload.Detail.Defaults
	if defaults["image"] == nil || defaults["pdf"] == nil || defaults["summary"] == nil ||
		defaults["compaction"] == nil || defaults["memorySearch"] == nil || defaults["text"] == nil {
		t.Fatalf("expected six defaults populated, got %#v", defaults)
	}
	// Confirm a referenced model surfaces defaultRoles
	var foundDefault bool
	for _, m := range openai.Models {
		if m.Id == "gpt-4o" && len(m.DefaultRoles) > 0 {
			foundDefault = true
			break
		}
	}
	if !foundDefault {
		t.Fatal("expected gpt-4o to carry default roles")
	}
}

func TestModelsControlConfigDetail_EmptyConfig(t *testing.T) {
	fake := newFakeModelsControlSurface(map[string]any{})
	srv := newModelsControlTestServer(t, fake)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/models/config/detail")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: %d", resp.StatusCode)
	}
	var payload deckapi.DeckGoModelsConfigDetailResponse
	decodeJSON(t, resp.Body, &payload)
	if payload.Detail.Mode != "merge" {
		t.Fatalf("expected merge default, got %q", payload.Detail.Mode)
	}
	if payload.Detail.ModeSource != "default" {
		t.Fatalf("expected modeSource=default, got %q", payload.Detail.ModeSource)
	}
	if len(payload.Detail.Providers) != 0 {
		t.Fatalf("expected 0 providers, got %d", len(payload.Detail.Providers))
	}
}

func TestModelsControlConfigDetail_RuntimeUnavailable(t *testing.T) {
	fake := newFakeModelsControlSurface(sampleConfig())
	fake.catalogErr = errors.New("runtime not started")
	fake.authErr = errors.New("auth read failed")
	srv := newModelsControlTestServer(t, fake)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/models/config/detail")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: %d", resp.StatusCode)
	}
	var payload deckapi.DeckGoModelsConfigDetailResponse
	decodeJSON(t, resp.Body, &payload)
	if payload.Detail.Runtime.CatalogStatus != "unavailable" {
		t.Fatalf("expected catalog unavailable, got %q", payload.Detail.Runtime.CatalogStatus)
	}
	if payload.Detail.Runtime.AuthStatus != "unavailable" {
		t.Fatalf("expected auth unavailable, got %q", payload.Detail.Runtime.AuthStatus)
	}
}

func TestModelsControlConfigDetail_RedactsSecrets(t *testing.T) {
	cfg := sampleConfig()
	// inject a literal API key string to test redaction
	models := cfg["models"].(map[string]any)
	providers := models["providers"].(map[string]any)
	openai := providers["openai"].(map[string]any)
	openai["apiKey"] = "sk-literal-secret-VERY-PRIVATE"

	fake := newFakeModelsControlSurface(cfg)
	srv := newModelsControlTestServer(t, fake)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/models/config/detail")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(body), "sk-literal-secret-VERY-PRIVATE") {
		t.Fatalf("response leaked literal secret value: %s", string(body))
	}
	if !strings.Contains(string(body), `"state":"literal-redacted"`) {
		t.Fatalf("expected literal-redacted state, got %s", string(body))
	}
}

func TestModelsControlProviderUpsert_CreateNew(t *testing.T) {
	fake := newFakeModelsControlSurface(sampleConfig())
	srv := newModelsControlTestServer(t, fake)
	defer srv.Close()

	body := deckapi.DeckGoModelProviderUpsertRequest{
		ExpectedBaseHash: fake.hash,
		ProviderId:       "newprovider",
		IsCreate:         true,
		Api:              "openai-completions",
		BaseUrl:          "https://example.com",
		Auth:             "api-key",
		ApiKey: map[string]any{
			"action": "set-ref",
			"ref":    "NEWPROVIDER_KEY",
		},
		Models: []deckapi.DeckGoModelProviderUpsertModelInput{
			{Id: "model-a", Name: "Model A"},
		},
	}
	bodyBytes, _ := json.Marshal(body)
	resp, err := http.Post(srv.URL+"/models/providers/upsert", "application/json", bytes.NewReader(bodyBytes))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		t.Fatalf("unexpected status %d: %s", resp.StatusCode, string(raw))
	}
	var out deckapi.DeckGoModelProviderUpsertResponse
	decodeJSON(t, resp.Body, &out)
	if !out.Ok || out.ProviderId != "newprovider" {
		t.Fatalf("unexpected response: %#v", out)
	}
	if !strings.Contains(fake.lastPatchRaw, `"ref":"NEWPROVIDER_KEY"`) {
		t.Fatalf("expected stored ref, got %s", fake.lastPatchRaw)
	}
	// Ensure literal value is never written
	if strings.Contains(fake.lastPatchRaw, "literal-redacted") {
		t.Fatal("patch should not include redaction marker")
	}
}

func TestModelsControlProviderUpsert_BaseHashConflict(t *testing.T) {
	fake := newFakeModelsControlSurface(sampleConfig())
	srv := newModelsControlTestServer(t, fake)
	defer srv.Close()

	body := deckapi.DeckGoModelProviderUpsertRequest{
		ExpectedBaseHash: "stale-hash",
		ProviderId:       "openai",
	}
	bodyBytes, _ := json.Marshal(body)
	resp, err := http.Post(srv.URL+"/models/providers/upsert", "application/json", bytes.NewReader(bodyBytes))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusConflict {
		t.Fatalf("expected 409, got %d", resp.StatusCode)
	}
}

func TestModelsControlProviderUpsert_PreservesUnedited(t *testing.T) {
	fake := newFakeModelsControlSurface(sampleConfig())
	srv := newModelsControlTestServer(t, fake)
	defer srv.Close()

	body := deckapi.DeckGoModelProviderUpsertRequest{
		ExpectedBaseHash: fake.hash,
		ProviderId:       "openai",
		IsCreate:         false,
		BaseUrl:          "https://updated.example.com",
		PreserveRequest:  true,
	}
	bodyBytes, _ := json.Marshal(body)
	resp, err := http.Post(srv.URL+"/models/providers/upsert", "application/json", bytes.NewReader(bodyBytes))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		t.Fatalf("unexpected status %d: %s", resp.StatusCode, string(raw))
	}
	// Inspect the persisted config
	models := fake.config["models"].(map[string]any)
	providers := models["providers"].(map[string]any)
	openai := providers["openai"].(map[string]any)
	if openai["baseUrl"] != "https://updated.example.com" {
		t.Fatalf("expected updated baseUrl, got %v", openai["baseUrl"])
	}
	if _, ok := openai["request"]; !ok {
		t.Fatal("expected request to be preserved")
	}
	if _, ok := openai["headers"]; !ok {
		t.Fatal("expected headers to be preserved")
	}
	if _, ok := openai["models"]; !ok {
		t.Fatal("expected models to be preserved")
	}
}

func TestModelsControlProviderUpsert_RejectsLiteralApiKey(t *testing.T) {
	fake := newFakeModelsControlSurface(sampleConfig())
	srv := newModelsControlTestServer(t, fake)
	defer srv.Close()

	body := deckapi.DeckGoModelProviderUpsertRequest{
		ExpectedBaseHash: fake.hash,
		ProviderId:       "newprovider",
		IsCreate:         true,
		ApiKey: map[string]any{
			"action": "set-literal", // unsupported action
			"value":  "sk-literal",
		},
	}
	bodyBytes, _ := json.Marshal(body)
	resp, err := http.Post(srv.URL+"/models/providers/upsert", "application/json", bytes.NewReader(bodyBytes))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
}

func TestModelsControlProviderDelete_PreviewThenCommit(t *testing.T) {
	fake := newFakeModelsControlSurface(sampleConfig())
	srv := newModelsControlTestServer(t, fake)
	defer srv.Close()

	previewBody, _ := json.Marshal(deckapi.DeckGoModelProviderDeletePreviewRequest{
		ExpectedBaseHash: fake.hash,
		ProviderId:       "openai",
	})
	previewResp, err := http.Post(srv.URL+"/models/providers/delete-preview", "application/json", bytes.NewReader(previewBody))
	if err != nil {
		t.Fatal(err)
	}
	defer previewResp.Body.Close()
	if previewResp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(previewResp.Body)
		t.Fatalf("preview unexpected status %d: %s", previewResp.StatusCode, string(raw))
	}
	var preview deckapi.DeckGoModelImpactPreviewResponse
	decodeJSON(t, previewResp.Body, &preview)
	if preview.Preview.ImpactToken == "" {
		t.Fatal("expected impact token")
	}
	if len(preview.Preview.References) == 0 {
		t.Fatal("expected references on openai delete")
	}
	if preview.Preview.Severity != "block" {
		t.Fatalf("expected block severity, got %q", preview.Preview.Severity)
	}

	commitBody, _ := json.Marshal(deckapi.DeckGoModelProviderDeleteCommitRequest{
		ExpectedBaseHash: fake.hash,
		ProviderId:       "openai",
		ImpactToken:      preview.Preview.ImpactToken,
		ConfirmText:      "delete",
	})
	commitResp, err := http.Post(srv.URL+"/models/providers/delete", "application/json", bytes.NewReader(commitBody))
	if err != nil {
		t.Fatal(err)
	}
	defer commitResp.Body.Close()
	if commitResp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(commitResp.Body)
		t.Fatalf("commit unexpected status %d: %s", commitResp.StatusCode, string(raw))
	}
	if _, ok := fake.config["models"].(map[string]any)["providers"].(map[string]any)["openai"]; ok {
		t.Fatal("expected openai to be removed")
	}
}

func TestModelsControlProviderDelete_StaleToken(t *testing.T) {
	fake := newFakeModelsControlSurface(sampleConfig())
	srv := newModelsControlTestServer(t, fake)
	defer srv.Close()

	previewBody, _ := json.Marshal(deckapi.DeckGoModelProviderDeletePreviewRequest{
		ExpectedBaseHash: fake.hash,
		ProviderId:       "openai",
	})
	previewResp, err := http.Post(srv.URL+"/models/providers/delete-preview", "application/json", bytes.NewReader(previewBody))
	if err != nil {
		t.Fatal(err)
	}
	defer previewResp.Body.Close()
	var preview deckapi.DeckGoModelImpactPreviewResponse
	decodeJSON(t, previewResp.Body, &preview)
	priorHash := fake.hash

	// Mutate config to advance hash
	fake.replaceConfig(map[string]any{"agents": map[string]any{"defaults": map[string]any{}}})

	commitBody, _ := json.Marshal(deckapi.DeckGoModelProviderDeleteCommitRequest{
		ExpectedBaseHash: priorHash,
		ProviderId:       "openai",
		ImpactToken:      preview.Preview.ImpactToken,
		ConfirmText:      "delete",
	})
	commitResp, err := http.Post(srv.URL+"/models/providers/delete", "application/json", bytes.NewReader(commitBody))
	if err != nil {
		t.Fatal(err)
	}
	defer commitResp.Body.Close()
	if commitResp.StatusCode != http.StatusConflict {
		t.Fatalf("expected 409, got %d", commitResp.StatusCode)
	}
}

func TestModelsControlProviderDelete_ConfirmTextMismatch(t *testing.T) {
	fake := newFakeModelsControlSurface(sampleConfig())
	srv := newModelsControlTestServer(t, fake)
	defer srv.Close()

	previewBody, _ := json.Marshal(deckapi.DeckGoModelProviderDeletePreviewRequest{
		ExpectedBaseHash: fake.hash,
		ProviderId:       "openai",
	})
	previewResp, err := http.Post(srv.URL+"/models/providers/delete-preview", "application/json", bytes.NewReader(previewBody))
	if err != nil {
		t.Fatal(err)
	}
	defer previewResp.Body.Close()
	var preview deckapi.DeckGoModelImpactPreviewResponse
	decodeJSON(t, previewResp.Body, &preview)

	commitBody, _ := json.Marshal(deckapi.DeckGoModelProviderDeleteCommitRequest{
		ExpectedBaseHash: fake.hash,
		ProviderId:       "openai",
		ImpactToken:      preview.Preview.ImpactToken,
		ConfirmText:      "DELETE",
	})
	commitResp, err := http.Post(srv.URL+"/models/providers/delete", "application/json", bytes.NewReader(commitBody))
	if err != nil {
		t.Fatal(err)
	}
	defer commitResp.Body.Close()
	if commitResp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", commitResp.StatusCode)
	}
}

func TestModelsControlModelUpsert_PreservesCompat(t *testing.T) {
	fake := newFakeModelsControlSurface(sampleConfig())
	srv := newModelsControlTestServer(t, fake)
	defer srv.Close()

	// Update gpt-4o without disturbing compat
	body := deckapi.DeckGoModelUpsertRequest{
		ExpectedBaseHash: fake.hash,
		ProviderId:       "openai",
		ModelId:          "gpt-4o",
		IsCreate:         false,
		Name:             "GPT-4o (renamed)",
		PreserveCompat:   true,
	}
	bodyBytes, _ := json.Marshal(body)
	resp, err := http.Post(srv.URL+"/models/models/upsert", "application/json", bytes.NewReader(bodyBytes))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		t.Fatalf("unexpected status %d: %s", resp.StatusCode, string(raw))
	}
	models := fake.config["models"].(map[string]any)["providers"].(map[string]any)["openai"].(map[string]any)["models"].(map[string]any)
	model := models["gpt-4o"].(map[string]any)
	compat, ok := model["compat"].(map[string]any)
	if !ok || compat["supportsTools"] != true {
		t.Fatalf("expected compat preserved, got %#v", model["compat"])
	}

	// Now repeat with PreserveCompat=false to confirm it drops compat
	fake.replaceConfig(sampleConfig())
	body.ExpectedBaseHash = fake.hash
	body.PreserveCompat = false
	bodyBytes, _ = json.Marshal(body)
	resp2, err := http.Post(srv.URL+"/models/models/upsert", "application/json", bytes.NewReader(bodyBytes))
	if err != nil {
		t.Fatal(err)
	}
	defer resp2.Body.Close()
	if resp2.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp2.Body)
		t.Fatalf("unexpected status %d: %s", resp2.StatusCode, string(raw))
	}
	models = fake.config["models"].(map[string]any)["providers"].(map[string]any)["openai"].(map[string]any)["models"].(map[string]any)
	model = models["gpt-4o"].(map[string]any)
	if _, ok := model["compat"]; ok {
		t.Fatal("expected compat to be dropped when PreserveCompat=false")
	}
}

func TestModelsControlModelUpsert_PartialOptionals(t *testing.T) {
	cfg := sampleConfig()
	models := cfg["models"].(map[string]any)
	providers := models["providers"].(map[string]any)
	openai := providers["openai"].(map[string]any)
	openai["models"].(map[string]any)["minimal"] = map[string]any{
		"id":   "minimal",
		"name": "Minimal",
	}
	fake := newFakeModelsControlSurface(cfg)
	srv := newModelsControlTestServer(t, fake)
	defer srv.Close()

	body := deckapi.DeckGoModelUpsertRequest{
		ExpectedBaseHash: fake.hash,
		ProviderId:       "openai",
		ModelId:          "minimal",
		IsCreate:         false,
		Name:             "Minimal Renamed",
		PreserveCompat:   true,
	}
	bodyBytes, _ := json.Marshal(body)
	resp, err := http.Post(srv.URL+"/models/models/upsert", "application/json", bytes.NewReader(bodyBytes))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		t.Fatalf("unexpected status %d: %s", resp.StatusCode, string(raw))
	}
	persisted := fake.config["models"].(map[string]any)["providers"].(map[string]any)["openai"].(map[string]any)["models"].(map[string]any)["minimal"].(map[string]any)
	if persisted["name"] != "Minimal Renamed" {
		t.Fatalf("expected renamed, got %v", persisted["name"])
	}
	// Ensure no other unexpected keys appeared (no contextWindow, no cost, etc.)
	for _, key := range []string{"contextWindow", "contextTokens", "maxTokens", "cost", "headers", "input"} {
		if _, present := persisted[key]; present {
			t.Fatalf("unexpected key %q persisted: %#v", key, persisted)
		}
	}
}

func TestModelsControlModelDelete_PreviewListsReferences(t *testing.T) {
	fake := newFakeModelsControlSurface(sampleConfig())
	srv := newModelsControlTestServer(t, fake)
	defer srv.Close()

	body, _ := json.Marshal(deckapi.DeckGoModelDeletePreviewRequest{
		ExpectedBaseHash: fake.hash,
		ProviderId:       "openai",
		ModelId:          "gpt-image",
	})
	resp, err := http.Post(srv.URL+"/models/models/delete-preview", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		t.Fatalf("unexpected status %d: %s", resp.StatusCode, string(raw))
	}
	var preview deckapi.DeckGoModelImpactPreviewResponse
	decodeJSON(t, resp.Body, &preview)
	if len(preview.Preview.References) == 0 {
		t.Fatal("expected at least one reference for gpt-image (agents.defaults.imageModel)")
	}
	hasImage := false
	for _, ref := range preview.Preview.DefaultsAffected {
		if ref == "imageModel" {
			hasImage = true
		}
	}
	if !hasImage {
		t.Fatalf("expected imageModel default in defaultsAffected, got %#v", preview.Preview.DefaultsAffected)
	}
}

func TestModelsControlModeSet_DryRunIdentifiesUnavailable(t *testing.T) {
	fake := newFakeModelsControlSurface(sampleConfig())
	fake.catalog = generated.ModelsCatalogProvidersResult{
		Providers: []struct {
			Api            string  `json:"api"`
			AuthType       string  `json:"authType"`
			DefaultBaseUrl string  `json:"defaultBaseUrl"`
			DisplayName    string  `json:"displayName"`
			Id             string  `json:"id"`
			ModelCount     float64 `json:"modelCount"`
			Models         []struct {
				ContextWindow float64 `json:"contextWindow"`
				Id            string  `json:"id"`
				MaxTokens     float64 `json:"maxTokens"`
				Name          string  `json:"name"`
				Reasoning     bool    `json:"reasoning"`
			} `json:"models"`
		}{
			{Id: "openai"},     // configured -> safe
			{Id: "anthropic"},  // configured -> safe
			{Id: "google"},     // unconfigured -> unavailable after replace
			{Id: "fireworks"},  // unconfigured -> unavailable after replace
		},
	}
	srv := newModelsControlTestServer(t, fake)
	defer srv.Close()

	body, _ := json.Marshal(deckapi.DeckGoModelModeSetRequest{
		ExpectedBaseHash: fake.hash,
		Mode:             "replace",
		DryRun:           true,
	})
	resp, err := http.Post(srv.URL+"/models/mode/set", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		t.Fatalf("unexpected status %d: %s", resp.StatusCode, string(raw))
	}
	var preview deckapi.DeckGoModelModeSetDryRunResponse
	decodeJSON(t, resp.Body, &preview)
	if len(preview.Preview.UnavailableProviders) != 2 {
		t.Fatalf("expected 2 unavailable providers, got %d", len(preview.Preview.UnavailableProviders))
	}
	if preview.Preview.ImpactToken == "" {
		t.Fatal("expected impact token in dry run preview")
	}
}

func TestModelsControlModeSet_CommitMatchesPreview(t *testing.T) {
	fake := newFakeModelsControlSurface(sampleConfig())
	srv := newModelsControlTestServer(t, fake)
	defer srv.Close()

	dryBody, _ := json.Marshal(deckapi.DeckGoModelModeSetRequest{
		ExpectedBaseHash: fake.hash,
		Mode:             "replace",
		DryRun:           true,
	})
	dryResp, err := http.Post(srv.URL+"/models/mode/set", "application/json", bytes.NewReader(dryBody))
	if err != nil {
		t.Fatal(err)
	}
	defer dryResp.Body.Close()
	var preview deckapi.DeckGoModelModeSetDryRunResponse
	decodeJSON(t, dryResp.Body, &preview)

	commitBody, _ := json.Marshal(deckapi.DeckGoModelModeSetRequest{
		ExpectedBaseHash: fake.hash,
		Mode:             "replace",
		DryRun:           false,
		ImpactToken:      preview.Preview.ImpactToken,
		ConfirmText:      "replace",
	})
	commitResp, err := http.Post(srv.URL+"/models/mode/set", "application/json", bytes.NewReader(commitBody))
	if err != nil {
		t.Fatal(err)
	}
	defer commitResp.Body.Close()
	if commitResp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(commitResp.Body)
		t.Fatalf("unexpected status %d: %s", commitResp.StatusCode, string(raw))
	}
	var commit deckapi.DeckGoModelModeSetCommitResponse
	decodeJSON(t, commitResp.Body, &commit)
	if !commit.Ok || commit.Mode != "replace" {
		t.Fatalf("unexpected commit response: %#v", commit)
	}
	if fake.config["models"].(map[string]any)["mode"] != "replace" {
		t.Fatalf("expected mode=replace persisted, got %#v", fake.config["models"])
	}
}

func TestModelsControlModeSet_StaleToken(t *testing.T) {
	fake := newFakeModelsControlSurface(sampleConfig())
	srv := newModelsControlTestServer(t, fake)
	defer srv.Close()

	dryBody, _ := json.Marshal(deckapi.DeckGoModelModeSetRequest{
		ExpectedBaseHash: fake.hash,
		Mode:             "replace",
		DryRun:           true,
	})
	dryResp, err := http.Post(srv.URL+"/models/mode/set", "application/json", bytes.NewReader(dryBody))
	if err != nil {
		t.Fatal(err)
	}
	defer dryResp.Body.Close()
	var preview deckapi.DeckGoModelModeSetDryRunResponse
	decodeJSON(t, dryResp.Body, &preview)
	priorHash := fake.hash

	// Drift: introduce a new agent reference that changes the reference index hash
	fake.replaceConfig(func() map[string]any {
		c := sampleConfig()
		ag := c["agents"].(map[string]any)
		list := ag["list"].([]any)
		list = append(list, map[string]any{"id": "drift", "model": "anthropic/claude"})
		ag["list"] = list
		return c
	}())

	commitBody, _ := json.Marshal(deckapi.DeckGoModelModeSetRequest{
		ExpectedBaseHash: priorHash,
		Mode:             "replace",
		DryRun:           false,
		ImpactToken:      preview.Preview.ImpactToken,
		ConfirmText:      "replace",
	})
	commitResp, err := http.Post(srv.URL+"/models/mode/set", "application/json", bytes.NewReader(commitBody))
	if err != nil {
		t.Fatal(err)
	}
	defer commitResp.Body.Close()
	if commitResp.StatusCode != http.StatusConflict {
		t.Fatalf("expected 409, got %d", commitResp.StatusCode)
	}
}

func TestModelReferenceIndex_AllSourceCategories(t *testing.T) {
	idx := buildModelReferenceIndex(sampleConfig())
	kinds := map[string]bool{}
	for _, ref := range idx.byProvider {
		for _, e := range ref {
			kinds[string(e.Kind)] = true
		}
	}
	for _, expect := range []string{"agents.defaults", "agents.list", "channels", "hooks", "tools", "sessions"} {
		if !kinds[expect] {
			t.Fatalf("expected reference kind %q in index, got %#v", expect, kinds)
		}
	}
	// Default roles are populated for image/pdf/summary/compaction/memorySearch
	if roles := idx.DefaultRolesForModel("anthropic", "claude-haiku"); len(roles) == 0 {
		t.Fatal("expected claude-haiku to carry default roles (compactionModel)")
	}
	if roles := idx.DefaultRolesForModel("openai", "text-embed"); len(roles) == 0 {
		t.Fatal("expected text-embed to carry default roles (memorySearchModel)")
	}
	// Hooks gmail recorded
	if !idx.IsModelReferenced("anthropic", "claude-haiku") {
		t.Fatal("expected claude-haiku referenced through hooks.gmail and compaction")
	}
	// Tools embedding recorded
	if !idx.IsModelReferenced("openai", "text-embed") {
		t.Fatal("expected text-embed referenced through tools.search.embedding.model")
	}
	// Sessions keyed/list recorded
	sessionRefs := idx.ReferencesForModel("openai", "gpt-4o")
	hasSession := false
	for _, ref := range sessionRefs {
		if string(ref.Kind) == "sessions" {
			hasSession = true
		}
	}
	if !hasSession {
		t.Fatal("expected sessions reference for openai/gpt-4o")
	}
	if idx.HashSeed() == "" {
		t.Fatal("expected non-empty hash seed")
	}
}
