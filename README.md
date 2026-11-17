# dotodo 0.3

새 기능: **취소 가능한 날짜·반복 칩**, **아이언~챌린저 개인 랭크**, **드래그 가능한 일간·주간 시간표**. [사용법·규칙·검증 결과](docs/smart-rank-calendar.md)

머릿속은 가볍게, 하루는 선명하게. TickTick의 작업 흐름을 참고해 만든 한국어 개인 생산성 앱입니다.

## 들어 있는 기능

- 수집함 · 오늘 · 내일 · 다음 7일 · 전체 · 중요 · 완료 스마트 목록
- 사용자 리스트 추가·수정·색상, 태그 필터와 전체 검색
- 할 일 메모, 날짜·시간, 4단계 우선순위, 체크리스트, 반복 일정
- 목록 정렬·그룹, 우선순위 칸반, 다중 선택 완료·연기·휴지통
- 캘린더 월·주·일, 날짜별 일정, 끌어서 날짜 변경
- 중요도 × 긴급도 매트릭스와 드래그 이동
- 포모도로·휴식 타이머, 작업 연결, 완료 세션·집중 시간 기록
- 사용자 습관, 하루 목표 횟수, 주간 체크·연속 기록·히트맵
- 휴지통, 복원·실행 취소·영구 삭제
- 라이트·다크·시스템 테마, 포인트 색상, 이름·주 시작·집중 시간 설정
- JSON 백업·검증·복원, 예전 데이터 이관, 저장 충돌 감지

## 프로젝트 구조

```text
frontend/   React 19 + TypeScript + Vite
backend/    Spring Boot 3.4.5 + JPA + H2
mobile/     React Native + Expo SDK 54 + WebView
```

`SaveMoney`의 모바일 WebView → React 웹 → Spring Boot 구성을 참고했습니다. 원본 프로젝트는 변경하지 않았습니다.

## 웹 실행

Node.js 22.14+와 npm을 사용합니다. 루트에서:

```powershell
npm --prefix frontend install
npm run dev
```

[http://localhost:5173](http://localhost:5173)에서 실행합니다. 기본은 **로컬 데모 모드**이며 현재 브라우저에 저장합니다. 새 브라우저에서는 예시 할 일·습관을 제공합니다. 기존 0.1 데이터가 있으면 할 일은 보존·변환하고 원본 저장 키도 유지합니다. 브라우저 데이터를 삭제하면 데모 데이터도 사라집니다.

빠른 입력 예: `내일 보고서 쓰기 #업무 !1`. 제목을 누르면 상세가 열리고, 상세 변경은 **저장** 버튼으로 적용합니다. `Ctrl/Cmd + K`는 전체 검색, 입력창 밖에서 `N`은 새 할 일입니다. 드래그 외에도 상세에서 날짜·우선순위를 변경할 수 있습니다.

## 서버 저장 모드

JDK 17~23이 필요합니다. 별도 DB 설치 없이 H2 파일 DB를 사용합니다.

```powershell
cd backend
.\gradlew.bat bootRun
```

`frontend/.env.example`을 `frontend/.env.local`로 복사하고 변경하세요.

```dotenv
VITE_DATA_MODE=api
VITE_API_BASE_URL=/api
```

웹 개발 서버를 재시작하면 Vite가 `/api`를 `127.0.0.1:8080`으로 전달합니다. 서버 기본 주소는 localhost이며, 파일 DB는 `backend/data/`에 저장됩니다. API 모드는 예시 데이터 없이 시작하며 기존 서버 할 일은 첫 워크스페이스 생성 시 한 번 이관합니다. 데모 데이터는 서버로 자동 병합하지 않습니다. 필요하면 설정의 JSON 내보내기·가져오기를 사용하세요.

새 화면은 `GET/PUT /api/workspace`를 사용합니다. 서버가 반환한 `revision`을 PUT에 다시 보내야 하며 오래된 버전의 쓰기는 409입니다. 새로 불러오기로 최신 상태를 확인하세요. 기존 `/api/todos`는 이전 스타터 호환용이고 첫 이관 이후 새 워크스페이스와 양방향 동기화하지 않습니다.

현재 API는 **인증 없는 개인용 개발 서버**입니다. 계정 로그인·사용자 격리·공개 서비스 배포는 별도 구현이 필요합니다.

## 모바일 실행

```powershell
npm --prefix mobile install
Copy-Item mobile/.env.example mobile/.env
npm run mobile
```

먼저 웹 서버를 실행하고 `mobile/.env`의 `EXPO_PUBLIC_WEB_URL`을 지정합니다.

| 실행 환경 | 웹 주소 |
| --- | --- |
| Android 에뮬레이터 | `http://10.0.2.2:5173` |
| iOS 시뮬레이터 | `http://localhost:5173` |
| 실제 기기 | `http://PC의_LAN_IP:5173` |

실기기는 PC와 같은 네트워크에 연결해야 합니다. API는 웹 서버 프록시를 통하므로 백엔드를 LAN에 직접 공개할 필요는 없습니다. Expo Go는 SDK 54 호환 버전이 필요하며, 호환 클라이언트가 없으면 개발 빌드를 사용하세요.

```powershell
cd mobile
npm run android
# macOS + Xcode에서:
npm run ios
```

Expo가 네이티브 프로젝트를 생성합니다. Android SDK/에뮬레이터 또는 macOS/Xcode가 별도로 필요합니다. 네이티브 생성 폴더는 Git에서 제외하고 앱 설정·플러그인에서 관리합니다. Android 뒤로 가기는 웹 상세/메뉴/기능 화면을 먼저 닫고, 웹 테마를 상태 표시줄에 반영합니다.

현재 HTTP 허용은 로컬 개발용입니다. 배포 시 HTTPS 주소를 사용하고 `withLocalWebView` 플러그인을 제거하세요. 앱의 **설정 → 앱 알림**에서 권한을 허용한 뒤, 날짜와 시간이 있는 일정의 상세에서 알림을 예약할 수 있습니다. 예약은 기기에서 실행되며, 앱이 닫혀 있어도 알림을 받을 수 있습니다. 변경·삭제·완료한 일정의 예약은 앱에서 변경사항을 읽을 때 갱신됩니다. 반복 일정은 기존 규칙대로 현재 회차를 완료하면 다음 회차와 알림을 생성합니다. Android에서 정확한 알람 권한이 없으면 기기 정책에 따라 알림이 늦어질 수 있습니다. 이 기능은 네이티브 앱 개발 빌드에서 확인할 수 있습니다. 브라우저 일정 알림은 사용자가 권한을 허용하고 웹이 열려 있을 때 동작합니다.

## 검사

```powershell
npm run test
npm run build
cd backend
.\gradlew.bat test
cd ../mobile
npm run typecheck
npx expo export --platform android --output-dir dist-android
npx expo export --platform ios --output-dir dist-ios
```

Expo export는 JS/Hermes 번들 검사이며 APK·IPA 빌드나 실기기 실행 검증은 아닙니다.

## 문서

- [TickTick 분석과 구현 범위](docs/ticktick-analysis.md)
- [아키텍처와 API](docs/architecture.md)
- [검증 결과](docs/verification-v2.md)

계정 공유·초대·협업·외부 캘린더 구독·첨부·AI·음성 입력·위치 알림·서버 발송 푸시·스토어 출시는 포함하지 않습니다. 공식 기능 전체의 복제본이 아닌, 실제로 확장하고 사용할 수 있는 dotodo 구현입니다.
