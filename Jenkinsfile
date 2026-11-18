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
                stash name: 'compose', includes: 'deploy/compose.yml,deploy/deploy-local.sh'
            }
        }
        stage('Build images') {
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
                sh 'sh deploy/deploy-local.sh'
            }
        }
    }
}
