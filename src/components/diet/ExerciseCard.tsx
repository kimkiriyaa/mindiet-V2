import { useState } from "react";
import { Dumbbell, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDiet } from "@/context/DietContext";

export function ExerciseCard() {
  const { exercises, selectedDate, addExercise, removeExercise } = useDiet();
  const [name, setName] = useState("");
  const [kcal, setKcal] = useState("");
  const list = exercises.filter((e) => e.date === selectedDate);
  const k = parseFloat(kcal);
  const ok = name.trim() && Number.isFinite(k) && k > 0;

  return (
    <section className="rounded-3xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-bold"><Dumbbell className="h-4 w-4 text-primary" />운동 기록</h2>
        <span className="text-sm font-semibold text-primary">-{list.reduce((a, e) => a + e.kcal, 0)} kcal</span>
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!ok) return; addExercise({ date: selectedDate, name: name.trim(), kcal: Math.round(k) }); setName(""); setKcal(""); }}>
        <Input placeholder="운동 종목" value={name} onChange={(e) => setName(e.target.value)} className="min-w-0 flex-1" />
        <Input placeholder="kcal" type="number" value={kcal} onChange={(e) => setKcal(e.target.value)} className="w-20" />
        <Button size="icon" type="submit" disabled={!ok} aria-label="운동 추가"><Plus className="h-4 w-4" /></Button>
      </form>
      {list.length === 0 ? (
        <p className="mt-3 text-center text-sm text-muted-foreground">오늘 한 운동을 기록해 보세요 🏃</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {list.map((e) => (
            <li key={e.id} className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{e.name}</span>
              <span className="tabular-nums">{e.kcal} kcal</span>
              <button onClick={() => removeExercise(e.id)} aria-label="삭제" className="text-muted-foreground"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
