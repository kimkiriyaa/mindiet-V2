import { Flame, Utensils } from "lucide-react";
import { useDiet } from "@/context/DietContext";
import { sumFoods } from "@/lib/diet";

export function SummaryCard() {
  const { foods, exercises, selectedDate, targetKcal, macros, stepCalories } = useDiet();
  const today = sumFoods(foods.filter((f) => f.date === selectedDate));
  const exerciseBurned = exercises.filter((e) => e.date === selectedDate).reduce((a, e) => a + e.kcal, 0);
  const burned = exerciseBurned + (stepCalories || 0);
  const intake = Math.round(today.kcal);
  const net = intake - burned;
  const over = net > targetKcal;
  const pct = targetKcal ? Math.min(100, Math.max(0, (net / targetKcal) * 100)) : 0;
  const diff = Math.abs(targetKcal - net);

  const bars = [
    { label: "탄수화물", cur: today.carb, goal: macros.carb },
    { label: "단백질", cur: today.protein, goal: macros.protein },
    { label: "지방", cur: today.fat, goal: macros.fat },
  ];

  return (
    <section className="rounded-3xl border bg-card p-5 shadow-sm">
      <p className="text-sm text-muted-foreground">순 섭취 칼로리</p>
      <div className="mt-1 flex items-end gap-1">
        <span className={`text-4xl font-extrabold tabular-nums ${over ? "text-warning" : "text-foreground"}`}>{net.toLocaleString()}</span>
        <span className="mb-1 text-sm text-muted-foreground">/ {targetKcal.toLocaleString()} kcal</span>
      </div>
      <p className={`mt-1 text-sm font-semibold ${over ? "text-warning" : "text-primary"}`}>
        {over ? `목표보다 ${diff.toLocaleString()} kcal 초과했어요` : `오늘 ${diff.toLocaleString()} kcal 남았어요`}
      </p>
      <div className="mt-4 h-4 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full transition-all duration-500 ${over ? "bg-warning" : "bg-primary"}`} style={{ width: `${over ? 100 : pct}%` }} />
      </div>
      <div className="mt-3 flex justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Utensils className="h-3.5 w-3.5" />섭취 {intake.toLocaleString()}</span>
        <span className="flex items-center gap-1"><Flame className="h-3.5 w-3.5" />운동 -{burned.toLocaleString()}</span>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        {bars.map((b) => {
          const p = b.goal ? Math.round((b.cur / b.goal) * 100) : 0;
          return (
            <div key={b.label} className="rounded-2xl bg-secondary p-3">
              <p className="text-xs text-muted-foreground">{b.label}</p>
              <p className="mt-1 text-sm font-bold tabular-nums">{Math.round(b.cur)}<span className="font-normal text-muted-foreground">/{b.goal}g</span></p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
                <div className={`h-full rounded-full ${p > 100 ? "bg-warning" : "bg-primary"}`} style={{ width: `${Math.min(100, p)}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{p}%</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
