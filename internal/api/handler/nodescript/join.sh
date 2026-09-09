#!/bin/sh
# Join this machine to a Warmbly fleet.
#
#   curl -fsSL https://<your-instance>/join.sh | sh -s -- \
#     --url https://<your-instance> --token <join-token> --role worker
#
# It asks the control plane to enrol the machine, writes the config the control
# plane hands back, installs a systemd service for the role and a timer that
# keeps it on the version the control plane wants, and starts it.
#
# Nothing is pushed to this machine, before or after. No inbound port is
# opened, no SSH key is installed, and the only credential involved is the join
# token, which is used once and never stored.
#
# POSIX sh: this runs under whatever /bin/sh the host has, which on Debian and
# Ubuntu is dash.
set -eu

WARMBLY_URL=""
WARMBLY_TOKEN=""
WARMBLY_ROLE=""
WARMBLY_REGION=""
WARMBLY_NAME=""
WARMBLY_IMAGE_REPO="ghcr.io/warmbly/warmbly"
CONFIG_DIR="/etc/warmbly"
STATE_DIR="/var/lib/warmbly"
# What the container may write. Kept separate from STATE_DIR because STATE_DIR
# also holds image-ref, which systemd feeds to a root `docker run`: anything
# the node can rewrite there would choose the image root then executes.
AGENT_DIR="/var/lib/warmbly/node"
DRY_RUN="false"

log()  { printf '%s\n' "$*"; }
warn() { printf '%s\n' "$*" >&2; }
die()  { printf 'error: %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'USAGE'
Join a machine to a Warmbly fleet.

  --url <url>        Your Warmbly instance, e.g. https://app.example.com  (required)
  --token <token>    Fleet join token. Issue one in Fleet settings, or with
                     `warmblyctl fleet join-token`.                        (required)
  --role <role>      worker | consumer                                     (required)
  --region <label>   Where this machine egresses from, e.g. eu-central.
                     Placement prefers a worker near where a mailbox's
                     provider expects sign-ins. Optional.
  --name <name>      Display name in the dashboard. Defaults to the hostname.
  --image-repo <r>   Container image repository. Defaults to
                     ghcr.io/warmbly/warmbly.
  --config-dir <d>   Where to write the env file. Default /etc/warmbly.
  --dry-run          Enrol and print what would be written, change nothing.
  -h, --help         This text.

A second run re-enrols the same machine: it keeps the existing node id, so the
node keeps its identity, history and mailbox placements.
USAGE
}

parse_args() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --url)         WARMBLY_URL="${2:-}"; shift 2 ;;
      --token)       WARMBLY_TOKEN="${2:-}"; shift 2 ;;
      --role)        WARMBLY_ROLE="${2:-}"; shift 2 ;;
      --region)      WARMBLY_REGION="${2:-}"; shift 2 ;;
      --name)        WARMBLY_NAME="${2:-}"; shift 2 ;;
      --image-repo)  WARMBLY_IMAGE_REPO="${2:-}"; shift 2 ;;
      --config-dir)  CONFIG_DIR="${2:-}"; shift 2 ;;
      --dry-run)     DRY_RUN="true"; shift ;;
      -h|--help)     usage; exit 0 ;;
      *)             die "unknown option: $1 (try --help)" ;;
    esac
  done
}

require_args() {
  [ -n "$WARMBLY_URL" ]   || die "--url is required"
  [ -n "$WARMBLY_TOKEN" ] || die "--token is required"
  [ -n "$WARMBLY_ROLE" ]  || die "--role is required (worker or consumer)"
  case "$WARMBLY_ROLE" in
    worker|consumer) ;;
    *) die "--role must be worker or consumer, got '$WARMBLY_ROLE'" ;;
  esac
  [ -n "$WARMBLY_NAME" ] || WARMBLY_NAME="$(hostname 2>/dev/null || echo warmbly-node)"
  # Trim a trailing slash so the URLs we build never double up.
  WARMBLY_URL="${WARMBLY_URL%/}"
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "$1 is required but not installed"
}

check_deps() {
  need_cmd curl
  if [ "$DRY_RUN" = "false" ]; then
    command -v docker >/dev/null 2>&1 || die "docker is required but not installed. Install it, then re-run."
    command -v systemctl >/dev/null 2>&1 || die "systemd is required (this script installs a service and a timer)"
    [ "$(id -u)" = "0" ] || die "run as root: this writes to $CONFIG_DIR and installs a systemd unit"
  fi
}

# json_field extracts a top-level string field. The join response is generated
# by our own backend and is a flat object, so this stays honest without pulling
# in a JSON parser the host may not have.
json_field() {
  # shellcheck disable=SC2016
  sed -n 's/.*"'"$1"'"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1
}

# b64decode reads base64 on stdin. coreutils is the norm; openssl is the
# fallback for the images that ship without it.
b64decode() {
  if command -v base64 >/dev/null 2>&1; then
    base64 -d
  else
    openssl base64 -d -A
  fi
}

