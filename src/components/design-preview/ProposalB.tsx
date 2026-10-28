import React, { useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Sprout,
  Utensils,
  Flame,
  Zap,
  Plus,
  Footprints,
  Droplets,
  Scale,
  Clock,
  Dumbbell,
  Check,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { PreviewData } from './previewMockData';

interface ProposalBProps {
  data: PreviewData;
}

export function ProposalB({ data }: ProposalBProps) {
  // 하단 세그먼트 상태: 'meals'(식단 기록) vs 'body'(바디 & 활동)
  const [activeSegment, setActiveSegment] = useState<'meals' | 'body'>('meals');
  const [localWater, setLocalWater] = useState(data.waterMl);
  const [localSteps, setLocalSteps] = useState(data.steps);

  const isOver = data.isOver;

  return (
    <div className="space-y-4 pb-20">
      {/* 1. 상단 미니 헤더 & 날짜 선택 */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500 text-white shadow-xs">
            <Sprout className="h-4 w-4" />
          </div>
          <span className="font-extrabold text-foreground text-sm">MinDiet 2.0</span>
        </div>

        <div className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground border border-border/40">
          <button type="button" className="p-0.5 hover:text-foreground"><ChevronLeft className="h-3.5 w-3.5" /></button>
          <span className="px-1 text-foreground flex items-center gap-1">
            <CalendarDays className="h-3 w-3 text-primary" />
            10월 27일 (오늘)
          </span>
          <button type="button" className="p-0.5 hover:text-foreground"><ChevronRight className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {/* 2. 상단 고정형 메인 요약 카드 (남은 칼로리 & In/Out 분리) */}
      <section className="rounded-3xl border border-border/80 bg-card p-4.5 shadow-sm space-y-3">
        {/* 상단 남은 칼로리 & 순섭취 칩 */}
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground block">
              {isOver ? '⚠️ 칼로리 목표 초과' : '✨ 오늘 남은 여유 칼로리'}
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span
                className={`text-4xl font-black tabular-nums tracking-tight ${
                  isOver ? 'text-orange-500' : 'text-primary'
                }`}
              >
                {isOver ? `+${data.overKcal.toLocaleString()}` : data.remainingKcal.toLocaleString()}
              </span>
              <span className={`text-sm font-bold ${isOver ? 'text-orange-500' : 'text-primary'}`}>
                kcal {isOver ? '초과' : '남음'}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary/80 px-2.5 py-1 text-[11px] font-semibold text-foreground border border-border/50">
              <Zap className="h-3 w-3 text-amber-500" />
              순 섭취: <b className="tabular-nums">{data.netKcal.toLocaleString()}</b> kcal
            </span>
            <p className="text-[10px] text-muted-foreground mt-1">
              목표 {data.targetKcal.toLocaleString()} kcal 기준
            </p>
          </div>
        </div>

        {/* 메인 섭취 게이지 (방안 C 규격) */}
        <div className="space-y-1">
          <div className="h-2.5 w-full rounded-full bg-secondary overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isOver ? 'bg-orange-500' : 'bg-primary'
              }`}
              style={{ width: `${Math.min(100, data.intakePct)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground font-medium">
            <span className="flex items-center gap-1">
              <Utensils className="h-3 w-3 text-primary" />
              총 섭취 {data.intakeKcal.toLocaleString()} kcal ({data.intakePct}%)
            </span>
            <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400 font-semibold">
              <Flame className="h-3 w-3" />
              활동 소모 -{data.burnedKcal.toLocaleString()} kcal
            </span>
          </div>
        </div>

        {/* 탄/단/지 한줄 미니 슬라이더 */}
        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/40 text-[11px]">
          <div>
            <div className="flex justify-between text-muted-foreground">
              <span>탄수화물</span>
              <span className="font-semibold text-foreground">{data.macros.carb.cur}g</span>
            </div>
            <div className="mt-1 h-1 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${Math.min(100, (data.macros.carb.cur / data.macros.carb.goal) * 100)}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-muted-foreground">
              <span>단백질</span>
              <span className="font-semibold text-foreground">{data.macros.protein.cur}g</span>
            </div>
            <div className="mt-1 h-1 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full bg-teal-500 rounded-full"
                style={{ width: `${Math.min(100, (data.macros.protein.cur / data.macros.protein.goal) * 100)}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-muted-foreground">
              <span>지방</span>
              <span className="font-semibold text-foreground">{data.macros.fat.cur}g</span>
            </div>
            <div className="mt-1 h-1 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full"
                style={{ width: `${Math.min(100, (data.macros.fat.cur / data.macros.fat.goal) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 3. [핵심] 상하 분리 세그먼트 컨트롤러 (44px 이상 터치 영역 확보) */}
      <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-secondary/80 p-1 border border-border/40">
        <button
          type="button"
          onClick={() => setActiveSegment('meals')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
            activeSegment === 'meals'
              ? 'bg-background text-primary shadow-xs border border-border/50'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Utensils className="h-4 w-4" />
          <span>식단 기록 ({data.intakeKcal} kcal)</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSegment('body')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
            activeSegment === 'body'
              ? 'bg-background text-orange-600 shadow-xs border border-border/50'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Flame className="h-4 w-4" />
          <span>바디 & 활동 (-{data.burnedKcal} kcal)</span>
        </button>
      </div>

      {/* 4-A. [세그먼트 1] 식단 기록 뷰 */}
      {activeSegment === 'meals' && (
        <section className="space-y-2.5 animate-in fade-in-50 duration-200">
          {data.meals.map((meal) => {
            const mealKcal = meal.items.reduce((acc, it) => acc + it.kcal * it.qty, 0);
            const hasItems = meal.items.length > 0;

            return (
              <div
                key={meal.type}
                className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-2xs space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{meal.emoji}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-xs text-foreground">{meal.label}</h3>
                        {meal.time && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            {meal.time}
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-extrabold text-foreground tabular-nums">
                        {mealKcal.toLocaleString()} kcal
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="flex items-center gap-1 rounded-xl bg-secondary px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition active:scale-95 min-h-[44px]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>추가</span>
                  </button>
                </div>

                {/* 음식 리스트 */}
                {hasItems ? (
                  <div className="space-y-1.5 pt-1 border-t border-border/40">
                    {meal.items.map((it) => (
                      <div
                        key={it.id}
                        className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-secondary/30"
                      >
                        <span className="font-medium text-foreground">
                          {it.name} <span className="text-muted-foreground text-[11px]">× {it.qty}{it.unit}</span>
                        </span>
                        <span className="font-bold tabular-nums text-muted-foreground">
                          {it.kcal * it.qty} kcal
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border/60 py-2.5 text-center text-xs text-muted-foreground">
                    아직 등록된 음식이 없어요. 탭하여 식단을 입력하세요.
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* 4-B. [세그먼트 2] 바디 & 활동 뷰 (운동, 걸음, 물, 체중) */}
      {activeSegment === 'body' && (
        <section className="space-y-3 animate-in fade-in-50 duration-200">
          {/* 1) 오늘의 걸음 수 카드 */}
          <div className="rounded-2xl border border-border/70 bg-card p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Footprints className="h-4 w-4 text-orange-500" />
                오늘의 걸음 수
              </span>
              <span className="text-xs font-bold text-orange-600">-{data.stepKcal} kcal 소모</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black tabular-nums text-foreground">
                {localSteps.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">/ 10,000보</span>
              </span>
              <button
                type="button"
                onClick={() => setLocalSteps((s) => s + 1000)}
                className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-secondary hover:bg-orange-50 hover:text-orange-600 transition"
              >
                +1,000보
              </button>
            </div>
            <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full bg-orange-500 rounded-full"
                style={{ width: `${Math.min(100, (localSteps / 10000) * 100)}%` }}
              />
            </div>
          </div>

          {/* 2) 추가 운동 종목 */}
          <div className="rounded-2xl border border-border/70 bg-card p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Dumbbell className="h-4 w-4 text-primary" />
                운동 종목
              </span>
              <button
                type="button"
                className="text-xs font-semibold text-primary hover:underline"
              >
                + 운동 등록
              </button>
            </div>
            {data.exercises.length > 0 ? (
              <div className="space-y-1.5">
                {data.exercises.map((e) => (
                  <div key={e.id} className="flex justify-between items-center rounded-xl bg-secondary/40 p-2.5 text-xs">
                    <div>
                      <span className="font-bold text-foreground block">{e.name}</span>
                      <span className="text-[11px] text-muted-foreground">{e.duration}분 수행</span>
                    </div>
                    <span className="font-extrabold text-orange-600 tabular-nums">-{e.kcal} kcal</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-2 text-xs text-muted-foreground">기록된 운동이 없습니다.</p>
            )}
          </div>

          {/* 3) 수분 충전 카드 */}
          <div className="rounded-2xl border border-border/70 bg-card p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Droplets className="h-4 w-4 text-sky-500" />
                수분 섭취
              </span>
              <span className="text-xs font-extrabold text-sky-500 tabular-nums">{localWater} ml</span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setLocalWater((w) => w + 250)}
                className="py-2 px-3 rounded-xl bg-secondary font-semibold text-xs text-sky-600 hover:bg-sky-50 transition min-h-[44px]"
              >
                +250 ml (1컵)
              </button>
              <button
                type="button"
                onClick={() => setLocalWater((w) => w + 500)}
                className="py-2 px-3 rounded-xl bg-secondary font-semibold text-xs text-sky-600 hover:bg-sky-50 transition min-h-[44px]"
              >
                +500 ml (1병)
              </button>
            </div>
          </div>

          {/* 4) 체중 카드 및 미니 차트 */}
          <div className="rounded-2xl border border-border/70 bg-card p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Scale className="h-4 w-4 text-indigo-500" />
                체중 트렌드
              </span>
              <span className="text-xs font-bold text-indigo-500">{data.currentWeight} kg</span>
            </div>
            <div className="h-28 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.weightHistory} margin={{ top: 5, right: 10, bottom: 0, left: -25 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                  <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fontSize: 9 }} />
                  <Tooltip contentStyle={{ fontSize: 10, borderRadius: 6 }} />
                  <ReferenceLine y={data.targetWeight} stroke="#10b981" strokeDasharray="2 2" />
                  <Line type="monotone" dataKey="weight" stroke="#6366f1" strokeWidth={2} dot={{ r: 2.5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
