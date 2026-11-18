# dotodo 배포

Jenkins의 **Pipeline script from SCM**으로 공개 저장소의 신뢰할 수 있는 배포 브랜치만 체크아웃하고, 두 작업을 등록합니다.

| Jenkins 작업 | Script Path |
| --- | --- |
| `dotodo-frontend` | `deploy/Jenkinsfile.frontend` |
| `dotodo-backend` | `deploy/Jenkinsfile.backend` |

 Ubuntu에서 실행되는 에이전트에는 `dotodo-docker` 라벨과 Git, Docker, Docker Compose, curl이 필요합니다. 이 에이전트는 Docker 권한을 사용하므로 배포 작업에 전용으로 할당합니다. 공개 PR 빌드에는 이 에이전트나 배포 설정을 연결하지 마세요.

두 작업이 각각 저장소를 폴링하고, 해당 서비스를 테스트·빌드한 뒤 Compose로 해당 컨테이너만 교체합니다. 배포 후 프런트와 API 응답을 확인하고, 실패하면 해당 서비스의 직전 이미지로 복구합니다.

서버의 `dockerhub-namespace` 파일에는 기존 이미지 이름의 접두어만 입력합니다. 설정 경로의 기본값은 `$HOME/.config/dotodo`입니다. 아래 DB 파일에는 줄바꿈 없이 값을 기록합니다.

| 파일 | 값 |
| --- | --- |
| `db/dotodo.db.url` | `jdbc:mysql://dotodo-mysql:3306/dotodo` |
| `db/dotodo.db.username` | dotodo 스키마 전용 MySQL 사용자 |
| `db/dotodo.db.password` | 사용자 비밀번호 |

설정 폴더와 `db` 폴더는 호스트에서 소유자만 접근할 수 있게 `0700`으로 둡니다. 컨테이너가 읽는 DB 파일 세 개는 `0444`로 두고 개별 읽기 전용 마운트를 사용합니다. MySQL은 기존 컨테이너를 `dotodo-database` 내부 Docker 네트워크에 연결하고 `dotodo-mysql` 별칭을 부여합니다. 전용 사용자의 권한을 이 네트워크의 서브넷과 dotodo 스키마로 제한합니다.

기존 HTTPS 가상 호스트 안에 `nginx-site.conf.example`의 location 설정을 넣습니다. 이 설정은 `/dotodo/`를 루프백의 프런트 컨테이너로, 컨테이너 Nginx는 `/api/`를 백엔드로 연결합니다. API는 하나의 공유 작업공간을 사용하므로 호스트 Nginx의 Basic 인증을 설정합니다. `/etc/nginx/dotodo.htpasswd`는 서버에서 생성한 후 `sudo nginx -t`로 검증하고 `sudo systemctl reload nginx`를 실행합니다. 호스트 포트 기본값은 8088이며 변경 시 호스트 Nginx와 Jenkins 설정도 맞춥니다.
