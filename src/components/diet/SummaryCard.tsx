import { Flame, Utensils, Zap } from "lucide-react";
import { useDiet } from "@/context/DietContext";
import { sumFoods } from "@/lib/diet";

/**
 * 방안 C 확정 적용:
 * 1. 메인 프로그레스 게이지 & 경고 색상: 오직 [총 섭취 칼로리 / 목표 칼로리(TDEE)] 기준 판정
 * 2. 활동 소모량 (Burned): 운동 소모량 + 걸음 소모량 합산 독립 표기
 * 3. 참고용 순 칼로리 (Net): '총 섭취 - 총 소모'는 보조 지표 텍스트로만 제공 (과식 유발 방지)
 */
export function SummaryCard() {
  const { foods, exercises, selectedDate, targetKcal, macros, stepCalories } = useDiet();
  const today = sumFoods(foods.filter((f) => f.date === selectedDate));
  const exerciseBurned = exercises.filter((e) => e.date === selectedDate).reduce((a, e) => a + e.kcal, 0);
  const burned = exerciseBurned + (stepCalories || 0);

  // [방안 C] 총 섭취 칼로리 기준으로 게이지 및 초과 판정
  const intake = Math.round(today.kcal);
  const net = intake - burned;
  const over = intake > targetKcal;
  const pct = targetKcal ? Math.min(100, Math.max(0, (intake / targetKcal) * 100)) : 0;
  const diff = Math.abs(targetKcal - intake);

  const bars = [
    { label: "탄수화물", cur: today.carb, goal: macros.carb },
    { label: "단백질", cur: today.protein, goal: macros.protein },
    { label: "지방", cur: today.fat, goal: macros.fat },
  ];

  return (
    <section className="rounded-3xl border bg-card p-5 shadow-sm space-y-4">
      {/* 1. 상단 총 섭취 칼로리 및 목표 달성 현황 */}
      <div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>오늘의 총 섭취 칼로리</span>
          <span className="flex items-center gap-1 font-medium text-foreground">
            <Zap className="h-3 w-3 text-primary" />
            순 칼로리(Net): <b className="tabular-nums">{net.toLocaleString()}</b> kcal
          </span>
        </div>

        <div className="mt-1 flex items-end gap-1">
          <span className={`text-4xl font-extrabold tabular-nums ${over ? "text-warning" : "text-foreground"}`}>
            {intake.toLocaleString()}
          </span>
          <span className="mb-1 text-sm text-muted-foreground">/ {targetKcal.toLocaleString()} kcal</span>
        </div>

        <p className={`mt-1 text-sm font-semibold ${over ? "text-warning" : "text-primary"}`}>
          {over
            ? `목표보다 ${diff.toLocaleString()} kcal 초과 섭취했어요 ⚠️`
            : `오늘 ${diff.toLocaleString()} kcal 더 드실 수 있어요`}
        </p>

        {/* 메인 섭취 게이지 (방안 C) */}
        <div className="mt-3 h-3.5 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all duration-500 ${over ? "bg-warning" : "bg-primary"}`}
            style={{ width: `${over ? 100 : pct}%` }}
          />
        </div>
      </div>

      {/* 2. 섭취량 & 독립된 활동 소모량 (Burned) 지표 카드 */}
      <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
        <div className="flex items-center gap-2 rounded-2xl bg-secondary p-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
            <Utensils className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground">총 섭취 (In)</p>
            <p className="font-bold text-foreground tabular-nums truncate">{intake.toLocaleString()} kcal</p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-2xl bg-secondary p-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-orange-50 text-orange-600 shrink-0">
            <Flame className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground">활동 소모 (Out)</p>
            <p className="font-bold text-orange-600 tabular-nums truncate">-{burned.toLocaleString()} kcal</p>
          </div>
        </div>
      </div>

      {/* 3. 탄단지 목표 비율 3단 카드 */}
      <div className="grid grid-cols-3 gap-2.5">
        {bars.map((b) => {
          const p = b.goal ? Math.round((b.cur / b.goal) * 100) : 0;
          return (
            <div key={b.label} className="rounded-2xl bg-secondary p-3">
              <p className="text-xs text-muted-foreground">{b.label}</p>
              <p className="mt-1 text-sm font-bold tabular-nums">
                {Math.round(b.cur)}
                <span className="font-normal text-muted-foreground">/{b.goal}g</span>
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
                <div
                  className={`h-full rounded-full ${p > 100 ? "bg-warning" : "bg-primary"}`}
                  style={{ width: `${Math.min(100, p)}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{p}%</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
