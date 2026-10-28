import React from "react";
import { Flame, Utensils, Zap } from "lucide-react";
import { useDiet } from "@/context/DietContext";
import { sumFoods } from "@/lib/diet";

/**
 * [홈 화면 개편 확정안 1단계 & 2단계]
 * 1) 메인 도넛 요약 보드 (C안 기반)
 *    - 좌측: 콤팩트 원형 링 게이지 (중앙 섭취율 N%)
 *    - 우측: "✨ 오늘 남은 여유 칼로리" 및 대형 잔여 칼로리 (text-3xl~4xl font-black)
 *    - 하단: 가로 알약 칩 3종 [섭취 O,OOO / 소모 -OOO / 순 섭취 O,OOO]
 *    - 계산 규칙 (방안 C 엄수): 잔여 = 일일목표(TDEE) - 총섭취. 초과 시 주황색(#F97316) 전환
 * 2) 탄단지 영양소 보드 (A안 기반)
 *    - 탄/단/지 3분할 카드 (현재g / 목표g)
 *    - 색상 규칙: 지방 기본 막대는 소프트 앰버(#F59E0B)로 목표 초과 경고색(#F97316)과 엄격 분리
 */
export function SummaryCard() {
  const { foods, exercises, selectedDate, targetKcal, macros, stepCalories } = useDiet();

  const today = sumFoods(foods.filter((f) => f.date === selectedDate));
  const exerciseBurned = exercises
    .filter((e) => e.date === selectedDate)
    .reduce((a, e) => a + e.kcal, 0);
  const burned = exerciseBurned + (stepCalories || 0);

  // [방안 C 엄수] 총 섭취 기준 잔여 칼로리 및 초과 판정
  const intake = Math.round(today.kcal);
  const net = intake - burned;
  const isOver = targetKcal > 0 && intake > targetKcal;
  const overDiff = Math.max(0, intake - targetKcal);
  const remaining = Math.max(0, targetKcal - intake);
  const intakePct = targetKcal > 0 ? Math.round((intake / targetKcal) * 100) : 0;

  const macroBars = [
    {
      label: "탄수화물",
      cur: Math.round(today.carb),
      goal: macros.carb,
      defaultColor: "bg-emerald-500",
    },
    {
      label: "단백질",
      cur: Math.round(today.protein),
      goal: macros.protein,
      defaultColor: "bg-teal-500",
    },
    {
      label: "지방",
      cur: Math.round(today.fat),
      goal: macros.fat,
      // [색상 규칙] 기본은 소프트 앰버(#F59E0B), 초과 시에만 주황(#F97316)
      defaultColor: "bg-amber-500",
    },
  ];

  return (
    <section className="rounded-3xl border border-emerald-100/70 bg-gradient-to-br from-card via-card to-emerald-50/20 p-5 shadow-sm space-y-4 dark:border-border dark:from-card dark:to-card">
      {/* 1. 메인 도넛 요약 보드 */}
      <div className="flex items-center gap-4">
        {/* 좌측: 콤팩트 원형 링 게이지 */}
        <div className="relative grid h-24 w-24 place-items-center shrink-0">
          <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 36 36">
            <path
              className="text-secondary stroke-current"
              strokeWidth="3.5"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className={`${
                isOver ? "text-warning" : "text-primary"
              } stroke-current transition-all duration-700`}
              strokeDasharray={`${Math.min(100, intakePct)}, 100`}
              strokeLinecap="round"
              strokeWidth="3.5"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <div className="absolute text-center">
            <span className="text-[10px] text-muted-foreground block font-medium">섭취율</span>
            <span
              className={`text-base font-black tabular-nums ${
                isOver ? "text-warning" : "text-foreground"
              }`}
            >
              {intakePct}%
            </span>
          </div>
        </div>

        {/* 우측: 잔여 칼로리 1순위 강조 */}
        <div className="min-w-0 flex-1">
          <span className="text-xs font-semibold text-muted-foreground block">
            {isOver ? "⚠️ 칼로리 목표 초과" : "✨ 오늘 남은 여유 칼로리"}
          </span>

          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span
              className={`text-3xl sm:text-4xl font-black tabular-nums tracking-tight ${
                isOver ? "text-warning" : "text-primary"
              }`}
            >
              {isOver ? `+${overDiff.toLocaleString()}` : remaining.toLocaleString()}
            </span>
            <span
              className={`text-sm sm:text-base font-bold ${
                isOver ? "text-warning" : "text-primary"
              }`}
            >
              kcal {isOver ? "초과 ⚠️" : "남음"}
            </span>
          </div>

          <p className="text-[11px] text-muted-foreground mt-1 truncate">
            {isOver
              ? `목표보다 ${overDiff.toLocaleString()} kcal 초과했어요`
              : intake === 0
              ? "첫 끼니를 기록해 보세요 🌱"
              : `목표 ${targetKcal.toLocaleString()} kcal 중 ${intake.toLocaleString()} kcal 섭취`}
          </p>
        </div>
      </div>

      {/* 하단 가로 알약 칩 3종 [섭취 / 소모 / 순 섭취] */}
      <div className="grid grid-cols-3 gap-1.5 pt-0.5 text-[11px]">
        <div className="flex items-center justify-center gap-1 rounded-xl bg-secondary/80 py-1.5 px-2 border border-border/40">
          <Utensils className="h-3 w-3 text-primary shrink-0" />
          <span className="truncate">
            섭취 <b className="font-bold text-foreground tabular-nums">{intake.toLocaleString()}</b>
          </span>
        </div>

        <div className="flex items-center justify-center gap-1 rounded-xl bg-orange-50/80 py-1.5 px-2 border border-orange-200/50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/40">
          <Flame className="h-3 w-3 text-orange-600 shrink-0" />
          <span className="truncate">
            소모 <b className="font-bold tabular-nums">-{burned.toLocaleString()}</b>
          </span>
        </div>

        <div className="flex items-center justify-center gap-1 rounded-xl bg-amber-50/80 py-1.5 px-2 border border-amber-200/50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40">
          <Zap className="h-3 w-3 text-amber-600 shrink-0" />
          <span className="truncate">
            순 섭취 <b className="font-bold tabular-nums">{net.toLocaleString()}</b>
          </span>
        </div>
      </div>

      {/* 2. 탄단지 영양소 보드 (A안 기반) */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/50">
        {macroBars.map((m) => {
          const isMacroOver = m.goal > 0 && m.cur > m.goal;
          const pct = m.goal > 0 ? Math.round((m.cur / m.goal) * 100) : 0;
          return (
            <div
              key={m.label}
              className="rounded-2xl bg-secondary/60 p-2.5 border border-border/40 space-y-1"
            >
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{m.label}</span>
                <span className="text-[10px]">{pct}%</span>
              </div>
              <p className="text-xs font-extrabold text-foreground tabular-nums">
                {m.cur}
                <span className="text-[10px] font-normal text-muted-foreground">/{m.goal}g</span>
              </p>
              <div className="h-1.5 w-full rounded-full bg-background overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isMacroOver ? "bg-warning" : m.defaultColor
                  }`}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
