package projection

import (
	"encoding/json"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/coerce"
)

type ActivityEventEntry struct {
	ID          string `json:"id"`
	Timestamp   int64  `json:"timestamp"`
	Type        string `json:"type"`
	AgentID     string `json:"agentId,omitempty"`
	AgentName   string `json:"agentName,omitempty"`
	Description string `json:"description"`
	Details     string `json:"details,omitempty"`
}

type RunRecord struct {
	RunID          string `json:"runId"`
	AgentID        string `json:"agentId,omitempty"`
	SessionKey     string `json:"sessionKey,omitempty"`
	Status         string `json:"status"`
	FirstEventAt   string `json:"firstEventAt"`
	LastEventAt    string `json:"lastEventAt"`
	EventCount     int    `json:"eventCount"`
	ToolCalls      int    `json:"toolCalls"`
	ModelCalls     int    `json:"modelCalls"`
	FileOps        int    `json:"fileOps"`
	SubagentSpawns int    `json:"subagentSpawns"`
	TotalTokens    int    `json:"totalTokens"`
	Compacted      bool   `json:"compacted"`
}

type RunEventRow struct {
	ID         int64  `json:"id"`
	RunID      string `json:"run_id"`
	Seq        int    `json:"seq"`
	Stream     string `json:"stream"`
	Data       string `json:"data"`
	AgentID    string `json:"agent_id,omitempty"`
	SessionKey string `json:"session_key,omitempty"`
	CreatedAt  string `json:"created_at"`
}

type TopAgent struct {
	AgentID  string `json:"agentId"`
	RunCount int    `json:"runCount"`
}

type MonitorStats struct {
	TotalRuns     int        `json:"totalRuns"`
	TodayRuns     int        `json:"todayRuns"`
	AvgDurationMs int64      `json:"avgDurationMs"`
	TopAgents     []TopAgent `json:"topAgents"`
}

type EventBus interface {
	EventsSince(lastID int64) ([]events.Event, bool)
}

func CollectActivityEntries(bus EventBus, limit int) []ActivityEventEntry {
	eventsList, _ := bus.EventsSince(0)
	results := make([]ActivityEventEntry, 0)
	for _, event := range eventsList {
		entry := DecodeActivityEventEntry(event)
		if entry == nil || entry.Description == "" {
			continue
		}
		results = append(results, *entry)
	}
	sort.Slice(results, func(i, j int) bool { return results[i].Timestamp > results[j].Timestamp })
	if limit > 0 && len(results) > limit {
		results = results[:limit]
	}
	return results
}

func DecodeActivityEventEntry(event events.Event) *ActivityEventEntry {
	switch event.Type {
	case "activity.event":
		var payload map[string]any
		if err := json.Unmarshal(event.Data, &payload); err != nil {
			return nil
		}
		entry := &ActivityEventEntry{
			ID:          coerce.String(payload["id"], strconv.FormatInt(event.ID, 10)),
			Timestamp:   int64(coerce.Number(payload["timestamp"])),
			Type:        coerce.String(payload["type"], "system"),
			AgentID:     coerce.String(payload["agentId"], ""),
			AgentName:   coerce.String(payload["agentName"], ""),
			Description: coerce.String(payload["description"], ""),
			Details:     coerce.String(payload["details"], ""),
		}
		if entry.Timestamp == 0 {
			entry.Timestamp = event.Timestamp
		}
		return entry
	case "chat":
		var payload map[string]any
		if err := json.Unmarshal(event.Data, &payload); err != nil {
			return nil
		}
		runID := coerce.String(payload["runId"], "")
		sessionKey := coerce.String(payload["sessionKey"], "")
		state := coerce.String(payload["state"], "")
		description := "Chat event"
		switch state {
		case "final":
			description = "Chat run completed"
		case "error":
			description = "Chat run failed"
		case "aborted":
			description = "Chat run aborted"
		case "delta":
			description = "Chat streaming"
		}
		details := strings.TrimSpace(strings.Join([]string{runID, sessionKey}, " · "))
		return &ActivityEventEntry{
			ID:          "chat-" + runID + "-" + strconv.FormatInt(event.ID, 10),
			Timestamp:   event.Timestamp,
			Type:        "chat",
			AgentID:     extractAgentIDFromSessionKey(sessionKey),
			Description: description,
			Details:     details,
		}
	case "agent":
		var payload map[string]any
		if err := json.Unmarshal(event.Data, &payload); err != nil {
			return nil
		}
		runID := coerce.String(payload["runId"], "")
		sessionKey := coerce.String(payload["sessionKey"], "")
		stream := coerce.String(payload["stream"], "")
		data := coerce.Map(payload["data"])
		entryType := "system"
		description := "Agent event"
		switch stream {
		case "tool":
			entryType = "tool_call"
			description = "Tool call"
			if name := coerce.String(data["name"], ""); name != "" {
				description = "Tool " + name
			}
		case "lifecycle":
			entryType = "agent"
			description = "Subagent lifecycle"
		case "compaction":
			entryType = "status"
			description = "Compaction checkpoint"
		}
		details := strings.TrimSpace(strings.Join([]string{runID, sessionKey}, " · "))
		return &ActivityEventEntry{
			ID:          "agent-" + runID + "-" + strconv.FormatInt(event.ID, 10),
			Timestamp:   event.Timestamp,
			Type:        entryType,
			AgentID:     extractAgentIDFromSessionKey(sessionKey),
			Description: description,
			Details:     details,
		}
	default:
		return nil
	}
}

