import { useState } from "react";
import { ChevronDown, Minus, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { useDiet } from "@/context/DietContext";
import { MEAL_LABEL, type MealType } from "@/lib/diet";
import { AddFoodModal } from "./AddFoodModal";

const EMOJI: Record<MealType, string> = { breakfast: "🌅", lunch: "☀️", dinner: "🌙", snack: "🍎" };

export function MealAccordion() {
  const { foods, selectedDate, removeFood, updateFoodQty } = useDiet();
  const [open, setOpen] = useState<MealType | null>("breakfast");
  const [adding, setAdding] = useState<MealType | null>(null);

  return (
    <section className="space-y-2">
      <h2 className="px-1 text-base font-bold text-foreground">식단 기록</h2>
      {(Object.keys(MEAL_LABEL) as MealType[]).map((m) => {
        const items = foods.filter((f) => f.date === selectedDate && f.meal === m);
        const total = Math.round(items.reduce((a, f) => a + f.unitKcal * f.qty, 0));
        const isOpen = open === m;
        return (
          <div key={m} className="overflow-hidden rounded-2xl border bg-card shadow-xs">
            <div className="flex items-center gap-3 p-4">
              <button
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                onClick={() => setOpen(isOpen ? null : m)}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-lg">
                  {EMOJI[m]}
                </span>
                <span className="font-semibold text-foreground">{MEAL_LABEL[m]}</span>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition duration-200 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              <span className="text-sm font-bold tabular-nums text-foreground">{total.toLocaleString()} kcal</span>
              <button
                type="button"
                onClick={() => setAdding(m)}
                className="flex shrink-0 items-center gap-0.5 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:bg-accent/80 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                추가
              </button>
            </div>

            {isOpen && (
              <div className="border-t border-border px-4 py-3">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center py-4 text-center text-sm text-muted-foreground">
                    <UtensilsCrossed className="mb-2 h-6 w-6 opacity-40" />
                    아직 기록이 없어요. <br />
                    + 추가 버튼으로 {MEAL_LABEL[m]}을 기록해 보세요.
                  </div>
                ) : (
                  <ul className="space-y-2.5">
                    {items.map((f) => (
                      <li key={f.id} className="flex items-center gap-2 rounded-xl bg-secondary/40 p-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {f.name}
                            <span className="text-xs font-normal text-muted-foreground ml-1.5">
                              ({f.unitKcal} kcal/개)
                            </span>
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            탄 {Math.round(f.unitCarb * f.qty)}g · 단 {Math.round(f.unitProtein * f.qty)}g · 지{" "}
                            {Math.round(f.unitFat * f.qty)}g
                          </p>
                        </div>

                        {/* 수량 (+/-) 조절 컨트롤러 */}
                        <div className="flex items-center gap-1 rounded-lg bg-background border border-border px-1 py-0.5 shadow-xs">
                          <button
                            type="button"
                            onClick={() => updateFoodQty(f.id, -1)}
                            title="수량 1 감소"
                            aria-label="수량 감소"
                            className="grid h-6 w-6 place-items-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition active:scale-95"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-5 text-center text-xs font-bold tabular-nums text-foreground">
                            {f.qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateFoodQty(f.id, 1)}
                            title="수량 1 증가"
                            aria-label="수량 증가"
                            className="grid h-6 w-6 place-items-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition active:scale-95"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        {/* 항목별 총 칼로리 */}
                        <span className="text-sm font-bold tabular-nums text-foreground w-16 text-right shrink-0">
                          {Math.round(f.unitKcal * f.qty).toLocaleString()} kcal
                        </span>

                        {/* 삭제 버튼 */}
                        <button
                          type="button"
                          onClick={() => removeFood(f.id)}
                          aria-label="식단 삭제"
                          title="삭제"
                          className="text-muted-foreground hover:text-destructive p-1 rounded-md transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}
      <AddFoodModal
        meal={adding}
        onClose={() => {
          if (adding) setOpen(adding);
          setAdding(null);
        }}
      />
    </section>
  );
}
