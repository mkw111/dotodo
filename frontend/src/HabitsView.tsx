import { useState } from "react";
import Icon from "./Icon";
import Modal from "./Modal";
import { addDays, streak, uid } from "./model";
import { localDate, palette, type Habit, type Workspace } from "./types";
import type { Commit } from "./useWorkspace";

export default function HabitsView({
  state,
  commit,
  busy,
}: {
  state: Workspace;
  commit: Commit;
  busy: boolean;
}) {
  const [editing, setEditing] = useState<Habit | "new" | null>(null);
  const [week, setWeek] = useState(0);
  const today = localDate();
  const days = Array.from({ length: 7 }, (_, i) =>
    addDays(today, -6 + i + week * 7)
  );
  const achieved = state.habits.filter(
    (h) => (h.checks[today] || 0) >= h.goal
  ).length;
  async function check(h: Habit, day: string, reset = false) {
    if (day > today) return;
    await commit((w) => ({
      ...w,
      habits: w.habits.map((x) =>
        x.id === h.id
          ? {
              ...x,
              checks: {
                ...x.checks,
                [day]: reset ? 0 : Math.min(x.goal, (x.checks[day] || 0) + 1),
              },
            }
          : x
      ),
    }));
  }
  return (
    <section className="habits-page">
      <div className="habit-banner">
        <div>
          <span className="eyebrow">SMALL STEPS. LASTING CHANGE.</span>
          <h2>좋은 하루는, 작은 습관에서.</h2>
          <p>꾸준함을 쌓는 나만의 공간. 오늘도 한 번 더 해볼까요?</p>
        </div>
        <div className="habit-overall">
          <strong>
            {achieved}
            <small> / {state.habits.length}</small>
          </strong>
          <span>오늘 완료한 습관</span>
        </div>
      </div>
      <div className="section-toolbar">
        <h3>
          나의 습관 <span className="count-badge">{state.habits.length}</span>
        </h3>
        <button className="btn primary small" onClick={() => setEditing("new")}>
          <Icon name="plus" size={16} />
          습관 만들기
        </button>
      </div>
      <div className="habit-week-toolbar">
        <span>
          {days[0].slice(5).replace("-", ".")} —{" "}
          {days[6].slice(5).replace("-", ".")}
        </span>
        <div className="inline-actions">
          <button
            className="icon-btn"
            aria-label="이전 주 습관"
            onClick={() => setWeek((w) => w - 1)}
          >
            <Icon name="left" size={15} />
          </button>
          <button className="text-btn" onClick={() => setWeek(0)}>
            이번 주
          </button>
          <button
            className="icon-btn"
            aria-label="다음 주 습관"
            disabled={week >= 0}
            onClick={() => setWeek((w) => w + 1)}
          >
            <Icon name="right" size={15} />
          </button>
        </div>
      </div>
      <div className="habit-table">
        <div className="habit-table-head">
          <span>하나씩, 꾸준히</span>
          {days.map((day) => (
            <span key={day} className={day === today ? "today-text" : ""}>
              <small>
                {
                  ["일", "월", "화", "수", "목", "금", "토"][
                    new Date(`${day}T12:00:00`).getDay()
                  ]
                }
              </small>
              {Number(day.slice(-2))}
            </span>
          ))}
        </div>
        {state.habits.map((h) => (
          <article className="habit-row" key={h.id}>
            <button className="habit-name" onClick={() => setEditing(h)}>
              <i style={{ color: h.color, background: `${h.color}15` }}>
                <Icon name={h.icon} size={21} />
              </i>
              <div>
                <strong>{h.name}</strong>
                <small>
                  매일 {h.goal}회 <b>·</b> {streak(h.checks, h.goal)}일 연속
                </small>
              </div>
            </button>
            {days.map((day) => {
              const n = h.checks[day] || 0;
              return (
                <button
                  key={day}
                  className={`habit-check ${n >= h.goal ? "achieved" : ""} ${
                    n > 0 && n < h.goal ? "partial" : ""
                  }`}
                  disabled={busy || day > today}
                  style={{ "--habit-color": h.color } as React.CSSProperties}
                  onClick={() => check(h, day, n >= h.goal)}
                  aria-label={`${h.name} ${day} ${
                    n >= h.goal ? "완료 취소" : `체크 ${n}/${h.goal}`
                  }`}
                  title={
                    n >= h.goal
                      ? "클릭하면 완료 취소"
                      : `클릭하면 1회 추가 (${n}/${h.goal})`
                  }
                >
                  {n >= h.goal ? (
                    <Icon name="check" size={17} />
                  ) : n > 0 ? (
                    <span>
                      {n}/{h.goal}
                    </span>
                  ) : (
                    <i />
                  )}
                </button>
              );
            })}
          </article>
        ))}
      </div>
      {!state.habits.length && (
        <div className="soft-empty">
          <Icon name="habit" size={40} />
          <p>
            작게 시작해서 오래 이어가요.
            <br />
            나만의 첫 습관을 만들어 보세요.
          </p>
        </div>
      )}
      <div className="habit-insights">
        {state.habits.map((h) => (
          <div className="habit-insight" key={h.id}>
            <div>
              <Icon name={h.icon} size={17} />
              <strong>{h.name}</strong>
              <span>최근 28일</span>
            </div>
            <div className="habit-heatmap">
              {Array.from({ length: 28 }, (_, i) => addDays(today, i - 27)).map(
                (day) => (
                  <i
                    key={day}
                    style={{
                      background:
                        (h.checks[day] || 0) >= h.goal
                          ? h.color
                          : (h.checks[day] || 0) > 0
                          ? `${h.color}66`
                          : undefined,
                    }}
                    title={`${day}: ${h.checks[day] || 0}/${h.goal}`}
                  />
                )
              )}
            </div>
            <p>
              <strong>
                {Object.values(h.checks).filter((n) => n >= h.goal).length}
              </strong>
              일의 작은 성공을 쌓았어요.
            </p>
          </div>
        ))}
      </div>
      <p className="view-tip">
        체크를 누르면 1회 추가되고, 목표를 채운 뒤 다시 누르면 그날 기록을
        취소합니다.
      </p>
      {editing && (
        <HabitEditor
          key={typeof editing === "string" ? "new" : editing.id}
          habit={editing === "new" ? null : editing}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={async (habit) => {
            if (
              await commit(
                (w) => ({
                  ...w,
                  habits:
                    editing === "new"
                      ? [...w.habits, habit]
                      : w.habits.map((h) => (h.id === habit.id ? habit : h)),
                }),
                "습관을 저장했어요"
              )
            )
              setEditing(null);
          }}
          onDelete={async () => {
            if (
              typeof editing !== "string" &&
              window.confirm(
                "습관과 모든 체크 기록을 삭제할까요? 이 작업은 되돌릴 수 없습니다."
              )
            )
              if (
                await commit(
                  (w) => ({
                    ...w,
                    habits: w.habits.filter((h) => h.id !== editing.id),
                  }),
                  "습관을 삭제했어요"
                )
              )
                setEditing(null);
          }}
        />
      )}
    </section>
  );
}
function HabitEditor({
  habit,
  busy,
  onClose,
  onSave,
  onDelete,
}: {
  habit: Habit | null;
  busy: boolean;
  onClose: () => void;
  onSave: (h: Habit) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(habit?.name || "");
  const [goal, setGoal] = useState(habit?.goal || 1);
  const [color, setColor] = useState(habit?.color || palette[0]);
  const [icon, setIcon] = useState(habit?.icon || "habit");
  return (
    <Modal title={habit ? "습관 수정" : "새로운 습관"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            id: habit?.id || uid(),
            name: name.trim(),
            goal,
            color,
            icon,
            checks: habit?.checks || {},
          });
        }}
      >
        <label className="form-field">
          어떤 습관을 만들까요?
          <input
            autoFocus
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 매일 책 읽기"
          />
        </label>
        <label className="form-field">
          하루 목표 횟수
          <input
            type="number"
            min={1}
            max={100}
            required
            value={goal}
            onChange={(e) => setGoal(Number(e.target.value))}
          />
        </label>
        <div className="form-field">
          아이콘
          <div className="choice-row">
            {["habit", "book", "drop", "walk", "heart", "sun", "focus"].map(
              (n) => (
                <button
                  type="button"
                  key={n}
                  className={`choice ${icon === n ? "selected" : ""}`}
                  onClick={() => setIcon(n)}
                  aria-label={`${n} 아이콘`}
                >
                  <Icon name={n} />
                </button>
              )
            )}
          </div>
        </div>
        <div className="form-field">
          색상
          <div className="choice-row">
            {palette.map((c) => (
              <button
                type="button"
                key={c}
                className={`color-choice ${color === c ? "selected" : ""}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={`${c} 색상`}
              />
            ))}
          </div>
        </div>
        <div className="dialog-actions">
          {habit && (
            <button
              type="button"
              className="text-btn danger"
              disabled={busy}
              onClick={onDelete}
            >
              습관 삭제
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            취소
          </button>
          <button
            className="btn primary"
            disabled={busy || !name.trim() || goal < 1 || goal > 100}
          >
            저장
          </button>
        </div>
      </form>
    </Modal>
  );
}
