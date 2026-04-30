package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/openclaw/openclaw/deck-go/backend/internal/admin"
	"github.com/openclaw/openclaw/deck-go/backend/internal/controld"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/envconf"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
	runtimestate "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/state"
)

func main() {
	if len(os.Args) > 1 && os.Args[1] == "admin" {
		os.Exit(runAdmin(os.Args[2:]))
	}

	addr := controld.ResolveListenAddr(os.Getenv)
	loaded, err := envconf.Load(envconf.Options{})
	if err != nil {
		log.Print(err)
		os.Exit(envconf.ExitCode(err))
	}
	if err := controld.ValidateListenAddrSecurity(addr, os.Getenv); err != nil {
		log.Print(err)
		os.Exit(64)
	}
	runtimeFacade, err := facade.BuildFacade(&loaded, runtimestate.Open(controld.ResolveDeckStatePath()))
	if err != nil {
		log.Print(err)
		os.Exit(envconf.ExitCode(err))
	}
	deps, err := controld.NewDependenciesWithRuntimeFacade(loaded, runtimeFacade)
	if err != nil {
		log.Print(err)
		os.Exit(envconf.ExitCode(err))
	}
	handler := controld.NewHandlerWithDependencies(deps)
	server := &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	adminSocket, err := admin.StartSocketServer(ctx, admin.SocketOptions{
		Path:    admin.EnvSocketPath(os.Getenv),
		Group:   admin.EnvSocketGroup(os.Getenv),
		Runtime: deps.RuntimeFacade,
		Logf:    log.Printf,
	})
	if err != nil {
		log.Print(err)
		os.Exit(64)
	}
	defer adminSocket.Close()

	if err := controld.RunServer(ctx, server, deps.RuntimeFacade, "deck-go backend"); err != nil {
		log.Fatal(err)
	}
}
