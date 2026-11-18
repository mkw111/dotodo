import test from "node:test";
import assert from "node:assert/strict";
import { appReminders } from "../src/AppReminders.ts";
import { recognizeInput } from "../src/smartInput.ts";
import {
  createWorkspace,
  newTask,
  moveTaskDate,
  scheduledOn,
  saveTaskWithHabit,
  checkHabit,
  toggleTask,
  validateWorkspace,
} from "../src/model.ts";
import { syncRewards, rankProfile, dailyQuests, tiers } from "../src/rank.ts";
import {
  layoutSchedule,
  snapStart,
  snapDuration,
  timeOf,
} from "../src/schedule.ts";
import { localDate } from "../src/types.ts";

test("Korean weekdays, this week, next week and recurring schedules", () => {
  for (const [text, date, repeat] of [
    ["오늘 운동", "2026-10-28", "none"],
    ["내일 운동", "2026-10-29", "none"],
    ["이번주 운동", "2026-11-01", "none"],
    ["이번 주 운동", "2026-11-01", "none"],
    ["다음주 운동", "2026-11-02", "none"],
    ["수요일 운동", "2026-10-28", "none"],
    ["다음 주 수요일 운동", "2026-11-04", "none"],
    ["매주 수요일 운동", "2026-10-28", "weekly"],
    ["매일 운동", "2026-10-28", "daily"],
    ["매월 운동", "2026-10-28", "monthly"],
  ]) {
    const p = recognizeInput(text, "2026-10-28");
    assert.equal(p.title, "운동", text);
    assert.equal(p.date, date, text);
    assert.equal(p.repeat, repeat, text);
  }
  assert.equal(recognizeInput("수요일 운동", "2026-10-29").date, "2026-11-04");
  assert.equal(
    recognizeInput("평일마다 운동", "2026-10-31").date,
    "2026-11-02"
  );
});
test("clicking a token preserves ordinary title text and does not regain recognition while typing", () => {
  const first = recognizeInput("오늘 운동", "2026-10-28");
  const key = first.tokens[0].key;
  const off = recognizeInput("오늘 운동", "2026-10-28", [key]);
  assert.equal(off.title, "오늘 운동");
  assert.equal(off.date, "");
  assert.equal(off.dateRecognitionDisabled, true);
  const later = recognizeInput("오늘 운동 더 하기", "2026-10-28", [key]);
  assert.equal(later.date, "");
  assert.equal(later.title, "오늘 운동 더 하기");
  assert.equal(
    recognizeInput("오늘 운동", "2026-10-28", []).date,
    "2026-10-28"
  );
});
test("independent repeated tokens, literal words and invalid dates", () => {
  const p = recognizeInput("오늘 오늘의 기록 오늘", "2026-10-28");
  assert.equal(p.tokens.length, 2);
  assert.notEqual(p.tokens[0].key, p.tokens[1].key);
  assert.equal(
    recognizeInput("내일의 계획 수요일엔 운동", "2026-10-28").title,
    "내일의 계획 수요일엔 운동"
  );
  assert.equal(
    recognizeInput("2026-02-31 운동", "2026-10-28").tokens.length,
    0
  );
});
test("smart time, recurrence, tags and priorities compose together", () => {
  const p = recognizeInput(
    "내일 오후 3시 30분 매일 운동 #건강 !1",
    "2026-10-28"
  );
  assert.equal(p.title, "운동");
  assert.equal(p.date, "2026-10-29");
  assert.equal(p.time, "15:30");
  assert.equal(p.repeat, "daily");
  assert.deepEqual(p.tags, ["건강"]);
  assert.equal(p.priority, 1);
  assert.equal(recognizeInput("오전 12시 독서", "2026-10-28").time, "00:00");
  assert.equal(recognizeInput("오후 12시 독서", "2026-10-28").time, "12:00");
  assert.equal(recognizeInput("오후 13시 독서", "2026-10-28").tokens.length, 0);
});
test("completion awards once, undo retracts XP, re-complete and reload never multiply it", () => {
  let w = createWorkspace(false);
  const task = newTask("퀘스트");
  w.tasks = [task];
  w = syncRewards(toggleTask(w, task.id));
  assert.equal(rankProfile(w).xp, 20);
  w = syncRewards(w);
  assert.equal(rankProfile(w).xp, 20);
  assert.equal(w.rewards.length, 1);
  w = syncRewards(toggleTask(w, task.id));
  assert.equal(rankProfile(w).xp, 0);
  w = syncRewards(toggleTask(w, task.id));
  assert.equal(rankProfile(w).xp, 20);
  assert.equal(w.rewards.length, 1);
  w = syncRewards({ ...w, tasks: [] });
  assert.equal(rankProfile(w).xp, 20);
  assert.equal(validateWorkspace(w), w);
});
test("daily quests grant once and revoke when source completion is undone", () => {
  let w = createWorkspace(false);
  const now = new Date().toISOString();
  const day = localDate(new Date(now));
  w.tasks = [1, 2, 3].map((n) =>
    newTask(`할 일${n}`, { completed: true, completedAt: now })
  );
  w.habits = [
    {
      id: "habit",
      name: "습관",
      icon: "habit",
      color: "#4776e6",
      goal: 1,
      checks: { [day]: 1 },
    },
  ];
  w.sessions = [
    {
      id: "session",
      taskId: null,
      title: "집중",
      minutes: 25,
      completedAt: now,
    },
  ];
  w = syncRewards(w);
  assert.equal(rankProfile(w).xp, 115);
  assert.equal(
    dailyQuests(w, day).every((q) => q.count >= q.target),
    true
  );
  assert.equal(rankProfile(syncRewards(w)).xp, 115);
  w = syncRewards(toggleTask(w, w.tasks[0].id));
  assert.equal(rankProfile(w).xp, 65);
});
test("all rank thresholds and divisions include iron through challenger", () => {
  const w = createWorkspace(false);
  assert.equal(rankProfile(w).label, "아이언 IV");
  for (const [i, tier] of tiers.entries()) {
    const xp = tier.min;
    const full = Math.floor(xp / 60);
    const left = xp % 60;
    const rewards = Array.from({ length: full }, (_, n) => ({
      id: `event-${n}`,
      type: "task",
      title: "기록",
      xp: 60,
      earnedAt: new Date().toISOString(),
      active: true,
    }));
    if (left)
      rewards.push({
        id: "rest",
        type: "task",
        title: "기록",
        xp: left,
        earnedAt: new Date().toISOString(),
        active: true,
      });
    const p = rankProfile({ ...w, rewards });
    assert.equal(p.index, i);
    assert.ok(Number.isFinite(p.progress));
    assert.ok(p.lp >= 0 && p.lp <= 100);
  }
});
test("time slot snapping and duration keep dragged events inside the day", () => {
  assert.equal(snapStart(9 * 60 + 8), 9 * 60 + 15);
  assert.equal(snapStart(-20), 0);
  assert.equal(snapStart(1440, 60), 1380);
  assert.equal(snapDuration(62, 9 * 60), 60);
  assert.equal(snapDuration(120, 23 * 60), 60);
  assert.equal(snapDuration(-10, 600), 15);
  assert.equal(timeOf(15 * 60 + 30), "15:30");
});
test("overlapping events receive separate columns, non-overlapping events use full width", () => {
  const items = layoutSchedule([
    newTask("A", { time: "09:00", durationMinutes: 60 }),
    newTask("B", { time: "09:30", durationMinutes: 60 }),
    newTask("C", { time: "11:00", durationMinutes: 30 }),
  ]);
  assert.equal(items[0].columns, 2);
  assert.equal(items[1].columns, 2);
  assert.notEqual(items[0].column, items[1].column);
  assert.equal(items[2].columns, 1);
});
test("backup validation rejects corrupt rank rewards and duration", () => {
  let w = syncRewards(createWorkspace());
  assert.doesNotThrow(() => validateWorkspace(w));
  w = structuredClone(w);
  w.rewards[0].xp = 999;
  assert.throws(() => validateWorkspace(w));
  w = createWorkspace();
  w.tasks[0].durationMinutes = 0;
  assert.throws(() => validateWorkspace(w));
});

