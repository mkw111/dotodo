import { useEffect, useRef, useState } from "react";
import SmartTaskInput from "./SmartTaskInput";
import { recognizeInput } from "./smartInput";
import Icon from "./Icon";
import { moveTaskDate, uid } from "./model";
import {
  priorityNames,
  repeatNames,
  type Task,
  type TaskList,
  type Priority,
  type Repeat,
  localDate,
} from "./types";

export default function TaskDetail({
  task,
  lists,
  busy,
  onClose,
  onDiscard,
  habitLimitReached = false,
  onSave,
  onToggle,
  onDelete,
  onFocus,
  onDirtyChange,
  isNew = false,
}: {
  task: Task;
  lists: TaskList[];
  busy: boolean;
  onClose: () => void;
  onDiscard: () => void;
  habitLimitReached?: boolean;
  onSave: (task: Task, linkHabit?: boolean) => Promise<boolean>;
  onToggle: (task: Task, linkHabit?: boolean) => Promise<boolean>;
  onDelete: () => void;
  onFocus: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  isNew?: boolean;
}) {
  const [customReminder, setCustomReminder] = useState(
    task.reminderMinutes !== undefined && ![0, 10, 30].includes(task.reminderMinutes)
  );
  const [draft, setDraft] = useState(task);
  const [habitDraft, setHabitDraft] = useState<boolean | null>(null);
  const linkHabit = (habitDraft ?? Boolean(task.habitId)) && draft.repeat === "daily" && Boolean(draft.date);
  const [dirty, setDirty] = useState(false);
  const [item, setItem] = useState("");
  const [tags, setTags] = useState(task.tags.join(", "));
  const [rawTitle, setRawTitle] = useState(task.title);
  const [ignored, setIgnored] = useState<string[]>([]);
  const titleEditor = useRef<HTMLDivElement>(null);
  const recognized = recognizeInput(rawTitle, localDate(), ignored);
  function smartChange(text: string, keys = ignored) {
    const available = new Set(
      recognizeInput(text, localDate()).tokens.map((t) => t.key)
    );
    keys = keys.filter((key) => available.has(key));
    const parsed = recognizeInput(text, localDate(), keys);
    setRawTitle(text);
    setIgnored(keys);
    const date = parsed.date || (parsed.dateRecognitionDisabled ? "" :
      recognized.date ? task.date : draft.date);
    const time = date ? parsed.time || (recognized.time ? task.time : draft.time) : "";
    const rangeSource = recognized.time && !parsed.time ? task : draft;
    change({
      ...moveTaskDate(rangeSource, date),
      title: parsed.title,
      time,
      ...(time ? { endDate: undefined } : {}),
      repeat: date ? parsed.repeat !== "none" ? parsed.repeat :
        recognized.repeat !== "none" ? task.repeat : draft.repeat : "none",
      priority: parsed.priority || (recognized.priority ? task.priority : draft.priority),
    });
  }
  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) {
      setDraft(task);
      setTags(task.tags.join(", "));
    }
  }, [task, dirty]);
  function change(patch: Partial<Task>) {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  }
  const value = () => ({
    ...draft,
    title: draft.title.trim(),
    endDate: draft.endDate && draft.endDate > draft.date && !draft.time ? draft.endDate : undefined,
    reminderMinutes: draft.date && draft.time ? draft.reminderMinutes : undefined,
    tags: [
      ...new Set([
        ...(isNew ? recognized.tags : []),
        ...tags
          .split(/[,#\s]+/)
          .map((s) => s.trim())
          .filter(Boolean),
      ]),
    ].slice(0, 30),
  });
  async function save() {
    if (!draft.title.trim() || (draft.endDate && draft.endDate < draft.date)) return;
    if (await onSave(value(), linkHabit)) {
      setHabitDraft(null);
      setDirty(false);
    }
  }
  function addItem() {
    if (!item.trim() || draft.checklist.length >= 100) return;
    change({
      checklist: [
        ...draft.checklist,
        { id: uid(), title: item.trim(), done: false },
      ],
    });
    setItem("");
  }
  const count = draft.checklist.filter((c) => c.done).length;
  return (
    <aside className="detail-panel" aria-label="할 일 상세">
      <div className="detail-top">
        <span className="detail-label">
          <Icon name="list" size={15} />
          {lists.find((l) => l.id === draft.listId)?.name || "수집함"}
        </span>
        <div className="inline-actions">
          <button
            className="icon-btn"
            title="이 할 일에 집중"
            aria-label="이 할 일에 집중"
            onClick={onFocus}
          >
            <Icon name="focus" size={18} />
          </button>
          <button className="icon-btn" aria-label="상세 닫기" onClick={onClose}>
            <Icon name="close" size={19} />
          </button>
        </div>
      </div>
      <div className="detail-body">
        <div className="detail-title">
          <button
            className={`task-check p${draft.priority} ${
              draft.completed ? "checked" : ""
            }`}
            aria-label={draft.completed ? "완료 취소" : "할 일 완료"}
            disabled={busy || isNew}
            onClick={async () => {
              if (await onToggle(value(), linkHabit)) {
                setHabitDraft(null);
                setDirty(false);
              }
            }}
          >
            {draft.completed && <Icon name="check" size={13} />}
          </button>
          {isNew ? (
            <SmartTaskInput
              value={rawTitle}
              ignored={ignored}
              today={localDate()}
              onChange={(text) => smartChange(text)}
              onIgnore={(key) => smartChange(rawTitle, [...ignored, key])}
              onSubmit={() => {
                titleEditor.current?.blur();
              }}
              editorRef={titleEditor}
            />
          ) : (
            <textarea
              aria-label="할 일 제목"
              maxLength={150}
              value={draft.title}
              onChange={(e) => change({ title: e.target.value })}
              rows={2}
            />
          )}
        </div>
        <div className="detail-fields">
          <label>
            <Icon name="calendar" size={16} />
            <input
              aria-label="마감 날짜"
              type="date"
              value={draft.date}
              onChange={(e) =>
                change({
                  date: e.target.value,
                  repeatDay: e.target.value
                    ? Number(e.target.value.slice(-2))
                    : undefined,
                  repeat: e.target.value ? draft.repeat : "none",
                  time: e.target.value ? draft.time : "",
                  endDate: !e.target.value ? undefined :
                    draft.endDate && draft.endDate < e.target.value ? e.target.value : draft.endDate,
                })
              }
            />
          </label>
          <label>
            <Icon name="clock" size={16} />
            <input
              aria-label="마감 시간"
              type="time"
              disabled={!draft.date}
              value={draft.time}
              onChange={(e) => change({ time: e.target.value, endDate: e.target.value ? undefined : draft.endDate })}
            />
          </label>
        </div>
        {draft.date && !draft.time && (
          <label className="detail-select">
            <span>종일 종료일</span>
            <input type="date" aria-label="종일 종료일" min={draft.date}
              value={draft.endDate ?? draft.date}
              onChange={(event) => change({ endDate: event.target.value || undefined })} />
          </label>
        )}
        <div className="detail-fields">
          <label>
            <Icon name="flag" size={16} />
            <select
              aria-label="우선순위"
              value={draft.priority}
              onChange={(e) =>
                change({ priority: Number(e.target.value) as Priority })
              }
            >
              {priorityNames.map((n, i) => (
                <option key={i} value={i}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            <Icon name="repeat" size={16} />
            <select
              aria-label="반복 일정"
              disabled={!draft.date}
              value={draft.repeat}
              onChange={(e) =>
                change({
                  repeat: e.target.value as Repeat,
                  repeatDay: Number(draft.date.slice(-2)),
                })
              }
            >
              {Object.entries(repeatNames).map(([v, n]) => (
                <option key={v} value={v}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        {draft.repeat === "daily" && draft.date && (
          <label className="detail-select linked-habit-option">
            <Icon name="habit" size={16} />
            <span>
              습관에 연동
              <small>{habitLimitReached && !task.habitId
                ? "습관은 200개까지 만들 수 있어요."
                : "완료 기록을 습관 탭에도 표시해요."}</small>
            </span>
            <input type="checkbox" aria-label="습관에 연동" checked={linkHabit}
              disabled={busy || (habitLimitReached && !task.habitId)}
              onChange={(event) => {
                setHabitDraft(event.target.checked);
                setDirty(true);
              }} />
          </label>
        )}
        {isNew && recognized.tokens.length > 0 && (
          <div className="recognition-preview">
            <small>강조된 단어를 누르면 인식을 취소합니다.</small>
            {ignored.length > 0 && (
              <button
                className="text-btn"
                onClick={() => smartChange(rawTitle, [])}
              >
                다시 인식
              </button>
            )}
          </div>
        )}
        <label className="detail-select">
          <Icon name="bell" size={16} />
          <select
            aria-label="앱 알림"
            disabled={!draft.date || !draft.time}
            value={draft.reminderMinutes === undefined ? "" :
              customReminder ? "custom" : draft.reminderMinutes}
            onChange={(event) => {
              const value = event.target.value;
              setCustomReminder(value === "custom");
              change({ reminderMinutes: value === "" ? undefined : value === "custom" ? 15 : Number(value) });
            }}
          >
            <option value="">앱 알림 없음</option>
            <option value="0">시작 시간에 알림</option>
            <option value="10">10분 전 알림</option>
            <option value="30">30분 전 알림</option>
            <option value="custom">직접 지정</option>
          </select>
        </label>
        {draft.date && draft.time && customReminder && (
          <label className="duration-field">
            <span>시작 전</span>
            <input type="number" min={1} max={10080} step={1}
              aria-label="알림 시간(분 전)" value={draft.reminderMinutes}
              onChange={(event) => {
                const minutes = event.target.valueAsNumber;
                if (Number.isInteger(minutes) && minutes >= 1 && minutes <= 10080) {
                  change({ reminderMinutes: minutes });
                }
              }} />
            <span>분에 알림</span>
          </label>
        )}
        <label className="duration-field">
          <Icon name="clock" size={16} />
          <span>소요 시간</span>
          <input
            aria-label="소요 시간(분)"
            type="number"
            min={15}
            max={720}
            step={15}
            value={draft.durationMinutes || 30}
            onChange={(e) =>
              change({ durationMinutes: Number(e.target.value) })
            }
          />
          <span>분</span>
          <small>시간표에서 길이 조정 가능</small>
        </label>
        <label className="detail-select">
          <Icon name="list" size={16} />
          <select
            aria-label="소속 리스트"
            value={draft.listId}
            onChange={(e) => change({ listId: e.target.value })}
          >
            <option value="inbox">수집함</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <div className="note-label">메모</div>
        <textarea
          className="notes"
          aria-label="메모"
          maxLength={20000}
          rows={7}
          value={draft.notes}
          onChange={(e) => change({ notes: e.target.value })}
          placeholder="생각이나 필요한 내용을 자유롭게 적어보세요…"
        />
        <div className="checklist-heading">
          <span>체크리스트</span>
          <small>
            {count} / {draft.checklist.length}
          </small>
        </div>
        {draft.checklist.length > 0 && (
          <div className="thin-progress">
            <i
              style={{ width: `${(count / draft.checklist.length) * 100}%` }}
            />
          </div>
        )}
        <div className="checklist">
          {draft.checklist.map((c) => (
            <div key={c.id}>
              <button
                className={`task-check ${c.done ? "checked" : ""}`}
                aria-label={`${c.title} 체크`}
                onClick={() =>
                  change({
                    checklist: draft.checklist.map((x) =>
                      x.id === c.id ? { ...x, done: !x.done } : x
                    ),
                  })
                }
              >
                {c.done && <Icon name="check" size={12} />}
              </button>
              <input
                aria-label="체크리스트 항목"
                className={c.done ? "struck" : ""}
                maxLength={150}
                value={c.title}
                onChange={(e) =>
                  change({
                    checklist: draft.checklist.map((x) =>
                      x.id === c.id ? { ...x, title: e.target.value } : x
                    ),
                  })
                }
              />
              <button
                className="icon-btn"
                aria-label={`${c.title} 항목 제거`}
                onClick={() =>
                  change({
                    checklist: draft.checklist.filter((x) => x.id !== c.id),
                  })
                }
              >
                <Icon name="close" size={13} />
              </button>
            </div>
          ))}
        </div>
        <form
          className="checklist-add"
          onSubmit={(e) => {
            e.preventDefault();
            addItem();
          }}
        >
          <Icon name="plus" size={15} />
          <input
            value={item}
            maxLength={150}
            onChange={(e) => setItem(e.target.value)}
            placeholder="하위 할 일 추가"
            aria-label="하위 할 일 추가"
          />
          <button type="submit" className="text-btn" disabled={!item.trim()}>
            추가
          </button>
        </form>
        <label className="tags-input">
          <Icon name="tag" size={16} />
          <input
            value={tags}
            maxLength={1200}
            onChange={(e) => {
              setTags(e.target.value);
              setDirty(true);
            }}
            placeholder="태그를 쉼표로 구분"
            aria-label="태그"
          />
        </label>
        <div className="tag-chips">
          {tags
            .split(/[,#\s]+/)
            .filter(Boolean)
            .map((tag, i) => (
              <span key={`${tag}-${i}`}>#{tag}</span>
            ))}
        </div>
      </div>
      <footer className="detail-footer">
        {!isNew && (
          <button className="icon-btn" onClick={onDelete} aria-label="휴지통으로 이동">
            <Icon name="trash" size={17} />
          </button>
        )}
        <span>{isNew ? "저장 전 일정" : dirty ? "변경사항이 있어요" : "모든 변경사항 저장됨"}</span>
        {(isNew || dirty) && (
          <button className="btn small" disabled={busy} onClick={onDiscard}>
            {isNew ? "취소" : "편집 취소"}
          </button>
        )}
        <button
          className="btn primary small"
          disabled={
            busy ||
            !dirty ||
            !draft.title.trim() ||
            Boolean(draft.endDate && draft.endDate < draft.date) ||
            (draft.durationMinutes !== undefined &&
              (!Number.isInteger(draft.durationMinutes) ||
                draft.durationMinutes < 15 ||
                draft.durationMinutes > 720)) ||
            draft.checklist.some((c) => !c.title.trim()) ||
            tags.split(/[,#\s]+/).some((t) => t.length > 40)
          }
          onClick={save}
        >
          {busy ? "저장 중" : "저장"}
        </button>
      </footer>
    </aside>
  );
}
