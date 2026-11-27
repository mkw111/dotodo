import {
  localDate,
  palette,
  repeatNames,
  type Task,
  type Workspace,
  type View,
  type Repeat,
  type Priority,
} from "./types.ts";
import { recognizeInput } from "./smartInput.ts";
export const uid = () => crypto.randomUUID();
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localDate(d);
}
export function validDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T12:00:00`)) &&
    localDate(new Date(`${value}T12:00:00`)) === value
  );
}
export function nextRepeat(
  date: string,
  repeat: Repeat,
  repeatDay?: number
): string {
  if (repeat === "monthly") {
    const d = new Date(`${date}T12:00:00`);
    const day = repeatDay || d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    d.setDate(
      Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())
    );
    return localDate(d);
  }
  let next = addDays(date, repeat === "weekly" ? 7 : 1);
  while (
    repeat === "weekdays" &&
    [0, 6].includes(new Date(`${next}T12:00:00`).getDay())
  )
    next = addDays(next, 1);
  return next;
}
export function scheduledOn(task: Task, day: string) {
  return Boolean(task.date) && task.date <= day && (task.endDate || task.date) >= day;
}

export function moveTaskDate(task: Task, date: string): Partial<Task> {
  if (!date || !task.endDate) return { date, endDate: undefined };
  const span = Math.round((Date.parse(task.endDate) - Date.parse(task.date)) / 86_400_000);
  return { date, endDate: addDays(date, span) };
}

export function newTask(title: string, patch: Partial<Task> = {}): Task {
  return {
    id: uid(),
    title,
    notes: "",
    listId: "inbox",
    date: "",
    time: "",
    priority: 0,
    tags: [],
    checklist: [],
    repeat: "none",
    completed: false,
    completedAt: null,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    order: Date.now(),
    ...patch,
  };
}
export function saveTaskWithHabit(state: Workspace, task: Task, linkHabit?: boolean): Workspace {
  const existing = state.tasks.find((item) => item.id === task.id);
  let tasks = existing
    ? state.tasks.map((item) => item.id === task.id ? task : item)
    : [...state.tasks, task];
  if (existing && task.title !== existing.title) {
    const descendants = new Set([task.id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const item of tasks) {
        if (item.recurrenceSource && descendants.has(item.recurrenceSource) && !descendants.has(item.id)) {
          descendants.add(item.id);
          changed = true;
        }
      }
    }
    tasks = tasks.map((item) => item.id !== task.id && descendants.has(item.id) &&
      !item.completed && item.date >= task.date ? { ...item, title: task.title } : item);
  }
  const next = {
    ...state, tasks,
    habits: state.habits.map((habit) =>
      habit.id === task.habitId && existing?.title !== task.title
        ? { ...habit, name: task.title.trim().slice(0, 100) } : habit),
  };
  if (linkHabit === undefined) return next;

  const habitId = task.habitId;
  if (!linkHabit || task.repeat !== "daily" || !task.date) {
    return habitId ? {
      ...next,
      tasks: tasks.map((item) => item.habitId === habitId ? { ...item, habitId: undefined } : item),
    } : next;
  }
  if (habitId || state.habits.length >= 200 || !task.title.trim()) return next;

  const byId = new Map(tasks.map((item) => [item.id, item]));
  let root = task;
  const ancestors = new Set([task.id]);
  while (root.recurrenceSource) {
    const parent = byId.get(root.recurrenceSource);
    if (!parent || parent.habitId || ancestors.has(parent.id)) break;
    ancestors.add(parent.id);
    root = parent;
  }
  const children = new Map<string, Task[]>();
  for (const item of tasks) {
    if (!item.recurrenceSource || item.habitId) continue;
    const siblings = children.get(item.recurrenceSource) ?? [];
    siblings.push(item);
    children.set(item.recurrenceSource, siblings);
  }
  const family = new Set<string>();
  const checks: Record<string, number> = {};
  const remaining = [root];
  while (remaining.length) {
    const item = remaining.pop()!;
    if (family.has(item.id)) continue;
    family.add(item.id);
    if (item.completed && item.completedAt) {
      const day = localDate(new Date(item.completedAt));
      checks[day] = Math.min(100, (checks[day] || 0) + 1);
    }
    for (const child of children.get(item.id) ?? []) remaining.push(child);
  }
  const id = uid();
  return {
    ...state,
    tasks: tasks.map((item) => family.has(item.id) ? { ...item, habitId: id } : item),
    habits: [...state.habits, {
      id,
      name: task.title.trim().slice(0, 100),
      color: state.lists.find((list) => list.id === task.listId)?.color ?? palette[0],
      icon: "habit",
      goal: 1,
      checks,
    }],
  };
}

// Keep each day's occurrence so a missed daily task remains in that day's history.
export function materializeDailyTasks(state: Workspace, today = localDate()): Workspace {
  const tasks = [...state.tasks];
  const children = new Set(tasks.map((task) => task.recurrenceSource).filter(Boolean));
  const until = today;
  for (let i = 0; i < tasks.length && tasks.length < 10000; i++) {
    const task = tasks[i];
    if (task.repeat !== "daily" || task.actual || task.deletedAt || !task.date ||
        task.date >= until || children.has(task.id)) continue;
    const date = addDays(task.date, 1);
    tasks.push(newTask(task.title, {
      ...task, id: uid(), ...moveTaskDate(task, date),
      completed: false, completedAt: null, recurrenceSource: task.id,
      checklist: task.checklist.map((item) => ({ ...item, id: uid(), done: false })),
      createdAt: new Date().toISOString(), order: Date.now(),
    }));
    children.add(task.id);
  }
  return tasks.length === state.tasks.length ? state : { ...state, tasks };
}

export function carriesToDay(task: Task, lists: Workspace["lists"], day: string): boolean {
  return Boolean(task.date) && (task.endDate || task.date) < day &&
    !task.completed && !task.deletedAt && task.repeat !== "daily" &&
    (task.autoCarry ?? lists.find((list) => list.id === task.listId)?.autoCarry) === true;
}

export function toggleTask(state: Workspace, id: string, completedDay?: string): Workspace {
  const task = state.tasks.find((t) => t.id === id);
  if (!task || task.deletedAt) return state;
  const completed = !task.completed;
  const completedAt = completed ? (completedDay ? new Date(`${completedDay}T12:00:00`).toISOString() : new Date().toISOString()) : null;
  let tasks = state.tasks.map((t) =>
    t.id === id
      ? {
          ...t,
          completed,
          completedAt,
        }
      : t
  );
  if (
    completed &&
    task.repeat !== "none" && task.repeat !== "daily" &&
    task.date &&
    !tasks.some((t) => t.recurrenceSource === id)
  )
    tasks.push(
      newTask(task.title, {
        ...task,
        id: uid(),
        ...moveTaskDate(task, nextRepeat(task.date, task.repeat, task.repeatDay)),
        repeatDay: task.repeatDay || Number(task.date.slice(-2)),
        completed: false,
        completedAt: null,
        recurrenceSource: id,
        checklist: task.checklist.map((item) => ({
          ...item,
          id: uid(),
          done: false,
        })),
        createdAt: new Date().toISOString(),
        order: Date.now(),
      })
    );
  const timestamp = completedAt ?? task.completedAt;
  if (!task.habitId || !timestamp) return { ...state, tasks };
  const day = localDate(new Date(timestamp));
  return {
    ...state,
    tasks,
    habits: state.habits.map((habit) => habit.id === task.habitId ? {
      ...habit,
      checks: {
        ...habit.checks,
        [day]: Math.max(0, Math.min(100, (habit.checks[day] || 0) + (completed ? 1 : -1))),
      },
    } : habit),
  };
}
export function checkHabit(state: Workspace, id: string, day: string, reset = false): Workspace {
  const habit = state.habits.find((item) => item.id === id);
  if (!habit || !validDate(day) || day > localDate()) return state;
  const linked = state.tasks.filter((task) => task.habitId === id && !task.deletedAt);
  let next = state;
  if (reset) {
    for (const task of linked) {
      if (task.completed && task.completedAt && localDate(new Date(task.completedAt)) === day) {
        next = toggleTask(next, task.id);
      }
    }
  } else if (linked.length) {
    const task = linked.find((item) => !item.completed && item.date === day);
    if (task) next = toggleTask(next, task.id, day);
    else {
      const source = linked.find((item) => item.repeat === "daily") ?? linked[0];
      const occurrence = newTask(source.title, {
        ...source, id: uid(), date: day, endDate: undefined,
        completed: false, completedAt: null, deletedAt: null,
        recurrenceSource: undefined, createdAt: new Date().toISOString(), order: Date.now(),
        checklist: source.checklist.map((item) => ({ ...item, id: uid(), done: false })),
      });
      // A date-specific check must not generate a second future recurring occurrence.
      next = toggleTask({ ...next, tasks: [...next.tasks, { ...occurrence, repeat: "none" }] }, occurrence.id, day);
    }
  }
  return {
    ...next,
    habits: next.habits.map((item) => item.id === id ? {
      ...item, checks: { ...item.checks, [day]: reset ? 0 : Math.min(100,
        Math.max(item.checks[day] || 0, (habit.checks[day] || 0) + 1)) },
    } : item),
  };
}

export function matches(task: Task, view: View, today = localDate()): boolean {
  if (view === "trash") return Boolean(task.deletedAt);
  if (task.deletedAt) return false;
  if (view === "completed") return task.completed;
  if (view === "today") return scheduledOn(task, today);
  if (view === "tomorrow") return scheduledOn(task, addDays(today, 1));
  if (view === "week")
    return (
      Boolean(task.date) && (task.endDate || task.date) >= today && task.date <= addDays(today, 6)
    );
  if (view === "important") return task.priority === 1;
  if (view === "inbox") return task.listId === "inbox";
  if (view.startsWith("list:")) return task.listId === view.slice(5);
  if (view.startsWith("tag:")) return task.tags.includes(view.slice(4));
  return true;
}
export function parseQuickAdd(
  text: string,
  today = localDate()
): Partial<Task> & { title: string } {
  const parsed = recognizeInput(text, today);
  return {
    title: parsed.title,
    date: parsed.date,
    priority: parsed.priority,
    tags: parsed.tags,
    ...(parsed.time ? { time: parsed.time } : {}),
    ...(parsed.repeat !== "none" ? { repeat: parsed.repeat } : {}),
  };
}
export function streak(
  checks: Record<string, number>,
  goal: number,
  today = localDate()
): number {
  let day = (checks[today] || 0) >= goal ? today : addDays(today, -1);
  let count = 0;
  while ((checks[day] || 0) >= goal) {
    count++;
    day = addDays(day, -1);
  }
  return count;
}
export function remainingSeconds(
  timer: Workspace["timer"],
  now = Date.now()
): number {
  return timer.endAt === null
    ? timer.remaining
    : Math.max(0, Math.ceil((timer.endAt - now) / 1000));
}
export function createWorkspace(samples = true): Workspace {
  const today = localDate();
  return {
    schema: 2,
    lists: [
      { id: "work", name: "업무", color: palette[0], icon: "briefcase" },
      { id: "personal", name: "개인", color: palette[1], icon: "user" },
      { id: "health", name: "건강", color: palette[3], icon: "heart" },
      { id: "learn", name: "배움", color: palette[2], icon: "book" },
    ],
    tasks: samples
      ? [
          newTask("dotodo, 나의 하루를 설계하는 공간", {
            date: today,
            time: "09:00",
            listId: "work",
            priority: 1,
            tags: ["dotodo", "기획"],
            notes:
              "머릿속의 할 일을 꺼내 놓고, 중요한 것부터 하나씩.\n\n오늘은 새롭게 시작하는 프로젝트의 방향을 정리해 보세요.",
            checklist: [
              {
                id: uid(),
                title: "프로젝트의 첫 번째 목표 정하기",
                done: true,
              },
              {
                id: uid(),
                title: "오늘 할 수 있는 작은 단계로 나누기",
                done: false,
              },
              { id: uid(), title: "집중할 시간 확보하기", done: false },
            ],
          }),
          newTask("팀 미팅 준비 및 자료 정리", {
            date: today,
            time: "10:30",
            listId: "work",
            priority: 2,
            tags: ["미팅"],
          }),
          newTask("점심 먹고 가볍게 산책하기", {
            date: today,
            time: "13:00",
            listId: "health",
            repeat: "weekdays",
          }),
          newTask("읽고 있던 책 20페이지 읽기", {
            date: today,
            listId: "learn",
            tags: ["루틴"],
          }),
          newTask("이번 주 장보기 목록 정리", {
            date: addDays(today, 1),
            listId: "personal",
            priority: 3,
          }),
          newTask("떠오른 아이디어를 자유롭게 적어보기", {
            listId: "inbox",
            tags: ["아이디어"],
          }),
          newTask("기분 좋은 음악으로 하루 시작하기", {
            date: today,
            listId: "personal",
            completed: true,
            completedAt: new Date().toISOString(),
          }),
          newTask("다음 주 프로젝트 초안 작성", {
            date: addDays(today, 3),
            listId: "work",
            priority: 1,
          }),
        ]
      : [],
    habits: samples
      ? [
          {
            id: uid(),
            name: "책 10페이지 읽기",
            icon: "book",
            color: palette[2],
            goal: 1,
            checks: { [addDays(today, -1)]: 1, [addDays(today, -2)]: 1 },
          },
          {
            id: uid(),
            name: "물 6잔 마시기",
            icon: "drop",
            color: palette[0],
            goal: 6,
            checks: { [today]: 2, [addDays(today, -1)]: 6 },
          },
          {
            id: uid(),
            name: "30분 걷기",
            icon: "walk",
            color: palette[3],
            goal: 1,
            checks: {},
          },
        ]
      : [],
    sessions: [],
    timer: {
      mode: "focus",
      taskId: null,
      endAt: null,
      remaining: 1500,
      duration: 1500,
    },
    settings: {
      name: "나",
      theme: "light",
      accent: palette[0],
      weekStart: 0,
      focusMinutes: 25,
      breakMinutes: 5,
      showCompleted: true,
    },
  };
}
export function migrateV1(value: unknown): Workspace {
  if (!Array.isArray(value))
    throw new Error("이전 데이터를 읽을 수 없어요. 원본은 보존되어 있습니다.");
  const state = createWorkspace(false);
  const map: Record<string, string> = {
    업무: "work",
    개인: "personal",
    건강: "health",
    배움: "learn",
  };
  state.tasks = value.map((t) => {
    if (!t || typeof t.title !== "string" || !t.title.trim())
      throw new Error("이전 할 일 형식이 올바르지 않습니다.");
    return newTask(t.title, {
      id: typeof t.id === "string" ? t.id : uid(),
      date: validDate(t.dueDate) ? t.dueDate : "",
      listId: map[t.category] || "inbox",
      priority: t.important ? 1 : 0,
      completed: Boolean(t.completed),
      completedAt: t.completed ? new Date().toISOString() : null,
    });
  });
  return state;
}
export function validateWorkspace(value: unknown): Workspace {
  const fail = (): never => {
    throw new Error(
      "dotodo 저장 데이터 형식이 올바르지 않아요. 원본 데이터는 변경하지 않았습니다."
    );
  };
  if (!value || typeof value !== "object") return fail();
  const w = value as Workspace;
  if (
    w.schema !== 2 ||
    !Array.isArray(w.tasks) ||
    !Array.isArray(w.lists) ||
    !Array.isArray(w.habits) ||
    !Array.isArray(w.sessions) ||
    !w.settings ||
    !w.timer
  )
    return fail();
  const str = (v: unknown, max: number, min = 0): v is string =>
    typeof v === "string" && v.length >= min && v.length <= max;
  const stamp = (v: unknown) =>
    v === null || (typeof v === "string" && !Number.isNaN(Date.parse(v)));
  const unique = (items: { id: string }[]) =>
    items.every((i) => i && str(i.id, 100, 1)) &&
    new Set(items.map((i) => i.id)).size === items.length;
  if (
    w.rewards !== undefined &&
    (!Array.isArray(w.rewards) ||
      w.rewards.length > 100000 ||
      new Set(w.rewards.map((r) => r?.id)).size !== w.rewards.length ||
      !w.rewards.every(
        (r) =>
          r &&
          str(r.id, 180, 1) &&
          ["task", "habit", "focus", "quest"].includes(r.type) &&
          str(r.title, 150) &&
          Number.isInteger(r.xp) &&
          r.xp >= 1 &&
          r.xp <= 60 &&
          typeof r.active === "boolean" &&
          typeof r.earnedAt === "string" &&
          stamp(r.earnedAt)
      ))
  )
    return fail();
  if (
    w.tasks.length > 10000 ||
    w.lists.length > 200 ||
    w.habits.length > 200 ||
    w.sessions.length > 50000 ||
    !unique(w.tasks) ||
    !unique(w.lists) ||
    !unique(w.habits) ||
    !unique(w.sessions)
  )
    return fail();
  if (
    !w.lists.every(
      (l) =>
        (l.autoCarry === undefined || typeof l.autoCarry === "boolean") &&
        str(l.name, 50, 1) &&
        /^#[0-9a-f]{6}$/i.test(l.color) &&
        str(l.icon, 30, 1) &&
        l.id !== "inbox"
    )
  )
    return fail();
  if (
    !w.tasks.every(
      (t) =>
        (t.actual === undefined || typeof t.actual === "boolean") &&
        str(t.title, 150, 1) &&
        t.title.trim() &&
        str(t.notes, 20000) &&
        (t.listId === "inbox" || w.lists.some((l) => l.id === t.listId)) &&
        typeof t.date === "string" &&
        (t.date === "" || validDate(t.date)) &&
        (t.endDate === undefined ||
          (typeof t.endDate === "string" && validDate(t.endDate) &&
            Boolean(t.date) && t.endDate >= t.date && !t.time)) &&
        (t.time === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(t.time)) &&
        [0, 1, 2, 3, 4].includes(t.priority) &&
        Array.isArray(t.tags) &&
        t.tags.length <= 30 &&
        t.tags.every((tag) => str(tag, 40, 1)) &&
        Array.isArray(t.checklist) &&
        t.checklist.length <= 100 &&
        unique(t.checklist) &&
        t.checklist.every(
          (c) => str(c.title, 150, 1) && typeof c.done === "boolean"
        ) &&
        (t.autoCarry === undefined || typeof t.autoCarry === "boolean") &&
        Object.hasOwn(repeatNames, t.repeat) &&
        typeof t.completed === "boolean" &&
        stamp(t.completedAt) &&
        stamp(t.deletedAt) &&
        str(t.createdAt, 100, 1) &&
        stamp(t.createdAt) &&
        Number.isFinite(t.order) &&
        (t.reminderMinutes === undefined ||
          (Number.isInteger(t.reminderMinutes) &&
            t.reminderMinutes >= 0 && t.reminderMinutes <= 10080)) &&
        (t.durationMinutes === undefined ||
          (Number.isInteger(t.durationMinutes) &&
            t.durationMinutes >= (t.actual ? 1 : 15) &&
            t.durationMinutes <= 720)) &&
        (t.habitId === undefined ||
          (str(t.habitId, 100, 1) && w.habits.some((habit) => habit.id === t.habitId))) &&
        (t.recurrenceSource === undefined || str(t.recurrenceSource, 100, 1)) &&
        (t.repeatDay === undefined ||
          (Number.isInteger(t.repeatDay) &&
            t.repeatDay >= 1 &&
            t.repeatDay <= 31)) &&
        (t.repeat === "none" || Boolean(t.date))
    )
  )
    return fail();
  if (
    !w.habits.every(
      (h) =>
        str(h.name, 100, 1) &&
        str(h.icon, 30, 1) &&
        /^#[0-9a-f]{6}$/i.test(h.color) &&
        Number.isInteger(h.goal) &&
        h.goal >= 1 &&
        h.goal <= 100 &&
        h.checks &&
        typeof h.checks === "object" &&
        !Array.isArray(h.checks) &&
        Object.entries(h.checks).every(
          ([day, n]) =>
            validDate(day) && Number.isInteger(n) && n >= 0 && n <= 100
        )
    )
  )
    return fail();
  if (
    !w.sessions.every(
      (s) =>
        str(s.title, 150) &&
        (s.taskId === null || str(s.taskId, 100, 1)) &&
        Number.isFinite(s.minutes) &&
        s.minutes > 0 &&
        s.minutes <= 180 &&
        typeof s.completedAt === "string" &&
        stamp(s.completedAt)
    )
  )
    return fail();
  const s = w.settings;
  const t = w.timer;
  if (
    !str(s.name, 40, 1) ||
    !["light", "dark", "system"].includes(s.theme) ||
    !/^#[0-9a-f]{6}$/i.test(s.accent) ||
    ![0, 1].includes(s.weekStart) ||
    !Number.isInteger(s.focusMinutes) ||
    s.focusMinutes < 1 ||
    s.focusMinutes > 180 ||
    !Number.isInteger(s.breakMinutes) ||
    s.breakMinutes < 1 ||
    s.breakMinutes > 60 ||
    typeof s.showCompleted !== "boolean"
  )
    return fail();
  if (
    !["focus", "break"].includes(t.mode) ||
    !(t.taskId === null || str(t.taskId, 100, 1)) ||
    !(t.endAt === null || (Number.isFinite(t.endAt) && t.endAt > 0)) ||
    !Number.isFinite(t.duration) ||
    t.duration < 60 ||
    t.duration > 10800 ||
    !Number.isFinite(t.remaining) ||
    t.remaining < 0 ||
    t.remaining > t.duration
  )
    return fail();
  if (w.calendarPlans !== undefined &&
    (!w.calendarPlans || typeof w.calendarPlans !== "object" || Array.isArray(w.calendarPlans) ||
      Object.keys(w.calendarPlans).length > 1200 ||
      Object.entries(w.calendarPlans).some(([period, plan]) =>
        !/^\d{4}(?:-(?:0[1-9]|1[0-2]))?$/.test(period) || !str(plan, 3000))))
    return fail();
  return w;
}
