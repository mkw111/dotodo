import { localDate, type RankReward, type Workspace } from "./types.ts";
export const tiers = [
  { name: "아이언", en: "IRON", min: 0, color: "#8c929e" },
  { name: "브론즈", en: "BRONZE", min: 200, color: "#b38762" },
  { name: "실버", en: "SILVER", min: 600, color: "#8aadc3" },
  { name: "골드", en: "GOLD", min: 1200, color: "#d5ac4e" },
  { name: "플래티넘", en: "PLATINUM", min: 2200, color: "#59aba6" },
  { name: "에메랄드", en: "EMERALD", min: 3600, color: "#44b68c" },
  { name: "다이아몬드", en: "DIAMOND", min: 5400, color: "#7b99ec" },
  { name: "마스터", en: "MASTER", min: 8000, color: "#ad78cf" },
  { name: "그랜드마스터", en: "GRANDMASTER", min: 11000, color: "#d56f79" },
  { name: "챌린저", en: "CHALLENGER", min: 15000, color: "#d9ad54" },
];
const dayOf = (at: string) => localDate(new Date(at));
/** Stable source IDs make undo/re-complete and refresh idempotent. Deleted source records retain earned rewards. */
export function syncRewards(state: Workspace): Workspace {
  const ledger = new Map<string, RankReward>(
    (state.rewards || []).map((r) => [r.id, { ...r }])
  );
  function grant(
    id: string,
    type: RankReward["type"],
    title: string,
    xp: number,
    at: string,
    active = true
  ) {
    const old = ledger.get(id);
    ledger.set(id, {
      id,
      type,
      title,
      xp,
      earnedAt: old?.active ? old.earnedAt : at,
      active,
    });
  }
  for (const task of state.tasks) {
    const id = `task:${task.id}`;
    if (task.completed && task.completedAt)
      grant(id, "task", task.title, 20, task.completedAt);
    else if (ledger.has(id)) ledger.get(id)!.active = false;
  }
  for (const habit of state.habits) {
    const prefix = `habit:${habit.id}:`;
    for (const reward of ledger.values())
      if (
        reward.id.startsWith(prefix) &&
        (habit.checks[reward.id.slice(prefix.length)] || 0) < habit.goal
      )
        reward.active = false;
    for (const [day, count] of Object.entries(habit.checks))
      if (count >= habit.goal)
        grant(
          `${prefix}${day}`,
          "habit",
          habit.name,
          10,
          new Date(`${day}T12:00:00`).toISOString()
        );
  }
  for (const session of state.sessions)
    grant(
      `focus:${session.id}`,
      "focus",
      session.title,
      Math.min(60, Math.max(1, Math.floor(session.minutes / 5) * 3)),
      session.completedAt
    );
  const daily = new Map<
    string,
    { tasks: number; habits: number; focus: number }
  >();
  for (const r of ledger.values()) {
    const day = dayOf(r.earnedAt);
    const counts = daily.get(day) || { tasks: 0, habits: 0, focus: 0 };
    if (r.active) {
      if (r.type === "task") counts.tasks++;
      if (r.type === "habit") counts.habits++;
      if (r.type === "focus") counts.focus++;
    }
    daily.set(day, counts);
  }
  for (const [day, counts] of daily) {
    const all = counts.tasks >= 3 && counts.habits >= 1 && counts.focus >= 1;
    const id = `quest:${day}`;
    if (all)
      grant(
        id,
        "quest",
        "일일 퀘스트 올클리어",
        30,
        new Date(`${day}T23:59:00`).toISOString()
      );
    else if (ledger.has(id)) ledger.get(id)!.active = false;
  }
  return { ...state, rewards: [...ledger.values()] };
}
export function rankProfile(state: Workspace) {
  const events = (state.rewards || syncRewards(state).rewards!).filter(
    (r) => r.active
  );
  const xp = events.reduce((n, r) => n + r.xp, 0);
  let index = 0;
  for (let i = 1; i < tiers.length; i++) if (xp >= tiers[i].min) index = i;
  const tier = tiers[index];
  const nextTier = tiers[index + 1];
  const division =
    index < 7
      ? Math.min(
          3,
          Math.floor((xp - tier.min) / ((nextTier.min - tier.min) / 4))
        )
      : 0;
  const floor =
    index < 7
      ? tier.min + ((nextTier.min - tier.min) / 4) * division
      : tier.min;
  const ceiling =
    index < 7
      ? floor + (nextTier.min - tier.min) / 4
      : nextTier?.min || tier.min;
  const label = `${tier.name}${
    index < 7 ? ` ${["IV", "III", "II", "I"][division]}` : ""
  }`;
  const nextLabel =
    index < 7
      ? division < 3
        ? `${tier.name} ${["III", "II", "I"][division]}`
        : `${nextTier.name} IV`
      : nextTier?.name || "최고 티어";
  const lp = nextTier
    ? Math.min(99, Math.floor(((xp - floor) / (ceiling - floor)) * 100))
    : 100;
  return {
    xp,
    events,
    index,
    tier,
    label,
    nextLabel,
    remaining: nextTier ? Math.max(0, Math.ceil(ceiling - xp)) : 0,
    progress: nextTier
      ? Math.min(100, ((xp - floor) / (ceiling - floor)) * 100)
      : 100,
    lp,
  };
}
export function dailyQuests(state: Workspace, today = localDate()) {
  const events = rankProfile(state).events.filter(
    (r) => dayOf(r.earnedAt) === today
  );
  return [
    {
      name: "할 일 3개 완료",
      count: events.filter((r) => r.type === "task").length,
      target: 3,
      icon: "tasks",
    },
    {
      name: "습관 1개 달성",
      count: events.filter((r) => r.type === "habit").length,
      target: 1,
      icon: "habit",
    },
    {
      name: "집중 세션 1회 완료",
      count: events.filter((r) => r.type === "focus").length,
      target: 1,
      icon: "focus",
    },
  ];
}
export function activityStreak(state: Workspace, today = localDate()) {
  const days = new Set(
    rankProfile(state)
      .events.filter((r) => r.type !== "quest")
      .map((r) => dayOf(r.earnedAt))
  );
  const previous = (day: string) => {
    const d = new Date(`${day}T12:00:00`);
    d.setDate(d.getDate() - 1);
    return localDate(d);
  };
  let day = days.has(today) ? today : previous(today);
  let count = 0;
  while (days.has(day)) {
    count++;
    day = previous(day);
  }
  return count;
}