test("app reminders reflect rescheduled tasks and skip inactive or past reminders", () => {
  const task = newTask("회의", { date: "2026-10-28", time: "14:00", reminderMinutes: 10 });
  const now = new Date("2026-10-28T13:00:00").getTime();
  const at = new Date("2026-10-28T13:50:00").getTime();
  assert.deepEqual(appReminders([task], now), [{ taskId: task.id, title: task.title, at }]);
  assert.equal(appReminders([{ ...task, time: "14:30" }], now)[0].at, at + 30 * 60_000);
  assert.deepEqual(appReminders([
    { ...task, completed: true },
    { ...task, deletedAt: new Date(now).toISOString() },
    { ...task, reminderMinutes: undefined },
    { ...task, time: "13:00" },
    { ...task, time: "" },
  ], now), []);
});

test("multi-day all-day dates are inclusive and preserve their length when moved", () => {
  const task = newTask("출장", { date: "2026-11-28", endDate: "2026-12-02" });
  assert.equal(scheduledOn(task, "2026-11-27"), false);
  assert.equal(scheduledOn(task, "2026-11-28"), true);
  assert.equal(scheduledOn(task, "2026-12-02"), true);
  assert.equal(scheduledOn(task, "2026-12-03"), false);
  assert.deepEqual(moveTaskDate(task, "2026-12-31"), { date: "2026-12-31", endDate: "2027-01-04" });

  const workspace = { ...createWorkspace(), tasks: [task] };
  assert.equal(validateWorkspace(workspace).tasks[0].endDate, "2026-12-02");
  assert.throws(() => validateWorkspace({ ...workspace, tasks: [{ ...task, endDate: "2026-11-27" }] }));
});

