import { useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Flame,
  Sprout,
  Utensils,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useDiet } from "@/context/DietContext";
import { fromDateKey, shiftDateKey, sumFoods, toLocalDateKey } from "@/lib/diet";
import { SummaryCard } from "./SummaryCard";
import { MealCardsGrid } from "./MealCardsGrid";
import { WaterCard } from "./WaterCard";
import { ExerciseCard } from "./ExerciseCard";
import { WeightCard } from "./WeightCard";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * [홈 화면 개편 확정안 전체 조립]
 * - 상단 헤더 & 날짜 이동 바 유지
 * - [1 & 2단계] SummaryCard: C안 기반 원형 링 게이지 잔여 칼로리 + A안 기반 탄단지 바
 * - [3단계] 2-탭 세그먼트 스위처: [ 🍴 식단 기록 (OOO kcal) ] | [ 🔥 바디 & 활동 (-OOO kcal) ]
 * - [4단계]
 *   - [식단 기록] 탭 선택 시: 4-A단계 MealCardsGrid (2x2 그리드 + 하단 바텀 시트)
 *   - [바디 & 활동] 탭 선택 시: 4-B단계 ExerciseCard (걸음+1000보/프로그레스바/운동등록) + WaterCard (-250ml/리셋) + WeightCard
 */
export function HomeTab() {
  const {
    profile,
    session,
    selectedDate,
    setSelectedDate,
    foods,
    exercises,
    stepCalories,
  } = useDiet();

  const [activeSegment, setActiveSegment] = useState<"meals" | "body">("meals");

  const d = fromDateKey(selectedDate);
  const isToday = selectedDate === toLocalDateKey();
  const displayName = profile?.nickname || session?.userName || "회원";

  const today = sumFoods(foods.filter((f) => f.date === selectedDate));
  const exerciseBurned = exercises
    .filter((e) => e.date === selectedDate)
    .reduce((a, e) => a + e.kcal, 0);
  const burned = exerciseBurned + (stepCalories || 0);
  const intake = Math.round(today.kcal);

  return (
    <div className="space-y-4">
      {/* 상단 헤더 */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-lg font-extrabold text-primary">
          <Sprout className="h-5 w-5" />민다이어트
        </div>
        <span className="truncate text-sm text-muted-foreground">{displayName}님 안녕하세요 👋</span>
      </header>

      {/* 날짜 이동 바 */}
      <div className="flex items-center justify-between rounded-2xl bg-secondary px-2 py-1.5">
        <button
          aria-label="이전 날짜"
          onClick={() => setSelectedDate(shiftDateKey(selectedDate, -1))}
          className="grid h-9 w-9 place-items-center rounded-full hover:bg-background transition"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <Popover>
          <PopoverTrigger className="flex items-center gap-2 font-semibold">
            <CalendarDays className="h-4 w-4 text-primary" />
            {d.getMonth() + 1}월 {d.getDate()}일 ({DOW[d.getDay()]})
            {isToday && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">
                오늘
              </span>
            )}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar
              mode="single"
              selected={d}
              onSelect={(x) => x && setSelectedDate(toLocalDateKey(x))}
              className="pointer-events-auto p-3"
            />
          </PopoverContent>
        </Popover>
        <button
          aria-label="다음 날짜"
          onClick={() => setSelectedDate(shiftDateKey(selectedDate, 1))}
          className="grid h-9 w-9 place-items-center rounded-full hover:bg-background transition"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* 1단계 & 2단계: 메인 요약 도넛 보드 + 탄단지 영양소 보드 */}
      <SummaryCard />

      {/* 3단계: 상하 분리 2-탭 세그먼트 스위처 */}
      <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-secondary/80 p-1 border border-border/40">
        <button
          type="button"
          onClick={() => setActiveSegment("meals")}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
            activeSegment === "meals"
              ? "bg-background text-primary shadow-xs border border-border/50"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Utensils className="h-4 w-4" />
          <span>식단 기록 ({intake.toLocaleString()} kcal)</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSegment("body")}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
            activeSegment === "body"
              ? "bg-background text-orange-600 shadow-xs border border-border/50"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Flame className="h-4 w-4" />
          <span>바디 & 활동 (-{burned.toLocaleString()} kcal)</span>
        </button>
      </div>

      {/* 4단계: 활성 세그먼트 컨텐츠 */}
      {activeSegment === "meals" ? (
        <MealCardsGrid />
      ) : (
        <div className="space-y-4 animate-in fade-in-50 duration-200">
          <ExerciseCard />
          <WaterCard />
          <WeightCard />
        </div>
      )}
    </div>
  );
}
