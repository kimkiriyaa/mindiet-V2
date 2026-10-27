import { useEffect, useState } from "react";
import { Dumbbell, Footprints, Plus, Trash2, Wand2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDiet } from "@/context/DietContext";
import { estimateExerciseCaloriesFn } from "@/services/geminiServerFn";

export function ExerciseCard() {
  const {
    exercises,
    selectedDate,
    addExercise,
    removeExercise,
    steps,
    setSteps,
    stepCalories,
    profile,
    runWithSessionEpoch,
  } = useDiet();

  const [name, setName] = useState("");
  const [kcal, setKcal] = useState("");
  const [stepsInput, setStepsInput] = useState(() => (steps ? String(steps) : ""));

  const [isEstimating, setIsEstimating] = useState(false);
  const [exerciseSource, setExerciseSource] = useState<"ai" | "local" | "fallback" | null>(null);

  useEffect(() => {
    setStepsInput(steps ? String(steps) : "");
  }, [steps]);

  const list = exercises.filter((e) => e.date === selectedDate);
  const exerciseTotal = list.reduce((a, e) => a + e.kcal, 0);
  const totalBurned = exerciseTotal + stepCalories;

  const k = parseFloat(kcal);
  const ok = name.trim() && Number.isFinite(k) && k > 0;

  const handleSaveSteps = () => {
    const val = parseInt(stepsInput.replace(/,/g, ""), 10);
    setSteps(Number.isFinite(val) && val >= 0 ? val : 0);
  };

  const handleEstimateExercise = async () => {
    if (!name.trim()) return;
    setIsEstimating(true);
    try {
      await runWithSessionEpoch(
        async (signal) => {
          return await estimateExerciseCaloriesFn({
            data: {
              text: name.trim(),
              weight: profile?.startWeight || 65,
            },
            signal,
          });
        },
        (res) => {
          setKcal(String(res.calories));
          setExerciseSource(res.source);
        },
        (err) => {
          console.warn("[ExerciseCard] 운동 칼로리 추정 오류:", err);
        }
      );
    } finally {
      setIsEstimating(false);
    }
  };

  return (
    <section className="rounded-3xl border bg-card p-5 space-y-4">
      {/* 타이틀 및 총 소모 칼로리 */}
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-bold text-foreground">
          <Dumbbell className="h-4 w-4 text-primary" />
          활동 및 운동 기록
        </h2>
        <span className="text-sm font-semibold text-primary">
          -{totalBurned.toLocaleString()} kcal
        </span>
      </div>

      {/* 1. 오늘의 걸음 수 입력란 */}
      <div className="rounded-2xl bg-secondary p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Footprints className="h-4 w-4 text-orange-500" />
            오늘의 걸음 수
          </span>
          <span className="text-xs font-bold text-orange-600 tabular-nums">
            -{stepCalories.toLocaleString()} kcal
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min="0"
            placeholder="걸음 수 입력 (예: 6000)"
            value={stepsInput}
            onChange={(e) => setStepsInput(e.target.value)}
            onBlur={handleSaveSteps}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSaveSteps();
              }
            }}
            className="h-10 flex-1 bg-background text-sm font-semibold"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSaveSteps}
            className="h-10 px-3 text-xs font-bold shrink-0"
          >
            저장
          </Button>
        </div>
      </div>

      {/* 2. 추가 운동 직접 등록 폼 */}
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ok) return;
          addExercise({ date: selectedDate, name: name.trim(), kcal: Math.round(k) });
          setName("");
          setKcal("");
          setExerciseSource(null);
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">운동 종목 및 칼로리</span>
          {exerciseSource && (
            <Badge
              variant="outline"
              className={
                exerciseSource === "ai"
                  ? "bg-emerald-50 text-emerald-600 border-emerald-200 text-[11px]"
                  : "bg-amber-50 text-amber-600 border-amber-200 text-[11px]"
              }
            >
              {exerciseSource === "ai" ? "AI 정밀 분석" : "대략적 추정값"}
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="운동 종목 (예: 수영 40분)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-w-0 flex-1 h-10 text-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleEstimateExercise}
            disabled={!name.trim() || isEstimating}
            className="h-10 px-2.5 text-xs font-semibold shrink-0 gap-1"
          >
            <Wand2 className="h-3.5 w-3.5 text-primary" />
            {isEstimating ? "계산 중..." : "AI 추정"}
          </Button>
          <Input
            placeholder="kcal"
            type="number"
            value={kcal}
            onChange={(e) => setKcal(e.target.value)}
            className="w-20 h-10 text-sm"
          />
          <Button size="icon" type="submit" disabled={!ok} aria-label="운동 추가" className="h-10 w-10 shrink-0">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </form>

      {/* 운동 내역 목록 */}
      {list.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-1">오늘 한 운동을 기록해 보세요 🏃</p>
      ) : (
        <ul className="space-y-2">
          {list.map((e) => (
            <li key={e.id} className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{e.name}</span>
              <span className="tabular-nums font-semibold">-{e.kcal} kcal</span>
              <button
                type="button"
                onClick={() => removeExercise(e.id)}
                aria-label="삭제"
                className="text-muted-foreground hover:text-destructive transition p-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
