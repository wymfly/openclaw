package privatefile

import (
	"strings"
	"testing"
)

func TestWindowsACLParserRejectsReadGrantsToOtherPrincipals(t *testing.T) {
	output := strings.Join([]string{
		`C:\deck\.env BUILTIN\Administrators:(I)(F)`,
		`            NT AUTHORITY\SYSTEM:(I)(F)`,
		`            DESKTOP\Alice:(I)(F)`,
		`            Everyone:(I)(RX)`,
		`Successfully processed 1 files; Failed processing 0 files`,
	}, "\n")

	offender := FirstDisallowedWindowsReadPrincipal(output, `C:\deck\.env`, `DESKTOP\Alice`)
	if offender != "Everyone" {
		t.Fatalf("offender = %q, want Everyone", offender)
	}
}

func TestWindowsACLParserAllowsOwnerSystemAndAdministrators(t *testing.T) {
	output := strings.Join([]string{
		`C:\deck\.env BUILTIN\Administrators:(I)(F)`,
		`            NT AUTHORITY\SYSTEM:(I)(F)`,
		`            DESKTOP\Alice:(I)(F)`,
		`            Everyone:(DENY)(R)`,
	}, "\n")

	if offender := FirstDisallowedWindowsReadPrincipal(output, `C:\deck\.env`, `DESKTOP\Alice`); offender != "" {
		t.Fatalf("offender = %q, want none", offender)
	}
}
