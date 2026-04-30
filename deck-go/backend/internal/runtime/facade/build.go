package facade

import (
	"fmt"
	"sync"

	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/envconf"
	runtimestate "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/state"
)

type BundledFactory func(*envconf.RuntimeBundledConfig) (RuntimeFacade, error)
type RemoteFactory func(envconf.RuntimeRemoteDefaults, *runtimestate.Store) RuntimeFacade

var (
	factoryMu      sync.RWMutex
	bundledFactory BundledFactory
	remoteFactory  RemoteFactory
)

func RegisterBundledFactory(factory BundledFactory) {
	factoryMu.Lock()
	defer factoryMu.Unlock()
	bundledFactory = factory
}

func RegisterRemoteFactory(factory RemoteFactory) {
	factoryMu.Lock()
	defer factoryMu.Unlock()
	remoteFactory = factory
}

func BuildFacade(cfg *envconf.Loaded, store *runtimestate.Store) (RuntimeFacade, error) {
	if cfg == nil {
		return nil, fmt.Errorf("runtime config is required")
	}
	factoryMu.RLock()
	bundled := bundledFactory
	remote := remoteFactory
	factoryMu.RUnlock()
	switch cfg.Mode {
	case envconf.ModeBundled:
		if bundled == nil {
			return nil, fmt.Errorf("bundled runtime factory is not registered")
		}
		return bundled(&cfg.Bundled)
	case envconf.ModeRemote:
		if remote == nil {
			return nil, fmt.Errorf("remote runtime factory is not registered")
		}
		return remote(cfg.Remote, store), nil
	default:
		return nil, fmt.Errorf("unsupported runtime mode %q", cfg.Mode)
	}
}
