import { useEffect, useRef, useState } from "react";
import { addDays } from "./model";
import {
  layoutSchedule,
  minutesOf,
  snapDuration,
  snapStart,
  timeOf,
} from "./schedule";
import { localDate, type Task, type TaskList } from "./types";
import Icon from "./Icon";

const HOUR_HEIGHT = 48;
type Preview = {
  id: string;
  date: string;
  time: string;
  durationMinutes: number;
};
export default function TimeSchedule({
  days,
  tasks,
  lists,
  onSelect,
  onSchedule,
  onAdd,
}: {
  days: string[];
  tasks: Task[];
  lists: TaskList[];
  onSelect: (id: string) => void;
  onSchedule: (id: string, patch: Partial<Task>) => Promise<boolean>;
  onAdd: (date: string, time?: string) => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const cleanup = useRef<(() => void) | null>(null);
  const skipClick = useRef(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (viewport.current) viewport.current.scrollTop = 7 * HOUR_HEIGHT;
    return () => cleanup.current?.();
  }, [days[0]]);
  const visible = tasks.map((t) =>
    t.id === preview?.id ? { ...t, ...preview } : t
  );
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  function scheduleAt(event: React.DragEvent, date: string) {
    event.preventDefault();
    const task = tasks.find(
      (t) => t.id === event.dataTransfer.getData("text/plain")
    );
    if (!task) return;
    const rect = event.currentTarget.getBoundingClientRect();
    void onSchedule(task.id, {
      date,
      time: timeOf(
        snapStart(
          ((event.clientY - rect.top) / HOUR_HEIGHT) * 60,
          task.durationMinutes || 30
        )
      ),
      durationMinutes: task.durationMinutes || 30,
    });
  }
  function begin(event: React.PointerEvent, task: Task, resize = false) {
    if (saving || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    cleanup.current?.();
    const column = event.currentTarget.closest<HTMLElement>(
      "[data-schedule-date]"
    )!;
    const rect = column.getBoundingClientRect();
    const startY = event.clientY;
    const startX = event.clientX;
    const duration = task.durationMinutes || 30;
    const start = minutesOf(task.time);
    const grab = ((event.clientY - rect.top) / HOUR_HEIGHT) * 60 - start;
    let next: Preview = {
      id: task.id,
      date: task.date,
      time: task.time,
      durationMinutes: duration,
    };
    let moved = false;
    const move = (e: PointerEvent) => {
      if (
        Math.abs(e.clientY - startY) + Math.abs(e.clientX - startX) < 4 &&
        !moved
      )
        return;
      e.preventDefault();
      moved = true;
      if (resize)
        next = {
          ...next,
          durationMinutes: snapDuration(
            duration + ((e.clientY - startY) / HOUR_HEIGHT) * 60,
            start
          ),
        };
      else {
        const target = document
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest<HTMLElement>("[data-schedule-date]");
        if (!target) return;
        const targetRect = target.getBoundingClientRect();
        next = {
          ...next,
          date: target.dataset.scheduleDate!,
          time: timeOf(
            snapStart(
              ((e.clientY - targetRect.top) / HOUR_HEIGHT) * 60 - grab,
              duration
            )
          ),
        };
      }
      setPreview({ ...next });
      const container = viewport.current;
      if (container) {
        const box = container.getBoundingClientRect();
        if (e.clientY > box.bottom - 45) container.scrollTop += 12;
        else if (e.clientY < box.top + 110) container.scrollTop -= 12;
      }
    };
    const stop = async () => {
      cleanup.current?.();
      skipClick.current = true;
      setTimeout(() => {
        skipClick.current = false;
      }, 100);
      if (!moved) {
        if (!resize) onSelect(task.id);
        return;
      }
      setSaving(true);
      try {
        await onSchedule(task.id, {
          date: next.date,
          time: next.time,
          durationMinutes: next.durationMinutes,
        });
      } finally {
        setPreview(null);
        setSaving(false);
      }
    };
    const cancel = () => {
      cleanup.current?.();
      setPreview(null);
    };
    cleanup.current = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", stop);
      document.removeEventListener("pointercancel", cancel);
      cleanup.current = null;
    };
    document.addEventListener("pointermove", move, { passive: false });
    document.addEventListener("pointerup", stop, { once: true });
    document.addEventListener("pointercancel", cancel, { once: true });
  }
  return (
    <div className="time-schedule">
      <div className="schedule-caption">
        <Icon name="clock" size={14} />
        <span>15분 단위로 드래그 · 아래쪽 손잡이로 길이 조정</span>
        <small>일정을 누르면 상세 편집</small>
      </div>
      <div className="schedule-viewport" ref={viewport}>
        <div
          className={`schedule-inner ${days.length === 1 ? "single-day" : ""}`}
        >
          <div
            className="schedule-days"
            style={{
              gridTemplateColumns: `52px repeat(${days.length},minmax(0,1fr))`,
            }}
          >
            <span>
              GMT{-now.getTimezoneOffset() / 60 >= 0 ? "+" : ""}
              {-now.getTimezoneOffset() / 60}
            </span>
            {days.map((day) => (
              <button
                key={day}
                className={day === localDate() ? "today" : ""}
                onClick={() => onAdd(day)}
              >
                <small>
                  {
                    ["일", "월", "화", "수", "목", "금", "토"][
                      new Date(`${day}T12:00:00`).getDay()
                    ]
                  }
                </small>
                <strong>{Number(day.slice(-2))}</strong>
              </button>
            ))}
          </div>
          <div
            className="schedule-all-day"
            style={{
              gridTemplateColumns: `52px repeat(${days.length},minmax(0,1fr))`,
            }}
          >
            <span>종일</span>
            {days.map((day) => (
              <div
                key={day}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain");
                  if (tasks.some((t) => t.id === id))
                    void onSchedule(id, { date: day, time: "" });
                }}
              >
                {visible
                  .filter((t) => t.date === day && !t.time)
                  .map((t) => (
                    <button
                      key={t.id}
                      draggable
                      onDragStart={(e) =>
                        e.dataTransfer.setData("text/plain", t.id)
                      }
                      onClick={() => onSelect(t.id)}
                      title="시간표로 끌면 시간을 지정할 수 있어요"
                    >
                      {t.title}
                    </button>
                  ))}
              </div>
            ))}
          </div>
          <div
            className="schedule-body"
            style={{
              gridTemplateColumns: `52px repeat(${days.length},minmax(0,1fr))`,
            }}
          >
            <div className="schedule-hours">
              {Array.from({ length: 24 }, (_, i) => (
                <span key={i} style={{ top: i * HOUR_HEIGHT }}>
                  {String(i).padStart(2, "0")}:00
                </span>
              ))}
            </div>
            {days.map((day) => (
              <div
                key={day}
                data-schedule-date={day}
                className="schedule-day-column"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => scheduleAt(e, day)}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <button
                    className="schedule-hour-slot"
                    key={i}
                    style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                    aria-label={`${day} ${String(i).padStart(
                      2,
                      "0"
                    )}:00 새 일정`}
                    onClick={(e) => {
                      const rect =
                        e.currentTarget.parentElement!.getBoundingClientRect();
                      const minute =
                        e.detail === 0
                          ? i * 60
                          : snapStart(
                              ((e.clientY - rect.top) / HOUR_HEIGHT) * 60
                            );
                      onAdd(day, timeOf(minute));
                    }}
                  />
                ))}
                {day === localDate() && (
                  <div
                    className="schedule-now-line"
                    style={{ top: (currentMinutes / 60) * HOUR_HEIGHT }}
                  >
                    <i />
                  </div>
                )}
                {layoutSchedule(
                  visible.filter((t) => t.date === day && t.time)
                ).map(({ task, start, end, column, columns }) => (
                  <article
                    key={task.id}
                    className={`schedule-event ${
                      preview?.id === task.id ? "drag-preview" : ""
                    }`}
                    style={
                      {
                        top: (start / 60) * HOUR_HEIGHT,
                        height: Math.max(
                          21,
                          ((end - start) / 60) * HOUR_HEIGHT
                        ),
                        left: `calc(${(column / columns) * 100}% + 3px)`,
                        width: `calc(${100 / columns}% - 6px)`,
                        "--event-color":
                          lists.find((l) => l.id === task.listId)?.color ||
                          "#8193ae",
                      } as React.CSSProperties
                    }
                  >
                    <button
                      className="schedule-event-main"
                      disabled={saving}
                      onPointerDown={(e) => begin(e, task)}
                      onClick={() => {
                        if (!skipClick.current) onSelect(task.id);
                      }}
                      onKeyDown={(e) => {
                        if (
                          e.altKey &&
                          ["ArrowUp", "ArrowDown"].includes(e.key)
                        ) {
                          e.preventDefault();
                          void onSchedule(task.id, {
                            time: timeOf(
                              snapStart(
                                start + (e.key === "ArrowUp" ? -15 : 15),
                                task.durationMinutes || 30
                              )
                            ),
                          });
                        } else if (
                          e.altKey &&
                          ["ArrowLeft", "ArrowRight"].includes(e.key)
                        ) {
                          e.preventDefault();
                          void onSchedule(task.id, {
                            date: addDays(day, e.key === "ArrowLeft" ? -1 : 1),
                          });
                        }
                      }}
                      aria-label={`${task.title} ${task.time}부터 ${timeOf(
                        end
                      )}. Alt 방향키로 이동`}
                    >
                      <strong>{task.title}</strong>
                      <span>
                        {task.time} – {timeOf(end)}
                      </span>
                    </button>
                    <button
                      className="schedule-resize"
                      disabled={saving}
                      aria-label={`${task.title} 소요 시간 조정`}
                      title="끌어서 길이 조정 · 위/아래 방향키로 15분 조정"
                      onPointerDown={(e) => begin(e, task, true)}
                      onKeyDown={(e) => {
                        if (["ArrowUp", "ArrowDown"].includes(e.key)) {
                          e.preventDefault();
                          void onSchedule(task.id, {
                            durationMinutes: snapDuration(
                              (task.durationMinutes || 30) +
                                (e.key === "ArrowUp" ? -15 : 15),
                              start
                            ),
                          });
                        }
                      }}
                    >
                      <i />
                    </button>
                  </article>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      {preview && (
        <div className="schedule-drag-readout" role="status">
          {preview.date} · {preview.time} –{" "}
          {timeOf(
            Math.min(1440, minutesOf(preview.time) + preview.durationMinutes)
          )}{" "}
          · {preview.durationMinutes}분
        </div>
      )}
    </div>
  );
}
