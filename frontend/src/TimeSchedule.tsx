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
const SCROLL_EDGE = 48;
const scrollSpeed = (y: number, top: number, bottom: number, edge: number) => {
  if (y < top || y > bottom || edge <= 0) return 0;
  if (y < top + edge) return -12 * (1 - (y - top) / edge);
  if (y > bottom - edge) return 12 * (1 - (bottom - y) / edge);
  return 0;
};
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
  actualPane = false,
  onTransfer,
  onScroll,
}: {
  days: string[];
  actualPane?: boolean;
  onTransfer?: (task: Task, time: string) => Promise<boolean>;
  onScroll?: (element: HTMLDivElement) => void;
  tasks: Task[];
  lists: TaskList[];
  onSelect: (id: string) => void;
  onDuplicate: (id: string) => Promise<string | null>;
  onSchedule: (id: string, patch: Partial<Task>) => Promise<boolean>;
  onAdd: (date: string, time?: string, options?: Pick<Task, "endDate" | "durationMinutes">) => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const allDayList = useRef<HTMLDivElement>(null);
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
  const [touchSource, setTouchSource] = useState<{ task: Task; day: string } | null>(null);
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
  function tasksInColumn(matches: (task: Task) => boolean, day: string) {
    // Touch events keep their original target when the preview crosses columns or rows.
    return visible.flatMap((task) => {
      if (matches(task)) return [task];
      if (touchSource?.day === day && task.id === touchSource.task.id && matches(touchSource.task))
        return [touchSource.task];
      return [];
    });
  }
  function isTouchPlaceholder(task: Task) {
    return touchSource?.task === task && Boolean(preview && !visible.includes(task));
  }
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
  function holdToMove(event: React.TouchEvent<HTMLButtonElement>, task: Task, day = task.date) {
    if (saving || event.touches.length !== 1) return;
    cleanup.current?.();
    const target = event.currentTarget;
    const touch = event.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;
    const timer = setTimeout(() => {
      cleanup.current?.();
      skipClick.current = true;
      begin({
        currentTarget: target, clientX: x, clientY: y, button: 0,
        preventDefault() {}, stopPropagation() {},
      }, task, false, day, true);
    }, 420);
    const move = (next: TouchEvent) => {
      const point = next.touches[0];
      if (next.touches.length !== 1 || !point ||
          Math.hypot(point.clientX - x, point.clientY - y) > 9) cleanup.current?.();
    };
    const stop = () => cleanup.current?.();
    cleanup.current = () => {
      clearTimeout(timer);
      target.removeEventListener("touchmove", move);
      target.removeEventListener("touchend", stop);
      target.removeEventListener("touchcancel", stop);
      cleanup.current = null;
    };
    target.addEventListener("touchmove", move, { passive: true });
    target.addEventListener("touchend", stop);
    target.addEventListener("touchcancel", stop);
  }
  function begin(event: {
    currentTarget: Element; clientX: number; clientY: number; button: number;
    pointerId?: number; pointerType?: string;
    preventDefault: () => void; stopPropagation: () => void;
  }, task: Task, resize = false, grabbedDay = task.date, touchDrag = false) {
    if (saving || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    cleanup.current?.();
    const column = event.currentTarget.closest<HTMLElement>("[data-schedule-date]");
    const pointerCapture = event.pointerType === "touch" ? viewport.current : null;
    if (pointerCapture && event.pointerId !== undefined) pointerCapture.setPointerCapture(event.pointerId);
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
    let transfer = false;
    let validDrop = true;
    let frame = 0;
    let point = { x: startX, y: startY };
    if (touchDrag) {
      setTouchSource({ task, day: grabbedDay });
      setPreview({ ...next });
    }
    const updateDrop = () => {
      if (resize) {
        const scrolled = rect && column ? rect.top - column.getBoundingClientRect().top : 0;
        next = {
          ...next,
          durationMinutes: snapDuration(
            duration + ((point.y - startY + scrolled) / HOUR_HEIGHT) * 60,
            start
          ),
        };
      } else {
        const target = document.elementFromPoint(point.x, point.y)
          ?.closest<HTMLElement>("[data-schedule-date], [data-schedule-all-day]");
        transfer = Boolean(onTransfer && target?.closest("[data-actual-pane]") && target.dataset.scheduleDate);
        validDrop = Boolean(target && (transfer || viewport.current?.contains(target)));
        if (!target || !validDrop) {
          setPreview(null);
          return;
        }
        const allDay = target.dataset.scheduleAllDay;
        const targetRect = target.getBoundingClientRect();
        next = {
          ...next,
          date: allDay ? addDays(allDay, -dayOffset) : target.dataset.scheduleDate!,
          time: allDay ? "" : timeOf(
            snapStart(((point.y - targetRect.top) / HOUR_HEIGHT) * 60 - grab, duration)
          ),
        };
      }
      setPreview(transfer ? null : { ...next });
    };
    const autoScroll = () => {
      const container = viewport.current;
      frame = requestAnimationFrame(autoScroll);
      if (container) {
        const hit = document.elementFromPoint(point.x, point.y);
        const target = hit?.closest<HTMLElement>(".schedule-viewport");
        const scroller = transfer ? target : container;
        if (!scroller || target !== scroller) return;
        const box = scroller.getBoundingClientRect();
        const list = scroller === container ? allDayList.current : null;
        const inAllDay = list && hit && list.contains(hit);
        const scrollArea = inAllDay ? list : scroller;
        const area = scrollArea.getBoundingClientRect();
        const stickyBottom = scroller.querySelector(".schedule-all-day")?.getBoundingClientRect().bottom ?? 0;
        const top = Math.max(0, area.top, inAllDay ? box.top : stickyBottom);
        const nav = document.querySelector(".mobile-bottom-nav")?.getBoundingClientRect();
        const bottom = Math.min(area.bottom, window.innerHeight, nav?.height ? nav.top : Infinity);
        const previous = scrollArea.scrollTop;
        scrollArea.scrollTop += scrollSpeed(point.y, top, bottom, Math.min(SCROLL_EDGE, (bottom - top) / 2));
        if (scrollArea.scrollTop !== previous) updateDrop();
      }
    };
    const move = (e: { clientX: number; clientY: number; preventDefault: () => void }) => {
      if (!moved && Math.abs(e.clientY - startY) + Math.abs(e.clientX - startX) < 4) return;
      e.preventDefault();
      point = { x: e.clientX, y: e.clientY };
      if (!moved) frame = requestAnimationFrame(autoScroll);
      moved = true;
      updateDrop();
    };
    const stop = async () => {
      cleanup.current?.();
      setTouchSource(null);
      skipClick.current = true;
      setTimeout(() => {
        skipClick.current = false;
      }, touchDrag ? 500 : 100);
      if (!moved) {
        setPreview(null);
        if (!resize && !touchDrag) onSelect(task.id);
        return;
      }
      if (!validDrop) {
        setPreview(null);
        return;
      }
      setSaving(true);
      try {
        if (transfer && onTransfer) {
          await onTransfer(task, next.time);
          return;
        }
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
      setTouchSource(null);
      setPreview(null);
      skipClick.current = true;
      setTimeout(() => { skipClick.current = false; }, 500);
    };
    const touchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) { cancel(); return; }
      const point = e.touches[0];
      move({ clientX: point.clientX, clientY: point.clientY,
        preventDefault: () => { if (e.cancelable) e.preventDefault(); } });
    };
    cleanup.current = () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", stop);
      document.removeEventListener("pointercancel", cancel);
      document.removeEventListener("touchmove", touchMove);
      document.removeEventListener("touchend", stop);
      document.removeEventListener("touchcancel", cancel);
      if (event.pointerId !== undefined && pointerCapture?.hasPointerCapture(event.pointerId))
        pointerCapture.releasePointerCapture(event.pointerId);
      cleanup.current = null;
    };
    if (touchDrag) {
      document.addEventListener("touchmove", touchMove, { passive: false });
      document.addEventListener("touchend", stop);
      document.addEventListener("touchcancel", cancel);
      return;
    }
    document.addEventListener("pointermove", move, { passive: false });
    document.addEventListener("pointerup", stop, { once: true });
    document.addEventListener("pointercancel", cancel, { once: true });
  }
  return (
    <div className="time-schedule">
      <div className="schedule-caption">
        <Icon name="clock" size={14} />
        <span>길게 눌러 15분 단위 이동 · 아래쪽 손잡이로 길이 조정</span>
        <small>일정을 누르면 상세 편집</small>
      </div>
      <div className="schedule-viewport" ref={viewport}
        data-actual-pane={actualPane || undefined}
        onScroll={onScroll ? (event) => onScroll(event.currentTarget) : undefined}>
        <div
          className={`schedule-inner ${days.length === 1 ? "single-day" : ""}`}
        >
          <div
            className="schedule-days"
            style={{
              gridTemplateColumns: `var(--schedule-time-width, 52px) repeat(${days.length},minmax(0,1fr))`,
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
            ref={allDayList}
            style={{
              gridTemplateColumns: `var(--schedule-time-width, 52px) repeat(${days.length},minmax(0,1fr))`,
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
                {tasksInColumn((t) => !t.time && scheduledOn(t, day), day)
                  .map((t) => (
                    <div key={t.id} className="schedule-all-day-event"
                      data-touch-placeholder={isTouchPlaceholder(t) || undefined}
                      data-copy={t.id === copyId || undefined}>
                      <button
                        ref={t.id === copyId ? copiedEvent : undefined}
                        disabled={saving}
                        onPointerDown={(e) => {
                          if (e.pointerType !== "touch") begin(e, t, false, day);
                        }}
                        onTouchStart={(e) => holdToMove(e, t, day)}
                        onContextMenu={(e) => e.preventDefault()}
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
              gridTemplateColumns: `var(--schedule-time-width, 52px) repeat(${days.length},minmax(0,1fr))`,
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
                  <div className="schedule-range-highlight" aria-label="저장 전 시간 선택" style={{
                    top: (range.start / 60) * HOUR_HEIGHT,
                    height: ((range.end - range.start) / 60) * HOUR_HEIGHT,
                  }}><span>시간 선택</span></div>
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
                  tasksInColumn((t) => t.date === day && Boolean(t.time), day)
                ).map(({ task, start, end, column, columns }) => (
                  <article
                    key={task.id}
                    data-touch-placeholder={isTouchPlaceholder(task) || undefined}
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
                        if (e.pointerType !== "touch") begin(e, task);
                      }}
                      onTouchStart={(event) => holdToMove(event, task)}
                      onContextMenu={(event) => event.preventDefault()}
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
                      onTransfer={onTransfer ? () => onTransfer(task, task.time) : undefined}
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
          }}>일정 작성</button>
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

function ScheduleActions({ title, disabled, onDuplicate, onTransfer }: {
  title: string;
  disabled: boolean;
  onDuplicate: () => Promise<void>;
  onTransfer?: () => Promise<boolean>;
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
        {onTransfer && <button type="button" className="btn small" onClick={() => {
          menu.current?.hidePopover();
          void onTransfer();
        }}>실행에 복사</button>}
      </div>
    </>
  );
}
