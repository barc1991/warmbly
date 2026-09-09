//go:build !windows

package main

import (
	"os"
	"syscall"
)

// lockIDFile takes a non-blocking exclusive flock on the given file.
func lockIDFile(f *os.File) error {
	return syscall.Flock(int(f.Fd()), syscall.LOCK_EX|syscall.LOCK_NB)
}
