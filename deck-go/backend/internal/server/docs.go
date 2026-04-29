package server

import (
	"context"
	"encoding/json"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway/generated"
	"github.com/openclaw/openclaw/deck-go/backend/internal/localstore"
	openclawrt "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/openclaw"
)

func registerDocsRoutes(mux interface {
	MethodFunc(string, string, http.HandlerFunc)
}, managed openclawrt.ManagedRuntimeSurface) {
	mux.MethodFunc("GET", "/docs", func(w http.ResponseWriter, r *http.Request) {
		category := r.URL.Query().Get("category")
		query := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q")))
		docs := localstore.GetDocStore().All()
		filtered := make([]localstore.DocEntry, 0, len(docs))
		for _, doc := range docs {
			if category != "" && doc.Category != category {
				continue
			}
			if query != "" {
				if !strings.Contains(strings.ToLower(doc.Title), query) &&
					!strings.Contains(strings.ToLower(doc.Content), query) &&
					!keywordsContain(doc.Keywords, query) {
					continue
				}
			}
			filtered = append(filtered, doc)
		}
		sort.Slice(filtered, func(i, j int) bool { return filtered[i].ExtractedAt > filtered[j].ExtractedAt })
		writeJSON(w, http.StatusOK, map[string]any{"docs": filtered})
	})

	mux.MethodFunc("GET", "/docs/{docId}", func(w http.ResponseWriter, r *http.Request) {
		docID := chi.URLParam(r, "docId")
		doc, ok := localstore.GetDocStore().Find(func(item localstore.DocEntry) bool { return item.ID == docID })
		if !ok {
			writeJSON(w, http.StatusNotFound, map[string]any{"error": "Document not found"})
			return
		}
		writeJSON(w, http.StatusOK, doc)
	})

	mux.MethodFunc("DELETE", "/docs/{docId}", func(w http.ResponseWriter, r *http.Request) {
		docID := chi.URLParam(r, "docId")
		removed := localstore.GetDocStore().RemoveWhere(func(item localstore.DocEntry) bool { return item.ID == docID })
		if removed == 0 {
			writeJSON(w, http.StatusNotFound, map[string]any{"error": "Document not found"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	})

	mux.MethodFunc("POST", "/docs/extract", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			SessionKey string `json:"sessionKey"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
			return
		}
		if strings.TrimSpace(body.SessionKey) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "sessionKey is required"})
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := managed.ChatHistory(ctx, map[string]any{"sessionKey": body.SessionKey})
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"error": "Failed to fetch conversation history"})
			return
		}
		extractions := extractDocsFromChatHistory(payload)
		if len(extractions) == 0 {
			writeJSON(w, http.StatusOK, map[string]any{"extracted": 0, "docs": []any{}})
			return
		}
		now := time.Now().UTC().Format(time.RFC3339)
		inserted := make([]localstore.DocEntry, 0, len(extractions))
		store := localstore.GetDocStore()
		for _, item := range extractions {
			sessionKey := body.SessionKey
			entry := localstore.DocEntry{
				ID:            "doc-" + randomID(6),
				Title:         item.Title,
				Category:      item.Category,
				Content:       item.Content,
				SourceSession: &sessionKey,
				SourceAgent:   nil,
				Keywords:      item.Keywords,
				Language:      item.Language,
				ExtractedAt:   now,
				UpdatedAt:     now,
			}
			store.Append(entry)
			inserted = append(inserted, entry)
		}
		writeJSON(w, http.StatusOK, map[string]any{"extracted": len(inserted), "docs": inserted})
	})
}

type extractedDoc struct {
	Title    string
	Category string
	Content  string
	Keywords []string
	Language string
}

func extractDocsFromChatHistory(payload any) []extractedDoc {
	if history, ok := payload.(generated.ChatHistoryResult); ok {
		results := make([]extractedDoc, 0)
		for _, message := range history.Messages {
			if message.Role != "assistant" {
				continue
			}
			text := flattenDocMessageContent(message.Content)
			if len(strings.TrimSpace(text)) < 200 {
				continue
			}
			category := categorizeDocContent(text)
			results = append(results, extractedDoc{
				Title:    extractDocTitle(text),
				Category: category,
				Content:  text,
				Keywords: extractDocKeywords(text, category),
				Language: detectDocLanguage(text),
			})
		}
		return results
	}
	record, ok := payload.(map[string]any)
	if !ok {
		return nil
	}
	rawMessages, _ := record["messages"].([]any)
	results := make([]extractedDoc, 0)
	for _, rawMessage := range rawMessages {
		message, ok := rawMessage.(map[string]any)
		if !ok {
			continue
		}
		if role, _ := message["role"].(string); role != "assistant" {
			continue
		}
		text := flattenDocMessageContent(message["content"])
		if len(strings.TrimSpace(text)) < 200 {
			continue
		}
		category := categorizeDocContent(text)
		results = append(results, extractedDoc{
			Title:    extractDocTitle(text),
			Category: category,
			Content:  text,
			Keywords: extractDocKeywords(text, category),
			Language: detectDocLanguage(text),
		})
	}
	return results
}

func flattenDocMessageContent(content any) string {
	if text, ok := content.(string); ok {
		return text
	}
	items, ok := content.([]any)
	if !ok {
		return ""
	}
	parts := make([]string, 0, len(items))
	for _, rawItem := range items {
		item, ok := rawItem.(map[string]any)
		if !ok {
			continue
		}
		if itemType, _ := item["type"].(string); itemType != "text" {
			continue
		}
		if text, _ := item["text"].(string); text != "" {
			parts = append(parts, text)
		}
	}
	return strings.Join(parts, "\n\n")
}

func categorizeDocContent(text string) string {
	type categoryKeywords struct {
		name     string
		keywords []string
	}
	categories := []categoryKeywords{
		{name: "summary", keywords: []string{"总结", "摘要", "概要", "summary", "recap", "overview", "conclusion"}},
		{name: "plan", keywords: []string{"计划", "方案", "路线图", "plan", "roadmap", "milestone", "timeline", "schedule"}},
		{name: "spec", keywords: []string{"规范", "规格", "接口", "协议", "api", "spec", "specification", "protocol", "schema", "contract"}},
		{name: "manual", keywords: []string{"手册", "教程", "指南", "步骤", "manual", "guide", "tutorial", "how-to", "instructions"}},
		{name: "draft", keywords: []string{"草稿", "初稿", "想法", "draft", "idea", "brainstorm", "notes"}},
	}
	lower := strings.ToLower(text)
	bestName := "draft"
	bestScore := 0
	for _, category := range categories {
		score := 0
		for _, keyword := range category.keywords {
			if strings.Contains(lower, strings.ToLower(keyword)) {
				score++
			}
		}
		if score > bestScore {
			bestScore = score
			bestName = category.name
		}
	}
	return bestName
}

func extractDocTitle(text string) string {
	lines := strings.Split(text, "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "#") {
			title := strings.TrimSpace(strings.TrimLeft(trimmed, "#"))
			if len(title) > 100 {
				return title[:100]
			}
			if title != "" {
				return title
			}
		}
	}
	firstLine := strings.TrimSpace(lines[0])
	if firstLine == "" {
		return "Untitled"
	}
	title := splitFirstSentence(firstLine)
	if len(title) > 100 {
		return title[:100]
	}
	return title
}

func splitFirstSentence(text string) string {
	for _, sep := range []string{".", "。", "!", "！", "?", "？"} {
		if idx := strings.Index(text, sep); idx >= 0 {
			return strings.TrimSpace(text[:idx])
		}
	}
	return strings.TrimSpace(text)
}

func detectDocLanguage(text string) string {
	if text == "" {
		return "en"
	}
	cjk := 0
	for _, r := range text {
		if (r >= 0x4e00 && r <= 0x9fff) || (r >= 0x3400 && r <= 0x4dbf) {
			cjk++
		}
	}
	if float64(cjk)/float64(len([]rune(text))) >= 0.15 {
		return "zh"
	}
	return "en"
}

func extractDocKeywords(text string, category string) []string {
	candidates := []string{}
	categoryMap := map[string][]string{
		"summary": {"总结", "摘要", "summary", "overview"},
		"plan":    {"计划", "方案", "plan", "roadmap"},
		"spec":    {"规范", "规格", "api", "protocol", "schema"},
		"manual":  {"手册", "教程", "manual", "guide"},
		"draft":   {"草稿", "draft", "idea", "notes"},
	}
	seen := map[string]bool{}
	lower := strings.ToLower(text)
	for _, keyword := range categoryMap[category] {
		if strings.Contains(lower, strings.ToLower(keyword)) && !seen[keyword] {
			seen[keyword] = true
			candidates = append(candidates, keyword)
		}
	}
	words := strings.FieldsFunc(text, func(r rune) bool {
		return !(r >= '0' && r <= '9' || r >= 'A' && r <= 'Z' || r >= 'a' && r <= 'z' || r == '_' || r >= 0x4e00 && r <= 0x9fff)
	})
	stopWords := map[string]bool{
		"the": true, "and": true, "for": true, "this": true, "that": true, "with": true, "from": true,
		"have": true, "will": true, "been": true, "some": true, "they": true,
		"其中": true, "以下": true, "这个": true, "进行": true, "使用": true, "包含": true, "通过": true,
	}
	for _, word := range words {
		normalized := strings.ToLower(strings.TrimSpace(word))
		if len([]rune(normalized)) < 3 || stopWords[normalized] || seen[normalized] {
			continue
		}
		seen[normalized] = true
		candidates = append(candidates, word)
		if len(candidates) >= 10 {
			break
		}
	}
	return candidates
}

func keywordsContain(items []string, query string) bool {
	for _, item := range items {
		if strings.Contains(strings.ToLower(item), query) {
			return true
		}
	}
	return false
}
