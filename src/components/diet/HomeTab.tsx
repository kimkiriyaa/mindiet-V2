import { CalendarDays, ChevronLeft, ChevronRight, Sprout } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useDiet } from "@/context/DietContext";
import { fromDateKey, shiftDateKey, toLocalDateKey } from "@/lib/diet";
import { SummaryCard } from "./SummaryCard";
import { MealAccordion } from "./MealAccordion";
import { WaterCard } from "./WaterCard";
import { ExerciseCard } from "./ExerciseCard";
import { WeightCard } from "./WeightCard";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

export function HomeTab() {
  const { profile, selectedDate, setSelectedDate } = useDiet();
  const d = fromDateKey(selectedDate);
  const isToday = selectedDate === toLocalDateKey();
  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-lg font-extrabold text-primary"><Sprout className="h-5 w-5" />민다이어트</div>
        <span className="truncate text-sm text-muted-foreground">{profile?.nickname}님 안녕하세요 👋</span>
      </header>
      <div className="flex items-center justify-between rounded-2xl bg-secondary px-2 py-1.5">
        <button aria-label="이전 날짜" onClick={() => setSelectedDate(shiftDateKey(selectedDate, -1))} className="grid h-9 w-9 place-items-center rounded-full hover:bg-background"><ChevronLeft className="h-5 w-5" /></button>
        <Popover>
          <PopoverTrigger className="flex items-center gap-2 font-semibold">
            <CalendarDays className="h-4 w-4 text-primary" />
            {d.getMonth() + 1}월 {d.getDate()}일 ({DOW[d.getDay()]}){isToday && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">오늘</span>}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar mode="single" selected={d} onSelect={(x) => x && setSelectedDate(toLocalDateKey(x))} className="pointer-events-auto p-3" />
          </PopoverContent>
        </Popover>
        <button aria-label="다음 날짜" onClick={() => setSelectedDate(shiftDateKey(selectedDate, 1))} className="grid h-9 w-9 place-items-center rounded-full hover:bg-background"><ChevronRight className="h-5 w-5" /></button>
      </div>
      <SummaryCard />
      <MealAccordion />
      <WaterCard />
      <ExerciseCard />
      <WeightCard />
    </div>
  );
}
