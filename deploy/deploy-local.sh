#!/bin/sh
set -eu

case "${1:-}" in
    frontend|backend) service="$1" ;;
    *) echo "Select frontend or backend" >&2; exit 1 ;;
esac

export DOTODO_CONFIG_DIR="${DOTODO_CONFIG_DIR:-$HOME/.config/dotodo}"
export DOCKERHUB_NAMESPACE="$(cat "$DOTODO_CONFIG_DIR/dockerhub-namespace")"
tag="$(git rev-parse HEAD)"

compose() { docker compose --project-name dotodo -f deploy/compose.yml "$@"; }

# Seed Compose interpolation while reading the live tags.
export FRONTEND_TAG="$tag" BACKEND_TAG="$tag"
container_for() { compose ps -q "$1"; }
live_tag() {
    image="$(docker inspect --format '{{.Config.Image}}' "$1")"
    case "$image" in
        "$DOCKERHUB_NAMESPACE/dotodo-$2:"*) printf '%s\n' "${image##*:}" ;;
        *) echo "Unexpected image for $2: $image" >&2; return 1 ;;
    esac
}
frontend_id="$(container_for frontend)"
backend_id="$(container_for backend)"
FRONTEND_TAG="$(live_tag "$frontend_id" frontend)"
BACKEND_TAG="$(live_tag "$backend_id" backend)"
if [ "$service" = frontend ]; then
    previous_tag="$FRONTEND_TAG"
    FRONTEND_TAG="$tag"
    peer=backend
    peer_id="$backend_id"
else
    previous_tag="$BACKEND_TAG"
    BACKEND_TAG="$tag"
    peer=frontend
    peer_id="$frontend_id"
fi

url="http://127.0.0.1:${DOTODO_PORT:-8088}"
healthy() {
    for attempt in $(seq 1 30); do
        if curl --fail --silent --max-time 2 "$url/" >/dev/null &&
           curl --fail --silent --max-time 2 "$url/api/workspace" >/dev/null; then
            return 0
        fi
        sleep 2
    done
    return 1
}

if compose up -d --no-deps --pull never "$service" && healthy; then
    test "$(container_for "$peer")" = "$peer_id"
    echo "$service deployed at $tag, $peer container unchanged"
    exit 0
fi

echo "Deployment failed, restoring $service at $previous_tag" >&2
if [ "$service" = frontend ]; then
    FRONTEND_TAG="$previous_tag"
else
    BACKEND_TAG="$previous_tag"
fi
compose up -d --no-deps --pull never "$service"
healthy || echo 'Restored service failed health checks' >&2
exit 1
