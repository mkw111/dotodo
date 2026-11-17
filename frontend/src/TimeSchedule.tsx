import { useEffect, useRef, useState } from "react";
import { useCalendarHold } from "./useCalendarHold";
import { addDays, moveTaskDate, scheduledOn } from "./model";
import {
  layoutSchedule,
  minutesOf,
  snapDuration,
  snapStart,
  timeOf,
} from "./schedule";
import { localDate, type Task, type TaskList } from "./types";
import Icon from "./Icon";

const HOUR_HEIGHT = 80;
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
  onDuplicate,
  onSchedule,
  onAdd,
}: {
  days: string[];
  tasks: Task[];
  lists: TaskList[];
  onSelect: (id: string) => void;
  onDuplicate: (id: string) => Promise<string | null>;
  onSchedule: (id: string, patch: Partial<Task>) => Promise<boolean>;
  onAdd: (date: string, time?: string, options?: Pick<Task, "endDate" | "durationMinutes">) => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<{ date: string; start: number; end: number } | null>(null);
  useCalendarHold(viewport, (target, _x, y, starting) => {
    if (starting && !target?.closest(".schedule-hour-slot")) return null;
    const column = target?.closest<HTMLElement>("[data-schedule-date]");
    if (!column?.dataset.scheduleDate || !viewport.current?.contains(column)) return null;
    const minute = Math.floor(((y - column.getBoundingClientRect().top) / HOUR_HEIGHT) * 4) * 15;
    return { date: column.dataset.scheduleDate, minute: Math.max(0, Math.min(1425, minute)) };
  }, (a, b) => {
    if (a.date !== b.date) return;
    const start = Math.min(a.minute, b.minute);
    setRange({ date: a.date, start, end: Math.min(Math.max(a.minute, b.minute) + 15, start + 720) });
  }, () => setRange(null));
  const cleanup = useRef<(() => void) | null>(null);
  const skipClick = useRef(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [saving, setSaving] = useState(false);
  const [copyId, setCopyId] = useState<string | null>(null);
  const copiedEvent = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (copyId && !saving) copiedEvent.current?.focus({ preventScroll: true });
  }, [copyId, saving]);
  async function duplicate(taskId: string) {
    if (saving) return;
    setSaving(true);
    try {
      const id = await onDuplicate(taskId);
      if (id) setCopyId(id);
    } finally {
      setSaving(false);
    }
  }
  useEffect(() => {
    if (viewport.current) viewport.current.scrollTop = 7 * HOUR_HEIGHT;
    return () => cleanup.current?.();
  }, [days[0]]);
  const visible = tasks.map((t) =>
    t.id === preview?.id ? {
      ...t, ...moveTaskDate(t, preview.date), ...preview,
      ...(preview.time ? { endDate: undefined } : {}),
    } : t
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
  function begin(event: React.PointerEvent, task: Task, resize = false, grabbedDay = task.date) {
    if (saving || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    cleanup.current?.();
    const column = event.currentTarget.closest<HTMLElement>("[data-schedule-date]");
    const rect = column?.getBoundingClientRect();
    const startY = event.clientY;
    const startX = event.clientX;
    const duration = task.durationMinutes || 30;
    const start = task.time ? minutesOf(task.time) : 0;
    const dayOffset = Math.round((Date.parse(grabbedDay) - Date.parse(task.date)) / 86_400_000);
    const grab = rect ? ((event.clientY - rect.top) / HOUR_HEIGHT) * 60 - start : 0;
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
        const target = document.elementFromPoint(e.clientX, e.clientY)
          ?.closest<HTMLElement>("[data-schedule-date], [data-schedule-all-day]");
        if (!target) return;
        const allDay = target.dataset.scheduleAllDay;
        const targetRect = target.getBoundingClientRect();
        next = {
          ...next,
          date: allDay ? addDays(allDay, -dayOffset) : target.dataset.scheduleDate!,
          time: allDay ? "" : timeOf(
            snapStart(((e.clientY - targetRect.top) / HOUR_HEIGHT) * 60 - grab, duration)
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
        const saved = await onSchedule(task.id, {
          date: next.date,
          time: next.time,
          durationMinutes: next.durationMinutes,
        });
        if (saved && task.id === copyId) setCopyId(null);
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
        <span>드래그로 15분 단위 이동 · 아래쪽 손잡이로 길이 조정</span>
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
                data-schedule-all-day={day}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain");
                  if (tasks.some((t) => t.id === id))
                    void onSchedule(id, { date: day, time: "" });
                }}
              >
                {visible
                  .filter((t) => !t.time && scheduledOn(t, day))
                  .map((t) => (
                    <div key={t.id} className="schedule-all-day-event"
                      data-copy={t.id === copyId || undefined}>
                      <button
                        ref={t.id === copyId ? copiedEvent : undefined}
                        disabled={saving}
                        onPointerDown={(e) => begin(e, t, false, day)}
                        onClick={() => {
                          if (!skipClick.current) onSelect(t.id);
                        }}
                        title="시간표로 끌면 시간을 지정할 수 있어요"
                      >
                        {t.title}
                      </button>
                      <ScheduleActions title={t.title} disabled={saving}
                        onDuplicate={() => duplicate(t.id)} />
                    </div>
                  ))}
              </div>
            ))}
          </div>
          <div
            className="schedule-body"
            style={{
              gridTemplateColumns: `52px repeat(${days.length},minmax(0,1fr))`,
              height: 24 * HOUR_HEIGHT,
              "--schedule-hour": `${HOUR_HEIGHT}px`,
            } as React.CSSProperties}
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
                {range?.date === day && (
                  <div className="schedule-range-highlight" style={{
                    top: (range.start / 60) * HOUR_HEIGHT,
                    height: ((range.end - range.start) / 60) * HOUR_HEIGHT,
                  }} />
                )}
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
                    data-copy={task.id === copyId || undefined}
                    className={`schedule-event ${
                      preview?.id === task.id ? "drag-preview" : ""
                    }`}
                    style={
                      {
                        top: (start / 60) * HOUR_HEIGHT,
                        height: Math.max(
                          37,
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
                      ref={task.id === copyId ? copiedEvent : undefined}
                      className="schedule-event-main"
                      disabled={saving}
                      onPointerDown={(e) => {
                        if (e.pointerType !== "touch" || task.id === copyId) begin(e, task);
                      }}
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
                    <ScheduleActions title={task.title} disabled={saving}
                      onDuplicate={() => duplicate(task.id)} />
                    <button
                      className="schedule-move"
                      disabled={saving}
                      aria-label={`${task.title} 이동 손잡이`}
                      onPointerDown={(e) => begin(e, task)}
                      onClick={() => { if (!skipClick.current) onSelect(task.id); }}
                    >
                      <Icon name="menu" size={13} />
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
      {range && (
        <div className="calendar-range-actions">
          <span role="status">{range.date} · {timeOf(range.start)} ~ {timeOf(range.end)}</span>
          <button className="btn small" onClick={() => setRange(null)}>선택 취소</button>
          <button className="btn primary small" onClick={() => {
            onAdd(range.date, timeOf(range.start), { durationMinutes: range.end - range.start });
            setRange(null);
          }}>일정 추가</button>
        </div>
      )}
      {preview && (
        <div className="schedule-drag-readout" role="status">
          {preview.date} · {preview.time ? (
            <>{preview.time} – {timeOf(Math.min(1440, minutesOf(preview.time) + preview.durationMinutes))}
              {" · "}{preview.durationMinutes}분</>
          ) : "종일"}
        </div>
      )}
    </div>
  );
}

function ScheduleActions({ title, disabled, onDuplicate }: {
  title: string;
  disabled: boolean;
  onDuplicate: () => Promise<void>;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const action = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button type="button" className="schedule-actions" aria-label={`${title} 일정 메뉴`}
        aria-haspopup="true" disabled={disabled}
        onClick={(event) => {
          const popup = menu.current;
          if (!popup) return;
          const rect = event.currentTarget.getBoundingClientRect();
          popup.style.left = `${Math.max(8, Math.min(rect.right - 112, innerWidth - 120))}px`;
          popup.style.top = `${rect.bottom + 48 < innerHeight ? rect.bottom + 4 : rect.top - 48}px`;
          popup.showPopover();
          action.current?.focus();
        }}>
        <Icon name="more" size={14} />
      </button>
      <div ref={menu} popover="auto" className="schedule-actions-popup">
        <button ref={action} type="button" className="btn small"
          onClick={() => {
            menu.current?.hidePopover();
            void onDuplicate();
          }}>
          복제
        </button>
      </div>
    </>
  );
}
