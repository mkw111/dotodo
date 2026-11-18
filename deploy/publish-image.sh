#!/bin/sh
set +x
set -eu

case "${1:-}" in
    frontend|backend) component="$1" ;;
    *) echo "Select frontend or backend" >&2; exit 1 ;;
esac

if [ -n "${RELEASE_SHA:-}" ]; then
    printf '%s\n' "$RELEASE_SHA" | grep -Eq '^[0-9a-f]{40}$'
    git merge-base --is-ancestor "$RELEASE_SHA" HEAD
    git checkout --detach "$RELEASE_SHA"
fi
tag="$(git rev-parse HEAD)"
config_dir="${DOTODO_CONFIG_DIR:-$HOME/.config/dotodo}"
namespace="$(cat "$config_dir/dockerhub-namespace")"
image="$namespace/dotodo-$component:$tag"
docker build -f "deploy/$component.Dockerfile" -t "$image" .
DOCKER_CONFIG="$(mktemp -d)"
export DOCKER_CONFIG
trap 'rm -rf "$DOCKER_CONFIG"' EXIT
printf '%s' "$DOCKERHUB_TOKEN" | docker login --username "$DOCKERHUB_USER" --password-stdin
docker push "$image"
