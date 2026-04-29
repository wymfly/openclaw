package state

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/openclaw/openclaw/deck-go/backend/internal/security/privatefile"
)

type RemoteEndpoint struct {
	URL       string `json:"url"`
	Token     string `json:"token"`
	TLSVerify bool   `json:"tlsVerify"`
}

type DeckState struct {
	Appearance    map[string]any   `json:"appearance,omitempty"`
	Notifications map[string]any   `json:"notifications,omitempty"`
	PairedDevices []map[string]any `json:"pairedDevices,omitempty"`
	Remote        *RemoteEndpoint  `json:"remote,omitempty"`
}

type Store struct {
	path string
	mu   sync.RWMutex
}

func Open(path string) *Store {
	return &Store{path: path}
}

func (s *Store) Path() string {
	return s.path
}

func (s *Store) Read() (DeckState, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.readUnlocked()
}

func (s *Store) WriteRemote(remote RemoteEndpoint) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	current, corrupt, err := s.readForWriteUnlocked()
	if err != nil {
		return err
	}
	if corrupt {
		if err := s.backupCorruptUnlocked(); err != nil {
			return err
		}
	}
	current.Remote = &remote
	return s.writeUnlocked(current)
}

func (s *Store) RemoteIsConfigured() bool {
	current, err := s.Read()
	return err == nil && current.Remote != nil && current.Remote.URL != ""
}

func (s *Store) readUnlocked() (DeckState, error) {
	raw, err := os.ReadFile(s.path)
	if os.IsNotExist(err) {
		return DeckState{}, nil
	}
	if err != nil {
		return DeckState{}, err
	}
	if len(raw) == 0 {
		return DeckState{}, nil
	}
	var parsed DeckState
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return DeckState{}, fmt.Errorf("deck-state.json is corrupt: %w", err)
	}
	return parsed, nil
}

func (s *Store) readForWriteUnlocked() (DeckState, bool, error) {
	raw, err := os.ReadFile(s.path)
	if os.IsNotExist(err) {
		return DeckState{}, false, nil
	}
	if err != nil {
		return DeckState{}, false, err
	}
	if len(raw) == 0 {
		return DeckState{}, false, nil
	}
	var parsed DeckState
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return DeckState{}, true, nil
	}
	return parsed, false, nil
}

func (s *Store) backupCorruptUnlocked() error {
	raw, err := os.ReadFile(s.path)
	if err != nil {
		return err
	}
	backupPath := fmt.Sprintf("%s.corrupt-%s.bak", s.path, time.Now().UTC().Format("20060102T150405Z"))
	if err := os.WriteFile(backupPath, raw, 0o600); err != nil {
		return err
	}
	return privatefile.SecureFile(backupPath)
}

func (s *Store) writeUnlocked(next DeckState) error {
	dir := filepath.Dir(s.path)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	if err := privatefile.SecureDir(dir); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(next, "", "  ")
	if err != nil {
		return err
	}
	tmp, err := os.CreateTemp(dir, filepath.Base(s.path)+".tmp-*")
	if err != nil {
		return err
	}
	tmpPath := tmp.Name()
	defer os.Remove(tmpPath)
	if _, err := tmp.Write(raw); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Chmod(0o600); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := os.Rename(tmpPath, s.path); err != nil {
		return err
	}
	return privatefile.SecureFile(s.path)
}
