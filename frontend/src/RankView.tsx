import Icon from "./Icon";
import RankBadge from "./RankBadge";
import { activityStreak, dailyQuests, rankProfile, tiers } from "./rank";
import { addDays } from "./model";
import { localDate, type Workspace } from "./types";

export default function RankView({
  state,
  onNavigate,
}: {
  state: Workspace;
  onNavigate: (view: "today" | "habits" | "focus") => void;
}) {
  const p = rankProfile(state);
  const today = localDate();
  const quests = dailyQuests(state, today);
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const counts = (type: string) =>
    p.events.filter((r) => r.type === type).length;
  const days = new Set(p.events.map((r) => localDate(new Date(r.earnedAt))));
  const achievements = [
    {
      name: "작은 첫걸음",
      description: "첫 번째 할 일 완료",
      done: counts("task") >= 1,
      icon: "check",
    },
    {
      name: "루틴 메이커",
      description: "습관을 7회 달성",
      done: counts("habit") >= 7,
      icon: "habit",
    },
    {
      name: "몰입의 시간",
      description: "집중 세션 5회 완료",
      done: counts("focus") >= 5,
      icon: "focus",
    },
    {
      name: "꾸준한 발자국",
      description: "서로 다른 7일 활동",
      done: days.size >= 7,
      icon: "calendar",
    },
    {
      name: "일일 퀘스트 정복",
      description: "일일 퀘스트 올클리어",
      done: counts("quest") >= 1,
      icon: "star",
    },
    {
      name: "실버의 시작",
      description: "실버 티어 달성",
      done: p.index >= 2,
      icon: "rank",
    },
  ];
  return (
    <section className="rank-page">
      <div
        className="rank-hero"
        style={{ "--tier-color": p.tier.color } as React.CSSProperties}
      >
        <div className="rank-hero-emblem">
          <RankBadge color={p.tier.color} size={155} level={p.index} />
        </div>
        <div className="rank-hero-copy">
          <span className="eyebrow">MY PERSONAL RANK</span>
          <h2>
            {p.label}
            <small>{p.lp} LP</small>
          </h2>
          <p>남과의 경쟁보다, 어제의 나보다 한 걸음 더.</p>
          <div className="rank-progress-label">
            <span>{p.xp.toLocaleString()} XP</span>
            <span>
              {p.remaining
                ? `${p.nextLabel}까지 ${p.remaining} XP`
                : "최고 티어에 도달했어요"}
            </span>
          </div>
          <div className="rank-progress-track">
            <i style={{ width: `${p.progress}%` }} />
          </div>
        </div>
      </div>
      <div className="rank-summary">
        <div>
          <Icon name="tasks" />
          <strong>{counts("task")}</strong>
          <span>완료한 할 일</span>
        </div>
        <div>
          <Icon name="habit" />
          <strong>{counts("habit")}</strong>
          <span>달성한 습관</span>
        </div>
        <div>
          <Icon name="focus" />
          <strong>{counts("focus")}</strong>
          <span>완료한 집중</span>
        </div>
        <div>
          <Icon name="sun" />
          <strong>
            {activityStreak(state)}
            <small>일</small>
          </strong>
          <span>연속 활동</span>
        </div>
      </div>
      <div className="rank-section-title">
        <h3>오늘의 퀘스트</h3>
        <span>모두 달성하면 +30 XP</span>
      </div>
      <div className="daily-quests">
        {quests.map((q, i) => (
          <button
            key={q.name}
            onClick={() =>
              onNavigate((["today", "habits", "focus"] as const)[i])
            }
            className={q.count >= q.target ? "quest-complete" : ""}
          >
            <span className="quest-icon">
              <Icon name={q.icon} />
            </span>
            <div>
              <strong>{q.name}</strong>
              <small>
                {Math.min(q.count, q.target)} / {q.target}
              </small>
              <div className="thin-progress">
                <i
                  style={{
                    width: `${Math.min(100, (q.count / q.target) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <Icon name={q.count >= q.target ? "check" : "right"} size={16} />
          </button>
        ))}
      </div>
      <div className="rank-columns">
        <section className="rank-activity">
          <div className="rank-section-title">
            <h3>이번 주의 성장</h3>
            <span>최근 7일</span>
          </div>
          <div className="xp-chart">
            {week.map((day) => {
              const xp = p.events
                .filter((r) => localDate(new Date(r.earnedAt)) === day)
                .reduce((n, r) => n + r.xp, 0);
              const max = Math.max(
                60,
                ...week.map((d) =>
                  p.events
                    .filter((r) => localDate(new Date(r.earnedAt)) === d)
                    .reduce((n, r) => n + r.xp, 0)
                )
              );
              return (
                <div key={day}>
                  <strong>{xp || ""}</strong>
                  <div>
                    <i style={{ height: `${(xp / max) * 100}%` }} />
                  </div>
                  <span className={day === today ? "today-text" : ""}>
                    {
                      ["일", "월", "화", "수", "목", "금", "토"][
                        new Date(`${day}T12:00:00`).getDay()
                      ]
                    }
                  </span>
                </div>
              );
            })}
          </div>
        </section>
        <section className="rank-achievements">
          <div className="rank-section-title">
            <h3>나의 업적</h3>
            <span>
              {achievements.filter((a) => a.done).length} /{" "}
              {achievements.length}
            </span>
          </div>
          <div className="achievement-grid">
            {achievements.map((a) => (
              <div
                key={a.name}
                className={a.done ? "unlocked" : ""}
                title={a.description}
              >
                <span>
                  <Icon name={a.icon} />
                </span>
                <strong>{a.name}</strong>
                <small>{a.description}</small>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="rank-section-title">
        <h3>티어 로드맵</h3>
        <span>아이언부터 챌린저까지</span>
      </div>
      <div className="tier-roadmap">
        {tiers.map((tier, i) => (
          <div
            key={tier.en}
            className={`${i === p.index ? "current" : ""} ${
              i > p.index ? "locked" : ""
            }`}
            style={{ "--tier-color": tier.color } as React.CSSProperties}
          >
            <RankBadge color={tier.color} size={66} level={i} />
            <strong>{tier.name}</strong>
            <small>{tier.min.toLocaleString()} XP</small>
            {i === p.index && <span>현재 티어</span>}
          </div>
        ))}
      </div>
      <div className="rank-section-title">
        <h3>최근 경험치 기록</h3>
        <span>현재 유효한 획득 기록</span>
      </div>
      <div className="reward-history">
        {[...p.events]
          .sort((a, b) => b.earnedAt.localeCompare(a.earnedAt))
          .slice(0, 10)
          .map((r) => (
            <div key={r.id}>
              <Icon
                name={
                  r.type === "task"
                    ? "check"
                    : r.type === "habit"
                    ? "habit"
                    : r.type === "focus"
                    ? "focus"
                    : "star"
                }
                size={17}
              />
              <div>
                <strong>{r.title}</strong>
                <small>
                  {new Date(r.earnedAt).toLocaleDateString("ko-KR", {
                    month: "long",
                    day: "numeric",
                  })}
                </small>
              </div>
              <span>+{r.xp} XP</span>
            </div>
          ))}
        {!p.events.length && (
          <p className="muted">
            첫 할 일을 완료하고 아이언 IV의 여정을 시작해 보세요.
          </p>
        )}
      </div>
      <div className="rank-rules">
        <h4>경험치는 이렇게 쌓여요</h4>
        <p>
          할 일 완료 +20 XP · 하루 습관 목표 달성 +10 XP · 집중 5분당 +3
          XP(세션당 최대 60) · 일일 퀘스트 올클리어 +30 XP
        </p>
        <p>
          완료 취소 시 해당 경험치도 회수됩니다. 다시 완료해도 같은 보상이 중복
          지급되지 않아요. 완료한 기록을 휴지통에 옮기거나 삭제해도 이미 달성한
          경험치는 남습니다. 개인 성장용 티어이며 온라인 경쟁 순위는 아닙니다.
        </p>
      </div>
    </section>
  );
}
export function RankMiniCard({
  state,
  onClick,
}: {
  state: Workspace;
  onClick: () => void;
}) {
  const p = rankProfile(state);
  return (
    <button
      className="rank-mini-card"
      onClick={onClick}
      style={{ "--tier-color": p.tier.color } as React.CSSProperties}
    >
      <RankBadge color={p.tier.color} size={48} level={p.index} />
      <div>
        <strong>
          {p.label}
          <small>{p.lp} LP</small>
        </strong>
        <div className="rank-mini-progress">
          <i style={{ width: `${p.progress}%` }} />
        </div>
        <span>
          {p.xp} XP ·{" "}
          {p.remaining ? p.nextLabel + "까지 " + p.remaining : "최고 티어"}
        </span>
      </div>
      <Icon name="right" size={13} />
    </button>
  );
}
