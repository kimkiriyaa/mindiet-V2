import { useState } from "react";
import { Minus, Plus, Trash2, Utensils, UtensilsCrossed } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useDiet } from "@/context/DietContext";
import { MEAL_LABEL, type MealType } from "@/lib/diet";
import { AddFoodModal } from "./AddFoodModal";

const EMOJI: Record<MealType, string> = {
  breakfast: "🌅",
  lunch: "☀️",
  dinner: "🌙",
  snack: "🍎",
};

const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

/**
 * [홈 화면 개편 확정안 4-A단계: 식단 기록 2x2 퀵 그리드 & 하단 시트]
 * - 4끼니(아침/점심/저녁/간식) 2x2 카드 그리드
 * - 미입력 끼니: 점선 테두리 + "+ 기록하기" -> 탭하면 AddFoodModal 즉시 호출
 * - 입력된 끼니: 실선 테두리 + 총 kcal + 입력 항목 1줄 요약 -> 탭하면 하단 바텀 시트 열림
 * - 하단 바텀 시트: 끼니명, 총 kcal, 음식 목록(단위/총 kcal, 탄단지, 수량 +/- 0.5 조절, 삭제), "+ 음식 추가" 버튼
 */
export function MealCardsGrid() {
  const { foods, selectedDate, removeFood, updateFoodQty } = useDiet();

  const [addingMeal, setAddingMeal] = useState<MealType | null>(null);
  const [activeMealDetail, setActiveMealDetail] = useState<MealType | null>(null);

  const activeItems = activeMealDetail
    ? foods.filter((f) => f.date === selectedDate && f.meal === activeMealDetail)
    : [];
  const activeMealKcal = Math.round(
    activeItems.reduce((acc, f) => acc + f.unitKcal * f.qty, 0)
  );

  return (
    <section className="space-y-2.5">
      {/* 소제목 */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
          <Utensils className="h-4 w-4 text-primary" />
          오늘의 끼니 현황
        </h2>
        <span className="text-xs text-muted-foreground">카드를 탭하여 상세 확인</span>
      </div>

      {/* 2x2 그리드 */}
      <div className="grid grid-cols-2 gap-2.5">
        {MEAL_ORDER.map((meal) => {
          const items = foods.filter((f) => f.date === selectedDate && f.meal === meal);
          const mealKcal = Math.round(
            items.reduce((acc, f) => acc + f.unitKcal * f.qty, 0)
          );
          const hasItems = items.length > 0;

          if (!hasItems) {
            return (
              <button
                key={meal}
                type="button"
                onClick={() => setAddingMeal(meal)}
                className="flex flex-col justify-between p-3.5 rounded-2xl border-2 border-dashed border-border/70 bg-secondary/30 hover:bg-secondary/60 hover:border-primary/40 transition text-left cursor-pointer min-h-[112px] group"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-2xl">{EMOJI[meal]}</span>
                  <span className="text-[11px] font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                    미입력
                  </span>
                </div>
                <div className="mt-2">
                  <p className="text-xs font-bold text-foreground">{MEAL_LABEL[meal]}</p>
                  <p className="text-[11px] text-primary font-semibold mt-0.5 flex items-center gap-0.5 group-hover:underline">
                    <Plus className="h-3 w-3" />
                    기록하기
                  </p>
                </div>
              </button>
            );
          }

          return (
            <button
              key={meal}
              type="button"
              onClick={() => setActiveMealDetail(meal)}
              className="flex flex-col justify-between p-3.5 rounded-2xl border border-border/80 bg-card hover:border-primary/50 hover:shadow-xs transition text-left cursor-pointer min-h-[112px]"
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-2xl">{EMOJI[meal]}</span>
                <span className="text-xs font-black text-foreground tabular-nums">
                  {mealKcal.toLocaleString()} kcal
                </span>
              </div>
              <div className="mt-2 min-w-0 w-full">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-foreground">{MEAL_LABEL[meal]}</p>
                  <span className="text-[10px] text-muted-foreground">{items.length}개</span>
                </div>
                <p
                  className="text-[11px] text-muted-foreground truncate mt-0.5"
                  title={items.map((i) => i.name).join(", ")}
                >
                  {items.map((i) => i.name).join(", ")}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* 식단 상세 하단 시트 (Bottom Sheet) */}
      <Sheet
        open={!!activeMealDetail}
        onOpenChange={(open) => {
          if (!open) setActiveMealDetail(null);
        }}
      >
        <SheetContent side="bottom" className="max-h-[85vh] rounded-t-3xl p-5 overflow-y-auto">
          {activeMealDetail && (
            <>
              <SheetHeader className="text-left pb-3 border-b border-border/50">
                <SheetTitle className="text-base font-bold flex items-center gap-2 pr-6">
                  <span>{EMOJI[activeMealDetail]}</span>
                  <span>{MEAL_LABEL[activeMealDetail]} 식단 상세</span>
                  <span className="text-sm font-black text-primary ml-auto tabular-nums">
                    {activeMealKcal.toLocaleString()} kcal
                  </span>
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  음식별 수량 조절(±0.5) 및 삭제, 추가가 가능합니다.
                </SheetDescription>
              </SheetHeader>

              {/* 음식 항목 리스트 */}
              <div className="py-3">
                {activeItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-sm text-muted-foreground">
                    <UtensilsCrossed className="mb-2 h-7 w-7 opacity-40 text-primary" />
                    <p className="font-medium text-foreground">기록된 식단이 없습니다.</p>
                    <p className="text-xs mt-1">아래 버튼을 눌러 음식을 추가해 보세요.</p>
                  </div>
                ) : (
                  <ul className="space-y-2.5">
                    {activeItems.map((f) => (
                      <li
                        key={f.id}
                        className="flex items-center gap-2 rounded-2xl bg-secondary/50 p-3 border border-border/40"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-foreground">
                            {f.name}
                            <span className="text-xs font-normal text-muted-foreground ml-1.5">
                              ({f.unitKcal} kcal/개)
                            </span>
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            탄 {Math.round(f.unitCarb * f.qty)}g · 단{" "}
                            {Math.round(f.unitProtein * f.qty)}g · 지{" "}
                            {Math.round(f.unitFat * f.qty)}g
                          </p>
                        </div>

                        {/* 수량 (+/- 0.5) 조절 컨트롤러 */}
                        <div className="flex items-center gap-1 rounded-xl bg-background border border-border px-1.5 py-1 shadow-xs shrink-0">
                          <button
                            type="button"
                            onClick={() => updateFoodQty(f.id, -0.5)}
                            title="수량 0.5 감소"
                            aria-label="수량 감소"
                            className="grid h-6 w-6 place-items-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition active:scale-95"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-8 text-center text-xs font-extrabold tabular-nums text-foreground">
                            {f.qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateFoodQty(f.id, 0.5)}
                            title="수량 0.5 증가"
                            aria-label="수량 증가"
                            className="grid h-6 w-6 place-items-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition active:scale-95"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        {/* 항목별 총 칼로리 */}
                        <span className="text-xs font-bold tabular-nums text-foreground w-16 text-right shrink-0">
                          {Math.round(f.unitKcal * f.qty).toLocaleString()} kcal
                        </span>

                        {/* 삭제 버튼 */}
                        <button
                          type="button"
                          onClick={() => removeFood(f.id)}
                          aria-label="식단 삭제"
                          title="삭제"
                          className="text-muted-foreground hover:text-destructive p-1 rounded-md transition shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* 하단 "+ 음식 추가" 버튼 */}
              <Button
                type="button"
                onClick={() => {
                  const m = activeMealDetail;
                  setActiveMealDetail(null);
                  setAddingMeal(m);
                }}
                className="w-full h-11 rounded-2xl font-bold flex items-center justify-center gap-1.5 mt-1"
              >
                <Plus className="h-4 w-4" />+ 음식 추가하기
              </Button>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* 음식 추가 모달 */}
      <AddFoodModal meal={addingMeal} onClose={() => setAddingMeal(null)} />
    </section>
  );
}
