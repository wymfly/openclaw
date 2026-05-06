package audit

import (
	"net/http"
	"strings"
	"time"
)

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

func (r *statusRecorder) Write(data []byte) (int, error) {
	if r.status == 0 {
		r.status = http.StatusOK
	}
	return r.ResponseWriter.Write(data)
}

func Middleware(log *Log) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !IsMutation(r.Method) {
				next.ServeHTTP(w, r)
				return
			}
			start := time.Now()
			recorder := &statusRecorder{ResponseWriter: w}
			next.ServeHTTP(recorder, r)
			status := recorder.status
			if status == 0 {
				status = http.StatusOK
			}
			log.Append(Entry{
				RequestID:  requestID(r),
				Actor:      actor(r),
				Method:     r.Method,
				Path:       r.URL.Path,
				Action:     Action(r.Method, r.URL.Path),
				Target:     Target(r.URL.Path),
				StatusCode: status,
				OK:         status >= 200 && status < 400,
				DurationMs: time.Since(start).Milliseconds(),
			})
		})
	}
}

func requestID(r *http.Request) string {
	for _, header := range []string{"X-Request-Id", "X-Request-ID", "X-Correlation-Id"} {
		if value := strings.TrimSpace(r.Header.Get(header)); value != "" {
			return value
		}
	}
	return "req-" + time.Now().UTC().Format("20060102T150405.000000000Z")
}

func actor(r *http.Request) string {
	if value := strings.TrimSpace(r.Header.Get("X-Deck-Actor")); value != "" {
		return value
	}
	return "deck-operator"
}
