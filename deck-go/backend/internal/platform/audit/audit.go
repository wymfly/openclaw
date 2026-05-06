package audit

import (
	"net/http"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

const (
	DefaultMaxEntries = 1000
	retentionMode     = "process-memory"
)

type Entry struct {
	ID         string `json:"id"`
	RequestID  string `json:"requestId"`
	Actor      string `json:"actor"`
	Method     string `json:"method"`
	Path       string `json:"path"`
	Action     string `json:"action"`
	Target     string `json:"target"`
	StatusCode int    `json:"statusCode"`
	OK         bool   `json:"ok"`
	DurationMs int64  `json:"durationMs"`
	Timestamp  string `json:"timestamp"`
	Summary    string `json:"summary,omitempty"`
}

type Retention struct {
	Mode       string `json:"mode"`
	MaxEntries int    `json:"maxEntries"`
}

type Log struct {
	mu         sync.RWMutex
	maxEntries int
	nextID     atomic.Int64
	entries    []Entry
}

func NewLog(maxEntries int) *Log {
	if maxEntries <= 0 {
		maxEntries = DefaultMaxEntries
	}
	return &Log{maxEntries: maxEntries}
}

func (l *Log) Retention() Retention {
	if l == nil {
		return Retention{Mode: retentionMode, MaxEntries: 0}
	}
	return Retention{Mode: retentionMode, MaxEntries: l.maxEntries}
}

func (l *Log) Append(entry Entry) Entry {
	if l == nil {
		return entry
	}
	entry.ID = strconv.FormatInt(l.nextID.Add(1), 10)
	if entry.Timestamp == "" {
		entry.Timestamp = time.Now().UTC().Format(time.RFC3339Nano)
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	l.entries = append(l.entries, entry)
	if len(l.entries) > l.maxEntries {
		l.entries = append([]Entry(nil), l.entries[len(l.entries)-l.maxEntries:]...)
	}
	return entry
}

func (l *Log) Recent(limit int) []Entry {
	if l == nil {
		return nil
	}
	l.mu.RLock()
	defer l.mu.RUnlock()
	if limit <= 0 || limit > len(l.entries) {
		limit = len(l.entries)
	}
	start := len(l.entries) - limit
	result := append([]Entry(nil), l.entries[start:]...)
	for i, j := 0, len(result)-1; i < j; i, j = i+1, j-1 {
		result[i], result[j] = result[j], result[i]
	}
	return result
}

func IsMutation(method string) bool {
	switch method {
	case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
		return true
	default:
		return false
	}
}

func Action(method string, path string) string {
	path = strings.TrimSpace(path)
	if path == "" {
		path = "/"
	}
	return method + " " + path
}

func Target(path string) string {
	path = strings.TrimSpace(path)
	if path == "" {
		return "/"
	}
	return path
}
