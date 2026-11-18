pipeline {
    agent none
    options {
        disableConcurrentBuilds()
        skipDefaultCheckout()
    }
    triggers { pollSCM('H/5 * * * *') }
    stages {
        stage('Select revision') {
            agent { label 'dotodo-docker' }
            steps {
                checkout scm
                script {
                    env.RELEASE_SHA = sh(script: 'git rev-parse HEAD', returnStdout: true).trim()
                }
                stash name: 'compose', includes: 'deploy/compose.yml'
            }
        }
        stage('Publish images') {
            parallel {
                stage('Frontend') {
                    steps {
                        build job: 'dotodo-frontend', parameters: [string(name: 'RELEASE_SHA', value: env.RELEASE_SHA)]
                    }
                }
                stage('Backend') {
                    steps {
                        build job: 'dotodo-backend', parameters: [string(name: 'RELEASE_SHA', value: env.RELEASE_SHA)]
                    }
                }
            }
        }
        stage('Deploy') {
            agent { label 'dotodo-docker' }
            steps {
                unstash 'compose'
                withCredentials([usernamePassword(credentialsId: 'dotodo-dockerhub',
                    usernameVariable: 'DOCKERHUB_USER', passwordVariable: 'DOCKERHUB_TOKEN')]) {
                    sh '''
                        set +x
                        set -eu
                        export DOTODO_CONFIG_DIR="${DOTODO_CONFIG_DIR:-$HOME/.config/dotodo}"
                        export DOCKERHUB_NAMESPACE="$(cat "$DOTODO_CONFIG_DIR/dockerhub-namespace")"
                        export IMAGE_TAG="$RELEASE_SHA"
                        DOCKER_CONFIG="$(mktemp -d)"
                        export DOCKER_CONFIG
                        trap 'rm -rf "$DOCKER_CONFIG"' EXIT
                        printf '%s' "$DOCKERHUB_TOKEN" | docker login --username "$DOCKERHUB_USER" --password-stdin
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
