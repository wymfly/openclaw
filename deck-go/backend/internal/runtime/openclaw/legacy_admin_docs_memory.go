package openclaw

import (
	"context"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway/generated"
	"github.com/openclaw/openclaw/deck-go/backend/internal/localstore"
)

var validMemoryAgentID = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)

func (m *ManagedRuntime) ListDocs(ctx context.Context, category string, query string) (map[string]any, error) {
	query = strings.ToLower(strings.TrimSpace(query))
	docs := localstore.GetDocStore().All()
	filtered := make([]localstore.DocEntry, 0, len(docs))
	for _, doc := range docs {
		if category != "" && doc.Category != category {
			continue
		}
		if query != "" &&
			!strings.Contains(strings.ToLower(doc.Title), query) &&
			!strings.Contains(strings.ToLower(doc.Content), query) &&
			!keywordsContain(doc.Keywords, query) {
			continue
		}
		filtered = append(filtered, doc)
	}
	slices.SortFunc(filtered, func(left, right localstore.DocEntry) int {
		switch {
		case left.ExtractedAt > right.ExtractedAt:
			return -1
		case left.ExtractedAt < right.ExtractedAt:
			return 1
		default:
			return 0
		}
	})
	return map[string]any{"docs": filtered}, nil
}

func (m *ManagedRuntime) GetDoc(ctx context.Context, docID string) (any, bool, error) {
	doc, ok := localstore.GetDocStore().Find(func(item localstore.DocEntry) bool { return item.ID == docID })
	if !ok {
		return nil, false, nil
	}
	return doc, true, nil
}

func (m *ManagedRuntime) DeleteDoc(ctx context.Context, docID string) (bool, error) {
	removed := localstore.GetDocStore().RemoveWhere(func(item localstore.DocEntry) bool { return item.ID == docID })
	return removed > 0, nil
}

func (m *ManagedRuntime) ExtractDocs(ctx context.Context, sessionKey string) (map[string]any, int, error) {
	if strings.TrimSpace(sessionKey) == "" {
		return map[string]any{"error": "sessionKey is required"}, http.StatusBadRequest, nil
	}
	queryCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	payload, err := m.ChatHistory(queryCtx, map[string]any{"sessionKey": sessionKey})
	if err != nil {
		return map[string]any{"error": "Failed to fetch conversation history"}, http.StatusBadGateway, nil
	}
	extractions := extractDocsFromChatHistory(payload)
	if len(extractions) == 0 {
		return map[string]any{"extracted": 0, "docs": []any{}}, http.StatusOK, nil
	}
	now := time.Now().UTC().Format(time.RFC3339)
	inserted := make([]localstore.DocEntry, 0, len(extractions))
	store := localstore.GetDocStore()
	for _, item := range extractions {
		key := sessionKey
		entry := localstore.DocEntry{
			ID:            "doc-" + randomHexID(6),
			Title:         item.Title,
			Category:      item.Category,
			Content:       item.Content,
			SourceSession: &key,
			SourceAgent:   nil,
			Keywords:      item.Keywords,
			Language:      item.Language,
			ExtractedAt:   now,
			UpdatedAt:     now,
		}
		store.Append(entry)
		inserted = append(inserted, entry)
	}
	return map[string]any{"extracted": len(inserted), "docs": inserted}, http.StatusOK, nil
}

func (m *ManagedRuntime) BrowseMemory(ctx context.Context, agentID string, subPath string, readMode bool) (any, int, error) {
	if agentID == "" {
		return map[string]any{"error": "agentId is required"}, http.StatusBadRequest, nil
	}
	if !validMemoryAgentID.MatchString(agentID) {
		return map[string]any{"error": "Invalid agentId — must be alphanumeric, hyphens, or underscores"}, http.StatusBadRequest, nil
	}
	if !isValidMemorySubPath(subPath) {
		return map[string]any{"error": "Invalid path — must be relative without '..' segments"}, http.StatusBadRequest, nil
	}
	basePath, err := m.resolveMemoryWorkspacePath(ctx, agentID)
	if err != nil || basePath == "" {
		return map[string]any{"error": "Could not resolve memory path"}, http.StatusServiceUnavailable, nil
	}
	targetPath, ok := safeMemoryPath(basePath, subPath)
	if !ok {
		return map[string]any{"error": "Invalid path — traversal detected"}, http.StatusForbidden, nil
	}
	info, err := os.Stat(targetPath)
	if err != nil {
		if os.IsNotExist(err) {
			return map[string]any{"files": []any{}}, http.StatusOK, nil
		}
		return map[string]any{"error": "Failed to browse memory files"}, http.StatusInternalServerError, nil
	}
	if readMode || !info.IsDir() {
		if info.IsDir() {
			return map[string]any{"error": "Not a file"}, http.StatusBadRequest, nil
		}
		content, err := os.ReadFile(targetPath)
		if err != nil {
			return map[string]any{"error": "Failed to read file"}, http.StatusInternalServerError, nil
		}
		return map[string]any{"content": string(content), "path": subPath}, http.StatusOK, nil
	}
	entries, err := os.ReadDir(targetPath)
	if err != nil {
		return map[string]any{"error": "Failed to browse memory files"}, http.StatusInternalServerError, nil
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
		item := map[string]any{"name": entry.Name(), "path": entryPath}
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
	return map[string]any{"files": files}, http.StatusOK, nil
}

func (m *ManagedRuntime) SearchMemory(ctx context.Context, query string, agentID string, scope string) (any, int, error) {
	if strings.TrimSpace(query) == "" {
		return map[string]any{"error": "q is required"}, http.StatusBadRequest, nil
	}
	return map[string]any{"error": "Not implemented — requires LanceDB extension"}, http.StatusNotImplemented, nil
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

func (m *ManagedRuntime) resolveMemoryWorkspacePath(ctx context.Context, agentID string) (string, error) {
	payload, err := m.AgentFilesList(ctx, agentID)
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

func randomHexID(bytes int) string {
	const alphabet = "0123456789abcdef"
	buf := make([]byte, bytes)
	now := time.Now().UnixNano()
	for i := range buf {
		buf[i] = alphabet[int((now>>uint(i*4))&0xf)]
	}
	return string(buf)
}
