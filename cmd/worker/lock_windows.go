//go:build windows

package main

import (
	"os"

	"golang.org/x/sys/windows"
)

// lockIDFile takes a non-blocking exclusive lock on the given file on Windows.
func lockIDFile(f *os.File) error {
	var overlapped windows.Overlapped
	return windows.LockFileEx(
		windows.Handle(f.Fd()),
		windows.LOCKFILE_EXCLUSIVE_LOCK|windows.LOCKFILE_FAIL_IMMEDIATELY,
		0,
		1,
		0,
		&overlapped,
	)
}
