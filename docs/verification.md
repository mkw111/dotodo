# 0.1 스타터 검증 결과 (이전 기록)

2026-10-28, Windows / Node.js 22.14 / Java 23 환경에서 확인했습니다.

| 항목 | 결과 |
| --- | --- |
| 프론트 TypeScript + Vite 프로덕션 빌드 | 통과 |
| Spring Boot API 통합 테스트 | 2개 통과, 실패 0 |
| API CRUD DB 반영, 제목/카테고리/날짜 입력 검증, 없는 ID 처리 | 통과 |
| 백엔드 `/api/health` | 200, UP |
| Vite 프록시를 통한 API 목록 요청 | 통과 |
| 브라우저에서 API 모드로 TODO 생성 → 서버 저장 확인 | 통과 (검증 전용 메모리 DB) |
| 브라우저 데모 모드 추가·완료·새로고침 후 유지 | 통과 |
| 모바일 TypeScript 검사 | 통과 |
| Expo SDK 의존성 조합 검사 | 오프라인 내장 목록 기준 통과 |
| Expo Android JS/Hermes 번들 export | 통과 |
| Expo iOS JS/Hermes 번들 export | 통과 |
| Expo 네이티브 설정 introspection | 통과, 개발용 Android HTTP / iOS 로컬 네트워크 설정 확인 |

화면은 데스크톱 브라우저에서 확인했습니다. 반응형 CSS와 모바일 하단 내비게이션을 구현했지만 실기기 화면, Android APK 빌드·설치, iOS Xcode 빌드·설치는 검증하지 않았습니다. Expo 번들 성공은 네이티브 빌드 성공을 의미하지 않습니다.

인증/사용자 격리/푸시/스토어 배포는 이번 기본 틀에 포함되지 않습니다. 공개 배포 전 해당 요구사항과 운영 DB/HTTPS 구성이 필요합니다.
