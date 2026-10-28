import { localDate, type Priority, type Repeat } from "./types.ts";

export type SmartToken = {
  key: string;
  start: number;
  end: number;
  text: string;
  kind: "date" | "repeat" | "time" | "tag" | "priority";
  ignored: boolean;
  description: string;
};
export type SmartInput = {
  title: string;
  date: string;
  time: string;
  repeat: Repeat;
  priority: Priority;
  tags: string[];
  tokens: SmartToken[];
  dateRecognitionDisabled: boolean;
};
const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
function shift(date: string, days: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localDate(d);
}
function valid(date: string) {
  const d = new Date(`${date}T12:00:00`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(d.getTime()) &&
    localDate(d) === date
  );
}
function monday(date: string) {
  return shift(date, -((new Date(`${date}T12:00:00`).getDay() + 6) % 7));
}
function weekdayDate(date: string, name: string) {
  return shift(
    date,
    (weekdays.indexOf(name) - new Date(`${date}T12:00:00`).getDay() + 7) % 7
  );
}
export function recognizeInput(
  text: string,
  today = localDate(),
  ignoredKeys: string[] = []
): SmartInput {
  const result: SmartInput = {
    title: "",
    date: "",
    time: "",
    repeat: "none",
    priority: 0,
    tags: [],
    tokens: [],
    dateRecognitionDisabled: false,
  };
  const counts = new Map<string, number>();
  let repeatStart = "";
  // Longest phrases first; whitespace boundaries keep words such as 오늘의/내일의 intact.
  const pattern =
    /(^|\s)(다음\s*주\s*[월화수목금토일]요일|이번\s*주\s*[월화수목금토일]요일|매주\s*[월화수목금토일]요일|평일마다|매\s*평일|매일|매주|매월|오늘|내일|모레|글피|이번\s*주|다음\s*주|[월화수목금토일]요일|\d{4}-\d{2}-\d{2}|(?:오전|오후)\s*\d{1,2}시(?:\s*\d{1,2}분)?|\d{1,2}:\d{2}|#[^\s#]+|![1-3])(?=\s|$)/g;
  for (const match of text.matchAll(pattern)) {
    const raw = match[2];
    const word = raw.replace(/\s/g, "");
    const start = match.index! + match[1].length;
    let kind: SmartToken["kind"] = "date";
    let date = "";
    let time = "";
    let repeat: Repeat = "none";
    let description = "";
    if (word.startsWith("#")) {
      kind = "tag";
      description = `태그 ${word.slice(1)}`;
    } else if (/^![1-3]$/.test(word)) {
      kind = "priority";
      description = ["", "높은 우선순위", "보통 우선순위", "낮은 우선순위"][
        Number(word[1])
      ];
    } else if (/^\d{1,2}:\d{2}$/.test(word)) {
      kind = "time";
      const [h, m] = word.split(":").map(Number);
      if (h > 23 || m > 59) continue;
      time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      description = time;
    } else if (/^(오전|오후)/.test(word)) {
      kind = "time";
      const t = word.match(/^(오전|오후)(\d{1,2})시(?:(\d{1,2})분)?$/)!;
      const h = Number(t[2]);
      const m = Number(t[3] || 0);
      if (h < 1 || h > 12 || m > 59) continue;
      time = `${String((h % 12) + (t[1] === "오후" ? 12 : 0)).padStart(
        2,
        "0"
      )}:${String(m).padStart(2, "0")}`;
      description = time;
    } else if (word.startsWith("매") || word === "평일마다") {
      kind = "repeat";
      repeat =
        word === "매일"
          ? "daily"
          : word === "매평일" || word === "평일마다"
          ? "weekdays"
          : word === "매월"
          ? "monthly"
          : "weekly";
      date = word.endsWith("요일") ? weekdayDate(today, word.at(-3)!) : today;
      if (repeat === "weekdays")
        while ([0, 6].includes(new Date(`${date}T12:00:00`).getDay()))
          date = shift(date, 1);
      description = `${raw} · ${date}부터`;
    } else if (/^\d{4}-/.test(word)) {
      if (!valid(word)) continue;
      date = word;
      description = date;
    } else if (["오늘", "내일", "모레", "글피"].includes(word)) {
      date = shift(today, ["오늘", "내일", "모레", "글피"].indexOf(word));
      description = date;
    } else if (word.startsWith("이번주") || word.startsWith("다음주")) {
      const next = word.startsWith("다음주");
      const base = shift(monday(today), next ? 7 : 0);
      date = word.endsWith("요일")
        ? shift(base, (weekdays.indexOf(word.at(-3)!) + 6) % 7)
        : next
        ? base
        : shift(base, 6);
      description = `${date}${word === "이번주" ? " · 이번 주 일요일" : ""}`;
    } else {
      date = weekdayDate(today, word[0]);
      description = date;
    }
    const identity = `${kind}:${word}`;
    const occurrence = counts.get(identity) || 0;
    counts.set(identity, occurrence + 1);
    const key = `${identity}:${occurrence}`;
    const ignored = ignoredKeys.includes(key);
    result.tokens.push({
      key,
      start,
      end: start + raw.length,
      text: raw,
      kind,
      ignored,
      description,
    });
    if (ignored) {
      if (kind === "date" || kind === "repeat")
        result.dateRecognitionDisabled = true;
      continue;
    }
    if (kind === "date") result.date = date;
    if (kind === "repeat") {
      result.repeat = repeat;
      repeatStart = date;
    }
    if (kind === "time") result.time = time;
    if (kind === "tag") result.tags.push(word.slice(1));
    if (kind === "priority") result.priority = Number(word[1]) as Priority;
  }
  if (result.repeat !== "none" && !result.date) result.date = repeatStart;
  if (result.time && !result.date && !result.dateRecognitionDisabled)
    result.date = today;
  let cursor = 0;
  const pieces: string[] = [];
  for (const token of result.tokens) {
    pieces.push(text.slice(cursor, token.start));
    if (token.ignored) pieces.push(token.text);
    cursor = token.end;
  }
  pieces.push(text.slice(cursor));
  result.title = pieces.join("").replace(/\s+/g, " ").trim();
  result.tags = [...new Set(result.tags)];
  return result;
}
