package main

import (
	"log"
	"net/http"
	"os"

	"github.com/openclaw/openclaw/deck-go/backend/internal/controld"
)

func main() {
	addr := controld.ResolveListenAddr(os.Getenv)

	log.Printf("deck-go backend listening on http://%s", addr)
	if err := http.ListenAndServe(addr, controld.NewHandler()); err != nil {
		log.Fatal(err)
	}
}
