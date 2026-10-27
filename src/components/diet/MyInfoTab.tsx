import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDiet } from "@/context/DietContext";
import { calculateDailyTargetCalories, DIET_LABEL, GOAL_LABEL, latestWeight, macroTargets, type Profile } from "@/lib/diet";
import { ProfileFields } from "./ProfileFields";

export function MyInfoTab({ onSaved }: { onSaved: () => void }) {
  const { profile, setProfile, weights, selectedDate } = useDiet();
  const [draft, setDraft] = useState<Profile>(profile!);
  const w = latestWeight(draft, weights, selectedDate);
  const { bmr, target } = calculateDailyTargetCalories(draft, w);
  const m = macroTargets(target, draft.dietType);
  const badges = ["🌱 시작", weights.length >= 3 ? "⚖️ 꾸준 체중" : null, "🔥 3일 연속"].filter(Boolean);

  return (
    <div className="space-y-5">
      <section className="flex items-center gap-4 rounded-3xl border bg-card p-5">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-accent text-4xl">🐻</div>
        <div className="min-w-0 flex-1">
          <Input value={draft.nickname} onChange={(e) => setDraft({ ...draft, nickname: e.target.value })} className="h-9 font-bold" aria-label="닉네임" />
          <p className="mt-1 text-xs text-muted-foreground">{GOAL_LABEL[profile!.goal]} · {DIET_LABEL[profile!.dietType]} · 현재 {w}kg</p>
          <div className="mt-2 flex flex-wrap gap-1">{badges.map((b) => <span key={b} className="rounded-full bg-secondary px-2 py-0.5 text-[11px]">{b}</span>)}</div>
        </div>
      </section>
      <ProfileFields value={draft} onChange={setDraft} sections={["basic", "weight", "plan"]} />
      <section className="rounded-3xl bg-accent p-5 text-accent-foreground">
        <p className="text-xs font-semibold">실시간 미리보기 (체중 {w}kg 기준)</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div><p className="text-xs opacity-80">기초대사량</p><p className="text-xl font-extrabold tabular-nums">{bmr.toLocaleString()} kcal</p></div>
          <div><p className="text-xs opacity-80">일일 목표</p><p className="text-xl font-extrabold tabular-nums">{target.toLocaleString()} kcal</p></div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
          {[["탄", m.carb], ["단", m.protein], ["지", m.fat]].map(([l, g]) => (
            <div key={l} className="rounded-xl bg-background py-2 text-foreground"><span className="text-muted-foreground">{l}</span> <b className="tabular-nums">{g}g</b></div>
          ))}
        </div>
      </section>
      <Button className="h-12 w-full" onClick={() => { setProfile(draft); toast.success("저장했어요!"); onSaved(); }}>저장하기</Button>
    </div>
  );
}
