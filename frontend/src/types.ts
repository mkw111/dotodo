export type Priority = 0 | 1 | 2 | 3 | 4;
export type Repeat = "none" | "daily" | "weekdays" | "weekly" | "monthly";
export type Task = {
  id: string;
  title: string;
  notes: string;
  listId: string;
  date: string;
  endDate?: string;
  time: string;
  priority: Priority;
  tags: string[];
  checklist: { id: string; title: string; done: boolean }[];
  repeat: Repeat;
  completed: boolean;
  completedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  order: number;
  recurrenceSource?: string;
  habitId?: string;
  actual?: boolean;
  autoCarry?: boolean;
  repeatDay?: number;
  durationMinutes?: number;
  reminderMinutes?: number;
};
export type TaskList = {
  id: string;
  name: string;
  color: string;
  icon: string;
  autoCarry?: boolean;
};
export type Habit = {
  id: string;
  name: string;
  icon: string;
  color: string;
  goal: number;
  checks: Record<string, number>;
};
export type FocusSession = {
  id: string;
  taskId: string | null;
  title: string;
  minutes: number;
  completedAt: string;
};
export type Timer = {
  mode: "focus" | "break";
  taskId: string | null;
  endAt: number | null;
  remaining: number;
  duration: number;
};
export type Settings = {
  name: string;
  theme: "light" | "dark" | "system";
  accent: string;
  weekStart: 0 | 1;
  focusMinutes: number;
  breakMinutes: number;
  showCompleted: boolean;
};
export type Workspace = {
  schema: 2;
  tasks: Task[];
  lists: TaskList[];
  habits: Habit[];
  sessions: FocusSession[];
  timer: Timer;
  settings: Settings;
  rewards?: RankReward[];
  calendarPlans?: Record<string, string>;
};
export type RankReward = {
  id: string;
  type: "task" | "habit" | "focus" | "quest";
  title: string;
  xp: number;
  earnedAt: string;
  active: boolean;
};
export type View =
  | "today"
  | "inbox"
  | "tomorrow"
  | "week"
  | "all"
  | "important"
  | "completed"
  | "trash"
  | "calendar"
  | "matrix"
  | "focus"
  | "habits"
  | "settings"
  | "rank"
  | `list:${string}`
  | `tag:${string}`;
export const palette = [
  "#4776e6",
  "#8a6ed7",
  "#d99b43",
  "#45a48a",
  "#df777a",
  "#6299bb",
];
export const priorityNames = ["우선순위 없음", "높음", "보통", "낮음", "가장 낮음"];
export const repeatNames: Record<Repeat, string> = {
  none: "반복 안 함",
  daily: "매일",
  weekdays: "평일마다",
  weekly: "매주",
  monthly: "매월",
};
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}