existing_node_id() {
  if [ -f "$CONFIG_DIR/node.env" ]; then
    sed -n 's/^WARMBLY_NODE_ID=//p' "$CONFIG_DIR/node.env" | head -n 1
  fi
}

enrol() {
  prior="$(existing_node_id)"
  if [ -n "$prior" ]; then
    log "Re-joining as existing node $prior"
  fi

  body=$(printf '{"token":"%s","role":"%s","region":"%s","name":"%s","node_id":"%s"}' \
    "$WARMBLY_TOKEN" "$WARMBLY_ROLE" "$WARMBLY_REGION" "$WARMBLY_NAME" "$prior")

  tmp="$(mktemp)"
  code=$(curl -sS -o "$tmp" -w '%{http_code}' \
    -X POST "$WARMBLY_URL/api/v1/fleet/join" \
    -H 'Content-Type: application/json' \
    -d "$body" || echo 000)

  if [ "$code" = "000" ]; then
    rm -f "$tmp"
    die "could not reach $WARMBLY_URL. Check the URL and that this machine can reach it."
  fi
  if [ "$code" != "200" ]; then
    detail=$(json_field message < "$tmp")
    [ -n "$detail" ] || detail=$(cat "$tmp")
    rm -f "$tmp"
    case "$code" in
      401) die "the join token was rejected. Issue a fresh one and try again." ;;
      *)   die "enrolment failed (HTTP $code): $detail" ;;
    esac
  fi

  NODE_ID=$(json_field node_id < "$tmp")
  DESIRED_VERSION=$(json_field desired_version < "$tmp")
  # The env file arrives base64 encoded, so a shell with no JSON parser can
  # recover it exactly. Decoding is one command; picking a multi-line,
  # quote-bearing value back out of JSON with sed is guesswork.
  NODE_ENV=$(json_field env_b64 < "$tmp" | b64decode)
  rm -f "$tmp"

  [ -n "$NODE_ID" ] || die "the control plane did not return a node id"
  [ -n "$NODE_ENV" ] || die "the control plane returned no configuration for this node"
  [ -n "$DESIRED_VERSION" ] || DESIRED_VERSION="latest"
  log "Enrolled as $WARMBLY_ROLE node $NODE_ID"
}

write_config() {
  if [ "$DRY_RUN" = "true" ]; then
    log ""
    log "--dry-run: would write $CONFIG_DIR/node.env with:"
    printf '%s\n' "$NODE_ENV" | sed 's/\(TOKEN=\|KEY=\|SECRET=\|PASSWORD=\).*/\1***/' | sed 's/^/    /'
    log ""
    log "--dry-run: would run image $WARMBLY_IMAGE_REPO/$WARMBLY_ROLE:$DESIRED_VERSION"
    return 0
  fi

  mkdir -p "$CONFIG_DIR" "$STATE_DIR" "$AGENT_DIR"
  # The node container runs as uid 1000 (deploy/docker/worker.Dockerfile), so
  # the directory it writes into has to be owned by that uid, or its
  # target-version write fails with EACCES, which it only logs, and auto-update
  # silently never happens.
  #
  # Only this subdirectory, never STATE_DIR itself: a recursive chown there
  # would re-own a bare-metal install's BLOB_FS_ROOT, and making STATE_DIR
  # container-writable would let the node rewrite the image reference that
  # systemd hands to a root `docker run --network host`.
  chown 1000:1000 "$AGENT_DIR" 2>/dev/null || true
  chmod 0700 "$AGENT_DIR"
  umask 077
  {
    printf '%s\n' "$NODE_ENV"
    printf 'WARMBLY_VERSION=%s\n' "$DESIRED_VERSION"
    printf 'WARMBLY_TARGET_VERSION_PATH=%s/target-version\n' "$AGENT_DIR"
    printf 'WARMBLY_NODE_NAME=%s\n' "$WARMBLY_NAME"
  } > "$CONFIG_DIR/node.env"
  chmod 600 "$CONFIG_DIR/node.env"

  printf '%s\n' "$DESIRED_VERSION" > "$AGENT_DIR/target-version"
  chown 1000:1000 "$AGENT_DIR/target-version" 2>/dev/null || true
  printf '%s\n' "$WARMBLY_IMAGE_REPO/$WARMBLY_ROLE" > "$STATE_DIR/image"
  # systemd performs no command substitution, so the image reference has to
  # reach the unit as an environment variable it can expand itself.
  printf 'WARMBLY_IMAGE_REF=%s/%s:%s\n' \
    "$WARMBLY_IMAGE_REPO" "$WARMBLY_ROLE" "$DESIRED_VERSION" > "$STATE_DIR/image-ref"
  log "Wrote $CONFIG_DIR/node.env"
}

