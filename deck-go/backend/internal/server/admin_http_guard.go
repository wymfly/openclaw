package server

import "net/http"

func registerAdminHTTPGuardRoutes(mux interface {
	MethodFunc(string, string, http.HandlerFunc)
}) {
	notFound := func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	}
	for _, method := range []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete} {
		mux.MethodFunc(method, "/admin/*", notFound)
		mux.MethodFunc(method, "/runtime/admin", notFound)
		mux.MethodFunc(method, "/runtime/admin/*", notFound)
		mux.MethodFunc(method, "/internal/admin/*", notFound)
	}
}
