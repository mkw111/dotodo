import type { Task } from "./types.ts";
export const minutesOf = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};
export function timeOf(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(
    minutes % 60
  ).padStart(2, "0")}`;
}
export function snapStart(minutes: number, duration = 30) {
  return Math.max(
    0,
    Math.min(
      Math.floor((1440 - duration) / 15) * 15,
      Math.round(minutes / 15) * 15
    )
  );
}
export function snapDuration(minutes: number, start: number) {
  return Math.max(
    15,
    Math.min(
      720,
      Math.floor((1440 - start) / 15) * 15,
      Math.round(minutes / 15) * 15
    )
  );
}
export function layoutSchedule(tasks: Task[]) {
  const sorted = tasks
    .filter((t) => t.time)
    .map((task) => ({
      task,
      start: minutesOf(task.time),
      end: Math.min(1440, minutesOf(task.time) + (task.durationMinutes || 30)),
      column: 0,
      columns: 1,
    }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
  let group: typeof sorted = [];
  let ends: number[] = [];
  let maxEnd = -1;
  function finish() {
    for (const item of group) item.columns = ends.length;
    group = [];
    ends = [];
    maxEnd = -1;
  }
  for (const item of sorted) {
    if (group.length && item.start >= maxEnd) finish();
    let column = ends.findIndex((end) => end <= item.start);
    if (column === -1) column = ends.length;
    item.column = column;
    ends[column] = item.end;
    group.push(item);
    maxEnd = Math.max(maxEnd, item.end);
  }
  finish();
  return sorted;
}