test("daily tasks share one linked habit through recurrence and completion undo", () => {
  const task = newTask("매일 독서", { date: localDate(), repeat: "daily" });
  let workspace = saveTaskWithHabit(createWorkspace(false), task, true);
  const habitId = workspace.tasks[0].habitId;
  const count = () => workspace.habits.find((habit) => habit.id === habitId).checks[localDate()];
  assert.ok(habitId);
  assert.equal(validateWorkspace(workspace).tasks[0].habitId, habitId);
  workspace = toggleTask(workspace, task.id);
  assert.equal(count(), 1);
  assert.equal(workspace.tasks.find((item) => item.recurrenceSource === task.id).habitId, habitId);
  workspace = toggleTask(workspace, task.id);
  assert.equal(count(), 0);
  workspace = toggleTask(workspace, task.id);
  assert.equal(count(), 1);
  assert.equal(workspace.tasks.length, 2);
  workspace = saveTaskWithHabit(workspace, workspace.tasks[1], true);
  assert.equal(workspace.habits.filter((habit) => habit.id === habitId).length, 1);
  workspace = saveTaskWithHabit(workspace, workspace.tasks[1], false);
  assert.ok(workspace.tasks.every((item) => item.habitId === undefined));
  assert.equal(count(), 1);
  assert.equal(validateWorkspace(workspace).tasks.length, 2);
});

test("linked habit checks complete tasks and undo without duplicating tomorrow", () => {
  const task = newTask("독서", { date: localDate(), repeat: "daily" });
  let state = saveTaskWithHabit(createWorkspace(false), task, true);
  const id = state.tasks[0].habitId;
  state = checkHabit(state, id, localDate());
  assert.equal(state.tasks.find((item) => item.id === task.id).completed, true);
  assert.equal(state.habits[0].checks[localDate()], 1);
  assert.equal(state.tasks.length, 2);
  state = checkHabit(state, id, localDate(), true);
  assert.equal(state.tasks.find((item) => item.id === task.id).completed, false);
  assert.equal(state.habits[0].checks[localDate()], 0);
  state = checkHabit(state, id, localDate());
  assert.equal(state.tasks.length, 2);
  state = toggleTask(state, task.id);
  assert.equal(state.habits[0].checks[localDate()], 0);
  validateWorkspace(state);
});

test("daily occurrences appear without completion and preserve missed dates", async () => {
  const { materializeDailyTasks, carriesToDay } = await import("../src/model.ts");
  const base = createWorkspace();
  const task = newTask("기도", { date: "2026-11-17", repeat: "daily" });
  const state = materializeDailyTasks({ ...base, tasks: [task] }, "2026-11-19");
  assert.deepEqual(state.tasks.map((item) => item.date), ["2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"]);
  assert.ok(state.tasks.every((item) => !item.completed));
  assert.equal(state.tasks[0], task);
  assert.equal(materializeDailyTasks(state, "2026-11-19"), state);
  assert.equal(carriesToDay(task, base.lists, "2026-11-19"), false);
  const completed = toggleTask(state, task.id);
  assert.equal(completed.tasks.length, state.tasks.length);
  validateWorkspace(state);
});

test("category carry settings preserve dates and daily tasks never carry", async () => {
  const { carriesToDay } = await import("../src/model.ts");
  const state = createWorkspace();
  const list = state.lists[0];
  const task = newTask("연락", { date: "2026-11-18", listId: list.id });
  assert.equal(carriesToDay(task, state.lists, "2026-11-19"), true);
  assert.equal(carriesToDay(task, [{ ...list, autoCarry: false }], "2026-11-19"), false);
  assert.equal(carriesToDay({ ...task, repeat: "daily" }, state.lists, "2026-11-19"), false);
  assert.equal(task.date, "2026-11-18");
  validateWorkspace({ ...state, lists: state.lists.map((item) => ({ ...item, autoCarry: false })) });
  assert.throws(() => validateWorkspace({ ...state, lists: [{ ...list, autoCarry: "false" }] }));
});

test("renaming linked tasks updates habit and future occurrences while preserving history", async () => {
  const { materializeDailyTasks } = await import("../src/model.ts");
  const task = newTask("독서", { date: "2026-11-18", repeat: "daily" });
  let state = saveTaskWithHabit({ ...createWorkspace(), tasks: [task], habits: [] }, task, true);
  state = materializeDailyTasks(state, "2026-11-19");
  const current = state.tasks.find((item) => item.date === "2026-11-19");
  const next = saveTaskWithHabit(state, { ...current, title: "독서 20분" });
  assert.equal(next.habits[0].name, "독서 20분");
  assert.equal(next.tasks.find((item) => item.date === "2026-11-20").title, "독서 20분");
  assert.equal(next.tasks[0].title, "독서");
  assert.deepEqual(next.habits[0].checks, state.habits[0].checks);
  validateWorkspace(next);
});
