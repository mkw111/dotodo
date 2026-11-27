import Icon from "./Icon";
import { addDays, scheduledOn } from "./model";
import type { Task } from "./types";

export default function DayNavigator({ day, today, weekStart, tasks, onSelect, onReview }: {
  day: string; today: string; weekStart: number; tasks: Task[];
  onSelect: (day: string) => void; onReview: () => void;
}) {
  const date = new Date(`${day}T12:00:00`);
  const start = addDays(day, -((date.getDay() - weekStart + 7) % 7));
  return <section className="day-navigator" aria-label="날짜 선택">
    <div className="day-navigator-heading">
      <strong>{date.toLocaleDateString("ko-KR", { year: "numeric", month: "long" })}</strong>
      <div>
        {day !== today && <button className="text-btn" onClick={() => onSelect(today)}>오늘로</button>}
        <button className="icon-btn" aria-label="이전 주" onClick={() => onSelect(addDays(day, -7))}><Icon name="left" size={18} /></button>
        <button className="icon-btn" aria-label="다음 주" onClick={() => onSelect(addDays(day, 7))}><Icon name="right" size={18} /></button>
        <button className="review-link" onClick={onReview}>하루 돌아보기<Icon name="right" size={14} /></button>
      </div>
    </div>
    <div className="day-navigator-week">
      {Array.from({ length: 7 }, (_, index) => {
        const value = addDays(start, index);
        const d = new Date(`${value}T12:00:00`);
        const count = tasks.filter((task) => !task.completed && scheduledOn(task, value)).length;
        return <button key={value} aria-pressed={value === day} aria-current={value === today ? "date" : undefined}
          aria-label={`${d.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" })}, 미완료 ${count}개`}
          onClick={() => onSelect(value)}>
          <span>{d.toLocaleDateString("ko-KR", { weekday: "short" })}</span>
          <strong>{d.getDate()}</strong>
          <i className={count ? "has-tasks" : ""} />
        </button>;
      })}
    </div>
  </section>;
}
