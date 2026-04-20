package gateway

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"
)

type storedDeviceIdentity struct {
	Version       int    `json:"version"`
	DeviceID      string `json:"deviceId"`
	PublicKeyPEM  string `json:"publicKeyPem"`
	PrivateKeyPEM string `json:"privateKeyPem"`
	CreatedAtMS   int64  `json:"createdAtMs"`
}

type deviceIdentity struct {
	deviceID      string
	publicKeyPEM  string
	privateKeyPEM string
}

func loadOrCreateDeviceIdentity() (*deviceIdentity, error) {
	path, err := resolveDeviceIdentityPath()
	if err != nil {
		return nil, err
	}
	raw, err := os.ReadFile(path)
	if err == nil {
		var parsed storedDeviceIdentity
		if json.Unmarshal(raw, &parsed) == nil &&
			parsed.Version == 1 &&
			strings.TrimSpace(parsed.PublicKeyPEM) != "" &&
			strings.TrimSpace(parsed.PrivateKeyPEM) != "" {
			deviceID, err := deriveDeviceID(parsed.PublicKeyPEM)
			if err == nil {
				if deviceID != parsed.DeviceID {
					parsed.DeviceID = deviceID
					_ = persistDeviceIdentity(path, parsed)
				}
				return &deviceIdentity{
					deviceID:      deviceID,
					publicKeyPEM:  parsed.PublicKeyPEM,
					privateKeyPEM: parsed.PrivateKeyPEM,
				}, nil
			}
		}
	}
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return nil, err
	}

	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, err
	}
	publicDER, err := x509.MarshalPKIXPublicKey(publicKey)
	if err != nil {
		return nil, err
	}
	privateDER, err := x509.MarshalPKCS8PrivateKey(privateKey)
	if err != nil {
		return nil, err
	}
	publicKeyPEM := string(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: publicDER}))
	privateKeyPEM := string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: privateDER}))
	sum := sha256.Sum256(publicKey)
	deviceID := hex.EncodeToString(sum[:])
	stored := storedDeviceIdentity{
		Version:       1,
		DeviceID:      deviceID,
		PublicKeyPEM:  publicKeyPEM,
		PrivateKeyPEM: privateKeyPEM,
		CreatedAtMS:   time.Now().UnixMilli(),
	}
	if err := persistDeviceIdentity(path, stored); err != nil {
		return nil, err
	}
	return &deviceIdentity{
		deviceID:      deviceID,
		publicKeyPEM:  publicKeyPEM,
		privateKeyPEM: privateKeyPEM,
	}, nil
}

func resolveDeviceIdentityPath() (string, error) {
	baseDir := os.Getenv("DECK_GO_DATA_DIR")
	if strings.TrimSpace(baseDir) == "" {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		baseDir = filepath.Join(homeDir, ".openclaw", "deck-go")
	}
	return filepath.Join(baseDir, "identity", "device.json"), nil
}

func persistDeviceIdentity(path string, stored storedDeviceIdentity) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(stored, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(path, append(raw, '\n'), 0o600); err != nil {
		return err
	}
	_ = os.Chmod(path, 0o600)
	return nil
}

func deriveDeviceID(publicKeyPEM string) (string, error) {
	raw, err := parsePublicKey(publicKeyPEM)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:]), nil
}

func parsePublicKey(publicKeyPEM string) (ed25519.PublicKey, error) {
	block, _ := pem.Decode([]byte(publicKeyPEM))
	if block == nil {
		return nil, errors.New("invalid public key pem")
	}
	key, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, err
	}
	publicKey, ok := key.(ed25519.PublicKey)
	if !ok {
		return nil, errors.New("public key is not ed25519")
	}
	return publicKey, nil
}

func signDevicePayload(privateKeyPEM string, payload string) (string, error) {
	block, _ := pem.Decode([]byte(privateKeyPEM))
	if block == nil {
		return "", errors.New("invalid private key pem")
	}
	keyAny, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return "", err
	}
	privateKey, ok := keyAny.(ed25519.PrivateKey)
	if !ok {
		return "", errors.New("private key is not ed25519")
	}
	signature := ed25519.Sign(privateKey, []byte(payload))
	return base64.RawURLEncoding.EncodeToString(signature), nil
}

func publicKeyRawBase64URLFromPEM(publicKeyPEM string) (string, error) {
	publicKey, err := parsePublicKey(publicKeyPEM)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(publicKey), nil
}

func buildDeviceAuthPayloadV3(params struct {
	deviceID   string
	clientID   string
	clientMode string
	role       string
	scopes     []string
	signedAtMS int64
	token      string
	nonce      string
}) string {
	return strings.Join([]string{
		"v3",
		params.deviceID,
		params.clientID,
		params.clientMode,
		params.role,
		strings.Join(params.scopes, ","),
		strconvFormatInt(params.signedAtMS),
		params.token,
		params.nonce,
		runtime.GOOS,
		"",
	}, "|")
}

func strconvFormatInt(value int64) string {
	return strconv.FormatInt(value, 10)
}
