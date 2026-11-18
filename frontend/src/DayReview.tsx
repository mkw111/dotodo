import { useRef, useState, type ComponentProps } from "react";
import Modal from "./Modal";
import TimeSchedule from "./TimeSchedule";
import { newTask } from "./model";
import { minutesOf } from "./schedule";
import type { Task, TaskList } from "./types";

function durationLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return [hours ? `${hours}시간` : "", remainder || !hours ? `${remainder}분` : ""].filter(Boolean).join(" ");
}

function totalMinutes(tasks: Task[]) {
  return tasks.reduce((sum, task) => sum + Math.min(task.durationMinutes ?? 30, 1440 - minutesOf(task.time)), 0);
}

export default function DayReview({
  date, plans, actuals, lists, busy, onSave, onDelete, planActions,
}: {
  date: string;
  plans: Task[];
  actuals: Task[];
  lists: TaskList[];
  busy: boolean;
  onSave: (task: Task) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  planActions: Pick<ComponentProps<typeof TimeSchedule>, "onSelect" | "onDuplicate" | "onSchedule" | "onAdd">;
}) {
  const [draft, setDraft] = useState<Task | null>(null);
  const timeline = useRef<HTMLDivElement>(null);
  const planned = plans.filter((task) => task.date === date && task.time);
  const recorded = actuals.filter((task) => task.date === date && task.time);
  const groups = [{ id: "inbox", name: "수집함" }, ...lists].map((list) => ({
    ...list,
    plan: totalMinutes(planned.filter((task) => task.listId === list.id)),
    actual: totalMinutes(recorded.filter((task) => task.listId === list.id)),
  })).filter((list) => list.plan || list.actual);

  function syncScroll(source: HTMLDivElement) {
    for (const pane of timeline.current?.querySelectorAll<HTMLElement>(".schedule-viewport") ?? []) {
      if (pane !== source && pane.scrollTop !== source.scrollTop) pane.scrollTop = source.scrollTop;
    }
  }
  function newActual(day: string, time: string, options?: Pick<Task, "durationMinutes">, source?: Task) {
    const duration = options?.durationMinutes ?? source?.durationMinutes ?? 30;
    return newTask(source?.title ?? "", {
      actual: true,
      date: day,
      time,
      listId: source?.listId ?? "inbox",
      notes: source?.notes ?? "",
      durationMinutes: Math.min(duration, 1440 - minutesOf(time)),
    });
  }
  function createActual(day: string, time = "09:00", options?: Pick<Task, "durationMinutes">, source?: Task) {
    if (!busy) setDraft(newActual(day, time, options, source));
  }

  return (
    <section className="day-review" aria-label="하루 돌아보기">
      <div ref={timeline} className="review-timeline">
        <section>
          <h3>계획 <small>{durationLabel(totalMinutes(planned))}</small></h3>
          <TimeSchedule days={[date]} tasks={planned} lists={lists} {...planActions}
            onScroll={syncScroll}
            onTransfer={(task, time) => busy ? Promise.resolve(false) : onSave(newActual(date, time, undefined, task))} />
        </section>
        <section>
          <h3>실행 <small>{durationLabel(totalMinutes(recorded))}</small></h3>
          <TimeSchedule days={[date]} tasks={recorded} lists={lists} actualPane
            onScroll={syncScroll} onAdd={createActual}
            onSelect={(id) => setDraft(recorded.find((task) => task.id === id) ?? null)}
            onDuplicate={async (id) => {
              const source = recorded.find((task) => task.id === id);
              if (source) createActual(source.date, source.time, undefined, source);
              return null;
            }}
            onSchedule={(id, patch) => {
              const task = recorded.find((item) => item.id === id);
              return task && patch.time !== "" ? onSave({ ...task, ...patch }) : Promise.resolve(false);
            }} />
        </section>
      </div>
      <p className="review-help">계획을 오른쪽으로 끌거나 메뉴에서 실행에 복사하세요. 오른쪽 빈 시간대를 길게 눌러 실행을 기록할 수도 있어요.</p>
      <section className="review-stats" aria-label="하루 시간 통계">
        <h3>리스트별 시간</h3>
        <table>
          <thead><tr><th scope="col">리스트</th><th scope="col">계획</th><th scope="col">실행</th><th scope="col">차이</th></tr></thead>
          <tbody>
            {groups.map((group) => {
              const difference = group.actual - group.plan;
              return <tr key={group.id}><th scope="row">{group.name}</th>
                <td>{durationLabel(group.plan)}</td><td>{durationLabel(group.actual)}</td>
                <td>{difference > 0 ? "+" : difference < 0 ? "−" : ""}{durationLabel(Math.abs(difference))}</td>
              </tr>;
            })}
            {!groups.length && <tr><td colSpan={4}>시간을 지정한 일정이나 실행 기록이 없어요.</td></tr>}
          </tbody>
        </table>
      </section>
      {draft && (
        <Modal title="실행 기록" onClose={() => { if (!busy) setDraft(null); }}>
          <form onKeyDown={(event) => {
            if (event.key === "Enter" && event.target instanceof HTMLInputElement &&
                !event.nativeEvent.isComposing) event.preventDefault();
          }} onSubmit={async (event) => {
            event.preventDefault();
            if (!draft.title.trim() || busy) return;
            if (await onSave({ ...draft, title: draft.title.trim() })) setDraft(null);
          }}>
            <label className="form-field">활동 이름
              <input required maxLength={150} value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
            </label>
            <label className="form-field">시작 시간
              <input type="time" required value={draft.time} onChange={(event) => {
                const time = event.target.value;
                setDraft({ ...draft, time, durationMinutes: time
                  ? Math.min(draft.durationMinutes ?? 30, 1440 - minutesOf(time))
                  : draft.durationMinutes });
              }} />
            </label>
            <label className="form-field">소요 시간 (분)
              <input type="number" required min={1} max={Math.min(720, draft.time ? 1440 - minutesOf(draft.time) : 720)}
                value={draft.durationMinutes || ""} onChange={(event) => {
                  setDraft({ ...draft, durationMinutes: Number(event.target.value) });
                }} />
            </label>
            <label className="form-field">리스트
              <select value={draft.listId} onChange={(event) => setDraft({ ...draft, listId: event.target.value })}>
                <option value="inbox">수집함</option>
                {lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
              </select>
            </label>
            <label className="form-field">메모
              <textarea maxLength={20000} value={draft.notes}
                onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
            </label>
            <div className="dialog-actions">
              {recorded.some((task) => task.id === draft.id) && (
                <button type="button" className="text-btn danger" disabled={busy} onClick={async () => {
                  if (await onDelete(draft.id)) setDraft(null);
                }}>삭제</button>
              )}
              <button type="button" className="btn" disabled={busy} onClick={() => setDraft(null)}>취소</button>
              <button className="btn primary" disabled={busy || !draft.title.trim()}>저장</button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
