import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import Modal from "./Modal";
import { validateWorkspace } from "./model";
import { localDate, palette, type Settings, type Workspace } from "./types";
import { dataMode } from "./api";
import type { Commit } from "./useWorkspace";

export default function SettingsView({
  state,
  commit,
  busy,
  notify,
}: {
  state: Workspace;
  commit: Commit;
  busy: boolean;
  notify: (message: string) => void;
}) {
  const [draft, setDraft] = useState<Settings>(state.settings);
  const [imported, setImported] = useState<Workspace | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const [permission, setPermission] = useState(
    typeof Notification === "undefined"
      ? "unavailable"
      : Notification.permission
  );
  const app = Boolean(window.ReactNativeWebView);
  const [appPermission, setAppPermission] = useState("loading");
  const [session, setSession] = useState<{ username: string; remembered: boolean } | null>(null);
  const [testingReminder, setTestingReminder] = useState(false);
  useEffect(() => {
    if (!window.ReactNativeWebView) return;
    const update = (event: Event) => setAppPermission((event as CustomEvent<string>).detail);
    window.addEventListener("dotodo:reminder-status", update);
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: "DOTODO_REMINDER_STATUS" }));
    return () => window.removeEventListener("dotodo:reminder-status", update);
  }, []);
  useEffect(() => {
    if (!window.ReactNativeWebView) return;
    const onTest = (event: Event) => {
      setTestingReminder(false);
      notify(String((event as CustomEvent).detail));
    };
    const onSession = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail && typeof detail.username === "string") setSession(detail);
    };
    const onSessionError = (event: Event) => notify(String((event as CustomEvent).detail));
    window.addEventListener("dotodo:reminder-test", onTest);
    window.addEventListener("dotodo:session-status", onSession);
    window.addEventListener("dotodo:session-error", onSessionError);
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: "DOTODO_SESSION_STATUS" }));
    return () => {
      window.removeEventListener("dotodo:reminder-test", onTest);
      window.removeEventListener("dotodo:session-status", onSession);
      window.removeEventListener("dotodo:session-error", onSessionError);
    };
  }, [notify]);
  useEffect(() => {
    if (!testingReminder) return;
    const timeout = setTimeout(() => {
      setTestingReminder(false);
      notify("앱에서 응답이 없어요. 최신 APK로 업데이트한 뒤 다시 시도해 주세요.");
    }, 15000);
    return () => clearTimeout(timeout);
  }, [testingReminder, notify]);
  const [fileError, setFileError] = useState("");
  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dotodo-${localDate()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("백업 파일을 다운로드했어요");
  }
  async function importData(event: React.ChangeEvent<HTMLInputElement>) {
    const f = event.target.files?.[0];
    event.target.value = "";
    if (!f) return;
    try {
      if (f.size > 8 * 1024 * 1024)
        throw new Error("백업 파일은 8MB 이내여야 합니다.");
      setImported(validateWorkspace(JSON.parse(await f.text())));
      setFileError("");
    } catch (e) {
      setFileError(
        e instanceof Error ? e.message : "백업 파일을 읽을 수 없어요."
      );
    }
  }
  return (
    <section className="settings-page">
      <div className="settings-intro">
        <h2>나에게 맞는 dotodo</h2>
        <p>편안한 작업 환경으로, 조금 더 나다운 하루.</p>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await commit((w) => ({ ...w, settings: draft }), "설정을 저장했어요");
        }}
      >
        <div className="settings-card">
          <h3>
            <Icon name="user" size={18} />
            프로필
          </h3>
          <label className="setting-row">
            <span>
              어떻게 불러드릴까요?<small>내 워크스페이스에 표시되는 이름</small>
            </span>
            <input
              required
              maxLength={40}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
        </div>
        <div className="settings-card">
          <h3>
            <Icon name="moon" size={18} />
            화면과 사용 환경
          </h3>
          <label className="setting-row">
            <span>테마</span>
            <select
              value={draft.theme}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  theme: e.target.value as Settings["theme"],
                })
              }
            >
              <option value="light">라이트</option>
              <option value="dark">다크</option>
              <option value="system">시스템 설정</option>
            </select>
          </label>
          <div className="setting-row">
            <span>포인트 색상</span>
            <div className="choice-row">
              {palette.map((c) => (
                <button
                  type="button"
                  className={`color-choice ${
                    draft.accent === c ? "selected" : ""
                  }`}
                  style={{ background: c }}
                  key={c}
                  aria-label={`${c} 포인트 색상`}
                  onClick={() => setDraft({ ...draft, accent: c })}
                />
              ))}
            </div>
          </div>
          <label className="setting-row">
            <span>한 주의 시작</span>
            <select
              value={draft.weekStart}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  weekStart: Number(e.target.value) as 0 | 1,
                })
              }
            >
              <option value={0}>일요일</option>
              <option value={1}>월요일</option>
            </select>
          </label>
          <label className="setting-row">
            <span>완료한 할 일 함께 보기</span>
            <input
              type="checkbox"
              checked={draft.showCompleted}
              onChange={(e) =>
                setDraft({ ...draft, showCompleted: e.target.checked })
              }
            />
          </label>
        </div>
        <div className="settings-card">
          <h3>
            <Icon name="focus" size={18} />
            집중과 휴식
          </h3>
          <label className="setting-row">
            <span>
              집중 시간<small>다음 세션 시작·초기화부터 적용</small>
            </span>
            <div>
              <input
                type="number"
                required
                min={1}
                max={180}
                value={draft.focusMinutes}
                onChange={(e) =>
                  setDraft({ ...draft, focusMinutes: Number(e.target.value) })
                }
              />
              <span className="unit">분</span>
            </div>
          </label>
          <label className="setting-row">
            <span>짧은 휴식</span>
            <div>
              <input
                type="number"
                required
                min={1}
                max={60}
                value={draft.breakMinutes}
                onChange={(e) =>
                  setDraft({ ...draft, breakMinutes: Number(e.target.value) })
                }
              />
              <span className="unit">분</span>
            </div>
          </label>
        </div>
        <div className="settings-save">
          <button className="btn primary" disabled={busy || !draft.name.trim()}>
            변경사항 저장
          </button>
        </div>
      </form>
      {session && <div className="settings-card">
        <h3>앱 로그인</h3>
        <div className="setting-row">
          <span>{session.username}<small>{session.remembered
            ? "이 기기에서 로그인을 유지하고 있어요." : "이번 실행 동안 로그인되어 있어요."}</small></span>
          <button className="btn small" onClick={() =>
            window.ReactNativeWebView?.postMessage(JSON.stringify({ type: "DOTODO_SIGN_OUT" }))}>
            로그아웃
          </button>
        </div>
      </div>}
      <div className="settings-card">
        <h3>
          <Icon name="bell" size={18} />
          {app ? "앱 알림" : "브라우저 알림"}
        </h3>
        <div className="setting-row">
          <span>
            일정 알림
            <small>
              {app ? "일정 상세에서 예약한 알림을 앱을 닫아도 받아요."
                : "웹이 열려 있는 동안 일정 시작 시간에 알림을 표시해요. 앱에서 받을 알림은 일정 상세에서 설정할 수 있어요."}
              {app && appPermission === "error" && " 알림 예약에 실패했어요. 다시 시도해 주세요."}
            </small>
          </span>
          {app ? (
            <button className="btn small"
              disabled={appPermission === "granted" || appPermission === "loading"}
              onClick={() => {
                window.ReactNativeWebView?.postMessage(JSON.stringify({
                  type: appPermission === "blocked" ? "DOTODO_REMINDER_SETTINGS" :
                    appPermission === "error" ? "DOTODO_REMINDER_STATUS" : "DOTODO_REMINDER_PERMISSION",
                }));
              }}>
              {appPermission === "granted" ? "허용됨" :
                appPermission === "blocked" ? "기기 설정 열기" :
                appPermission === "error" ? "다시 시도" :
                appPermission === "loading" ? "확인 중" : "알림 허용"}
            </button>
          ) : <button
            className="btn small"
            disabled={permission === "unavailable" || permission === "granted"}
            onClick={async () => {
              try {
                setPermission(await Notification.requestPermission());
              } catch {
                setPermission("unavailable");
              }
            }}
          >
            {permission === "granted"
              ? "허용됨"
              : permission === "unavailable"
              ? "이 환경에서 지원 안 함"
              : permission === "denied"
              ? "브라우저에서 차단됨"
              : "알림 허용"}
          </button>}
        </div>
        {app && <div className="setting-row">
          <span>알림 테스트<small>5초 뒤 앱 알림을 보내 수신 여부를 확인해요.</small></span>
          <button className="btn small" disabled={testingReminder} onClick={() => {
            setTestingReminder(true);
            window.ReactNativeWebView?.postMessage(JSON.stringify({ type: "DOTODO_REMINDER_TEST" }));
          }}>{testingReminder ? "예약 중…" : "테스트 알림 보내기"}</button>
        </div>}
      </div>
      <div className="settings-card">
        <h3>
          <Icon name="download" size={18} />내 데이터
        </h3>
        <div className="setting-row">
          <span>
            저장 방식
            <small>
              {dataMode === "demo"
                ? "현재 브라우저에 저장됩니다. 기기 간 동기화는 API 모드를 사용하세요."
                : "Spring Boot 서버의 H2 DB에 저장됩니다. 다른 창의 충돌을 감지합니다."}
            </small>
          </span>
          <span className="mode-pill">
            {dataMode === "demo" ? "로컬 저장" : "서버 저장"}
          </span>
        </div>
        <div className="setting-row">
          <span>
            백업과 복원
            <small>
              할 일, 리스트, 습관, 집중 기록, 설정을 JSON으로 보관합니다.
            </small>
          </span>
          <div className="inline-actions">
            <button className="btn small" onClick={exportData}>
              <Icon name="download" size={14} />
              내보내기
            </button>
            <button className="btn small" onClick={() => file.current?.click()}>
              <Icon name="upload" size={14} />
              가져오기
            </button>
          </div>
        </div>
        <input
          type="file"
          hidden
          ref={file}
          accept=".json,application/json"
          onChange={importData}
        />
        {fileError && (
          <p role="alert" className="error-inline">
            {fileError}
          </p>
        )}
      </div>
      <p className="version-note">dotodo 0.2 · Designed for a clear mind.</p>
      {imported && (
        <Modal title="백업을 복원할까요?" onClose={() => setImported(null)}>
          <p className="dialog-description">
            할 일 {imported.tasks.length}개, 리스트 {imported.lists.length}개,
            습관 {imported.habits.length}개를 가져옵니다. 현재 데이터를
            대체하므로 먼저 내보내기를 권장합니다. 진행 중인 타이머는 일시 정지
            상태로 복원합니다.
          </p>
          <div className="dialog-actions">
            <button className="btn" onClick={() => setImported(null)}>
              취소
            </button>
            <button
              className="btn primary"
              disabled={busy}
              onClick={async () => {
                const restored = {
                  ...imported,
                  timer: { ...imported.timer, endAt: null },
                };
                if (await commit(() => restored, "백업을 복원했어요")) {
                  setDraft(restored.settings);
                  setImported(null);
                }
              }}
            >
              복원하기
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
