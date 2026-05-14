package server

import (
	"context"
	"crypto/tls"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
)

const (
	gatewayAssetsRoutePrefix    = "/api/runtime/gateway-assets/"
	gatewayAssetsUpstreamPrefix = "/admin/assets/"
	gatewayA2UIUpstreamPrefix   = "/__openclaw__/a2ui/"
	gatewayCanvasUpstreamPrefix = "/__openclaw__/canvas/"
)

type gatewayConnectionProvider interface {
	GatewayConnection(context.Context) (facade.GatewayConnection, error)
}

func registerGatewayAssetsProxyRoutes(
	mux interface {
		MethodFunc(string, string, http.HandlerFunc)
	},
	runtimeFacade facade.RuntimeFacade,
) {
	provider, ok := runtimeFacade.(gatewayConnectionProvider)
	if !ok {
		return
	}
	handler := gatewayAssetsProxyHandler(provider)
	mux.MethodFunc(http.MethodGet, "/runtime/gateway-assets/*", handler)
	for _, method := range []string{http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete} {
		mux.MethodFunc(method, "/runtime/gateway-assets/*", func(w http.ResponseWriter, _ *http.Request) {
			writeRuntimeError(w, http.StatusMethodNotAllowed, "method_not_allowed", "gateway assets only support GET")
		})
	}
}

func gatewayAssetsProxyHandler(provider gatewayConnectionProvider) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := provider.GatewayConnection(r.Context())
		if err != nil {
			writeRuntimeFacadeError(w, err)
			return
		}
		targetURL, err := gatewayAssetsTargetURL(conn.URL, r.URL.Path, r.URL.RawQuery)
		if err != nil {
			if errors.Is(err, facade.ErrNotConfigured) {
				writeRuntimeFacadeError(w, err)
				return
			}
			writeRuntimeError(w, http.StatusBadGateway, "gateway_assets_endpoint_invalid", "gateway assets endpoint is invalid")
			return
		}
		req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, targetURL, nil)
		if err != nil {
			writeRuntimeError(w, http.StatusBadGateway, "gateway_assets_request_failed", "failed to build gateway assets request")
			return
		}
		copyGatewayAssetRequestHeaders(req, r)
		if strings.TrimSpace(conn.Token) != "" {
			req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(conn.Token))
		}
		res, err := gatewayAssetsHTTPClient(conn.TLSVerify).Do(req)
		if err != nil {
			writeRuntimeError(w, http.StatusBadGateway, "gateway_assets_unreachable", "gateway assets endpoint is unreachable")
			return
		}
		defer res.Body.Close()
		copyGatewayAssetResponseHeaders(w.Header(), res.Header)
		w.WriteHeader(res.StatusCode)
		_, _ = io.Copy(w, res.Body)
	}
}

func gatewayAssetsTargetURL(rawEndpoint string, requestPath string, rawQuery string) (string, error) {
	endpoint := strings.TrimSpace(rawEndpoint)
	if endpoint == "" {
		return "", facade.ErrNotConfigured
	}
	if strings.HasPrefix(endpoint, "ws://") {
		endpoint = "http://" + strings.TrimPrefix(endpoint, "ws://")
	} else if strings.HasPrefix(endpoint, "wss://") {
		endpoint = "https://" + strings.TrimPrefix(endpoint, "wss://")
	}
	parsed, err := url.Parse(endpoint)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return "", err
	}
	subPath := strings.TrimPrefix(requestPath, gatewayAssetsRoutePrefix)
	parsed.Path = strings.TrimRight(parsed.Path, "/") + gatewayAssetsUpstreamPath(subPath)
	parsed.RawQuery = rawQuery
	return parsed.String(), nil
}

func gatewayAssetsUpstreamPath(subPath string) string {
	switch {
	case subPath == "a2ui" || strings.HasPrefix(subPath, "a2ui/"):
		return gatewayA2UIUpstreamPrefix + strings.TrimPrefix(strings.TrimPrefix(subPath, "a2ui"), "/")
	case subPath == "canvas" || strings.HasPrefix(subPath, "canvas/"):
		return gatewayCanvasUpstreamPrefix + strings.TrimPrefix(strings.TrimPrefix(subPath, "canvas"), "/")
	default:
		return gatewayAssetsUpstreamPrefix + subPath
	}
}

func copyGatewayAssetRequestHeaders(dst *http.Request, src *http.Request) {
	for _, key := range []string{"Accept", "Accept-Encoding", "If-None-Match", "If-Modified-Since", "Range"} {
		if value := src.Header.Get(key); value != "" {
			dst.Header.Set(key, value)
		}
	}
}

func copyGatewayAssetResponseHeaders(dst http.Header, src http.Header) {
	for _, key := range []string{"Content-Type", "Content-Length", "Cache-Control", "ETag", "Last-Modified"} {
		if value := src.Get(key); value != "" {
			dst.Set(key, value)
		}
	}
}

func gatewayAssetsHTTPClient(tlsVerify bool) *http.Client {
	if tlsVerify {
		return http.DefaultClient
	}
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
	return &http.Client{Transport: transport}
}
