import { useRef, useState } from "react";
import Icon from "./Icon";
import TimeSchedule from "./TimeSchedule";
import { useCalendarHold } from "./useCalendarHold";
import { addDays, scheduledOn } from "./model";
import { localDate, type Task, type TaskList } from "./types";

export default function CalendarView({
  initialDate,
  tasks,
  lists,
  weekStart,
  onSelect,
  onDuplicate,
  onMove,
  onAdd,
  onSchedule,
  plans,
  onSavePlan,
  busy,
}: {
  initialDate: string;
  tasks: Task[];
  lists: TaskList[];
  weekStart: 0 | 1;
  onSelect: (id: string) => void;
  onDuplicate: (id: string) => Promise<string | null>;
  onMove: (id: string, date: string) => void;
  onAdd: (date: string, time?: string, options?: Pick<Task, "endDate" | "durationMinutes">) => void;
  plans: Record<string, string>;
  onSavePlan: (period: string, text: string) => Promise<boolean>;
  busy: boolean;
  onSchedule: (id: string, patch: Partial<Task>) => Promise<boolean>;
}) {
  const [cursor, setCursor] = useState(initialDate);
  const [mode, setMode] = useState<"year" | "month" | "week" | "day">("month");
  const [picked, setPicked] = useState(initialDate);
  const monthGrid = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);
  useCalendarHold(monthGrid, (target, _x, _y, starting) => {
    if (starting && target?.closest(".calendar-event, .day-add, .more-events")) return null;
    const cell = target?.closest<HTMLElement>("[data-calendar-day]");
    return cell && monthGrid.current?.contains(cell) ? cell.dataset.calendarDay ?? null : null;
  }, (a, b) => setRange(a <= b ? { start: a, end: b } : { start: b, end: a }),
  () => setRange(null), mode === "month");
  const current = new Date(`${cursor}T12:00:00`);
  const year = cursor.slice(0, 4);
  const period = mode === "year" ? year : cursor.slice(0, 7);
  const first = new Date(current.getFullYear(), current.getMonth(), 1);
  const lastDay = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
  const start =
    mode === "month"
      ? addDays(localDate(first), -((first.getDay() - weekStart + 7) % 7))
      : mode === "week"
      ? addDays(cursor, -((current.getDay() - weekStart + 7) % 7))
      : cursor;
  const days = Array.from(
    { length: mode === "month" ? 42 : mode === "week" ? 7 : 1 },
    (_, i) => addDays(start, i)
  );
  const active = tasks.filter((t) => !t.deletedAt && !t.completed && t.date);
  const daily = active
    .filter((t) => scheduledOn(t, picked))
    .sort((a, b) => a.time.localeCompare(b.time));
  function shift(direction: number) {
    setRange(null);
    if (mode === "year") {
      const d = new Date(`${cursor}T12:00:00`);
      d.setFullYear(d.getFullYear() + direction, 0, 1);
      setCursor(localDate(d));
      setPicked(localDate(d));
    } else if (mode === "month") {
      const d = new Date(`${cursor}T12:00:00`);
      d.setDate(1);
      d.setMonth(d.getMonth() + direction);
      setCursor(localDate(d));
      setPicked(localDate(d));
    } else {
      const date = addDays(cursor, direction * (mode === "week" ? 7 : 1));
      setCursor(date);
      setPicked(date);
    }
  }
  function drop(event: React.DragEvent, date: string) {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain");
    if (tasks.some((t) => t.id === id)) onMove(id, date);
  }
  return (
    <section className="calendar-page">
      <div className="section-toolbar">
        <div className="calendar-heading">
          <h2>
            {current.getFullYear()}년 {mode !== "year" && `${current.getMonth() + 1}월`}
          </h2>
          <button
            className="icon-btn"
            onClick={() => shift(-1)}
            aria-label="이전 기간"
          >
            <Icon name="left" size={16} />
          </button>
          <button
            className="icon-btn"
            onClick={() => shift(1)}
            aria-label="다음 기간"
          >
            <Icon name="right" size={16} />
          </button>
          <button
            className="btn small"
            onClick={() => {
              setRange(null);
              setCursor(localDate());
              setPicked(localDate());
            }}
          >
            오늘
          </button>
        </div>
        <div className="segmented">
          {(["year", "month", "week", "day"] as const).map((m, i) => (
            <button
              key={m}
              className={mode === m ? "selected" : ""}
              onClick={() => {
                setRange(null);
                setMode(m);
                setCursor(picked);
              }}
            >
              {["연", "월", "주", "일"][i]}
            </button>
          ))}
        </div>
      </div>
      {(mode === "year" || mode === "month") && (
        <PlanEditor key={period} period={period} plan={plans[period] ?? ""}
          onSave={onSavePlan} busy={busy} monthEnd={lastDay} />
      )}
      {mode === "year" ? (
        <div className="year-months">
          {Array.from({ length: 12 }, (_, i) => {
            const month = `${year}-${String(i + 1).padStart(2, "0")}`;
            const count = active.filter((task) => task.date < localDate(new Date(Number(year), i + 1, 1)) &&
              (task.endDate ?? task.date) >= `${month}-01`).length;
            return (
              <button key={month} onClick={() => {
                setPicked(`${month}-01`);
                setCursor(`${month}-01`);
                setMode("month");
              }}>
                <strong>{i + 1}월</strong>
                <small>예정 일정 {count}개</small>
                {plans[month] && <span>{plans[month].slice(0, 120)}</span>}
              </button>
            );
          })}
        </div>
      ) : mode !== "month" ? (
        <TimeSchedule
          key={`${mode}:${days[0]}`}
          days={days}
          tasks={active}
          lists={lists}
          onSelect={onSelect}
          onDuplicate={onDuplicate}
          onSchedule={onSchedule}
          onAdd={onAdd}
        />
      ) : (
        <div className={`calendar-grid ${mode}`}>
          <div className="calendar-weekdays">
            {Array.from({ length: 7 }, (_, i) => (
              <span key={i}>
                {
                  ["일", "월", "화", "수", "목", "금", "토"][
                    (i + weekStart) % 7
                  ]
                }
              </span>
            ))}
          </div>
          <div className="calendar-cells" ref={monthGrid}>
            {days.map((day) => (
              <div
                key={day}
                data-calendar-day={day}
                className={`calendar-cell ${
                  day.slice(0, 7) !== cursor.slice(0, 7) ? "other-month" : ""
                } ${day === picked ? "picked" : ""} ${
                  range && day >= range.start && day <= range.end ? "range-selected" : ""
                }`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => drop(e, day)}
              >
                <button
                  className={`day-number ${
                    day === localDate() ? "is-today" : ""
                  }`}
                  onClick={() => { setPicked(day); setRange(null); }}
                  aria-label={`${day} 선택`}
                >
                  {Number(day.slice(-2))}
                </button>
                <button
                  className="day-add icon-btn"
                  aria-label={`${day} 할 일 추가`}
                  onClick={() => onAdd(day)}
                >
                  <Icon name="plus" size={13} />
                </button>
                <div className="calendar-events">
                  {active
                    .filter((t) => scheduledOn(t, day))
                    .sort((a, b) => a.time.localeCompare(b.time))
                    .slice(0, mode === "month" ? 3 : 30)
                    .map((t) => (
                      <button
                        key={t.id}
                        draggable
                        onDragStart={(e) =>
                          e.dataTransfer.setData("text/plain", t.id)
                        }
                        className={`calendar-event ${t.endDate ? "calendar-period-event" : ""}`}
                        aria-label={t.endDate ? `${t.title} ${t.date} ~ ${t.endDate}` : undefined}
                        style={
                          {
                            "--event-color":
                              lists.find((l) => l.id === t.listId)?.color ||
                              "#8a93a4",
                          } as React.CSSProperties
                        }
                        onClick={() => onSelect(t.id)}
                      >
                        {t.endDate && <span className="calendar-period-marker" aria-hidden="true">↔</span>}
                        <small>{t.time}</small>
                        {t.title}
                      </button>
                    ))}
                  {mode === "month" &&
                    active.filter((t) => scheduledOn(t, day)).length > 3 && (
                      <button
                        className="more-events"
                        onClick={() => {
                          setPicked(day);
                          setCursor(day);
                          setMode("day");
                        }}
                      >
                        +{active.filter((t) => scheduledOn(t, day)).length - 3}개 더
                        보기
                      </button>
                    )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {mode === "month" && range && (
        <div className="calendar-range-actions">
          <span role="status">{range.start}{range.end !== range.start && ` ~ ${range.end}`}</span>
          <button className="btn small" onClick={() => setRange(null)}>선택 취소</button>
          <button className="btn primary small" onClick={() => {
            setPicked(range.start);
            onAdd(range.start, "", { endDate: range.end !== range.start ? range.end : undefined });
            setRange(null);
          }}>일정 추가</button>
        </div>
      )}
      {mode !== "year" && <div className="calendar-agenda">
        <div>
          <h3>
            {new Date(`${picked}T12:00:00`).toLocaleDateString("ko-KR", {
              month: "long",
              day: "numeric",
              weekday: "long",
            })}
          </h3>
          <span>{daily.length}개의 일정</span>
        </div>
        {daily.length ? (
          daily.map((t) => (
            <button
              className="agenda-row"
              key={t.id}
              onClick={() => onSelect(t.id)}
            >
              <span>{t.time || "종일"}</span>
              <i
                style={{
                  background:
                    lists.find((l) => l.id === t.listId)?.color || "#8590a3",
                }}
              />
              <strong>{t.title}</strong>
              <Icon name="right" size={14} />
            </button>
          ))
        ) : (
          <p className="muted">
            아직 정해진 일정이 없어요. 여유로운 하루를 계획해 보세요.
          </p>
        )}
      </div>}
      <p className="view-tip">
        <Icon name="edit" size={13} />
        {mode === "month" ? "날짜를 길게 누르고 끌어서 기간을 선택할 수 있어요." : "일정을 끌어서 옮길 수 있어요."}
      </p>
    </section>
  );
}

function PlanEditor({ period, plan, onSave, busy, monthEnd }: {
  period: string;
  plan: string;
  onSave: (period: string, text: string) => Promise<boolean>;
  busy: boolean;
  monthEnd: number;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? plan;
  const monthly = period.length === 7;
  const month = Number(period.slice(-2));
  const [editing, setEditing] = useState(false);
  if (monthly && !editing) {
    return (
      <section className="plan-editor monthly-goal">
        <div>
          <strong>월간 목표</strong>
          <small>{month}월 1일 ~ {month}월 {monthEnd}일</small>
        </div>
        {plan && <p>{plan}</p>}
        <button className="btn small" onClick={() => setEditing(true)}>
          {plan ? "목표 수정" : "목표 추가"}
        </button>
      </section>
    );
  }
  return (
    <form className="plan-editor" onSubmit={async (event) => {
      event.preventDefault();
      if (await onSave(period, value.trim())) {
        setDraft(null);
        setEditing(false);
      }
    }}>
      <label>
        {monthly ? "월간 목표" : "연간 계획"}
        {monthly && <small>{month}월 1일 ~ {month}월 {monthEnd}일</small>}
        <textarea rows={2} maxLength={3000} value={value}
          disabled={busy} onChange={(event) => setDraft(event.target.value)} />
      </label>
      <div className="plan-editor-actions">
        {monthly && <button type="button" className="btn small" disabled={busy}
          onClick={() => { setDraft(null); setEditing(false); }}>편집 취소</button>}
        <button className="btn small" disabled={busy || value.trim() === plan}>
          {monthly ? "목표 저장" : "계획 저장"}
        </button>
      </div>
    </form>
  );
}
