package main

import (
	"log"
	"net/http"
	"os"

	"github.com/openclaw/openclaw/deck-go/backend/internal/server"
)

func main() {
	addr := os.Getenv("DECK_GO_ADDR")
	if addr == "" {
		addr = "127.0.0.1:19528"
	}

	srv := server.New()
	log.Printf("deck-go backend listening on http://%s", addr)
	if err := http.ListenAndServe(addr, srv); err != nil {
		log.Fatal(err)
	}
}

