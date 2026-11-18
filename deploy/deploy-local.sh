#!/bin/sh
set -eu

export DOTODO_CONFIG_DIR="${DOTODO_CONFIG_DIR:-$HOME/.config/dotodo}"
export DOCKERHUB_NAMESPACE="$(cat "$DOTODO_CONFIG_DIR/dockerhub-namespace")"
export IMAGE_TAG="${RELEASE_SHA:?Git commit required}"

compose() { docker compose --project-name dotodo -f deploy/compose.yml "$@"; }
url="http://127.0.0.1:${DOTODO_PORT:-8088}"
healthy() {
    for attempt in $(seq 1 30); do
        if curl --fail --silent --max-time 2 "$url/api/workspace" >/dev/null &&
           curl --fail --silent --max-time 2 "$url/" >/dev/null; then
            return 0
        fi
        sleep 2
    done
    return 1
}

previous_frontend="$(docker inspect --format '{{.Config.Image}}' "$(compose ps -q frontend)" 2>/dev/null || true)"
previous_backend="$(docker inspect --format '{{.Config.Image}}' "$(compose ps -q backend)" 2>/dev/null || true)"
if compose up -d --pull never && healthy; then
    exit 0
fi

echo 'Deployment failed health checks' >&2
previous_tag="${previous_frontend##*:}"
if [ -n "$previous_tag" ] &&
   [ "$previous_frontend" = "$DOCKERHUB_NAMESPACE/dotodo-frontend:$previous_tag" ] &&
   [ "$previous_backend" = "$DOCKERHUB_NAMESPACE/dotodo-backend:$previous_tag" ]; then
    echo "Restoring previous image tag: $previous_tag" >&2
    IMAGE_TAG="$previous_tag" compose up -d --pull never
    healthy || echo 'Restored containers failed health checks' >&2
fi
exit 1
