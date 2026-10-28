import test from "node:test";
import assert from "node:assert/strict";
import { recognizeInput } from "../src/smartInput.ts";
import {
  createWorkspace,
  newTask,
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
