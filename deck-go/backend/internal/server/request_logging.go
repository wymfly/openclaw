package server

import (
	"context"
	"log"
	"net/http"
	"time"
)

type requestLogMetaKey struct{}

type requestLogMeta struct {
	sensitiveBody bool
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

func (r *statusRecorder) Write(body []byte) (int, error) {
	if r.status == 0 {
		r.status = http.StatusOK
	}
	return r.ResponseWriter.Write(body)
}

func (r *statusRecorder) Flush() {
	if flusher, ok := r.ResponseWriter.(http.Flusher); ok {
		flusher.Flush()
	}
}

func accessLogMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		meta := &requestLogMeta{}
		req = req.WithContext(context.WithValue(req.Context(), requestLogMetaKey{}, meta))
		rec := &statusRecorder{ResponseWriter: w}
		started := time.Now()

		next.ServeHTTP(rec, req)

		auth := "absent"
		if req.Header.Get("Authorization") != "" {
			auth = "redacted"
		}
		body := "omitted"
		if meta.sensitiveBody {
			body = "redacted"
		}
		status := rec.status
		if status == 0 {
			status = http.StatusOK
		}
		log.Printf(
			"access method=%s path=%s status=%d duration=%s authorization=%s request_body=%s",
			req.Method,
			req.URL.Path,
			status,
			time.Since(started).Round(time.Millisecond),
			auth,
			body,
		)
	})
}

func sensitiveBody(handler http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		if meta, ok := req.Context().Value(requestLogMetaKey{}).(*requestLogMeta); ok && meta != nil {
			meta.sensitiveBody = true
		}
		handler(w, req)
	}
}
