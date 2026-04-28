package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/openclaw/openclaw/deck-go/backend/internal/controld"
)

func main() {
	addr := controld.ResolveListenAddr(os.Getenv)
	deps, err := controld.NewDependencies()
	if err != nil {
		log.Fatal(err)
	}
	handler := controld.NewHandlerWithDependencies(deps)
	server := &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := controld.RunServer(ctx, server, deps.Runtime, "deck-go backend"); err != nil {
		log.Fatal(err)
	}
}
