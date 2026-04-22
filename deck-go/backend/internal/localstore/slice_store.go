package localstore

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

func resolveDataDir() string {
	if dir := os.Getenv("DECK_GO_DATA_DIR"); dir != "" {
		return dir
	}
	homeDir, err := os.UserHomeDir()
	if err != nil || homeDir == "" {
		return ".openclaw/deck-go"
	}
	return filepath.Join(homeDir, ".openclaw", "deck-go")
}

type SliceStore[T any] struct {
	filePath string
	mu       sync.Mutex
	data     []T
}

func NewSliceStore[T any](fileName string) *SliceStore[T] {
	store := &SliceStore[T]{
		filePath: filepath.Join(resolveDataDir(), fileName),
		data:     []T{},
	}
	store.reload()
	return store
}

func (s *SliceStore[T]) All() []T {
	s.mu.Lock()
	defer s.mu.Unlock()
	return cloneSlice(s.data)
}

func (s *SliceStore[T]) Append(item T) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data = append(s.data, item)
	s.saveLocked()
}

func (s *SliceStore[T]) Find(predicate func(T) bool) (T, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, item := range s.data {
		if predicate(item) {
			return cloneItem(item), true
		}
	}
	var zero T
	return zero, false
}

func (s *SliceStore[T]) UpdateItem(predicate func(T) bool, updater func(T) T) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	for idx, item := range s.data {
		if predicate(item) {
			s.data[idx] = updater(item)
			s.saveLocked()
			return true
		}
	}
	return false
}

func (s *SliceStore[T]) RemoveWhere(predicate func(T) bool) int {
	s.mu.Lock()
	defer s.mu.Unlock()
	filtered := make([]T, 0, len(s.data))
	removed := 0
	for _, item := range s.data {
		if predicate(item) {
			removed++
			continue
		}
		filtered = append(filtered, item)
	}
	if removed > 0 {
		s.data = filtered
		s.saveLocked()
	}
	return removed
}

func (s *SliceStore[T]) reload() {
	s.mu.Lock()
	defer s.mu.Unlock()
	raw, err := os.ReadFile(s.filePath)
	if err != nil {
		if os.IsNotExist(err) {
			s.data = []T{}
			return
		}
		s.data = []T{}
		return
	}
	var parsed []T
	if err := json.Unmarshal(raw, &parsed); err != nil {
		s.data = []T{}
		return
	}
	s.data = parsed
}

func (s *SliceStore[T]) saveLocked() {
	if err := os.MkdirAll(filepath.Dir(s.filePath), 0o755); err != nil {
		return
	}
	raw, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil {
		return
	}
	tmp := s.filePath + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o644); err != nil {
		return
	}
	_ = os.Rename(tmp, s.filePath)
}

func cloneSlice[T any](items []T) []T {
	raw, err := json.Marshal(items)
	if err != nil {
		return append([]T(nil), items...)
	}
	var cloned []T
	if err := json.Unmarshal(raw, &cloned); err != nil {
		return append([]T(nil), items...)
	}
	return cloned
}

func cloneItem[T any](item T) T {
	raw, err := json.Marshal(item)
	if err != nil {
		return item
	}
	var cloned T
	if err := json.Unmarshal(raw, &cloned); err != nil {
		return item
	}
	return cloned
}
