import { useEffect, useState } from "react";
import Icon from "./Icon";
import { remainingSeconds } from "./model";
import { localDate, type Workspace } from "./types";
import type { Commit } from "./useWorkspace";

export default function FocusView({
  state,
  commit,
  busy,
}: {
  state: Workspace;
  commit: Commit;
  busy: boolean;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, []);
  const timer = state.timer;
  const seconds = remainingSeconds(timer);
  const running = timer.endAt !== null;
  const today = state.sessions.filter(
    (s) => localDate(new Date(s.completedAt)) === localDate()
  );
  const completed = state.tasks.filter(
    (t) =>
      !t.deletedAt &&
      t.completed &&
      t.completedAt &&
      localDate(new Date(t.completedAt)) === localDate()
  ).length;
  const duration = (mode: "focus" | "break") =>
    (mode === "focus"
      ? state.settings.focusMinutes
      : state.settings.breakMinutes) * 60;
  const mode = (next: "focus" | "break") =>
    commit((w) => ({
      ...w,
      timer: {
        ...w.timer,
        mode: next,
        endAt: null,
        remaining: duration(next),
        duration: duration(next),
      },
    }));
  function toggle() {
    void commit((w) => ({
      ...w,
      timer: {
        ...w.timer,
        endAt: running ? null : Date.now() + seconds * 1000,
        remaining: seconds,
      },
    }));
  }
  return (
    <section className="focus-page">
      <div className="focus-layout">
        <div className="focus-main">
          <div className="focus-tabs">
            <button
              className={timer.mode === "focus" ? "selected" : ""}
              disabled={running || busy}
              onClick={() => mode("focus")}
            >
              포모도로
            </button>
            <button
              className={timer.mode === "break" ? "selected" : ""}
              disabled={running || busy}
              onClick={() => mode("break")}
            >
              짧은 휴식
            </button>
          </div>
          <p className="focus-intro">지금은, 오직 한 가지에만.</p>
          <div className="timer-ring">
            <svg viewBox="0 0 300 300">
              <circle cx="150" cy="150" r="137" />
              <circle
                cx="150"
                cy="150"
                r="137"
                strokeDasharray={861}
                strokeDashoffset={861 * (1 - seconds / timer.duration)}
              />
            </svg>
            <div>
              <strong>
                {String(Math.floor(seconds / 60)).padStart(2, "0")}
                <span>:</span>
                {String(seconds % 60).padStart(2, "0")}
              </strong>
              <small>
                {running
                  ? "나만의 속도로 집중하는 중"
                  : timer.mode === "focus"
                  ? "FOCUS ON WHAT MATTERS"
                  : "TAKE A LITTLE BREATH"}
              </small>
            </div>
          </div>
          <select
            className="focus-task"
            aria-label="집중할 할 일"
            value={timer.taskId || ""}
            disabled={running || busy}
            onChange={(e) =>
              commit((w) => ({
                ...w,
                timer: { ...w.timer, taskId: e.target.value || null },
              }))
            }
          >
            <option value="">자유롭게 집중하기</option>
            {state.tasks
              .filter((t) => !t.completed && !t.deletedAt)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
          </select>
          <div className="focus-buttons">
            <button
              className="icon-btn reset-timer"
              aria-label="타이머 초기화"
              disabled={busy}
              onClick={() => {
                if (
                  !running ||
                  window.confirm(
                    "진행 중인 타이머를 초기화할까요? 기록은 완료한 세션만 저장됩니다."
                  )
                )
                  void mode(timer.mode);
              }}
            >
              <Icon name="reset" />
            </button>
            <button
              className="btn primary start-focus"
              disabled={busy || seconds === 0}
              onClick={toggle}
            >
              <Icon name={running ? "pause" : "play"} size={17} />
              {running ? "일시 정지" : "시작하기"}
            </button>
          </div>
          <p className="focus-note">
            타이머는 화면을 이동하거나 새로고침해도 유지됩니다.
            <br />
            앱이 닫혀 있을 때 시스템 알림을 보내지는 않습니다.
          </p>
        </div>
        <div className="focus-summary">
          <h3>오늘의 작은 몰입</h3>
          <div className="focus-stats">
            <div>
              <strong>{today.length}</strong>
              <span>완료한 집중</span>
            </div>
            <div>
              <strong>
                {today.reduce((n, s) => n + s.minutes, 0)}
                <small>분</small>
              </strong>
              <span>집중한 시간</span>
            </div>
            <div>
              <strong>{completed}</strong>
              <span>완료한 할 일</span>
            </div>
          </div>
          <h4>최근 집중 기록</h4>
          {state.sessions.length ? (
            <div className="session-list">
              {state.sessions
                .slice(-8)
                .reverse()
                .map((s) => (
                  <div key={s.id}>
                    <span className="session-dot" />
                    <div>
                      <strong>{s.title}</strong>
                      <small>
                        {new Date(s.completedAt).toLocaleString("ko-KR", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </small>
                    </div>
                    <span>{s.minutes}분</span>
                  </div>
                ))}
            </div>
          ) : (
            <div className="soft-empty">
              <Icon name="focus" size={30} />
              <p>
                첫 번째 집중을 시작해 보세요.
                <br />
                오롯이 나를 위한 시간이 쌓여요.
              </p>
            </div>
          )}
          <div className="focus-quote">
            “작은 몰입이 쌓이면,
            <br />
            어느새 큰 변화가 됩니다.”<span>ONE THING AT A TIME</span>
          </div>
        </div>
      </div>
    </section>
  );
}
