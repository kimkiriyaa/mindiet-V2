import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ACTIVITY_LABEL, DIET_LABEL, DIET_RATIO, GOAL_LABEL,
  type Activity, type DietType, type Goal, type Profile,
} from "@/lib/diet";

type Section = "basic" | "weight" | "plan";

function Chips<T extends string>({ options, value, onChange }: { options: Record<T, string>; value: T; onChange: (v: T) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(Object.keys(options) as T[]).map((k) => (
        <button key={k} type="button" onClick={() => onChange(k)}
          className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${value === k ? "border-primary bg-accent text-accent-foreground" : "border-border text-muted-foreground"}`}>
          {options[k]}
        </button>
      ))}
    </div>
  );
}

function NumField({ label, unit, value, onChange }: { label: string; unit: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input type="number" inputMode="decimal" value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(parseFloat(e.target.value))} className="h-11 pr-10" />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

export function ProfileFields({ value, onChange, sections }: { value: Profile; onChange: (p: Profile) => void; sections: readonly Section[] }) {
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => onChange({ ...value, [k]: v });
  const dietOpts = Object.fromEntries(
    (Object.keys(DIET_LABEL) as DietType[]).map((k) => [k, `${DIET_LABEL[k]} ${DIET_RATIO[k].join(":")}`]),
  ) as Record<DietType, string>;
  return (
    <div className="space-y-5">
      {sections.includes("basic") && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">성별</Label>
            <Chips options={{ male: "남성", female: "여성" }} value={value.gender} onChange={(v) => set("gender", v)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumField label="나이" unit="세" value={value.age} onChange={(n) => set("age", n)} />
            <NumField label="키" unit="cm" value={value.height} onChange={(n) => set("height", n)} />
          </div>
        </>
      )}
      {sections.includes("weight") && (
        <div className="grid grid-cols-2 gap-3">
          <NumField label="시작 체중" unit="kg" value={value.startWeight} onChange={(n) => set("startWeight", n)} />
          <NumField label="목표 체중" unit="kg" value={value.targetWeight} onChange={(n) => set("targetWeight", n)} />
        </div>
      )}
      {sections.includes("plan") && (
        <>
          <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">활동량</Label>
            <Chips<Activity> options={ACTIVITY_LABEL} value={value.activity} onChange={(v) => set("activity", v)} /></div>
          <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">다이어트 목표</Label>
            <Chips<Goal> options={GOAL_LABEL} value={value.goal} onChange={(v) => set("goal", v)} /></div>
          <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">식단 타입 (탄:단:지)</Label>
            <Chips<DietType> options={dietOpts} value={value.dietType} onChange={(v) => set("dietType", v)} /></div>
        </>
      )}
    </div>
  );
}
