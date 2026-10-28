import { useEffect, useState } from "react";
import {
  Dumbbell,
  Droplets,
  Footprints,
  Pencil,
  Plus,
  RotateCcw,
  Scale,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useDiet } from "@/context/DietContext";
import { shiftDateKey } from "@/lib/diet";
import { estimateExerciseCaloriesFn } from "@/services/geminiServerFn";

/**
 * [홈 화면 개편 확정안 4-B단계: 바디 & 활동 뷰 (B안 디자인 완전 교체)]
 * 1) 오늘의 걸음 수 카드: 걸음 수/10,000보 대형 숫자, -OO kcal 소모, +1,000보 알약 퀵 버튼, 주황색 바, 연필 아이콘 미니 수동 입력 토글
 * 2) 운동 종목 카드: + 운동 등록 토글 폼 (AI 추정 포함), 등록된 운동 종목 리스트, 삭제 버튼
 * 3) 수분 섭취 카드: 상단 수분량 (파란색), 가로 2분할 와이드 버튼 (+250ml 1컵 | +500ml 1병), 차감 및 리셋 옵션
 * 4) 체중 트렌드 카드: 체중 (보라색), 14일 Recharts 꺾은선 차트, 하단 콤팩트 인라인 체중 입력 폼
 */
export function BodyActivityView() {
  const {
    steps,
    setSteps,
    stepCalories,
    exercises,
    selectedDate,
    addExercise,
    removeExercise,
    profile,
    runWithSessionEpoch,
    waterMl,
    addWater,
    resetWater,
    weights,
    setWeight,
    currentWeight,
  } = useDiet();

  // 1. 걸음 수 상태
  const [isEditingSteps, setIsEditingSteps] = useState(false);
  const [stepsInput, setStepsInput] = useState(() => (steps ? String(steps) : ""));

  useEffect(() => {
    setStepsInput(steps ? String(steps) : "");
  }, [steps]);

  const handleSaveSteps = () => {
    const val = parseInt(stepsInput.replace(/,/g, ""), 10);
    setSteps(Number.isFinite(val) && val >= 0 ? val : 0);
    setIsEditingSteps(false);
  };

  // 2. 운동 상태
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [exerciseName, setExerciseName] = useState("");
  const [exerciseKcal, setExerciseKcal] = useState("");
  const [isEstimating, setIsEstimating] = useState(false);
  const [exerciseSource, setExerciseSource] = useState<"ai" | "local" | "fallback" | null>(null);

  const todayExercises = exercises.filter((e) => e.date === selectedDate);
  const k = parseFloat(exerciseKcal);
  const isExerciseValid = exerciseName.trim().length > 0 && Number.isFinite(k) && k > 0;

  const handleEstimateExercise = async () => {
    if (!exerciseName.trim()) return;
    setIsEstimating(true);
    try {
      await runWithSessionEpoch(
        async (signal) => {
          return await estimateExerciseCaloriesFn({
            data: {
              text: exerciseName.trim(),
              weight: profile?.startWeight || 65,
            },
            signal,
          });
        },
        (res) => {
          setExerciseKcal(String(res.calories));
          setExerciseSource(res.source);
        },
        (err) => {
          console.warn("[BodyActivityView] 운동 추정 오류:", err);
        }
      );
    } finally {
      setIsEstimating(false);
    }
  };

  const handleAddExerciseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isExerciseValid) return;
    addExercise({
      date: selectedDate,
      name: exerciseName.trim(),
      kcal: Math.round(k),
    });
    setExerciseName("");
    setExerciseKcal("");
    setExerciseSource(null);
    setIsAddingExercise(false);
  };

  // 3. 체중 상태 및 차트 데이터
  const todaysWeight = weights.find((w) => w.date === selectedDate);
  const [weightVal, setWeightVal] = useState("");

  useEffect(() => {
    setWeightVal(todaysWeight ? String(todaysWeight.weight) : "");
  }, [selectedDate, todaysWeight]);

  const weightChartData = Array.from({ length: 14 }, (_, i) => {
    const d = shiftDateKey(selectedDate, i - 13);
    const w = weights.find((x) => x.date === d);
    return { date: d.slice(5).replace("-", "/"), weight: w?.weight ?? null };
  });

  const targetWeight = profile?.targetWeight ?? 0;
  const recordedWeights = weightChartData
    .map((d) => d.weight)
    .filter((x): x is number => x != null)
    .concat(targetWeight > 0 ? [targetWeight] : [], currentWeight > 0 ? [currentWeight] : []);
  const minWeight =
    recordedWeights.length > 0 ? Math.floor(Math.min(...recordedWeights) - 1) : 40;
  const maxWeight =
    recordedWeights.length > 0 ? Math.ceil(Math.max(...recordedWeights) + 1) : 100;

  return (
    <section className="space-y-3 animate-in fade-in-50 duration-200">
      {/* 1) 오늘의 걸음 수 카드 */}
      <div className="rounded-2xl border border-border/70 bg-card p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <Footprints className="h-4 w-4 text-orange-500" />
            오늘의 걸음 수
          </span>
          <span className="text-xs font-bold text-orange-600 tabular-nums">
            -{stepCalories.toLocaleString()} kcal 소모
          </span>
        </div>

        <div className="flex items-baseline justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-2xl font-black tabular-nums text-foreground">
              {(steps || 0).toLocaleString()}{" "}
              <span className="text-xs font-normal text-muted-foreground">/ 10,000보</span>
            </span>
            <button
              type="button"
              onClick={() => setIsEditingSteps((prev) => !prev)}
              aria-label="걸음 수 직접 수정"
              title="직접 입력"
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setSteps((steps || 0) + 1000)}
            className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-secondary hover:bg-orange-50 hover:text-orange-600 border border-border/40 transition active:scale-95"
          >
            +1,000보
          </button>
        </div>

        {/* 연필 클릭 시 나타나는 미니 수동 입력창 */}
        {isEditingSteps && (
          <div className="flex items-center gap-1.5 pt-1 animate-in fade-in-50 duration-150">
            <Input
              type="number"
              min="0"
              placeholder="걸음 수 (예: 6000)"
              value={stepsInput}
              onChange={(e) => setStepsInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSaveSteps();
                }
              }}
              className="h-8 text-xs font-semibold bg-background flex-1"
              autoFocus
            />
            <Button
              type="button"
              size="sm"
              onClick={handleSaveSteps}
              className="h-8 px-2.5 text-xs font-bold shrink-0"
            >
              저장
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsEditingSteps(false)}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* 오렌지 프로그레스 바 */}
        <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full bg-orange-500 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, (((steps || 0) / 10000) * 100))}%` }}
          />
        </div>
      </div>

      {/* 2) 추가 운동 종목 카드 */}
      <div className="rounded-2xl border border-border/70 bg-card p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <Dumbbell className="h-4 w-4 text-primary" />
            운동 종목
          </span>
          <button
            type="button"
            onClick={() => setIsAddingExercise((prev) => !prev)}
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5"
          >
            {isAddingExercise ? "접기" : "+ 운동 등록"}
          </button>
        </div>

        {/* + 운동 등록 클릭 시 펼쳐지는 미니 인풋 & AI 추정 폼 */}
        {isAddingExercise && (
          <form
            onSubmit={handleAddExerciseSubmit}
            className="rounded-xl bg-secondary/50 p-2.5 space-y-2 border border-border/50 animate-in fade-in-50 duration-150"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground">새 운동 기록</span>
              {exerciseSource && (
                <Badge
                  variant="outline"
                  className={
                    exerciseSource === "ai"
                      ? "bg-emerald-50 text-emerald-600 border-emerald-200 text-[10px]"
                      : "bg-amber-50 text-amber-600 border-amber-200 text-[10px]"
                  }
                >
                  {exerciseSource === "ai" ? "AI 정밀 분석" : "대략적 추정값"}
                </Badge>
              )}
            </div>

            <div className="flex gap-1.5">
              <Input
                placeholder="운동 종목 (예: 수영 40분)"
                value={exerciseName}
                onChange={(e) => setExerciseName(e.target.value)}
                className="min-w-0 flex-1 h-9 text-xs bg-background"
                autoFocus
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleEstimateExercise}
                disabled={!exerciseName.trim() || isEstimating}
                className="h-9 px-2 text-xs font-semibold shrink-0 gap-1 bg-background"
              >
                <Wand2 className="h-3.5 w-3.5 text-primary" />
                {isEstimating ? "추정중" : "AI 추정"}
              </Button>
              <Input
                placeholder="kcal"
                type="number"
                value={exerciseKcal}
                onChange={(e) => setExerciseKcal(e.target.value)}
                className="w-16 h-9 text-xs bg-background"
              />
              <Button
                size="sm"
                type="submit"
                disabled={!isExerciseValid}
                className="h-9 px-2.5 text-xs font-bold shrink-0"
              >
                등록
              </Button>
            </div>
          </form>
        )}

        {/* 등록된 운동 리스트 */}
        {todayExercises.length > 0 ? (
          <div className="space-y-1.5">
            {todayExercises.map((e) => (
              <div
                key={e.id}
                className="flex justify-between items-center rounded-xl bg-secondary/40 p-2.5 text-xs border border-border/30"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <span className="font-bold text-foreground block truncate">{e.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-extrabold text-orange-600 tabular-nums">
                    -{e.kcal.toLocaleString()} kcal
                  </span>
                  <button
                    type="button"
                    onClick={() => removeExercise(e.id)}
                    aria-label="운동 삭제"
                    title="삭제"
                    className="text-muted-foreground hover:text-destructive p-1 rounded transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
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
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-extrabold text-sky-500 tabular-nums">
              {waterMl.toLocaleString()} ml
            </span>
            {waterMl > 0 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => addWater(-250)}
                  title="250ml 차감"
                  aria-label="-250 ml"
                  className="text-[10px] text-muted-foreground hover:text-rose-600 px-1 py-0.5 rounded hover:bg-rose-50 transition"
                >
                  -250ml
                </button>
                <button
                  type="button"
                  onClick={resetWater}
                  title="수분 초기화"
                  aria-label="수분 초기화"
                  className="text-muted-foreground hover:text-foreground p-0.5 rounded transition"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 가로 2분할 와이드 버튼 */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() => addWater(250)}
            className="py-2.5 px-3 rounded-xl bg-secondary font-semibold text-xs text-sky-600 hover:bg-sky-50 hover:border-sky-200 border border-border/40 transition active:scale-95 min-h-[44px] flex items-center justify-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>+250 ml (1컵)</span>
          </button>
          <button
            type="button"
            onClick={() => addWater(500)}
            className="py-2.5 px-3 rounded-xl bg-secondary font-semibold text-xs text-sky-600 hover:bg-sky-50 hover:border-sky-200 border border-border/40 transition active:scale-95 min-h-[44px] flex items-center justify-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>+500 ml (1병)</span>
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
          <span className="text-xs font-bold text-indigo-500 tabular-nums">
            {currentWeight ? `${currentWeight} kg` : "기록 없음"}
          </span>
        </div>

        {/* 14일 꺾은선 차트 */}
        <div className="h-28 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={weightChartData}
              margin={{ top: 5, right: 10, bottom: 0, left: -25 }}
            >
              <XAxis dataKey="date" tick={{ fontSize: 9 }} />
              <YAxis domain={[minWeight, maxWeight]} tick={{ fontSize: 9 }} />
              <Tooltip
                contentStyle={{ fontSize: 10, borderRadius: 6 }}
                formatter={(x) => [`${x}kg`, "체중"]}
              />
              {targetWeight > 0 && (
                <ReferenceLine
                  y={targetWeight}
                  stroke="#10b981"
                  strokeDasharray="2 2"
                  label={{ value: "목표", position: "insideTopRight", fontSize: 9, fill: "#10b981" }}
                />
              )}
              <Line
                type="monotone"
                dataKey="weight"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ r: 2.5 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 차트 하단 콤팩트 한 줄 인라인 체중 입력 폼 */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const num = parseFloat(weightVal);
            if (num > 0) {
              setWeight(selectedDate, num);
            }
          }}
          className="flex items-center gap-1.5 pt-1.5 border-t border-border/40"
        >
          <div className="relative flex-1">
            <Input
              type="number"
              step="0.1"
              placeholder={`오늘 체중 (${currentWeight ? `${currentWeight}kg` : "예: 68.5"})`}
              value={weightVal}
              onChange={(e) => setWeightVal(e.target.value)}
              className="h-8 text-xs font-semibold pr-8 bg-background"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
              kg
            </span>
          </div>
          <Button
            size="sm"
            type="submit"
            disabled={!(parseFloat(weightVal) > 0)}
            className="h-8 px-3 text-xs font-bold shrink-0"
          >
            {todaysWeight ? "수정" : "기록"}
          </Button>
        </form>
      </div>
    </section>
  );
}
