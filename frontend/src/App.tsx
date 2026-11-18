import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Icon from "./Icon";
import { appReminders } from "./AppReminders";
import Modal, { SaveErrorContext } from "./Modal";
import TaskDetail from "./TaskDetail";
import CalendarView from "./CalendarView";
import FocusView from "./FocusView";
import HabitsView from "./HabitsView";
import SettingsView from "./SettingsView";
import QuickComposer, { QuickAddSheet } from "./QuickComposer";
import RankView, { RankMiniCard } from "./RankView";
import useWorkspace from "./useWorkspace";
import { dataMode } from "./api";
import {
  addDays,
  carriesToDay,
  matches,
  moveTaskDate,
  scheduledOn,
  saveTaskWithHabit,
  checkHabit,
  newTask,
  remainingSeconds,
  toggleTask,
  uid,
} from "./model";
import {
  localDate,
  palette,
  priorityNames,
  repeatNames,
  type Priority,
  type Task,
  type TaskList,
  type View,
  type Workspace,
} from "./types";

const smartViews: { id: View; name: string; icon: string; color: string }[] = [
  { id: "inbox", name: "수집함", icon: "inbox", color: "#6e91bd" },
  { id: "today", name: "오늘", icon: "sun", color: "#d7a351" },
  { id: "tomorrow", name: "내일", icon: "calendar", color: "#75ad8f" },
  { id: "week", name: "다음 7일", icon: "week", color: "#ac8fbd" },
  { id: "all", name: "모든 할 일", icon: "tasks", color: "#7f8da2" },
  { id: "important", name: "중요한 일", icon: "flag", color: "#d88585" },
];
const sections = [
  { id: "today", name: "할 일", icon: "tasks" },
  { id: "calendar", name: "캘린더", icon: "calendar" },
  { id: "matrix", name: "매트릭스", icon: "matrix" },
  { id: "focus", name: "집중", icon: "focus" },
  { id: "habits", name: "습관", icon: "habit" },
] as const;
const specialTitles: Record<string, string> = {
  rank: "나의 랭크",
  calendar: "캘린더",
  matrix: "아이젠하워 매트릭스",
  focus: "집중",
  habits: "습관",
  settings: "설정",
  completed: "완료한 일",
  trash: "휴지통",
};
export default function App() {
  const { state, error, notice, busy, commit, load, setNotice, setError } =
    useWorkspace();
  const [view, setView] = useState<View>("today");
  const [selected, setSelected] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const [sort, setSort] = useState("order");
  const [group, setGroup] = useState("date");
  const [homeCategory, setHomeCategory] = useState("all");
  const [layout, setLayout] = useState<"list" | "board">("list");
  const [selectionMode, setSelectionMode] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);
  const [listEditor, setListEditor] = useState<TaskList | "new" | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [newEditor, setNewEditor] = useState<Task | null>(null);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    message: string;
    run: () => Promise<boolean>;
  } | null>(null);
  const [undo, setUndo] = useState<{ ids: string[] } | null>(null);
  const [homeDate, setHomeDate] = useState<string | null>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const suppressSwipeClick = useRef(false);
  const [today, setToday] = useState(localDate());
  const [completionDay, setCompletionDay] = useState("");
  const [calendarMode, setCalendarMode] = useState<"month" | "review">("month");
  const [calendarStart, setCalendarStart] = useState(localDate());
  const dirtyDetail = useRef(false);
  const onDirtyChange = useCallback((value: boolean) => {
    dirtyDetail.current = value;
  }, []);
  function canLeaveDetail() {
    if (
      dirtyDetail.current &&
      !window.confirm("저장하지 않은 변경사항을 닫을까요?")
    )
      return false;
    dirtyDetail.current = false;
    return true;
  }
  function discardDetail() {
    dirtyDetail.current = false;
    if (newEditor) setNewEditor(null);
    else setSelected(null);
  }
  function closeDetail() {
    if (!dirtyDetail.current) {
      discardDetail();
      return;
    }
    setConfirmation({
      title: "편집을 취소할까요?",
      message: "저장하지 않은 변경사항을 폐기합니다.",
      run: async () => {
        discardDetail();
        return true;
      },
    });
  }
  function chooseTask(id: string | null) {
    if (canLeaveDetail()) setSelected(id);
  }
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => {
      if (dirtyDetail.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, []);
  const [, tick] = useState(0);
  useEffect(() => {
    const canGoBack = Boolean(
      selected ||
        newEditor ||
        quickAddOpen ||
        listEditor ||
        confirmation ||
        sidebarOpen ||
        searchOpen ||
        query ||
        view !== "today"
    );
    const dark =
      state?.settings.theme === "dark" ||
      (state?.settings.theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    window.ReactNativeWebView?.postMessage(
      JSON.stringify({ type: "DOTODO_STATE", canGoBack, dark })
    );
  }, [
    selected,
    newEditor,
    quickAddOpen,
    listEditor,
    confirmation,
    sidebarOpen,
    searchOpen,
    query,
    view,
    state?.settings.theme,
  ]);
  useEffect(() => {
    const back = () => {
      if (confirmation) setConfirmation(null);
      else if (newEditor) closeDetail();
      else if (quickAddOpen) setQuickAddOpen(false);
      else if (listEditor) setListEditor(null);
      else if (searchOpen) setSearchOpen(false);
      else if (selected) closeDetail();
      else if (sidebarOpen) setSidebarOpen(false);
      else {
        setView("today");
        setHomeDate(null);
        setQuery("");
      }
    };
    window.addEventListener("dotodo:back", back);
    return () => window.removeEventListener("dotodo:back", back);
  }, [confirmation, newEditor, quickAddOpen, listEditor, searchOpen, selected, sidebarOpen]);
  useEffect(() => {
    const t = setInterval(() => {
      setToday(localDate());
      tick((n) => n + 1);
    }, 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!state) return;
    const root = document.documentElement;
    root.dataset.theme = state.settings.theme;
    root.style.setProperty("--accent", state.settings.accent);
  }, [state?.settings.theme, state?.settings.accent]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing =
        target.matches("input,textarea,select") || target.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchRef.current?.focus(), 0);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setSidebarOpen(false);
        setQuery("");
      }
      if (!typing && !quickAddOpen && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        if (!canLeaveDetail()) return;
        setSelected(null);
        if (view === "today" && !query) setQuickAddOpen(true);
        else setNewEditor(newTask("", { date: today }));
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [today, view, query, quickAddOpen]);
  useEffect(() => {
    if (!state?.tasks || !window.ReactNativeWebView) return;
    const openReminder = (event: Event) => {
      const id = (event as CustomEvent<unknown>).detail;
      if (typeof id !== "string") return;
      window.ReactNativeWebView?.postMessage(JSON.stringify({
        type: "DOTODO_REMINDER_OPENED", taskId: id,
      }));
      const task = state.tasks.find((item) => item.id === id && !item.deletedAt);
      if (!task) {
        setNotice("이 알림의 일정을 찾을 수 없어요.");
        return;
      }
      if (!canLeaveDetail()) return;
      setNewEditor(null);
      setListEditor(null);
      setConfirmation(null);
      setSearchOpen(false);
      setSidebarOpen(false);
      setQuery("");
      setView(task.date ? "calendar" : "all");
      if (task.date) setCalendarStart(task.date);
      setSelected(id);
    };
    window.addEventListener("dotodo:open-reminder", openReminder);
    const sendReminders = () => window.ReactNativeWebView?.postMessage(JSON.stringify({
      type: "DOTODO_REMINDERS", reminders: appReminders(state.tasks),
    }));
    window.addEventListener("dotodo:refresh-reminders", sendReminders);
    sendReminders();
    return () => {
      window.removeEventListener("dotodo:open-reminder", openReminder);
      window.removeEventListener("dotodo:refresh-reminders", sendReminders);
    };
  }, [state?.tasks]);
  useEffect(() => {
    if (
      !state ||
      window.ReactNativeWebView ||
      typeof Notification === "undefined" ||
      Notification.permission !== "granted"
    )
      return;
    const now = Date.now();
    for (const task of state.tasks) {
      if (task.completed || task.deletedAt || !task.date || !task.time)
        continue;
      const at = new Date(`${task.date}T${task.time}:00`).getTime();
      if (at > now || now - at > 60000) continue;
      const key = `dotodo.notified.${task.id}.${task.date}.${task.time}`;
      try {
        if (!sessionStorage.getItem(key)) {
          new Notification("dotodo · 할 일 알림", {
            body: task.title,
            tag: task.id,
          });
          sessionStorage.setItem(key, "1");
        }
      } catch {
        /* Notification availability differs between browsers and webviews. */
      }
    }
  }, [state, today, Math.floor(Date.now() / 15000)]);
  if (!state)
    return (
      <div className="boot-screen">
        <div className="logo-mark">
          <Icon name="check" size={28} />
        </div>
        <h1>
          dotodo<span>.</span>
        </h1>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button className="btn primary" onClick={load}>
              다시 불러오기
            </button>
          </>
        ) : (
          <p>나의 하루를 준비하고 있어요…</p>
        )}
      </div>
    );
  const home = view === "today" && !query;
  const displayedDay = view === "today" && !query ? homeDate ?? today : today;
  const dayTitle = displayedDay === today ? "오늘" :
    new Date(`${displayedDay}T12:00:00`).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
  const tasks = state.tasks.filter((task) => !task.actual || (view === "trash" && task.deletedAt));
  const visibleTasks = tasks.filter((t) => !t.deletedAt);
  const active = visibleTasks.filter((t) => !t.completed);
  const dayTasks = visibleTasks.filter((task) => homeCategory === "all" || task.listId === homeCategory);
  const selectedTask = tasks.find((t) => t.id === selected && !t.deletedAt);
  const tags = [...new Set(visibleTasks.flatMap((t) => t.tags))].sort();
  const special = [
    "rank",
    "calendar",
    "matrix",
    "focus",
    "habits",
    "settings",
  ].includes(view);
  const title = query
    ? "검색 결과"
    : view === "today" ? dayTitle
    : view.startsWith("list:")
    ? state.lists.find((l) => l.id === view.slice(5))?.name || "리스트"
    : view.startsWith("tag:")
    ? `#${view.slice(4)}`
    : specialTitles[view] ||
      smartViews.find((v) => v.id === view)?.name ||
      "할 일";
  const completedOn = (task: Task, day: string) =>
    task.completed && Boolean(task.completedAt) &&
    localDate(new Date(task.completedAt!)) === day;
  const filtered = tasks.filter((t) => (!home || homeCategory === "all" || t.listId === homeCategory) && (
    query
      ? !t.deletedAt &&
        `${t.title} ${t.notes} ${t.tags.join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase())
      : view === "today" && t.completed
      ? !t.deletedAt && (completedOn(t, displayedDay) || scheduledOn(t, displayedDay))
      : view === "today"
      ? !t.deletedAt && (scheduledOn(t, displayedDay) || carriesToDay(t, state.lists, displayedDay))
      : matches(t, view, today) &&
        (view !== "completed" || !completionDay || completedOn(t, completionDay))
  ));
  const sorted = [...filtered].sort((a, b) =>
    sort === "priority"
      ? (a.priority || 5) - (b.priority || 5) || a.order - b.order
      : sort === "date"
      ? (a.date || "9999").localeCompare(b.date || "9999") ||
        a.time.localeCompare(b.time)
      : sort === "title"
      ? a.title.localeCompare(b.title, "ko")
      : a.order - b.order
  );
  const pending = sorted.filter((t) => !t.completed);
  const completed = sorted.filter((t) => t.completed);
  const todayDone = dayTasks.filter((t) => completedOn(t, displayedDay)).length;
  const todayTotal = todayDone + dayTasks.filter((t) => !t.completed && scheduledOn(t, displayedDay)).length;
  const progress = todayTotal
    ? Math.round((todayDone / todayTotal) * 100)
    : 0;
  const subtitle =
    view === "today"
      ? "중요한 것부터 하나씩, 나만의 속도로."
      : view === "calendar"
      ? "계획을 한눈에 보고, 하루에 여유를 더하세요."
      : view === "habits"
      ? "작은 반복이 만드는 큰 변화."
      : view === "focus"
      ? "산만한 생각은 잠시 내려놓고."
      : view === "matrix"
      ? "급한 일과 중요한 일 사이, 균형을 찾아요."
      : view === "trash"
      ? "삭제한 할 일을 복원하거나 영구 삭제할 수 있어요."
      : "머릿속의 할 일을 꺼내 놓는 공간.";
  function navigate(next: View, initialCalendarMode: "month" | "review" = "month") {
    if (!canLeaveDetail()) return;
    setView(next);
    if (next === "calendar") setCalendarMode(initialCalendarMode);
    if (next === "today") setHomeDate(null);
    setQuery("");
    setSelected(null);
    setChecked([]);
    setSelectionMode(false);
    setSidebarOpen(false);
  }
  function shiftHome(direction: number) {
    if (!canLeaveDetail()) return;
    const date = addDays(displayedDay, direction);
    setHomeDate(date === today ? null : date);
    setSelected(null);
    setChecked([]);
  }
  const patchTask = (id: string, patch: Partial<Task>, message?: string) =>
    commit(
      (w) => ({
        ...w,
        tasks: w.tasks.map((t) => (t.id === id ? {
          ...t,
          ...(patch.date !== undefined ? moveTaskDate(t, patch.date) : {}),
          ...patch,
          ...(patch.time ? { endDate: undefined } : {}),
        } : t)),
      }),
      message
    );
  const saveTask = (task: Task, linkHabit?: boolean) =>
    commit(
      (workspace) => saveTaskWithHabit(workspace, task, linkHabit),
      "할 일을 저장했어요"
    );
  async function duplicateSchedule(id: string) {
    const source = state?.tasks.find((task) => task.id === id && !task.deletedAt && !task.completed);
    if (!source) return null;
    const copy = newTask(source.title, {
      notes: source.notes,
      listId: source.listId,
      date: source.date,
      endDate: source.endDate,
      time: source.time,
      durationMinutes: source.durationMinutes,
      priority: source.priority,
      tags: [...source.tags],
      checklist: source.checklist.map(({ title }) => ({ id: uid(), title, done: false })),
    });
    return await commit(
      (workspace) => ({ ...workspace, tasks: [...workspace.tasks, copy] }),
      "복제했어요. 새 일정을 원하는 위치로 옮기세요."
    ) ? copy.id : null;
  }
  const toggle = (task: Task, linkHabit?: boolean) =>
    commit(
      (w) =>
        toggleTask(
          saveTaskWithHabit(w, task, linkHabit),
          task.id
        ),
      task.completed ? "완료를 취소했어요" : "하나 더 해냈어요!"
    );
  async function trash(ids: string[]) {
    if (
      await commit(
        (w) => ({
          ...w,
          tasks: w.tasks.map((t) =>
            ids.includes(t.id)
              ? { ...t, deletedAt: new Date().toISOString() }
              : t
          ),
        }),
        "휴지통으로 이동했어요"
      )
    ) {
      setUndo({ ids });
      setSelected(null);
      setChecked([]);
    }
  }
  function focusTask(id: string) {
    if (!canLeaveDetail()) return;
    void commit((w) => ({ ...w, timer: { ...w.timer, taskId: id } })).then(
      (ok) => {
        if (ok) navigate("focus");
      }
    );
  }
  function openQuickAdd() {
    if (!canLeaveDetail()) return;
    setSelected(null);
    setQuickAddOpen(true);
  }
  function openNew(
    date = ["today", "tomorrow"].includes(view)
      ? view === "tomorrow"
        ? addDays(today, 1)
        : displayedDay
      : "",
    time = "",
    options: Pick<Task, "endDate" | "durationMinutes"> = {}
  ) {
    if (!canLeaveDetail()) return;
    setSelected(null);
    setNewEditor(
      newTask("", {
        date,
        time,
        ...options,
        listId: view.startsWith("list:") ? view.slice(5) : "inbox",
        tags: view.startsWith("tag:") ? [view.slice(4)] : [],
      })
    );
  }
  function fromQuick(draft: Partial<Task> & { title: string }) {
    return newTask(draft.title, {
      ...draft,
      listId: draft.listId ?? (view.startsWith("list:") ? view.slice(5) : "inbox"),
      tags: [
        ...new Set([
          ...(draft.tags || []),
          ...(view.startsWith("tag:") ? [view.slice(4)] : []),
        ]),
      ],
    });
  }
  function dropPriority(event: React.DragEvent, priority: Priority) {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain");
    if (tasks.some((t) => t.id === id)) void patchTask(id, { priority });
  }
  function reorder(event: React.DragEvent, target: Task) {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain");
    if (!id || id === target.id || sort !== "order") return;
    void commit((w) => {
      const items = [...w.tasks].sort((a, b) => a.order - b.order);
      const moving = items.find((t) => t.id === id);
      if (!moving) return w;
      const rest = items.filter((t) => t.id !== id);
      rest.splice(
        rest.findIndex((t) => t.id === target.id),
        0,
        moving
      );
      return { ...w, tasks: rest.map((t, i) => ({ ...t, order: i })) };
    });
  }
  function row(task: Task, compact = false) {
    const list = state!.lists.find((l) => l.id === task.listId);
    const isTrash = Boolean(task.deletedAt);
    return (
      <article
        key={task.id}
        data-priority={home && task.priority ? task.priority : undefined}
        className={`task-row ${task.completed ? "completed" : ""} ${
          selected === task.id ? "selected" : ""
        } ${compact ? "compact" : ""}`}
        draggable={!selectionMode && !isTrash}
        onDragStart={(e) => e.dataTransfer.setData("text/plain", task.id)}
        onDragOver={(e) => {
          if (!compact) e.preventDefault();
        }}
        onDrop={(e) => {
          if (!compact) reorder(e, task);
        }}
      >
        {selectionMode ? (
          <input
            type="checkbox"
            className="bulk-check"
            aria-label={`${task.title} 선택`}
            checked={checked.includes(task.id)}
            onChange={() =>
              setChecked((ids) =>
                ids.includes(task.id)
                  ? ids.filter((id) => id !== task.id)
                  : [...ids, task.id]
              )
            }
          />
        ) : (
          <button
            className={`task-check p${task.priority} ${
              task.completed ? "checked" : ""
            }`}
            disabled={busy || isTrash}
            aria-label={`${task.title} ${
              task.completed ? "완료 취소" : "완료"
            }`}
            aria-pressed={task.completed}
            onClick={() => toggle(task)}
          >
            {task.completed && <Icon name="check" size={12} />}
          </button>
        )}
        <button
          className="task-content"
          onClick={() => !isTrash && chooseTask(task.id)}
        >
          <span className="task-title-text">{task.title}</span>
          <span className="task-meta">
            {task.time && (
              <span className={task.date < today ? "overdue" : ""}>
                <Icon name="clock" size={11} />
                {task.time}
              </span>
            )}
            {task.date && view !== "today" && (
              <span
                className={
                  task.date < today && !task.completed ? "overdue" : ""
                }
              >
                {dateLabel(task.date, today)}
              </span>
            )}
            {task.tags.map((tag) => (
              <span className="row-tag" key={tag}>
                #{tag}
              </span>
            ))}
            {task.checklist.length > 0 && (
              <span>
                <Icon name="tasks" size={11} />
                {task.checklist.filter((c) => c.done).length}/
                {task.checklist.length}
              </span>
            )}
            {task.repeat !== "none" && <span className="task-repeat-label"><Icon name="repeat" size={12} />{repeatNames[task.repeat]}</span>}
            {task.habitId && <span className="task-habit-label">습관 연동</span>}
            {home && carriesToDay(task, state!.lists, displayedDay) &&
              <span className="task-carry-label">{dateLabel(task.date, today)}부터</span>}
          </span>
        </button>
        {!compact && (
          <span className={`task-list-label ${isTrash ? "" : "task-list-picker"}`}>
            <i style={{ background: list?.color || "#b0b7c4" }} />
            <span>{list?.name || "수집함"}</span>
            {!isTrash && (
              <>
                <Icon name="chevron" size={10} />
                <select
                  aria-label={`${task.title} 리스트 변경`}
                  value={task.listId}
                  disabled={busy}
                  onChange={(event) => {
                    const listId = event.target.value;
                    if (selected === task.id && dirtyDetail.current) {
                      if (!canLeaveDetail()) return;
                      setSelected(null);
                    }
                    void patchTask(task.id, { listId }, "리스트를 변경했어요");
                  }}
                >
                  <option value="inbox">수집함</option>
                  {state!.lists.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </>
            )}
          </span>
        )}
        {isTrash ? (
          <div className="inline-actions">
            <button
              className="text-btn"
              disabled={busy}
              onClick={() =>
                patchTask(task.id, { deletedAt: null }, "할 일을 복원했어요")
              }
            >
              복원
            </button>
            <button
              className="icon-btn"
              aria-label={`${task.title} 영구 삭제`}
              onClick={() =>
                setConfirmation({
                  title: "영구 삭제할까요?",
                  message: `“${task.title}”을 영구 삭제하면 복원할 수 없습니다.`,
                  run: () =>
                    commit(
                      (w) => ({
                        ...w,
                        tasks: w.tasks.filter((t) => t.id !== task.id),
                      }),
                      "영구 삭제했어요"
                    ),
                })
              }
            >
              <Icon name="trash" size={15} />
            </button>
          </div>
        ) : (
          <label className={`icon-btn priority-flag priority-picker p${task.priority}`}
            title={task.priority ? `우선순위 ${task.priority}` : "우선순위 없음"}>
            <Icon name="flag" size={24} flagNumber={task.priority || undefined} />
            <select aria-label={`${task.title} 우선순위 변경`}
              value={task.priority} disabled={busy}
              onChange={(event) => void patchTask(task.id, {
                priority: Number(event.target.value) as Priority,
              })}>
              {priorityNames.map((name, priority) => (
                <option key={priority} value={priority}>
                  {priority ? `${priority} · ${name}` : name}
                </option>
              ))}
            </select>
          </label>
        )}
      </article>
    );
  }
  function grouped() {
    const groups = new Map<string, Task[]>();
    for (const task of pending) {
      const label =
        group === "priority"
          ? priorityNames[task.priority]
          : group === "list"
          ? state!.lists.find((l) => l.id === task.listId)?.name || "수집함"
          : group === "none"
          ? "할 일"
          : (task.endDate ?? task.date) && (task.endDate ?? task.date) < displayedDay
          ? "이전 날짜에서 이어서"
          : task.date
          ? dateLabel(scheduledOn(task, displayedDay) ? displayedDay : task.date, today)
          : "날짜 없음";
      groups.set(label, [...(groups.get(label) || []), task]);
    }
    return [...groups].map(([label, items]) => (
      <section className="task-group" key={label}>
        <h3 className={label === "이전 날짜에서 이어서" ? "overdue" : ""}>
          <Icon name="chevron" size={13} />
          {label}
          <span>{items.length}</span>
        </h3>
        {items.map((t) => row(t))}
      </section>
    ));
  }
  return (
    <SaveErrorContext.Provider value={error}>
      <div className={`workspace-app ${selectedTask ? "detail-open" : ""}`}>
        <aside className="icon-rail">
          <button
            className="rail-brand"
            onClick={() => navigate("today")}
            aria-label="dotodo 홈"
          >
            <Icon name="check" size={25} />
          </button>
          <div className="rail-sections">
            {sections.map((s) => (
              <button
                key={s.id}
                className={`rail-button ${
                  (s.id === "today" && !special) || view === s.id
                    ? "active"
                    : ""
                }`}
                onClick={() => navigate(s.id)}
                title={s.name}
                aria-label={s.name}
              >
                <Icon name={s.icon} size={22} />
              </button>
            ))}
          </div>
          <div className="rail-bottom">
            <button
              className="rail-button"
              aria-label="새로 불러오기"
              title="새로 불러오기"
              disabled={busy}
              onClick={load}
            >
              <Icon name="refresh" size={19} />
            </button>
            <button
              className={`rail-button ${view === "settings" ? "active" : ""}`}
              onClick={() => navigate("settings")}
              aria-label="설정"
            >
              <Icon name="settings" size={21} />
            </button>
            <button
              className="rail-avatar"
              onClick={() => navigate("settings")}
              aria-label="프로필 설정"
            >
              {state.settings.name.slice(0, 1)}
            </button>
          </div>
        </aside>
        {sidebarOpen && (
          <button
            className="sidebar-scrim"
            aria-label="메뉴 닫기"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <aside className={`list-sidebar ${sidebarOpen ? "mobile-open" : ""}`}>
          <div className="sidebar-brand">
            <strong>
              dotodo<span>.</span>
            </strong>
            <span className="personal-label">PERSONAL</span>
          </div>
          <button
            className="workspace-profile"
            onClick={() => navigate("settings")}
          >
            <span className="profile-avatar">
              {state.settings.name.slice(0, 1)}
            </span>
            <span>
              {state.settings.name}의 워크스페이스
              <small>오늘도 나답게, 하나씩.</small>
            </span>
            <Icon name="chevron" size={14} />
          </button>
          <button
            className="sidebar-search"
            onClick={() => {
              setSearchOpen(true);
              setTimeout(() => searchRef.current?.focus(), 0);
            }}
          >
            <Icon name="search" size={16} />
            <span>검색</span>
            <kbd>Ctrl K</kbd>
          </button>
          <nav className="smart-nav" aria-label="스마트 목록">
            {smartViews.map((v) => (
              <button
                className={`sidebar-item ${
                  view === v.id && !query ? "active" : ""
                }`}
                key={v.id}
                onClick={() => navigate(v.id)}
              >
                <i style={{ color: v.color }}>
                  <Icon name={v.icon} size={18} />
                </i>
                <span>{v.name}</span>
                <small>
                  {active.filter((t) => v.id === "today"
                    ? scheduledOn(t, today) || carriesToDay(t, state.lists, today)
                    : matches(t, v.id, today)).length || ""}
                </small>
              </button>
            ))}
          </nav>
          <div className="sidebar-section-label">
            <span>내 리스트</span>
            <button
              className="icon-btn"
              aria-label="리스트 추가"
              onClick={() => setListEditor("new")}
            >
              <Icon name="plus" size={16} />
            </button>
          </div>
          <nav aria-label="내 리스트">
            {state.lists.map((list) => (
              <div
                className={`list-nav-row ${
                  view === `list:${list.id}` ? "active" : ""
                }`}
                key={list.id}
              >
                <button
                  className="sidebar-item"
                  onClick={() => navigate(`list:${list.id}`)}
                >
                  <i className="list-dot" style={{ background: list.color }} />
                  <span>{list.name}</span>
                  <small>
                    {active.filter((t) => t.listId === list.id).length || ""}
                  </small>
                </button>
                <button
                  className="list-edit icon-btn"
                  aria-label={`${list.name} 리스트 수정`}
                  onClick={() => setListEditor(list)}
                >
                  <Icon name="more" size={14} />
                </button>
              </div>
            ))}
          </nav>
          <div className="sidebar-section-label">
            <span>태그</span>
            <small>{tags.length}</small>
          </div>
          <div className="sidebar-tags">
            {tags.length ? (
              tags.map((tag) => (
                <button
                  className={view === `tag:${tag}` ? "active" : ""}
                  onClick={() => navigate(`tag:${tag}`)}
                  key={tag}
                >
                  <span>#</span>
                  {tag}
                </button>
              ))
            ) : (
              <p>할 일 상세에서 태그를 추가하세요.</p>
            )}
          </div>
          <div className="sidebar-spacer" />
          <RankMiniCard state={state} onClick={() => navigate("rank")} />
          <div className="sidebar-footer">
            <button
              className={`sidebar-item ${view === "completed" ? "active" : ""}`}
              onClick={() => navigate("completed")}
            >
              <Icon name="check" size={17} />
              <span>완료한 일</span>
              <small>
                {visibleTasks.filter((t) => t.completed).length || ""}
              </small>
            </button>
            <button
              className={`sidebar-item ${view === "trash" ? "active" : ""}`}
              onClick={() => navigate("trash")}
            >
              <Icon name="trash" size={16} />
              <span>휴지통</span>
              <small>{tasks.filter((t) => t.deletedAt).length || ""}</small>
            </button>
            <div className="storage-status">
              <span className={busy ? "saving" : ""} />
              {busy
                ? "저장하고 있어요"
                : dataMode === "demo"
                ? "이 브라우저에 저장됨"
                : "서버에 저장됨"}
              <span>v0.3</span>
            </div>
          </div>
        </aside>
        <main className="main-workspace">
          <header className="workspace-topbar">
            <button
              className="icon-btn mobile-menu"
              aria-label="메뉴 열기"
              onClick={() => setSidebarOpen(true)}
            >
              <Icon name="menu" />
            </button>
            <div className="breadcrumb">
              <span>나의 공간</span>
              <span>/</span>
              <strong>{title}</strong>
            </div>
            <div className="topbar-actions">
              {state.timer.endAt && (
                <button
                  className="running-timer"
                  onClick={() => navigate("focus")}
                >
                  <Icon name="focus" size={15} />
                  {Math.floor(remainingSeconds(state.timer) / 60)}:
                  {String(remainingSeconds(state.timer) % 60).padStart(2, "0")}
                </button>
              )}
              <span className="topbar-date">
                {new Date(`${displayedDay}T12:00:00`).toLocaleDateString("ko-KR", {
                  month: "long",
                  day: "numeric",
                  weekday: "short",
                })}
              </span>
              <button
                className="icon-btn"
                aria-label="할 일 검색"
                onClick={() => {
                  setSearchOpen(true);
                  setTimeout(() => searchRef.current?.focus(), 0);
                }}
              >
                <Icon name="search" size={18} />
              </button>
              {!home && <button
                className="topbar-add"
                aria-label="새 할 일"
                onClick={() => openNew()}
              >
                <Icon name="plus" size={17} />
              </button>}
            </div>
          </header>
          <div className="page-layout">
            <div className={`page-main ${view === "today" && !query ? "home-swipe" : ""}`}
              onPointerDown={(event) => {
                suppressSwipeClick.current = false;
                if (view !== "today" || query || event.pointerType !== "touch" ||
                    (event.target as Element).closest("input, textarea, select, [contenteditable]")) return;
                swipeStart.current = { x: event.clientX, y: event.clientY };
              }}
              onPointerCancel={() => { swipeStart.current = null; }}
              onPointerUp={(event) => {
                const start = swipeStart.current;
                swipeStart.current = null;
                if (!start || view !== "today" || query) return;
                const dx = event.clientX - start.x;
                const dy = event.clientY - start.y;
                if (Math.abs(dx) >= 55 && Math.abs(dx) > Math.abs(dy) * 1.4) {
                  suppressSwipeClick.current = true;
                  shiftHome(dx > 0 ? -1 : 1);
                }
              }}
              onClickCapture={(event) => {
                if (!suppressSwipeClick.current) return;
                suppressSwipeClick.current = false;
                if (event.detail === 0) return;
                event.preventDefault();
                event.stopPropagation();
              }}>
              {view === "today" && !query && (
                <div className="home-day-nav">
                  <button className="icon-btn" aria-label="전날" onClick={() => shiftHome(-1)}><Icon name="left" size={17} /></button>
                  <strong>{dayTitle}</strong>
                  <button className="icon-btn" aria-label="다음 날" onClick={() => shiftHome(1)}><Icon name="right" size={17} /></button>
                  <button className="btn small home-review-btn" onClick={() => {
                    if (!canLeaveDetail()) return;
                    setCalendarStart(displayedDay);
                    navigate("calendar", "review");
                  }}>하루 돌아보기</button>
                  {homeDate && <button className="btn small" onClick={() => {
                    if (canLeaveDetail()) {
                      setHomeDate(null);
                      setSelected(null);
                      setChecked([]);
                    }
                  }}>오늘로</button>}
                </div>
              )}
              <div className="page-heading">
                <div>
                  {!home && <div className="page-eyebrow">
                    {view === "today"
                      ? "YOUR DAY, YOUR PACE"
                      : "A CLEAR MIND. A BETTER DAY."}
                  </div>}
                  <h1>
                    {title}
                    {!special && (
                      <span>
                        {(view === "completed" ? completed : pending).length}
                      </span>
                    )}
                  </h1>
                  <p>{subtitle}</p>
                </div>
                {!special && view !== "trash" && (
                  <div className="page-actions">
                    <button
                      className={`icon-btn ${selectionMode ? "active" : ""}`}
                      aria-label="여러 할 일 선택"
                      title="여러 할 일 선택"
                      onClick={() => {
                        setSelectionMode(!selectionMode);
                        setChecked([]);
                      }}
                    >
                      <Icon name="check" size={19} />
                    </button>
                    <div className="segmented">
                      <button
                        className={layout === "list" ? "selected" : ""}
                        onClick={() => setLayout("list")}
                        aria-label="목록 보기"
                      >
                        <Icon name="list" size={17} />
                      </button>
                      <button
                        className={layout === "board" ? "selected" : ""}
                        onClick={() => setLayout("board")}
                        aria-label="칸반 보기"
                      >
                        <Icon name="board" size={17} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {error && (
                <div className="error-banner" role="alert">
                  <span>{error}</span>
                  <button className="text-btn" disabled={busy} onClick={load}>
                    새로 불러오기
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => setError("")}
                    aria-label="오류 닫기"
                  >
                    <Icon name="close" size={15} />
                  </button>
                </div>
              )}
              {query && (
                <div className="search-results-line">
                  “{query}” 검색 결과 {filtered.length}개
                  <button className="text-btn" onClick={() => setQuery("")}>
                    검색 닫기
                  </button>
                </div>
              )}
              {!special || query ? (
                <>
                  {view === "today" && !query && (
                    <nav className="home-category-strip" aria-label="카테고리별 할 일">
                      {[{ id: "all", name: "전체" }, { id: "inbox", name: "수집함" }, ...state.lists].map((list) =>
                        <button key={list.id} type="button" aria-pressed={homeCategory === list.id}
                          onClick={() => setHomeCategory(list.id)}>
                          {"color" in list && <i style={{ background: list.color }} />}
                          {list.name}
                        </button>)}
                      {state.lists.some((list) => list.id === homeCategory) &&
                        <button type="button" className="category-settings-shortcut"
                          onClick={() => setListEditor(state.lists.find((list) => list.id === homeCategory)!)}>
                          이월 설정
                        </button>}
                    </nav>
                  )}
                  {view === "today" && !query && (
                    <section className="day-summary" aria-label="하루 진행 상황">
                      <div><strong>{dayTasks.filter((task) => completedOn(task, displayedDay)).length}</strong><span>완료</span></div>
                      <div><strong>{dayTasks.filter((task) => !task.completed && scheduledOn(task, displayedDay)).length}</strong><span>예정</span></div>
                      <div><strong>{dayTasks.filter((task) => !task.completed && carriesToDay(task, state.lists, displayedDay)).length}</strong><span>이어서 할 일</span></div>
                      <progress max={100} value={progress} aria-label="예정된 할 일 완료율" />
                    </section>
                  )}
                  {!home && view !== "trash" && view !== "completed" && (
                    <QuickComposer
                      key={view}
                      today={today}
                      defaultDate={
                        view === "today"
                          ? displayedDay
                          : view === "tomorrow"
                          ? addDays(today, 1)
                          : ""
                      }
                      busy={busy}
                      onAdd={(draft) => saveTask(fromQuick(draft))}
                      onDetails={(draft) => {
                        if (!canLeaveDetail()) return;
                        setSelected(null);
                        setNewEditor(fromQuick(draft));
                      }}
                    />
                  )}
                  <div className="task-view-toolbar">
                    <span>
                      <Icon name="list" size={14} />
                      {view === "trash"
                        ? "삭제한 할 일"
                        : view === "completed"
                        ? "완료한 할 일"
                        : "할 일 목록"}
                      <small>{filtered.length}</small>
                    </span>
                    <div className="toolbar-selects">
                      {view === "completed" && !query && (
                        <>
                          <label>
                            완료 날짜
                            <input type="date" aria-label="완료 날짜" value={completionDay}
                              onChange={(e) => setCompletionDay(e.target.value)} />
                          </label>
                          <button className="btn small" onClick={() => setCompletionDay(today)}>오늘</button>
                          <button className="btn small" onClick={() => setCompletionDay("")}>전체 날짜</button>
                        </>
                      )}
                      <label>
                        <Icon name="sort" size={14} />
                        <select
                          value={sort}
                          aria-label="할 일 정렬"
                          onChange={(e) => setSort(e.target.value)}
                        >
                          <option value="order">사용자 지정</option>
                          <option value="date">날짜순</option>
                          <option value="priority">우선순위순</option>
                          <option value="title">제목순</option>
                        </select>
                      </label>
                      <label>
                        <select
                          value={group}
                          aria-label="할 일 그룹"
                          onChange={(e) => setGroup(e.target.value)}
                        >
                          <option value="date">날짜로 그룹</option>
                          <option value="priority">우선순위로 그룹</option>
                          <option value="list">리스트로 그룹</option>
                          <option value="none">그룹 없음</option>
                        </select>
                      </label>
                    </div>
                  </div>
                  {selectionMode && (
                    <div className="bulk-toolbar">
                      <label>
                        <input
                          type="checkbox"
                          checked={
                            pending.length > 0 &&
                            pending.every((t) => checked.includes(t.id))
                          }
                          onChange={(e) =>
                            setChecked(
                              e.target.checked ? pending.map((t) => t.id) : []
                            )
                          }
                        />{" "}
                        {checked.length}개 선택
                      </label>
                      <button
                        disabled={busy || !checked.length}
                        onClick={async () => {
                          if (
                            await commit(
                              (w) =>
                                checked.reduce((s, id) => {
                                  const t = s.tasks.find((x) => x.id === id);
                                  return t && !t.completed
                                    ? toggleTask(s, id)
                                    : s;
                                }, w),
                              "선택한 할 일을 완료했어요"
                            )
                          )
                            setChecked([]);
                        }}
                      >
                        완료
                      </button>
                      <button
                        disabled={busy || !checked.length}
                        onClick={() =>
                          commit(
                            (w) => ({
                              ...w,
                              tasks: w.tasks.map((t) =>
                                checked.includes(t.id)
                                  ? { ...t, ...moveTaskDate(t, addDays(today, 1)) }
                                  : t
                              ),
                            }),
                            "내일로 미뤘어요"
                          )
                        }
                      >
                        내일로
                      </button>
                      <button
                        disabled={busy || !checked.length}
                        onClick={() => trash(checked)}
                      >
                        휴지통
                      </button>
                    </div>
                  )}
                  {view === "trash" ? (
                    sorted.map((t) => row(t))
                  ) : view === "completed" ? (
                    completed.map((t) => row(t))
                  ) : layout === "board" ? (
                    <div className="kanban-board">
                      {([1, 2, 3, 4, 0] as Priority[]).map((p) => (
                        <section
                          className={`kanban-column p${p}`}
                          key={p}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => dropPriority(e, p)}
                        >
                          <h3>
                            <i />
                            {priorityNames[p]}
                            <span>
                              {pending.filter((t) => t.priority === p).length}
                            </span>
                          </h3>
                          {pending
                            .filter((t) => t.priority === p)
                            .map((t) => row(t, true))}
                          <button
                            className="board-add"
                            onClick={() =>
                              setNewEditor(
                                newTask("", {
                                  priority: p,
                                  date: displayedDay,
                                  listId: view.startsWith("list:")
                                    ? view.slice(5)
                                    : "inbox",
                                })
                              )
                            }
                          >
                            <Icon name="plus" size={14} />할 일 추가
                          </button>
                        </section>
                      ))}
                    </div>
                  ) : (
                    grouped()
                  )}
                  {!filtered.length && (
                    <div className="empty-state">
                      <div>
                        <Icon
                          name={
                            view === "trash"
                              ? "trash"
                              : view === "completed"
                              ? "check"
                              : "inbox"
                          }
                          size={34}
                        />
                      </div>
                      <h3>
                        {query
                          ? "찾는 할 일이 없어요"
                          : view === "trash"
                          ? "휴지통이 비어 있어요"
                          : view === "completed"
                          ? "아직 완료한 일이 없어요"
                          : "마음에도 여백을 남겨요"}
                      </h3>
                      <p>
                        {query
                          ? "다른 검색어로 다시 찾아보세요."
                          : "새로운 할 일을 더해, 작은 시작을 만들어 보세요."}
                      </p>
                    </div>
                  )}
                  {state.settings.showCompleted &&
                    view !== "completed" &&
                    view !== "trash" &&
                    completed.length > 0 && (
                      <details className="completed-section" open>
                        <summary>
                          <Icon name="chevron" size={13} />
                          완료한 일<span>{completed.length}</span>
                        </summary>
                        {completed.map((t) => row(t))}
                      </details>
                    )}
                  {!home && view !== "trash" && view !== "completed" && (
                    <button
                      className="list-add-bottom"
                      onClick={() => openNew()}
                    >
                      <Icon name="plus" size={16} />
                      새로운 할 일 추가<span>작은 일도 좋아요</span>
                    </button>
                  )}
                </>
              ) : view === "calendar" ? (
                <CalendarView
                  key={`${calendarStart}:${calendarMode}`}
                  initialMode={calendarMode}
                  initialDate={calendarStart}
                  actuals={state.tasks.filter((task) => task.actual && !task.deletedAt)}
                  onSaveActual={saveTask}
                  onDeleteActual={(id) => patchTask(id, { deletedAt: new Date().toISOString() }, "실행 기록을 삭제했어요")}
                  plans={state.calendarPlans ?? {}}
                  busy={busy}
                  onSavePlan={(period, text) => commit((workspace) => {
                    const plans = { ...workspace.calendarPlans };
                    if (text) plans[period] = text;
                    else delete plans[period];
                    return { ...workspace, calendarPlans: plans };
                  }, "계획을 저장했어요")}
                  tasks={tasks}
                  lists={state.lists}
                  weekStart={state.settings.weekStart}
                  onSelect={chooseTask}
                  onDuplicate={duplicateSchedule}
                  onMove={(id, date) =>
                    patchTask(id, { date }, "일정을 옮겼어요")
                  }
                  onAdd={openNew}
                  onSchedule={(id, patch) =>
                    patchTask(id, patch, "일정 시간을 변경했어요")
                  }
                />
              ) : view === "focus" ? (
                <FocusView state={state} commit={commit} busy={busy} />
              ) : view === "habits" ? (
                <HabitsView state={state} commit={commit} busy={busy} />
              ) : view === "settings" ? (
                <SettingsView
                  state={state}
                  commit={commit}
                  busy={busy}
                  notify={setNotice}
                />
              ) : view === "rank" ? (
                <RankView state={state} onNavigate={navigate} />
              ) : (
                <section className="matrix-grid">
                  {[
                    {
                      title: "지금 하기",
                      description: "중요하고 급한 일",
                      priority: 1 as Priority,
                      color: "red",
                    },
                    {
                      title: "계획하기",
                      description: "중요하지만 급하지 않은 일",
                      priority: 2 as Priority,
                      color: "amber",
                    },
                    {
                      title: "빠르게 처리하기",
                      description: "급하지만 덜 중요한 일",
                      priority: 3 as Priority,
                      color: "blue",
                    },
                    {
                      title: "여유 있을 때",
                      description: "급하지도 중요하지도 않은 일",
                      priority: 4 as Priority,
                      color: "purple",
                    },
                  ].map((q) => {
                    const items = active.filter(
                      (task) => task.priority === q.priority
                    );
                    return (
                      <section
                        className={`matrix-quadrant ${q.color}`}
                        key={q.title}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const id = e.dataTransfer.getData("text/plain");
                          const task = tasks.find((t) => t.id === id);
                          if (task)
                            void patchTask(id, {
                              priority: q.priority,
                            });
                        }}
                      >
                        <header>
                          <span className="quadrant-number">{q.priority}</span>
                          <div>
                            <h2>{q.title}</h2>
                            <p>{q.description}</p>
                          </div>
                          <span>{items.length}</span>
                        </header>
                        {items.map((t) => row(t, true))}
                        {!items.length && (
                          <p className="matrix-empty">
                            할 일을 이곳으로 끌어 정리해 보세요.
                          </p>
                        )}
                      </section>
                    );
                  })}
                  <p className="view-tip">
                    우선순위 1~4에 따라 표시됩니다. 칸을 옮기면 우선순위가 바뀝니다.
                    {active.some((task) => task.priority === 0) && (
                      <span> 우선순위 미지정 {active.filter((task) => task.priority === 0).length}개는 할 일 목록에서 지정해 주세요.</span>
                    )}
                  </p>
                </section>
              )}
              <footer className="workspace-footer">
                <span>
                  dotodo<span>.</span>
                </span>
                머릿속은 가볍게, 하루는 선명하게.
                <small>ONE SMALL STEP AT A TIME</small>
              </footer>
            </div>
            {selectedTask ? (
              <ResponsiveTaskDetail
                key={selectedTask.id}
                task={selectedTask}
                lists={state.lists}
                busy={busy}
                onClose={closeDetail}
                onDiscard={discardDetail}
                habitLimitReached={state.habits.length >= 200}
                onDirtyChange={onDirtyChange}
                onSave={saveTask}
                onToggle={toggle}
                onDelete={() => trash([selectedTask.id])}
                onFocus={() => focusTask(selectedTask.id)}
              />
            ) : view === "today" && !query ? (
              <TodayOverview
                state={state}
                today={displayedDay}
                onDate={(day) => {
                  setCalendarStart(day);
                  navigate("calendar");
                }}
                onNavigate={navigate}
                onHabit={(id) => commit((workspace) => {
                  const habit = workspace.habits.find((item) => item.id === id);
                  return checkHabit(workspace, id, displayedDay,
                    Boolean(habit && (habit.checks[displayedDay] || 0) >= habit.goal));
                })}
              />
            ) : null}
          </div>
        </main>
        {home && (
          <button className="home-quick-add" aria-label="할 일 추가" onClick={openQuickAdd}>
            <Icon name="plus" size={28} />
          </button>
        )}
        <nav className="mobile-bottom-nav" aria-label="주요 기능">
          {sections.map((s) => (
            <button
              key={s.id}
              className={
                view === s.id || (s.id === "today" && !special) ? "active" : ""
              }
              onClick={() => navigate(s.id)}
            >
              <Icon name={s.icon} size={20} />
              <span>{s.name}</span>
            </button>
          ))}
        </nav>
        {notice && (
          <div className="toast" role="status">
            <Icon name="check" size={16} />
            <span>{notice}</span>
            {undo && notice === "휴지통으로 이동했어요" && (
              <button
                onClick={async () => {
                  if (
                    await commit(
                      (w) => ({
                        ...w,
                        tasks: w.tasks.map((t) =>
                          undo.ids.includes(t.id)
                            ? { ...t, deletedAt: null }
                            : t
                        ),
                      }),
                      "이동을 취소했어요"
                    )
                  )
                    setUndo(null);
                }}
              >
                실행 취소
              </button>
            )}
          </div>
        )}
        {searchOpen && (
          <Modal
            title="무엇을 찾고 있나요?"
            onClose={() => setSearchOpen(false)}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSearchOpen(false);
              }}
            >
              <label className="global-search">
                <Icon name="search" />
                <input
                  ref={searchRef}
                  autoFocus
                  aria-label="전체 검색"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="할 일, 메모, 태그 검색…"
                />
              </label>
              <p className="search-help">
                제목, 메모, 태그를 모든 리스트에서 찾아요.
              </p>
              <div className="search-preview">
                {query &&
                  visibleTasks
                    .filter((t) =>
                      `${t.title} ${t.notes} ${t.tags.join(" ")}`
                        .toLowerCase()
                        .includes(query.toLowerCase())
                    )
                    .slice(0, 6)
                    .map((t) => (
                      <button
                        type="button"
                        key={t.id}
                        onClick={() => {
                          setSearchOpen(false);
                          setSelected(t.id);
                        }}
                      >
                        <Icon name="tasks" size={15} />
                        {t.title}
                        <Icon name="arrow" size={14} />
                      </button>
                    ))}
              </div>
              <div className="dialog-actions">
                <button className="btn primary" disabled={!query.trim()}>
                  검색 결과 보기
                </button>
              </div>
            </form>
          </Modal>
        )}
        {listEditor && (
          <ListEditor
            list={listEditor === "new" ? null : listEditor}
            busy={busy}
            onClose={() => setListEditor(null)}
            onSave={async (list) => {
              if (
                await commit(
                  (w) => ({
                    ...w,
                    lists:
                      listEditor === "new"
                        ? [...w.lists, list]
                        : w.lists.map((l) => (l.id === list.id ? list : l)),
                  }),
                  "리스트를 저장했어요"
                )
              )
                setListEditor(null);
            }}
            onDelete={() => {
              if (listEditor === "new") return;
              setConfirmation({
                title: "리스트를 삭제할까요?",
                message:
                  "이 리스트의 할 일은 삭제하지 않고 수집함으로 옮깁니다.",
                run: async () => {
                  const ok = await commit(
                    (w) => ({
                      ...w,
                      lists: w.lists.filter((l) => l.id !== listEditor.id),
                      tasks: w.tasks.map((t) =>
                        t.listId === listEditor.id
                          ? { ...t, listId: "inbox" }
                          : t
                      ),
                    }),
                    "리스트의 할 일을 수집함으로 옮겼어요"
                  );
                  if (ok) {
                    setListEditor(null);
                    navigate("inbox");
                  }
                  return ok;
                },
              });
            }}
          />
        )}
        {quickAddOpen && (
          <QuickAddSheet
            today={today}
            defaultDate={displayedDay}
            sheetLists={state.lists}
            busy={busy}
            onClose={() => setQuickAddOpen(false)}
            onAdd={async (draft) => {
              const saved = await saveTask(fromQuick(draft));
              if (saved) setQuickAddOpen(false);
              return saved;
            }}
            onDetails={(draft) => {
              setQuickAddOpen(false);
              setNewEditor(fromQuick(draft));
            }}
          />
        )}
        {newEditor && (
          <Modal
            title="새로운 할 일"
            wide
            onClose={closeDetail}
          >
            <div className="new-task-detail">
              <TaskDetail
                key={newEditor.id}
                task={newEditor}
                isNew
                habitLimitReached={state.habits.length >= 200}
                onDirtyChange={onDirtyChange}
                lists={state.lists}
                busy={busy}
                onClose={closeDetail}
                onDiscard={discardDetail}
                onSave={async (task, linkHabit) => {
                  if (await saveTask(task, linkHabit)) {
                    setNewEditor(null);
                    setSelected(task.id);
                    return true;
                  }
                  return false;
                }}
                onToggle={async () => false}
                onDelete={() => setNewEditor(null)}
                onFocus={() => {
                  setNotice("할 일을 먼저 저장해 주세요");
                }}
              />
            </div>
          </Modal>
        )}
        {confirmation && (
          <Modal
            title={confirmation.title}
            onClose={() => setConfirmation(null)}
          >
            <p className="dialog-description">{confirmation.message}</p>
            <div className="dialog-actions">
              <button className="btn" onClick={() => setConfirmation(null)}>
                취소
              </button>
              <button
                className="btn danger-fill"
                disabled={busy}
                onClick={async () => {
                  if (await confirmation.run()) setConfirmation(null);
                }}
              >
                확인
              </button>
            </div>
          </Modal>
        )}
      </div>
    </SaveErrorContext.Provider>
  );
}
function dateLabel(date: string, today: string) {
  return date === today
    ? "오늘"
    : date === addDays(today, 1)
    ? "내일"
    : date === addDays(today, -1)
    ? "어제"
    : new Date(`${date}T12:00:00`).toLocaleDateString("ko-KR", {
        month: "long",
        day: "numeric",
        weekday: "short",
      });
}
function ListEditor({
  list,
  busy,
  onClose,
  onSave,
  onDelete,
}: {
  list: TaskList | null;
  busy: boolean;
  onClose: () => void;
  onSave: (l: TaskList) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(list?.name || "");
  const [color, setColor] = useState(list?.color || palette[0]);
  const [autoCarry, setAutoCarry] = useState(list?.autoCarry !== false);
  return (
    <Modal title={list ? "리스트 수정" : "새로운 리스트"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            id: list?.id || uid(),
            name: name.trim(),
            color,
            icon: list?.icon || "list",
            autoCarry,
          });
        }}
      >
        <label className="form-field">
          리스트 이름
          <input
            autoFocus
            maxLength={50}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 사이드 프로젝트"
          />
        </label>
        <div className="form-field">
          리스트 색상
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
        <label className="category-carry-setting">
          <div>
            <strong>미완료 할 일 자동 이월</strong>
            <span>{autoCarry ? "다음 날에도 이어서 표시해요. 원래 날짜의 기록은 보존돼요." : "지정한 날짜에만 표시해요."}</span>
            <small>매일 반복은 이 설정과 관계없이 날짜마다 새로 생성돼요.</small>
          </div>
          <input type="checkbox" checked={autoCarry}
            onChange={(event) => setAutoCarry(event.target.checked)} />
        </label>
        <div className="dialog-actions">
          {list && (
            <button
              className="text-btn danger"
              type="button"
              onClick={onDelete}
            >
              리스트 삭제
            </button>
          )}
          <button className="btn" type="button" onClick={onClose}>
            취소
          </button>
          <button className="btn primary" disabled={busy || !name.trim()}>
            저장
          </button>
        </div>
      </form>
    </Modal>
  );
}
function TodayOverview({
  state,
  today,
  onNavigate,
  onHabit,
  onDate,
}: {
  state: Workspace;
  today: string;
  onNavigate: (v: View) => void;
  onHabit: (id: string) => void;
  onDate: (day: string) => void;
}) {
  const d = new Date(`${today}T12:00:00`);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const start = addDays(
    localDate(first),
    -((first.getDay() - state.settings.weekStart + 7) % 7)
  );
  const sessions = state.sessions.filter(
    (s) => localDate(new Date(s.completedAt)) === today
  );
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  return (
    <aside className="today-overview">
      <div className="overview-date">
        <span>오늘의 리듬</span>
        <Icon name="sun" size={17} />
      </div>
      <div className="mini-calendar-heading">
        <strong>
          {d.getFullYear()}년 {d.getMonth() + 1}월
        </strong>
        <button
          className="icon-btn"
          aria-label="전체 캘린더 열기"
          onClick={() => onNavigate("calendar")}
        >
          <Icon name="calendar" size={15} />
        </button>
      </div>
      <div className="mini-calendar">
        {Array.from(
          { length: 7 },
          (_, i) =>
            ["일", "월", "화", "수", "목", "금", "토"][
              (i + state.settings.weekStart) % 7
            ]
        ).map((v) => (
          <span className="day-label" key={v}>
            {v}
          </span>
        ))}
        {days.map((day) => (
          <button
            className={`${day === today ? "current" : ""} ${
              day.slice(0, 7) !== today.slice(0, 7) ? "muted" : ""
            }`}
            key={day}
            onClick={() => onDate(day)}
          >
            {Number(day.slice(-2))}
            {state.tasks.some(
              (t) => t.date === day && !t.deletedAt && !t.completed
            ) && <i />}
          </button>
        ))}
      </div>
      <div className="overview-section">
        <div className="overview-section-heading">
          <h3>나의 작은 습관</h3>
          <button
            className="icon-btn"
            aria-label="습관 전체 보기"
            onClick={() => onNavigate("habits")}
          >
            <Icon name="right" size={14} />
          </button>
        </div>
        {state.habits.slice(0, 3).map((h) => (
          <button
            className="overview-habit"
            key={h.id}
            onClick={() => onHabit(h.id)}
            disabled={today > localDate()}
          >
            <i style={{ color: h.color, background: `${h.color}12` }}>
              <Icon name={h.icon} size={17} />
            </i>
            <span>
              {h.name}
              <small>
                {Math.min(h.checks[today] || 0, h.goal)} / {h.goal}회
              </small>
            </span>
            <span
              className={`tiny-check ${
                (h.checks[today] || 0) >= h.goal ? "done" : ""
              }`}
            >
              {(h.checks[today] || 0) >= h.goal && (
                <Icon name="check" size={11} />
              )}
            </span>
          </button>
        ))}
      </div>
      <div className="overview-focus">
        <Icon name="focus" size={23} />
        <h3>나를 위한 {state.settings.focusMinutes}분</h3>
        <p>
          잠깐의 몰입이 만드는
          <br />
          생각보다 큰 변화.
        </p>
        <button className="btn" onClick={() => onNavigate("focus")}>
          집중하러 가기
          <Icon name="arrow" size={14} />
        </button>
        <span>
          오늘 {sessions.reduce((n, s) => n + s.minutes, 0)}분 집중했어요
        </span>
      </div>
      <div className="overview-quote">
        조금 느려도 괜찮아요.
        <br />
        오늘의 한 걸음이면 충분해요.<span>MAKE SPACE FOR WHAT MATTERS</span>
      </div>
    </aside>
  );
}

function ResponsiveTaskDetail(props: React.ComponentProps<typeof TaskDetail>) {
  const [overlay, setOverlay] = useState(() => window.matchMedia("(max-width: 1050px)").matches);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1050px)");
    const update = () => setOverlay(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (overlay && !dialog.current?.open) dialog.current?.showModal();
  }, [overlay]);
  const detail = <TaskDetail {...props} />;
  return overlay ? createPortal(
    <dialog ref={dialog} className="detail-overlay" aria-label="할 일 편집"
      onCancel={(event) => {
        event.preventDefault();
        props.onClose();
      }}>
      {detail}
    </dialog>,
    document.body
  ) : detail;
}
