package privatefile

import (
	"fmt"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"runtime"
	"strings"
)

func CheckExisting(path string) error {
	info, err := os.Stat(path)
	if err != nil {
		return err
	}
	if info.IsDir() {
		return fmt.Errorf("%s is a directory, expected file", path)
	}
	if runtime.GOOS == "windows" {
		return AuditOwnerOnlyRead(path)
	}
	if info.Mode().Perm()&0o077 != 0 {
		return fmt.Errorf("%s permissions must be 0600 or stricter", filepath.Clean(path))
	}
	return nil
}

func SecureDir(path string) error {
	if runtime.GOOS == "windows" {
		return applyWindowsOwnerOnlyACL(path, true)
	}
	return os.Chmod(path, 0o700)
}

func SecureFile(path string) error {
	if runtime.GOOS == "windows" {
		return applyWindowsOwnerOnlyACL(path, false)
	}
	return os.Chmod(path, 0o600)
}

func AuditOwnerOnlyRead(path string) error {
	current, err := user.Current()
	if err != nil {
		return fmt.Errorf("%s permissions could not resolve current user: %w", filepath.Clean(path), err)
	}
	output, err := exec.Command("icacls", path).CombinedOutput()
	if err != nil {
		return fmt.Errorf("%s permissions could not be checked with icacls: %w", filepath.Clean(path), err)
	}
	if principal := FirstDisallowedWindowsReadPrincipal(string(output), path, current.Username); principal != "" {
		return fmt.Errorf("%s ACL grants read access to %s; expected owner-only DACL", filepath.Clean(path), principal)
	}
	return nil
}

func applyWindowsOwnerOnlyACL(path string, directory bool) error {
	current, err := user.Current()
	if err != nil {
		return fmt.Errorf("%s permissions could not resolve current user: %w", filepath.Clean(path), err)
	}
	permission := ":F"
	if directory {
		permission = ":(OI)(CI)F"
	}
	args := []string{
		path,
		"/inheritance:r",
		"/grant:r",
		current.Username + permission,
		"NT AUTHORITY\\SYSTEM" + permission,
		"BUILTIN\\Administrators" + permission,
	}
	if output, err := exec.Command("icacls", args...).CombinedOutput(); err != nil {
		return fmt.Errorf("%s permissions could not be applied with icacls: %w (%s)", filepath.Clean(path), err, strings.TrimSpace(string(output)))
	}
	return AuditOwnerOnlyRead(path)
}

func FirstDisallowedWindowsReadPrincipal(output string, path string, currentUser string) string {
	for _, line := range strings.Split(output, "\n") {
		principal, rights, ok := parseICACLSACE(line, path)
		if !ok || !windowsACEHasRead(rights) {
			continue
		}
		if !allowedWindowsACLPrincipal(principal, currentUser) {
			return principal
		}
	}
	return ""
}

func parseICACLSACE(line string, path string) (string, string, bool) {
	trimmed := strings.TrimSpace(line)
	if trimmed == "" || strings.HasPrefix(trimmed, "Successfully processed") || strings.HasPrefix(trimmed, "No files failed") {
		return "", "", false
	}
	cleanPath := filepath.Clean(path)
	if strings.HasPrefix(strings.ToLower(trimmed), strings.ToLower(cleanPath)) {
		trimmed = strings.TrimSpace(trimmed[len(cleanPath):])
	}
	idx := strings.Index(trimmed, ":(")
	if idx <= 0 {
		return "", "", false
	}
	return strings.TrimSpace(trimmed[:idx]), trimmed[idx+1:], true
}

func windowsACEHasRead(rights string) bool {
	upper := strings.ToUpper(rights)
	if strings.Contains(upper, "(DENY)") || strings.Contains(upper, "(N)") {
		return false
	}
	for _, marker := range []string{"(F)", "(M)", "(RX)", "(R)", "(GR)", "(RD)"} {
		if strings.Contains(upper, marker) {
			return true
		}
	}
	return false
}

func allowedWindowsACLPrincipal(principal string, currentUser string) bool {
	normalized := strings.ToUpper(strings.TrimSpace(principal))
	current := strings.ToUpper(strings.TrimSpace(currentUser))
	if normalized == current {
		return true
	}
	switch normalized {
	case "SYSTEM", "NT AUTHORITY\\SYSTEM", "ADMINISTRATORS", "BUILTIN\\ADMINISTRATORS":
		return true
	default:
		return false
	}
}
