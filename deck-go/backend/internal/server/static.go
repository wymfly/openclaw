package server

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

func registerStaticRoutes(mux interface{ Handle(string, http.Handler) }) {
	distDir := resolveFrontendDistDir()
	if distDir == "" {
		return
	}
	fileServer := http.FileServer(http.Dir(distDir))
	mux.Handle("/*", spaFileServer(distDir, fileServer))
}

func resolveFrontendDistDir() string {
	if explicit := strings.TrimSpace(os.Getenv("DECK_GO_FRONTEND_DIST")); explicit != "" {
		if info, err := os.Stat(explicit); err == nil && info.IsDir() {
			return explicit
		}
	}
	candidates := []string{
		filepath.Clean("../frontend/dist"),
		filepath.Clean("frontend/dist"),
	}
	for _, candidate := range candidates {
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
	}
	return ""
}

func spaFileServer(distDir string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") || r.URL.Path == "/healthz" {
			http.NotFound(w, r)
			return
		}

		candidate := filepath.Join(distDir, filepath.Clean(strings.TrimPrefix(r.URL.Path, "/")))
		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			next.ServeHTTP(w, r)
			return
		}
		http.ServeFile(w, r, filepath.Join(distDir, "index.html"))
	})
}

