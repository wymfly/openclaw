package config

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
)

type Settings struct {
	AccessToken  string `json:"accessToken,omitempty"`
	GatewayURL   string `json:"gatewayUrl,omitempty"`
	GatewayToken string `json:"gatewayToken,omitempty"`
}

type Store struct {
	path string
	mu   sync.RWMutex
	data Settings
}

func NewStore() (*Store, error) {
	dir := os.Getenv("DECK_GO_DATA_DIR")
	if dir == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return nil, err
		}
		dir = filepath.Join(home, ".openclaw", "deck-go")
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	store := &Store{path: filepath.Join(dir, "settings.json")}
	if err := store.load(); err != nil {
		return nil, err
	}
	return store, nil
}

func (s *Store) Path() string {
	return s.path
}

func (s *Store) Get() Settings {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.data
}

func (s *Store) Effective() Settings {
	current := s.Get()
	if v := os.Getenv("DECK_GO_ACCESS_TOKEN"); v != "" {
		current.AccessToken = v
	}
	if v := os.Getenv("DECK_GO_GATEWAY_URL"); v != "" {
		current.GatewayURL = v
	}
	if v := os.Getenv("DECK_GO_GATEWAY_TOKEN"); v != "" {
		current.GatewayToken = v
	}
	return current
}

func (s *Store) Update(next Settings) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data = next
	return s.saveLocked()
}

func (s *Store) load() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	raw, err := os.ReadFile(s.path)
	if errors.Is(err, os.ErrNotExist) {
		s.data = Settings{}
		return nil
	}
	if err != nil {
		return err
	}
	if len(raw) == 0 {
		s.data = Settings{}
		return nil
	}
	var parsed Settings
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return err
	}
	s.data = parsed
	return nil
}

func (s *Store) saveLocked() error {
	raw, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil {
		return err
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}

