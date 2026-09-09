#!/bin/sh
# Everything CI should know about the fleet join script.
#
# The script is served verbatim from the backend at GET /join.sh and is what a
# stranger pipes into a root shell to add a machine, which makes it the
# highest-consequence file in the repo that is not Go. Nothing else covered it,
# and that is how a systemd unit that could never start, an env file with a
# stray JSON fragment in it, and a state directory the node could not write all
# reached the branch at once.
#
# What is checked:
#   - POSIX parse under dash, which is /bin/sh on Debian and Ubuntu
#   - shellcheck, in sh mode
#   - --help exits 0 and says something
#   - the generated systemd unit is ONE ExecStart line with the image as a
#     systemd variable, not a command substitution systemd would never expand
#   - the mount list always includes the agent directory
#   - a relative BLOB_FS_ROOT is refused rather than mounted
set -eu

SCRIPT="internal/api/handler/nodescript/join.sh"
fail() { printf 'check-join-script: %s\n' "$*" >&2; exit 1; }
ok()   { printf '  ok  %s\n' "$*"; }

[ -f "$SCRIPT" ] || fail "$SCRIPT not found (run from the repository root)"

# POSIX parse. sh -n under a non-POSIX shell proves nothing about dash.
if command -v dash >/dev/null 2>&1; then
  dash -n "$SCRIPT" || fail "dash -n failed"
  ok "dash -n"
else
  sh -n "$SCRIPT" || fail "sh -n failed"
  printf '  --  dash not installed; used sh -n instead\n'
fi

if command -v shellcheck >/dev/null 2>&1; then
  shellcheck -s sh "$SCRIPT" || fail "shellcheck failed"
  ok "shellcheck -s sh"
else
  printf '  --  shellcheck not installed; skipped\n'
fi

out=$(sh "$SCRIPT" --help) || fail "--help exited non-zero"
printf '%s' "$out" | grep -q -- "--token" || fail "--help does not document --token"
ok "--help"

# Everything below asserts on what the script RENDERS, never on its source
# text. A previous version of this file checked a heredoc copied in here, which
# meant putting the original `$(cat ...)` bug back left it passing green.
unit=$(sh "$SCRIPT" --print-unit) || fail "--print-unit failed"

printf '%s\n' "$unit" | grep -q 'ExecStart=.*\${WARMBLY_IMAGE_REF}$' \
  || fail "ExecStart must end with the systemd variable \${WARMBLY_IMAGE_REF}"
if printf '%s\n' "$unit" | grep -q 'ExecStart=.*\$('; then
  fail "ExecStart contains a command substitution; systemd never expands one"
fi
[ "$(printf '%s\n' "$unit" | grep -c '^ExecStart=')" = "1" ] \
  || fail "ExecStart must be exactly one line"
printf '%s\n' "$unit" | grep -q '^EnvironmentFile=.*/image-ref$' \
  || fail "the unit must read the image reference from an EnvironmentFile"
printf '%s\n' "$unit" | grep -q 'ExecStart=.*-v /var/lib/warmbly/node:/var/lib/warmbly/node' \
  || fail "the agent directory must always be mounted, or auto-update stops silently"
ok "rendered unit (no blob mount)"

# With local blobs the root has to be mounted too, and the line must still be
# one line: a multi-line mount list is how the continuation collapsed before.
unit=$(NODE_ENV="BLOB_PROVIDER=fs
BLOB_FS_ROOT=/var/lib/warmbly/blobs" sh "$SCRIPT" --print-unit) || fail "--print-unit with blobs failed"
printf '%s\n' "$unit" | grep -q 'ExecStart=.*-v /var/lib/warmbly/blobs:/var/lib/warmbly/blobs' \
  || fail "BLOB_FS_ROOT must be mounted (the fs alias counts as filesystem)"
[ "$(printf '%s\n' "$unit" | grep -c '^ExecStart=')" = "1" ] \
  || fail "ExecStart must stay one line when a blob mount is added"
ok "rendered unit (fs alias + blob mount)"

# A relative root is refused rather than rendered into a mount docker rejects.
if NODE_ENV="BLOB_PROVIDER=filesystem
BLOB_FS_ROOT=data/blobs" sh "$SCRIPT" --print-unit >/dev/null 2>&1; then
  fail "a relative BLOB_FS_ROOT must be refused, not mounted"
fi
ok "relative BLOB_FS_ROOT refused"

printf 'check-join-script: all checks passed\n'
