import { useState } from "react";
import Icon from "./Icon";
import TimeSchedule from "./TimeSchedule";
import { addDays } from "./model";
import { localDate, type Task, type TaskList } from "./types";

export default function CalendarView({
  initialDate,
  tasks,
  lists,
  weekStart,
  onSelect,
  onMove,
  onAdd,
  onSchedule,
}: {
  initialDate: string;
  tasks: Task[];
  lists: TaskList[];
  weekStart: 0 | 1;
  onSelect: (id: string) => void;
  onMove: (id: string, date: string) => void;
  onAdd: (date: string, time?: string) => void;
  onSchedule: (id: string, patch: Partial<Task>) => Promise<boolean>;
}) {
  const [cursor, setCursor] = useState(initialDate);
  const [mode, setMode] = useState<"month" | "week" | "day">("month");
  const [picked, setPicked] = useState(initialDate);
  const current = new Date(`${cursor}T12:00:00`);
  const first = new Date(current.getFullYear(), current.getMonth(), 1);
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
    .filter((t) => t.date === picked)
    .sort((a, b) => a.time.localeCompare(b.time));
  function shift(direction: number) {
    if (mode === "month") {
      const d = new Date(`${cursor}T12:00:00`);
      d.setDate(1);
      d.setMonth(d.getMonth() + direction);
      setCursor(localDate(d));
    } else setCursor(addDays(cursor, direction * (mode === "week" ? 7 : 1)));
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
            {current.getFullYear()}년 {current.getMonth() + 1}월
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
              setCursor(localDate());
              setPicked(localDate());
            }}
          >
            오늘
          </button>
        </div>
        <div className="segmented">
          {(["month", "week", "day"] as const).map((m, i) => (
            <button
              key={m}
              className={mode === m ? "selected" : ""}
              onClick={() => {
                setMode(m);
                setCursor(picked);
              }}
            >
              {["월", "주", "일"][i]}
            </button>
          ))}
        </div>
      </div>
      {mode !== "month" ? (
        <TimeSchedule
          key={`${mode}:${days[0]}`}
          days={days}
          tasks={active}
          lists={lists}
          onSelect={onSelect}
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
          <div className="calendar-cells">
            {days.map((day) => (
              <div
                key={day}
                className={`calendar-cell ${
                  day.slice(0, 7) !== cursor.slice(0, 7) ? "other-month" : ""
                } ${day === picked ? "picked" : ""}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => drop(e, day)}
              >
                <button
                  className={`day-number ${
                    day === localDate() ? "is-today" : ""
                  }`}
                  onClick={() => setPicked(day)}
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
                    .filter((t) => t.date === day)
                    .sort((a, b) => a.time.localeCompare(b.time))
                    .slice(0, mode === "month" ? 3 : 30)
                    .map((t) => (
                      <button
                        key={t.id}
                        draggable
                        onDragStart={(e) =>
                          e.dataTransfer.setData("text/plain", t.id)
                        }
                        className="calendar-event"
                        style={
                          {
                            "--event-color":
                              lists.find((l) => l.id === t.listId)?.color ||
                              "#8a93a4",
                          } as React.CSSProperties
                        }
                        onClick={() => onSelect(t.id)}
                      >
                        <small>{t.time}</small>
                        {t.title}
                      </button>
                    ))}
                  {mode === "month" &&
                    active.filter((t) => t.date === day).length > 3 && (
                      <button
                        className="more-events"
                        onClick={() => {
                          setPicked(day);
                          setCursor(day);
                          setMode("day");
                        }}
                      >
                        +{active.filter((t) => t.date === day).length - 3}개 더
                        보기
                      </button>
                    )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="calendar-agenda">
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
      </div>
      <p className="view-tip">
        <Icon name="edit" size={13} />
        일정을 다른 날짜로 끌어 옮기거나, 상세 화면에서 날짜를 변경하세요.
      </p>
    </section>
  );
}
