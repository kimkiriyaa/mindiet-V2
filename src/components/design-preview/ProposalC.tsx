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
  Sparkles,
  Camera,
  X,
  CheckCircle2,
} from 'lucide-react';
import type { PreviewData } from './previewMockData';

interface ProposalCProps {
  data: PreviewData;
}

export function ProposalC({ data }: ProposalCProps) {
  // 플로팅 액션 버튼(FAB) 바텀시트 메뉴 열림/닫힘
  const [fabOpen, setFabOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isOver = data.isOver;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };

  // 타임라인 아이템 리스트 생성
  const timelineItems = [
    {
      time: '08:30',
      type: 'meal',
      icon: '🌅',
      title: '아침 식사',
      subtitle: data.meals[0]?.items.map((i) => i.name).join(', ') || '식사 기록 없음',
      kcal: data.meals[0]?.items.reduce((acc, i) => acc + i.kcal * i.qty, 0) || 0,
      isBurn: false,
    },
    {
      time: '10:30',
      type: 'water',
      icon: '💧',
      title: '수분 보충 (250 ml)',
      subtitle: '아침 수분 충전 완료',
      kcal: 0,
      isBurn: false,
    },
    {
      time: '12:40',
      type: 'meal',
      icon: '☀️',
      title: '점심 식사',
      subtitle: data.meals[1]?.items.map((i) => i.name).join(', ') || '식사 기록 없음',
      kcal: data.meals[1]?.items.reduce((acc, i) => acc + i.kcal * i.qty, 0) || 0,
      isBurn: false,
    },
    {
      time: '15:20',
      type: 'water',
      icon: '💧',
      title: '수분 보충 (500 ml)',
      subtitle: '오후 텀블러 1병',
      kcal: 0,
      isBurn: false,
    },
    {
      time: '18:50',
      type: 'meal',
      icon: '🌙',
      title: '저녁 식사',
      subtitle: data.meals[2]?.items.map((i) => i.name).join(', ') || '식사 기록 없음',
      kcal: data.meals[2]?.items.reduce((acc, i) => acc + i.kcal * i.qty, 0) || 0,
      isBurn: false,
    },
    {
      time: '20:00',
      type: 'exercise',
      icon: '🏃',
      title: '빠르게 걷기 (30분)',
      subtitle: `${data.steps.toLocaleString()}보 활동 합산`,
      kcal: data.burnedKcal,
      isBurn: true,
    },
  ].filter((item) => data.state !== 'empty' || item.kcal > 0);

  return (
    <div className="relative space-y-4 pb-24">
      {/* 1. 미니멀 헤더 */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white shadow-xs">
            <Sprout className="h-4 w-4" />
          </div>
          <div>
            <h1 className="font-black text-sm text-foreground">MinDiet</h1>
            <p className="text-[10px] text-muted-foreground">타임라인 기록 피드</p>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-full bg-secondary/80 px-2.5 py-1 text-xs font-semibold text-muted-foreground border border-border/40">
          <button type="button" className="p-0.5 hover:text-foreground"><ChevronLeft className="h-3.5 w-3.5" /></button>
          <span className="px-1 text-foreground flex items-center gap-1">
            <CalendarDays className="h-3 w-3 text-primary" />
            10월 27일 (오늘)
          </span>
          <button type="button" className="p-0.5 hover:text-foreground"><ChevronRight className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {/* 2. 도넛/게이지 서머리 카드 */}
      <section className="rounded-3xl border border-emerald-100/60 bg-gradient-to-br from-card via-card to-emerald-50/30 p-4.5 shadow-sm dark:border-border dark:from-card dark:to-card">
        <div className="flex items-center gap-4">
          {/* 원형 칼로리 시각화 링 */}
          <div className="relative grid h-24 w-24 place-items-center shrink-0">
            <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 36 36">
              <path
                className="text-secondary stroke-current"
                strokeWidth="3.5"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className={`${isOver ? 'text-orange-500' : 'text-primary'} stroke-current transition-all duration-700`}
                strokeDasharray={`${Math.min(100, data.intakePct)}, 100`}
                strokeLinecap="round"
                strokeWidth="3.5"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute text-center">
              <span className="text-[10px] text-muted-foreground block font-medium">섭취율</span>
              <span className={`text-base font-black tabular-nums ${isOver ? 'text-orange-500' : 'text-foreground'}`}>
                {data.intakePct}%
              </span>
            </div>
          </div>

          {/* 우측 잔여 칼로리 정보 */}
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-semibold text-muted-foreground block">
              {isOver ? '⚠️ 칼로리 목표 초과' : '✨ 오늘 남은 여유 칼로리'}
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span
                className={`text-3xl font-black tabular-nums ${
                  isOver ? 'text-orange-500' : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {isOver ? `+${data.overKcal.toLocaleString()}` : data.remainingKcal.toLocaleString()}
              </span>
              <span className={`text-xs font-bold ${isOver ? 'text-orange-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                kcal {isOver ? '초과' : '남음'}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
              <span className="rounded-md bg-secondary px-2 py-0.5 font-medium text-foreground">
                섭취 {data.intakeKcal.toLocaleString()}
              </span>
              <span className="rounded-md bg-orange-50 px-2 py-0.5 font-semibold text-orange-600 dark:bg-orange-950/40">
                소모 -{data.burnedKcal}
              </span>
              <span className="rounded-md bg-amber-50 px-2 py-0.5 font-semibold text-amber-700 dark:bg-amber-950/40">
                순 섭취 {data.netKcal}
              </span>
            </div>
          </div>
        </div>

        {/* 탄/단/지 미니 3색 바 */}
        <div className="mt-3.5 pt-2.5 border-t border-border/40 grid grid-cols-3 gap-2 text-[10px]">
          <div>
            <span className="text-muted-foreground">탄 {data.macros.carb.cur}g</span>
            <div className="mt-0.5 h-1 rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (data.macros.carb.cur / data.macros.carb.goal) * 100)}%` }} />
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">단 {data.macros.protein.cur}g</span>
            <div className="mt-0.5 h-1 rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-teal-500" style={{ width: `${Math.min(100, (data.macros.protein.cur / data.macros.protein.goal) * 100)}%` }} />
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">지 {data.macros.fat.cur}g</span>
            <div className="mt-0.5 h-1 rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-amber-500" style={{ width: `${Math.min(100, (data.macros.fat.cur / data.macros.fat.goal) * 100)}%` }} />
            </div>
          </div>
        </div>
      </section>

      {/* 3. 하루 타임라인 피드 (Timeline View) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-primary" />
            오늘의 기록 타임라인
          </h2>
          <span className="text-[11px] text-muted-foreground">시간순 정렬</span>
        </div>

        {timelineItems.length > 0 ? (
          <div className="relative pl-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/60 space-y-3">
            {timelineItems.map((item, idx) => (
              <div key={idx} className="relative group">
                {/* 타임라인 노드 불릿 */}
                <div
                  className={`absolute -left-5 top-2.5 h-2.5 w-2.5 rounded-full border-2 border-background ring-2 ${
                    item.isBurn ? 'bg-orange-500 ring-orange-200' : 'bg-primary ring-emerald-200'
                  }`}
                />

                <div className="rounded-2xl border border-border/70 bg-card p-3 shadow-2xs hover:border-primary/50 transition">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{item.icon}</span>
                      <span className="text-xs font-bold text-foreground">{item.title}</span>
                      <span className="text-[10px] text-muted-foreground">· {item.time}</span>
                    </div>

                    {item.kcal > 0 && (
                      <span
                        className={`text-xs font-extrabold tabular-nums ${
                          item.isBurn ? 'text-orange-600' : 'text-foreground'
                        }`}
                      >
                        {item.isBurn ? `-${item.kcal}` : `+${item.kcal}`} kcal
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-[11px] text-muted-foreground truncate pl-6">
                    {item.subtitle}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border py-8 text-center text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">아직 오늘 등록된 타임라인 기록이 없습니다 🌱</p>
            <p>우측 하단의 [+ 기록] 버튼을 눌러 첫 끼니를 등록해 보세요.</p>
          </div>
        )}
      </section>

      {/* 4. 엄지 영역 플로팅 액션 버튼 (FAB - Floating Action Button) */}
      {/* 480px 컨테이너 우하단 고정 */}
      <div className="sticky bottom-4 flex justify-end z-30 pointer-events-none pr-1">
        <button
          type="button"
          onClick={() => setFabOpen(true)}
          className="pointer-events-auto flex items-center gap-2 rounded-full bg-emerald-600 text-white px-5 py-3.5 shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition-all active:scale-95 min-h-[48px] min-w-[48px] font-bold text-sm"
        >
          <Plus className="h-5 w-5" />
          <span>기록하기</span>
        </button>
      </div>

      {/* FAB 클릭 시 열리는 슬릭 액션 모달/바텀시트 */}
      {fabOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-[420px] rounded-3xl bg-card border border-border p-5 shadow-2xl space-y-4 animate-in slide-in-from-bottom-5 duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-foreground">무엇을 기록할까요?</h3>
                <p className="text-xs text-muted-foreground">자주 쓰는 기록 액션을 바로 실행하세요.</p>
              </div>
              <button
                type="button"
                onClick={() => setFabOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setFabOpen(false);
                  showToast('AI 사진/텍스트 식단 등록 모달 연결');
                }}
                className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 transition min-h-[72px]"
              >
                <Camera className="h-5 w-5 mb-1 text-emerald-600" />
                <span className="text-xs font-bold">식단 기록 (AI/수동)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFabOpen(false);
                  showToast('운동 및 활동 칼로리 등록 연결');
                }}
                className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-orange-50/80 dark:bg-orange-950/30 border border-orange-200/60 text-orange-800 dark:text-orange-300 hover:bg-orange-100 transition min-h-[72px]"
              >
                <Dumbbell className="h-5 w-5 mb-1 text-orange-600" />
                <span className="text-xs font-bold">운동 기록하기</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFabOpen(false);
                  showToast('물 250ml 기록 완료!');
                }}
                className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-sky-50/80 dark:bg-sky-950/30 border border-sky-200/60 text-sky-800 dark:text-sky-300 hover:bg-sky-100 transition min-h-[72px]"
              >
                <Droplets className="h-5 w-5 mb-1 text-sky-600" />
                <span className="text-xs font-bold">물 +250ml 섭취</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFabOpen(false);
                  showToast('오늘의 체중 입력 연결');
                }}
                className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200/60 text-indigo-800 dark:text-indigo-300 hover:bg-indigo-100 transition min-h-[72px]"
              >
                <Scale className="h-5 w-5 mb-1 text-indigo-600" />
                <span className="text-xs font-bold">오늘의 체중</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 인터랙션 토스트 피드백 */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 rounded-full bg-zinc-900 text-white text-xs font-semibold px-4 py-2 shadow-lg flex items-center gap-1.5 animate-in fade-in duration-150">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
