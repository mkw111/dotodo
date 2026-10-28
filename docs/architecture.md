# dotodo 0.2 아키텍처

## 기존 프로젝트에서 이어받은 구조

| 기존 경로 | 확인한 역할 | dotodo |
| --- | --- | --- |
| SaveMoney/SmsReceiverApp | React Native 0.80 + WebView, 토큰·SMS·FCM | Expo SDK 54 + RN WebView 셸 |
| SmsMonitorFront | React/TypeScript/Vite, 라우팅·Axios | React/TypeScript/Vite 작업 UI |
| SaveMoney/SmsMonitor | Java 17, Spring Boot 3.4.5, JPA, 기능별 패키지 | 같은 Boot/JPA 기반 저장 API |

참고 근거는 package.json, App.js, App.tsx, API 모듈, build.gradle, Java 패키지입니다. 기존 SMS·금융 도메인·인증 키·운영 주소는 복사하지 않았습니다.

## 실행 경로

```text
React Native WebView
        ↓ 같은 웹 UI
React / Vite :5173
        ↓ /api 프록시 (개발)
Spring Boot localhost:8080
        ↓ JPA
H2 파일 DB (backend/data)
```

배포 시에는 웹·API를 같은 origin의 HTTPS로 제공할 프록시를 별도로 구성해야 합니다. 현재 프로젝트는 로컬 개발용입니다.

## 프론트

- `types.ts`: Task / TaskList / Habit / FocusSession / Timer / Settings / Workspace
- `model.ts`: 순수 로직. 날짜, 반복, 스마트 목록, 빠른 입력, 습관 연속 달성, 타이머 경과, 이관·검증
- `api.ts`: demo / api 저장 어댑터. 자동 저장 위치 전환 없음
- `useWorkspace.ts`: 저장 상태·오류·알림, 완료 타이머 세션 처리
- `App.tsx`: 내비게이션, 작업 목록·칸반·매트릭스, 검색, 리스트, 다중 선택
- `TaskDetail.tsx`: 상세 초안과 명시적 저장
- `CalendarView.tsx`, `FocusView.tsx`, `HabitsView.tsx`, `SettingsView.tsx`: 각 기능 화면

Task는 문자열 ID, 제목, 메모, listId, 날짜(date), 시간(time), priority(0~3), 태그, 체크리스트, repeat, 완료/삭제 시각, 정렬 순서를 가집니다. 날짜 없음은 빈 문자열입니다. 수집함은 listId=inbox로 고정합니다.

반복 완료 시 다음 항목을 한 번 생성합니다. recurrenceSource로 같은 원본의 재완료가 다음 항목을 중복 생성하지 않게 하고, repeatDay로 월말 일정의 원래 날짜를 보존합니다. 1월 31일 → 2월 28일 → 3월 31일입니다. 지난 반복의 완료 취소는 이미 생성한 다음 항목을 삭제하지 않습니다.

타이머는 남은 시간과 종료 epoch를 저장합니다. 실제 경과 시간을 계산하므로 화면 이동·새로고침·일시적인 백그라운드에서도 초가 누적해서 틀어지지 않습니다. 완료 기록은 다시 웹 코드가 실행될 때 반영할 수 있습니다. 여러 기기에서 동시에 타이머를 실행하는 분산 타이머는 아닙니다.

## 새 API

### GET /api/workspace

```json
{ "revision": 0, "data": { "schema": 2, "tasks": [], "lists": [], "habits": [], "sessions": [], "timer": {}, "settings": {} } }
```

위 예시의 timer/settings 빈 객체는 구조를 설명하기 위한 축약이며 실제 응답에는 기본 필드가 모두 있습니다. 최초 조회 시 기본 리스트·설정을 만들고 기존 TODO 테이블에서 한 번 이관합니다.

### PUT /api/workspace

GET의 revision과 완전한 data를 보냅니다. 성공하면 새 revision/data를 반환합니다.

- 200: 저장 성공
- 400: 잘못된 스키마·필드·날짜·범위·중복 ID·없는 리스트 참조 등
- 409: 오래된 revision 또는 JPA 낙관적 잠금 충돌
- 오류 본문: `{ "message": "설명" }`

워크스페이스는 `workspace_documents`의 JSON CLOB에 저장됩니다. 서버에서 구조/길이/개수/참조를 검사하고 전체 갱신을 한 트랜잭션으로 반영합니다. 단일 개인 워크스페이스에 적합한 방식이며 대규모·다중 사용자 서비스에는 정규화, 사용자 키, 페이지네이션, 변경 단위 API가 필요합니다.

기존 `/api/todos` CRUD 및 `/api/health`는 유지합니다. `/api/todos`는 이전 스타터용으로 최초 이관 이후 새 화면과 양방향 연동되지 않습니다.

## 클라이언트와 서버의 경계

- 필터, 그룹, 드래그 해석, 반복 항목 생성, 집중 세션 완성은 프론트 로직입니다.
- 서버는 문서 보관, 입력 검증, revision 충돌 처리를 수행합니다.
- API 모드의 다른 창·기기는 새로 불러올 때 데이터를 읽습니다. 실시간 스트리밍은 없습니다.
- 로컬 모드는 저장 전 마지막 스냅샷과 현재 저장소를 비교합니다. 거의 동시에 발생하는 다중 탭 쓰기를 완전히 막는 잠금은 아닙니다.
- 웹 일정 알림은 권한이 허용된 열린 브라우저에서만 확인합니다. Native OS 푸시·예약 실행은 없습니다.
- 모바일 메시지 브리지는 UI의 뒤로 가기 가능 여부와 테마만 전달하고, 원래 웹 origin 내 탐색만 허용합니다.

TickTick 조사 내용과 기능별 경계는 [ticktick-analysis.md](ticktick-analysis.md)에 있습니다.
