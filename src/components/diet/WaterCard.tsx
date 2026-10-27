import { Droplets, Plus, RotateCcw } from 'lucide-react';
import { useDiet } from '@/context/DietContext';

export function WaterCard() {
  const { waterMl, targetWaterMl, addWater, resetWater } = useDiet();

  const percentage = Math.min(100, Math.round((waterMl / targetWaterMl) * 100));

  return (
    <section className="rounded-3xl border bg-card p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-sky-50 text-sky-500">
            <Droplets className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">수분 섭취</h2>
            <p className="text-[11px] text-muted-foreground">목표 {targetWaterMl.toLocaleString()} ml</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-base font-extrabold text-sky-500 tabular-nums">
            {waterMl.toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground">ml</span>
          {waterMl > 0 && (
            <button
              type="button"
              onClick={resetWater}
              title="오늘 섭취량 초기화"
              aria-label="초기화"
              className="ml-1 p-1 text-muted-foreground hover:text-foreground rounded-lg transition"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 프로그레스 바 */}
      <div className="space-y-1">
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-sky-500 transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{percentage}% 달성</span>
          <span>{Math.max(0, targetWaterMl - waterMl).toLocaleString()} ml 남음</span>
        </div>
      </div>

      {/* 빠른 추가 버튼들 */}
      <div className="grid grid-cols-2 gap-2 pt-0.5">
        <button
          type="button"
          onClick={() => addWater(250)}
          className="flex items-center justify-center gap-1 rounded-xl bg-secondary hover:bg-sky-50 hover:text-sky-600 px-3 py-2 text-xs font-semibold transition active:scale-95"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>+250 ml (1컵)</span>
        </button>
        <button
          type="button"
          onClick={() => addWater(500)}
          className="flex items-center justify-center gap-1 rounded-xl bg-secondary hover:bg-sky-50 hover:text-sky-600 px-3 py-2 text-xs font-semibold transition active:scale-95"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>+500 ml (1병)</span>
        </button>
      </div>
    </section>
  );
}