func AggregateRuns(bus EventBus) []RunRecord {
	eventsList, _ := bus.EventsSince(0)
	runs := map[string]*RunRecord{}
	for _, event := range eventsList {
		if event.Type != "chat" && event.Type != "agent" {
			continue
		}
		var payload map[string]any
		if err := json.Unmarshal(event.Data, &payload); err != nil {
			continue
		}
		runID := coerce.String(payload["runId"], "")
		if runID == "" {
			continue
		}
		now := time.Now().UTC().Format(time.RFC3339)
		run := runs[runID]
		if run == nil {
			sessionKey := coerce.String(payload["sessionKey"], "")
			run = &RunRecord{
				RunID:        runID,
				AgentID:      extractAgentIDFromSessionKey(sessionKey),
				SessionKey:   sessionKey,
				Status:       "running",
				FirstEventAt: now,
				LastEventAt:  now,
			}
			runs[runID] = run
		}
		run.LastEventAt = now
		run.EventCount++
		if event.Type == "chat" {
			state := coerce.String(payload["state"], "")
			if state == "final" {
				run.Status = "completed"
				run.ModelCalls++
			} else if state == "error" {
				run.Status = "error"
				run.ModelCalls++
			}
			if usage, ok := payload["usage"].(map[string]any); ok {
				run.TotalTokens += int(coerce.Number(usage["input_tokens"]) + coerce.Number(usage["output_tokens"]))
			}
		}
		if event.Type == "agent" {
			stream := coerce.String(payload["stream"], "")
			data := coerce.Map(payload["data"])
			switch stream {
			case "compaction":
				run.Compacted = true
			case "tool":
				toolName := strings.ToLower(coerce.String(data["name"], ""))
				switch toolName {
				case "read", "write", "edit", "multiedit", "glob", "read_file", "write_file", "edit_file", "create_file", "delete_file":
					run.FileOps++
				case "agent", "taskcreate":
					run.SubagentSpawns++
				default:
					run.ToolCalls++
				}
			case "lifecycle":
				if data != nil && (data["childRunId"] != nil || data["childSessionKey"] != nil) {
					run.SubagentSpawns++
				}
			}
		}
	}
	result := make([]RunRecord, 0, len(runs))
	now := time.Now()
	for _, run := range runs {
		lastAt, err := time.Parse(time.RFC3339, run.LastEventAt)
		if err == nil && run.Status == "running" && now.Sub(lastAt) > 5*time.Minute {
			run.Status = "error"
		}
		result = append(result, *run)
	}
	return result
}

func AggregateRunEvents(bus EventBus, runID string) []RunEventRow {
	if strings.TrimSpace(runID) == "" {
		return nil
	}
	eventsList, _ := bus.EventsSince(0)
	rows := make([]RunEventRow, 0)
	seq := 0
	for _, event := range eventsList {
		if event.Type != "chat" && event.Type != "agent" {
			continue
		}
		var payload map[string]any
		if err := json.Unmarshal(event.Data, &payload); err != nil {
			continue
		}
		if coerce.String(payload["runId"], "") != runID {
			continue
		}
		seq++
		stream := event.Type
		if event.Type == "agent" {
			stream = coerce.String(payload["stream"], event.Type)
		}
		sessionKey := coerce.String(payload["sessionKey"], "")
		agentID := coerce.String(payload["agentId"], extractAgentIDFromSessionKey(sessionKey))
		rows = append(rows, RunEventRow{
			ID:         event.ID,
			RunID:      runID,
			Seq:        seq,
			Stream:     stream,
			Data:       string(event.Data),
			AgentID:    agentID,
			SessionKey: sessionKey,
			CreatedAt:  time.UnixMilli(event.Timestamp).UTC().Format(time.RFC3339),
		})
	}
	return rows
}

func BuildMonitorStats(runs []RunRecord, now time.Time) MonitorStats {
	agentCounts := map[string]int{}
	var totalDuration int64
	todayStart := now.Truncate(24 * time.Hour)
	todayRuns := 0
	for _, run := range runs {
		firstAt, _ := time.Parse(time.RFC3339, run.FirstEventAt)
		lastAt, _ := time.Parse(time.RFC3339, run.LastEventAt)
		totalDuration += lastAt.Sub(firstAt).Milliseconds()
		if !firstAt.Before(todayStart) {
			todayRuns++
		}
		agentKey := run.AgentID
		if agentKey == "" {
			agentKey = "unknown"
		}
		agentCounts[agentKey]++
	}
	topAgents := make([]TopAgent, 0, len(agentCounts))
	for agentID, runCount := range agentCounts {
		topAgents = append(topAgents, TopAgent{AgentID: agentID, RunCount: runCount})
	}
	sort.Slice(topAgents, func(i, j int) bool { return topAgents[i].RunCount > topAgents[j].RunCount })
	if len(topAgents) > 5 {
		topAgents = topAgents[:5]
	}
	avgDuration := int64(0)
	if len(runs) > 0 {
		avgDuration = totalDuration / int64(len(runs))
	}
	return MonitorStats{
		TotalRuns:     len(runs),
		TodayRuns:     todayRuns,
		AvgDurationMs: avgDuration,
		TopAgents:     topAgents,
	}
}

func extractAgentIDFromSessionKey(sessionKey string) string {
	if !strings.HasPrefix(sessionKey, "agent:") {
		return ""
	}
	parts := strings.Split(sessionKey, ":")
	if len(parts) < 2 {
		return ""
	}
	return parts[1]
}
