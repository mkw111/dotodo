pipeline {
    agent { label 'dotodo-docker' }
    options { disableConcurrentBuilds() }
    triggers { pollSCM('H/5 * * * *') }
    stages {
        stage('Build and test') {
            steps {
                sh '''
                    set -eu
                    config_dir="${DOTODO_CONFIG_DIR:-$HOME/.config/dotodo}"
                    namespace="$(cat "$config_dir/dockerhub-namespace")"
                    tag="$(git rev-parse HEAD)"
                    docker build -f deploy/frontend.Dockerfile -t "$namespace/dotodo-frontend:$tag" .
                    docker build -f deploy/backend.Dockerfile -t "$namespace/dotodo-backend:$tag" .
                '''
            }
        }
        stage('Publish and deploy') {
            steps {
                withCredentials([usernamePassword(credentialsId: 'dockerCredential',
                    usernameVariable: 'DOCKERHUB_USER', passwordVariable: 'DOCKERHUB_TOKEN')]) {
                    sh '''
                        set +x
                        set -eu
                        export DOTODO_CONFIG_DIR="${DOTODO_CONFIG_DIR:-$HOME/.config/dotodo}"
                        export DOCKERHUB_NAMESPACE="$(cat "$DOTODO_CONFIG_DIR/dockerhub-namespace")"
                        export IMAGE_TAG="$(git rev-parse HEAD)"
                        DOCKER_CONFIG="$(mktemp -d)"
                        export DOCKER_CONFIG
                        trap 'rm -rf "$DOCKER_CONFIG"' EXIT
                        printf '%s' "$DOCKERHUB_TOKEN" | docker login --username "$DOCKERHUB_USER" --password-stdin
                        docker push "$DOCKERHUB_NAMESPACE/dotodo-frontend:$IMAGE_TAG"
                        docker push "$DOCKERHUB_NAMESPACE/dotodo-backend:$IMAGE_TAG"
                        docker compose --project-name dotodo -f deploy/compose.yml pull
                        docker compose --project-name dotodo -f deploy/compose.yml up -d
                        url="http://127.0.0.1:${DOTODO_PORT:-8088}"
                        for attempt in $(seq 1 30); do
                            if curl --fail --silent "$url/api/workspace" >/dev/null &&
                               curl --fail --silent "$url/" >/dev/null; then
                                exit 0
                            fi
                            sleep 2
                        done
                        echo "dotodo failed its post-deployment check" >&2
                        exit 1
                    '''
                }
            }
        }
    }
}
