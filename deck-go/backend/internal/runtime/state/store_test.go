package state

import (
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

func TestWriteRemoteCreatesFileWithPrivateMode(t *testing.T) {
	path := filepath.Join(t.TempDir(), "nested", "deck-state.json")
	store := Open(path)

	if err := store.WriteRemote(RemoteEndpoint{
		URL:       "https://gateway.example.test",
		Token:     "secret-token",
		TLSVerify: true,
	}); err != nil {
		t.Fatalf("WriteRemote() error = %v", err)
	}

	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("stat deck-state.json: %v", err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("mode = %o, want 0600", info.Mode().Perm())
	}
	dirInfo, err := os.Stat(filepath.Dir(path))
	if err != nil {
		t.Fatalf("stat deck-state parent dir: %v", err)
	}
	if dirInfo.Mode().Perm() != 0o700 {
		t.Fatalf("parent dir mode = %o, want 0700", dirInfo.Mode().Perm())
	}

	read, err := store.Read()
	if err != nil {
		t.Fatalf("Read() error = %v", err)
	}
	if read.Remote == nil || read.Remote.Token != "secret-token" {
		t.Fatalf("remote state = %#v", read.Remote)
	}
}

func TestWriteRemoteAtomicallyReplacesExistingState(t *testing.T) {
	path := filepath.Join(t.TempDir(), "deck-state.json")
	store := Open(path)
	if err := store.WriteRemote(RemoteEndpoint{URL: "https://old.example.test", Token: "old", TLSVerify: true}); err != nil {
		t.Fatal(err)
	}
	if err := store.WriteRemote(RemoteEndpoint{URL: "https://new.example.test", Token: "new", TLSVerify: false}); err != nil {
		t.Fatal(err)
	}

	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(raw), "old.example") || !strings.Contains(string(raw), "new.example") {
		t.Fatalf("unexpected state file: %s", raw)
	}
	if matches, _ := filepath.Glob(path + ".tmp*"); len(matches) != 0 {
		t.Fatalf("temporary files left behind: %v", matches)
	}
}

func TestReadCorruptFileDoesNotOverwrite(t *testing.T) {
	path := filepath.Join(t.TempDir(), "deck-state.json")
	if err := os.WriteFile(path, []byte("{not-json"), 0o600); err != nil {
		t.Fatal(err)
	}
	store := Open(path)

	_, err := store.Read()
	if err == nil {
		t.Fatal("Read() error = nil, want corrupt-state error")
	}
	raw, readErr := os.ReadFile(path)
	if readErr != nil {
		t.Fatal(readErr)
	}
	if string(raw) != "{not-json" {
		t.Fatalf("corrupt file was overwritten: %q", raw)
	}
}

func TestConcurrentReadsAreSafe(t *testing.T) {
	path := filepath.Join(t.TempDir(), "deck-state.json")
	store := Open(path)
	if err := store.WriteRemote(RemoteEndpoint{URL: "https://gateway.example.test", Token: "token", TLSVerify: true}); err != nil {
		t.Fatal(err)
	}

	var wg sync.WaitGroup
	errs := make(chan error, 20)
	for range 20 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			state, err := store.Read()
			if err != nil {
				errs <- err
				return
			}
			if state.Remote == nil || state.Remote.URL == "" {
				errs <- os.ErrInvalid
			}
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		t.Fatalf("concurrent Read() error = %v", err)
	}
}

func TestWriteFailureSurfacesError(t *testing.T) {
	dir := t.TempDir()
	store := Open(dir)
	err := store.WriteRemote(RemoteEndpoint{URL: "https://gateway.example.test", Token: "token", TLSVerify: true})
	if err == nil {
		t.Fatal("WriteRemote() error = nil, want write failure")
	}
}
