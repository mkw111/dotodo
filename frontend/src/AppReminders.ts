import type { Task } from "./types";

export type AppReminder = {
  taskId: string;
  title: string;
  at: number;
};

export function appReminders(tasks: Task[], now = Date.now()): AppReminder[] {
  return tasks.flatMap((task) => {
    if (task.completed || task.deletedAt || !task.date || !task.time ||
        task.reminderMinutes === undefined) return [];

    const at = new Date(`${task.date}T${task.time}:00`).getTime() -
      task.reminderMinutes * 60_000;
    return at > now ? [{ taskId: task.id, title: task.title, at }] : [];
  }).sort((a, b) => a.at - b.at).slice(0, 60);
}