install_units() {
  [ "$DRY_RUN" = "false" ] || return 0

  service="warmbly-$WARMBLY_ROLE"
  cat > "/etc/systemd/system/$service.service" <<UNIT
[Unit]
Description=Warmbly $WARMBLY_ROLE
After=docker.service network-online.target
Requires=docker.service

[Service]
Restart=always
RestartSec=5
# systemd does not run a shell, so the image reference comes from a file it
# reads as environment rather than from a command substitution. \${VAR} expands
# to exactly one argument, which is what an image:tag needs.
EnvironmentFile=$STATE_DIR/image-ref
# The container is replaced rather than reconfigured, so start always removes
# any previous one first: a name collision after an unclean stop would
# otherwise wedge the service in a restart loop.
ExecStartPre=-/usr/bin/docker rm -f $service
ExecStart=/usr/bin/docker run --rm --name $service \\
  --env-file $CONFIG_DIR/node.env \\
  --network host \\
  -v $AGENT_DIR:$AGENT_DIR \\
  \${WARMBLY_IMAGE_REF}
ExecStop=/usr/bin/docker stop $service

[Install]
WantedBy=multi-user.target
UNIT

  # The updater is what makes auto-update work without anything reaching into
  # this machine. The node writes the version the control plane wants into
  # $STATE_DIR/target-version on each heartbeat; this notices the file changed,
  # pulls, and restarts. Keeping it outside the service means the process being
  # replaced is never the process doing the replacing.
  cat > "/usr/local/bin/warmbly-node-update" <<'UPDATER'
#!/bin/sh
set -eu
STATE_DIR="/var/lib/warmbly"
AGENT_DIR="/var/lib/warmbly/node"
CONFIG_DIR="/etc/warmbly"
[ -f "$AGENT_DIR/target-version" ] || exit 0
[ -f "$STATE_DIR/image" ] || exit 0

target="$(cat "$AGENT_DIR/target-version")"
image="$(cat "$STATE_DIR/image")"
current="$(sed -n 's/^WARMBLY_VERSION=//p' "$CONFIG_DIR/node.env" | head -n 1)"

[ -n "$target" ] || exit 0
[ "$target" != "$current" ] || exit 0

# The node writes this file, and root runs whatever image it names, so the
# value is validated rather than trusted: tag characters only, no registry or
# path separators that could redirect the pull somewhere else.
case "$target" in
  *[!A-Za-z0-9._-]*) echo "warmbly-node-update: refusing malformed target '$target'"; exit 0 ;;
esac

role="$(sed -n 's/^WARMBLY_NODE_ROLE=//p' "$CONFIG_DIR/node.env" | head -n 1)"
[ -n "$role" ] || exit 0

# Pull first. If the image is not there yet, leave the node on the version it
# is running rather than restarting it into a pull failure.
if ! docker pull "$image:$target" >/dev/null 2>&1; then
  echo "warmbly-node-update: $image:$target is not pullable yet; staying on $current"
  exit 0
fi

sed -i "s|^WARMBLY_VERSION=.*|WARMBLY_VERSION=$target|" "$CONFIG_DIR/node.env"
printf 'WARMBLY_IMAGE_REF=%s:%s\n' "$image" "$target" > "$STATE_DIR/image-ref"
echo "warmbly-node-update: $current -> $target"
systemctl restart "warmbly-$role"
UPDATER
  chmod 755 /usr/local/bin/warmbly-node-update

  cat > /etc/systemd/system/warmbly-node-update.service <<'UNIT'
[Unit]
Description=Apply the Warmbly version the control plane asked for

[Service]
Type=oneshot
ExecStart=/usr/local/bin/warmbly-node-update
UNIT

  cat > /etc/systemd/system/warmbly-node-update.timer <<'UNIT'
[Unit]
Description=Check for a new Warmbly version

[Timer]
OnBootSec=2min
OnUnitActiveSec=2min

[Install]
WantedBy=timers.target
UNIT

  systemctl daemon-reload
  log "Installed $service.service and warmbly-node-update.timer"
}

start_node() {
  [ "$DRY_RUN" = "false" ] || return 0
  service="warmbly-$WARMBLY_ROLE"

  log "Pulling $WARMBLY_IMAGE_REPO/$WARMBLY_ROLE:$DESIRED_VERSION"
  docker pull "$WARMBLY_IMAGE_REPO/$WARMBLY_ROLE:$DESIRED_VERSION" >/dev/null

  systemctl enable --now warmbly-node-update.timer >/dev/null 2>&1 || true
  systemctl enable "$service" >/dev/null 2>&1 || true
  systemctl restart "$service"

  log ""
  log "Done. This machine is now a Warmbly $WARMBLY_ROLE."
  log ""
  log "  Node id      $NODE_ID"
  log "  Version      $DESIRED_VERSION"
  log "  Logs         journalctl -u $service -f"
  log "  Status       systemctl status $service"
  log ""
  log "It will appear in Fleet within a minute or two, and will keep itself on"
  log "whatever version you set there. Nothing else to do."
}

main() {
  parse_args "$@"
  require_args
  check_deps
  enrol
  write_config
  install_units
  start_node
  return 0
}

main "$@"
