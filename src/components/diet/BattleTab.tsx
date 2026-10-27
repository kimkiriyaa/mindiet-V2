import { useState } from "react";
import { CheckCircle2, Circle, Crown } from "lucide-react";

const MISSIONS = [
  { id: "water", label: "물 2L 마시기", emoji: "💧", pts: 30 },
  { id: "meals", label: "세 끼 식단 기록하기", emoji: "📝", pts: 40 },
  { id: "kcal", label: "목표 칼로리 지키기", emoji: "🎯", pts: 50 },
  { id: "walk", label: "만 보 걷기", emoji: "👟", pts: 30 },
];
const RANK = [
  { name: "지윤", emoji: "🐰", rate: 92 },
  { name: "나 (민다이어터)", emoji: "🐻", rate: 85, me: true },
  { name: "도현", emoji: "🦊", rate: 78 },
  { name: "서아", emoji: "🐼", rate: 64 },
];

export function BattleTab() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const total = MISSIONS.reduce((a, m) => a + m.pts, 0);
  const earned = MISSIONS.reduce((a, m) => a + (done[m.id] ? m.pts : 0), 0);
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-extrabold">오늘의 챌린지</h1>
      <section className="rounded-3xl bg-primary p-5 text-primary-foreground">
        <p className="text-sm opacity-90">적립 포인트</p>
        <p className="text-3xl font-extrabold tabular-nums">{earned} <span className="text-base font-medium opacity-80">/ {total}P</span></p>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-primary-foreground/30">
          <div className="h-full rounded-full bg-primary-foreground transition-all duration-500" style={{ width: `${(earned / total) * 100}%` }} />
        </div>
      </section>
      <ul className="space-y-2">
        {MISSIONS.map((m) => (
          <li key={m.id}>
            <button onClick={() => setDone({ ...done, [m.id]: !done[m.id] })}
              className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition ${done[m.id] ? "border-primary bg-accent" : "bg-card"}`}>
              <span className="text-xl">{m.emoji}</span>
              <span className={`flex-1 font-medium ${done[m.id] ? "text-muted-foreground line-through" : ""}`}>{m.label}</span>
              <span className="text-xs font-semibold text-primary">+{m.pts}P</span>
              {done[m.id] ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
            </button>
          </li>
        ))}
      </ul>
      <section className="rounded-3xl border bg-card p-5">
        <h2 className="font-bold">그룹 주간 랭킹</h2>
        <ul className="mt-3 space-y-3">
          {RANK.map((r, i) => (
            <li key={r.name} className={`flex items-center gap-3 rounded-xl p-2 ${r.me ? "bg-accent" : ""}`}>
              <span className="w-5 text-center font-bold text-muted-foreground">{i === 0 ? <Crown className="h-4 w-4 text-warning" /> : i + 1}</span>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-lg">{r.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.name}</p>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${r.rate}%` }} /></div>
              </div>
              <span className="text-sm font-bold tabular-nums">{r.rate}%</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
