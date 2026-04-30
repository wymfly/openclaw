//go:build !windows

package bundled

import (
	"os/exec"
	"syscall"
)

func configureManagedProcessGroup(cmd *exec.Cmd) {
	if cmd == nil {
		return
	}
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
}

func interruptManagedProcess(cmd *exec.Cmd) error {
	return signalManagedProcessGroup(cmd, syscall.SIGINT)
}

func killManagedProcessGroup(cmd *exec.Cmd) error {
	return signalManagedProcessGroup(cmd, syscall.SIGKILL)
}

func interruptManagedPID(pid int) error {
	return signalManagedPIDGroup(pid, syscall.SIGINT)
}

func killManagedPIDGroup(pid int) error {
	return signalManagedPIDGroup(pid, syscall.SIGKILL)
}

func signalManagedProcessGroup(cmd *exec.Cmd, signal syscall.Signal) error {
	if cmd == nil || cmd.Process == nil {
		return nil
	}
	if cmd.Process.Pid > 0 {
		if err := syscall.Kill(-cmd.Process.Pid, signal); err == nil {
			return nil
		}
	}
	return cmd.Process.Signal(signal)
}

func signalManagedPIDGroup(pid int, signal syscall.Signal) error {
	if pid <= 0 {
		return nil
	}
	if err := syscall.Kill(-pid, signal); err == nil {
		return nil
	}
	return syscall.Kill(pid, signal)
}

func managedProcessAlive(pid int) bool {
	if pid <= 0 {
		return false
	}
	err := syscall.Kill(pid, 0)
	return err == nil || err == syscall.EPERM
}
