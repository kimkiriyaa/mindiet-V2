import { useState } from "react";
import { ChevronDown, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { useDiet } from "@/context/DietContext";
import { MEAL_LABEL, type MealType } from "@/lib/diet";
import { AddFoodModal } from "./AddFoodModal";

const EMOJI: Record<MealType, string> = { breakfast: "🌅", lunch: "☀️", dinner: "🌙", snack: "🍎" };

export function MealAccordion() {
  const { foods, selectedDate, removeFood } = useDiet();
  const [open, setOpen] = useState<MealType | null>("breakfast");
  const [adding, setAdding] = useState<MealType | null>(null);

  return (
    <section className="space-y-2">
      <h2 className="px-1 text-base font-bold">식단 기록</h2>
      {(Object.keys(MEAL_LABEL) as MealType[]).map((m) => {
        const items = foods.filter((f) => f.date === selectedDate && f.meal === m);
        const total = Math.round(items.reduce((a, f) => a + f.unitKcal * f.qty, 0));
        const isOpen = open === m;
        return (
          <div key={m} className="overflow-hidden rounded-2xl border bg-card">
            <div className="flex items-center gap-3 p-4">
              <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setOpen(isOpen ? null : m)}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-lg">{EMOJI[m]}</span>
                <span className="font-semibold">{MEAL_LABEL[m]}</span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${isOpen ? "rotate-180" : ""}`} />
              </button>
              <span className="text-sm font-semibold tabular-nums">{total} kcal</span>
              <button onClick={() => setAdding(m)} className="flex shrink-0 items-center gap-0.5 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground">
                <Plus className="h-3.5 w-3.5" />추가
              </button>
            </div>
            {isOpen && (
              <div className="border-t px-4 py-3">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center py-4 text-center text-sm text-muted-foreground">
                    <UtensilsCrossed className="mb-2 h-6 w-6 opacity-50" />
                    아직 기록이 없어요. <br />+ 추가로 {MEAL_LABEL[m]}을 기록해 보세요.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {items.map((f) => (
                      <li key={f.id} className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{f.name} <span className="text-muted-foreground">× {f.qty}</span></p>
                          <p className="text-xs text-muted-foreground">탄 {Math.round(f.unitCarb * f.qty)}g · 단 {Math.round(f.unitProtein * f.qty)}g · 지 {Math.round(f.unitFat * f.qty)}g</p>
                        </div>
                        <span className="text-sm tabular-nums">{Math.round(f.unitKcal * f.qty)} kcal</span>
                        <button onClick={() => removeFood(f.id)} aria-label="삭제" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}
      <AddFoodModal meal={adding} onClose={() => { if (adding) setOpen(adding); setAdding(null); }} />
    </section>
  );
}
