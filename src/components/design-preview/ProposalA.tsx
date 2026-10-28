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
  ChevronDown,
  Droplets,
  Footprints,
  Dumbbell,
  Scale,
  Sparkles,
  Info,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { PreviewData } from './previewMockData';

interface ProposalAProps {
  data: PreviewData;
}

export function ProposalA({ data }: ProposalAProps) {
  // 접이식 섹션 상태 (하단 활동, 수분, 체중을 아코디언으로 압축)
  const [openSection, setOpenSection] = useState<'exercise' | 'water' | 'weight' | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<string | null>(null);
  const [localWater, setLocalWater] = useState(data.waterMl);

  const toggleSection = (section: 'exercise' | 'water' | 'weight') => {
    setOpenSection(openSection === section ? null : section);
  };

  const isOver = data.isOver;
  const isHealthy = !isOver && data.intakeKcal > 0;

  return (
    <div className="space-y-4 pb-20">
      {/* 1. 컴팩트 헤더 & 날짜 선택 */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20">
            <Sprout className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-black text-foreground">MinDiet</h1>
            <p className="text-[11px] text-muted-foreground">민수님, 건강한 하루 보내세요!</p>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-xl bg-secondary/80 px-2 py-1 border border-border/50 text-xs">
          <button type="button" className="p-1 hover:text-foreground text-muted-foreground"><ChevronLeft className="h-3.5 w-3.5" /></button>
          <span className="font-semibold flex items-center gap-1 px-1">
            <CalendarDays className="h-3 w-3 text-primary" />
            10월 27일 (월)
            <span className="rounded-full bg-primary/15 text-primary font-bold px-1.5 py-0.2 text-[9px]">오늘</span>
          </span>
          <button type="button" className="p-1 hover:text-foreground text-muted-foreground"><ChevronRight className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {/* 2. [Hero] 잔여 칼로리 중심 메인 서머리 카드 */}
      <section className="relative overflow-hidden rounded-3xl border border-emerald-100/80 bg-gradient-to-br from-emerald-50/70 via-card to-background p-5 shadow-sm dark:border-border dark:from-card dark:to-card">
        {/* 우상단 은은한 데코 뱃지 */}
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 rounded-full bg-background/80 backdrop-blur px-2.5 py-1 text-[11px] font-semibold text-muted-foreground border border-border/50 shadow-2xs">
            <Zap className="h-3 w-3 text-amber-500" />
            순 섭취(Net): <b className="text-foreground">{data.netKcal.toLocaleString()}</b> kcal
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            목표 {data.targetKcal.toLocaleString()} kcal
          </span>
        </div>

        {/* 메인 잔여 칼로리 1순위 강조 */}
        <div className="mt-3.5">
          <p className="text-xs font-semibold text-muted-foreground">
            {isOver ? '오늘의 칼로리 상태' : '오늘 더 먹을 수 있는 칼로리'}
          </p>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span
              className={`text-4xl sm:text-5xl font-black tabular-nums tracking-tight ${
                isOver ? 'text-orange-500' : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {isOver ? `+${data.overKcal.toLocaleString()}` : data.remainingKcal.toLocaleString()}
            </span>
            <span className={`text-base font-bold ${isOver ? 'text-orange-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
              kcal {isOver ? '초과 ⚠️' : '남음'}
            </span>
          </div>

          <p className="text-xs text-muted-foreground mt-1">
            {isOver
              ? `목표 칼로리보다 ${data.overKcal.toLocaleString()} kcal 초과 섭취했어요.`
              : data.intakeKcal === 0
              ? '아직 기록된 식단이 없습니다. 첫 끼니를 등록해 보세요.'
              : `목표의 ${data.intakePct}%를 건강하게 채우고 있어요.`}
          </p>
        </div>

        {/* 프로그레스 바 (방안 C: 섭취 / 목표 기준) */}
        <div className="mt-3.5 space-y-1">
          <div className="h-3 w-full overflow-hidden rounded-full bg-secondary/80 p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isOver ? 'bg-orange-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, data.intakePct)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-0.5">
            <span>총 섭취 {data.intakeKcal.toLocaleString()} kcal ({data.intakePct}%)</span>
            <span className="font-semibold text-orange-600 dark:text-orange-400">
              소모 -{data.burnedKcal.toLocaleString()} kcal
            </span>
          </div>
        </div>

        {/* 탄/단/지 미니 대시보드 */}
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/50 pt-3">
          {[
            { label: '탄수화물', cur: data.macros.carb.cur, goal: data.macros.carb.goal, color: 'bg-emerald-500' },
            { label: '단백질', cur: data.macros.protein.cur, goal: data.macros.protein.goal, color: 'bg-teal-500' },
            { label: '지방', cur: data.macros.fat.cur, goal: data.macros.fat.goal, color: 'bg-amber-500' },
          ].map((m) => {
            const pct = m.goal > 0 ? Math.round((m.cur / m.goal) * 100) : 0;
            return (
              <div key={m.label} className="rounded-xl bg-background/80 p-2 border border-border/40">
                <span className="text-[11px] text-muted-foreground block">{m.label}</span>
                <span className="text-xs font-bold text-foreground block mt-0.5">
                  {m.cur} <span className="text-[10px] font-normal text-muted-foreground">/{m.goal}g</span>
                </span>
                <div className="mt-1 h-1 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className={`h-full rounded-full ${m.color}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. 끼니별 현황 (1st Fold 2x2 퀵 그리드) */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <Utensils className="h-4 w-4 text-primary" />
            오늘의 끼니 현황
          </h2>
          <span className="text-xs text-muted-foreground">카드를 탭하여 상세 확인</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {data.meals.map((meal) => {
            const hasItems = meal.items.length > 0;
            const mealKcal = meal.items.reduce((acc, it) => acc + it.kcal * it.qty, 0);
            const isSelected = selectedMeal === meal.type;

            return (
              <div
                key={meal.type}
                onClick={() => setSelectedMeal(isSelected ? null : meal.type)}
                className={`relative rounded-2xl border p-3 transition cursor-pointer active:scale-98 ${
                  isSelected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
                    : hasItems
                    ? 'border-border/80 bg-card hover:border-primary/40'
                    : 'border-dashed border-border/70 bg-secondary/30 hover:bg-secondary/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base">{meal.emoji}</span>
                  <span className="text-xs font-bold tabular-nums text-foreground">
                    {hasItems ? `${mealKcal} kcal` : '미입력'}
                  </span>
                </div>

                <div className="mt-1.5">
                  <p className="text-xs font-bold text-foreground">{meal.label}</p>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {hasItems
                      ? meal.items.map((i) => i.name).join(', ')
                      : '+ 기록하기'}
                  </p>
                </div>

                {/* 선택 시 펼쳐지는 인라인 음식 리스트 */}
                {isSelected && hasItems && (
                  <div className="mt-2.5 pt-2 border-t border-border/50 space-y-1 text-[11px]">
                    {meal.items.map((it) => (
                      <div key={it.id} className="flex justify-between text-muted-foreground">
                        <span className="truncate">{it.name} × {it.qty}{it.unit}</span>
                        <span className="font-semibold text-foreground">{it.kcal * it.qty}kcal</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. 하단 접이식 아코디언 (운동·물·체중 스크롤 압축 영역) */}
      <section className="space-y-2 pt-1">
        <p className="px-1 text-xs font-bold text-muted-foreground">바디 & 라이프스타일 요약</p>

        {/* 1) 활동 및 운동 아코디언 */}
        <div className="rounded-2xl border border-border/70 bg-card overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('exercise')}
            className="flex w-full items-center justify-between p-3.5 text-left hover:bg-secondary/40 transition min-h-[44px]"
          >
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-orange-500/10 text-orange-600">
                <Footprints className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">걸음 수 & 운동 기록</p>
                <p className="text-[11px] text-muted-foreground">
                  {data.steps.toLocaleString()}보 · 총 {data.burnedKcal} kcal 소모
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-orange-600 tabular-nums">
                -{data.burnedKcal} kcal
              </span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                  openSection === 'exercise' ? 'rotate-180' : ''
                }`}
              />
            </div>
          </button>

          {openSection === 'exercise' && (
            <div className="border-t border-border/50 bg-secondary/20 p-3.5 space-y-2.5 text-xs">
              <div className="flex items-center justify-between rounded-xl bg-card p-2.5 border border-border/40">
                <span className="text-muted-foreground">오늘의 걸음 수</span>
                <span className="font-bold text-foreground">{data.steps.toLocaleString()} 보 (-{data.stepKcal} kcal)</span>
              </div>
              {data.exercises.length > 0 ? (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground block">추가 운동 내역</span>
                  {data.exercises.map((e) => (
                    <div key={e.id} className="flex justify-between items-center rounded-lg bg-card p-2 border border-border/30">
                      <span className="font-medium text-foreground">{e.name} ({e.duration}분)</span>
                      <span className="font-bold text-orange-600">-{e.kcal} kcal</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-1">등록된 운동 내역이 없습니다.</p>
              )}
            </div>
          )}
        </div>

        {/* 2) 수분 섭취 아코디언 */}
        <div className="rounded-2xl border border-border/70 bg-card overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('water')}
            className="flex w-full items-center justify-between p-3.5 text-left hover:bg-secondary/40 transition min-h-[44px]"
          >
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-sky-500/10 text-sky-500">
                <Droplets className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">수분 섭취량</p>
                <p className="text-[11px] text-muted-foreground">
                  목표 {data.targetWaterMl} ml 중 {localWater} ml 달성
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-sky-500 tabular-nums">
                {localWater} ml
              </span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                  openSection === 'water' ? 'rotate-180' : ''
                }`}
              />
            </div>
          </button>

          {openSection === 'water' && (
            <div className="border-t border-border/50 bg-secondary/20 p-3.5 space-y-2.5 text-xs">
              <div className="flex justify-between items-center text-[11px] text-muted-foreground">
                <span>달성률 {Math.round((localWater / data.targetWaterMl) * 100)}%</span>
                <span>{Math.max(0, data.targetWaterMl - localWater)} ml 남음</span>
              </div>
              <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-sky-500 transition-all"
                  style={{ width: `${Math.min(100, (localWater / data.targetWaterMl) * 100)}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setLocalWater((prev) => prev + 250)}
                  className="flex items-center justify-center gap-1 py-2 rounded-xl bg-card border border-border/60 font-semibold text-sky-600 hover:bg-sky-50 transition"
                >
                  <Plus className="h-3.5 w-3.5" /> +250 ml (1컵)
                </button>
                <button
                  type="button"
                  onClick={() => setLocalWater((prev) => prev + 500)}
                  className="flex items-center justify-center gap-1 py-2 rounded-xl bg-card border border-border/60 font-semibold text-sky-600 hover:bg-sky-50 transition"
                >
                  <Plus className="h-3.5 w-3.5" /> +500 ml (1병)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 3) 체중 기록 & 14일 추이 아코디언 */}
        <div className="rounded-2xl border border-border/70 bg-card overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('weight')}
            className="flex w-full items-center justify-between p-3.5 text-left hover:bg-secondary/40 transition min-h-[44px]"
          >
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-500/10 text-indigo-500">
                <Scale className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">체중 및 14일 추이</p>
                <p className="text-[11px] text-muted-foreground">
                  오늘 {data.currentWeight} kg (목표 {data.targetWeight} kg)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-indigo-500 tabular-nums">
                {data.currentWeight} kg
              </span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                  openSection === 'weight' ? 'rotate-180' : ''
                }`}
              />
            </div>
          </button>

          {openSection === 'weight' && (
            <div className="border-t border-border/50 bg-secondary/20 p-3.5 space-y-3">
              <div className="h-36 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.weightHistory} margin={{ top: 10, right: 10, bottom: 0, left: -25 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <ReferenceLine y={data.targetWeight} stroke="#10b981" strokeDasharray="3 3" label={{ value: '목표', fill: '#10b981', fontSize: 10 }} />
                    <Line type="monotone" dataKey="weight" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[11px] text-center text-muted-foreground">
                최근 7회 기록 기준 목표 체중까지 {Math.abs(data.currentWeight - data.targetWeight).toFixed(1)} kg 남았어요.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
