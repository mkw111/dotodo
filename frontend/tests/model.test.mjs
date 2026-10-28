import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  createWorkspace,
  matches,
  migrateV1,
  newTask,
  nextRepeat,
  parseQuickAdd,
  remainingSeconds,
  streak,
  toggleTask,
  validateWorkspace,
} from "../src/model.ts";

test("month-end, leap year, weekday recurrence and day boundaries", () => {
  assert.equal(nextRepeat("2026-02-28", "monthly", 31), "2026-03-31");
  assert.equal(nextRepeat("2026-01-31", "monthly"), "2026-02-28");
  assert.equal(nextRepeat("2024-01-31", "monthly"), "2024-02-29");
  assert.equal(nextRepeat("2026-10-30", "weekdays"), "2026-11-02");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});
test("recurring completion produces one reset successor, including after undo/re-complete", () => {
  let w = createWorkspace(false);
  const t = newTask("반복 일정", {
    date: "2026-10-28",
    repeat: "daily",
    checklist: [{ id: "step", title: "하위 작업", done: true }],
  });
  w.tasks = [t];
  w = toggleTask(w, t.id);
  assert.equal(w.tasks.length, 2);
  assert.equal(w.tasks[1].date, "2026-10-29");
  assert.equal(w.tasks[1].checklist[0].done, false);
  w = toggleTask(w, t.id);
  w = toggleTask(w, t.id);
  assert.equal(w.tasks.length, 2);
  assert.equal(w.tasks[0].completed, true);
});
test("smart lists include overdue today, bound seven days and exclude trash", () => {
  const today = "2026-10-28";
  const overdue = newTask("지난 일", { date: "2026-10-27" });
  assert.equal(matches(overdue, "today", today), true);
  assert.equal(
    matches(newTask("다음주", { date: "2026-11-04" }), "week", today),
    false
  );
  assert.equal(
    matches(newTask("마지막날", { date: "2026-11-03" }), "week", today),
    true
  );
  assert.equal(
    matches(
      { ...overdue, deletedAt: new Date().toISOString() },
      "today",
      today
    ),
    false
  );
});
test("Korean quick input recognises bounded dates, tags and priorities without eating words", () => {
  assert.deepEqual(parseQuickAdd("내일 보고서 쓰기 #업무 !1", "2026-10-28"), {
    title: "보고서 쓰기",
    date: "2026-10-29",
    priority: 1,
    tags: ["업무"],
  });
  assert.equal(parseQuickAdd("내일의 계획").title, "내일의 계획");
  assert.equal(parseQuickAdd("2026-02-31 할 일").date, "");
});
test("habit streak permits unfinished today and restarts after a gap", () => {
  assert.equal(
    streak({ "2026-10-27": 2, "2026-10-26": 2 }, 2, "2026-10-28"),
    2
  );
  assert.equal(
    streak({ "2026-10-28": 2, "2026-10-26": 2 }, 2, "2026-10-28"),
    1
  );
});
test("timer computes elapsed wall time across backgrounding and reload", () => {
  const timer = {
    mode: "focus",
    taskId: null,
    duration: 1500,
    remaining: 1500,
    endAt: 100000,
  };
  assert.equal(remainingSeconds(timer, 40500), 60);
  assert.equal(remainingSeconds(timer, 110000), 0);
  assert.equal(
    remainingSeconds({ ...timer, endAt: null, remaining: 123 }, 999999),
    123
  );
});
test("legacy task migration preserves IDs, dates, completion and category", () => {
  const w = migrateV1([
    {
      id: "my-task",
      title: "기존 할 일",
      category: "업무",
      dueDate: "2026-10-28",
      important: true,
      completed: true,
    },
  ]);
  assert.equal(w.tasks[0].id, "my-task");
  assert.equal(w.tasks[0].priority, 1);
  assert.equal(w.tasks[0].listId, "work");
  assert.equal(w.tasks[0].completed, true);
  assert.equal(validateWorkspace(w), w);
});
test("backup validation rejects invalid data, duplicates and dangling lists", () => {
  const w = createWorkspace();
  assert.equal(validateWorkspace(w), w);
  for (const mutate of [
    (x) => {
      x.tasks[0].date = "2026-02-31";
    },
    (x) => {
      x.tasks[0].listId = "not-found";
    },
    (x) => {
      x.tasks.push(x.tasks[0]);
    },
    (x) => {
      x.settings.focusMinutes = -1;
    },
    (x) => {
      x.habits[0].checks = { "bad-date": 2 };
    },
    (x) => {
      x.tasks[0].title = "";
    },
  ]) {
    const bad = structuredClone(w);
    mutate(bad);
    assert.throws(() => validateWorkspace(bad));
  }
});
