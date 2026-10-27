import { useRef, useState } from "react";
import { Camera, Minus, Plus, ScanLine, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDiet } from "@/context/DietContext";
import { MEAL_LABEL, type MealType } from "@/lib/diet";

const SAMPLE = [
  { name: "닭가슴살 샐러드", unit: "인분", unitKcal: 320, unitCarb: 18, unitProtein: 35, unitFat: 11 },
  { name: "삶은 계란", unit: "개", unitKcal: 75, unitCarb: 0.5, unitProtein: 6.5, unitFat: 5 },
];
const SAMPLE_QTY = [1, 2];

export function AddFoodModal({ meal, onClose }: { meal: MealType | null; onClose: () => void }) {
  return (
    <Dialog open={!!meal} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[440px] rounded-3xl">
        {meal && <Body meal={meal} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function Body({ meal, onClose }: { meal: MealType; onClose: () => void }) {
  const { addFood, selectedDate } = useDiet();
  const fileRef = useRef<HTMLInputElement>(null);
  const [scan, setScan] = useState<"idle" | "scanning" | "done">("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [qtys, setQtys] = useState(SAMPLE_QTY);
  const [form, setForm] = useState({ name: "", qty: "1", kcal: "", carb: "", protein: "", fat: "" });
  const n = (s: string) => (Number.isFinite(parseFloat(s)) ? parseFloat(s) : 0);

  const onFile = (f?: File) => {
    if (!f) return;
    setPreview(URL.createObjectURL(f));
    setScan("scanning");
    setTimeout(() => setScan("done"), 1500);
  };
  const registerScan = () => {
    SAMPLE.forEach((s, i) => (qtys[i] ?? 0) > 0 && addFood({ date: selectedDate, meal, name: s.name, qty: qtys[i] ?? 0, unitKcal: s.unitKcal, unitCarb: s.unitCarb, unitProtein: s.unitProtein, unitFat: s.unitFat }));
    onClose();
  };
  const total = Math.round(n(form.kcal) * n(form.qty));
  const registerManual = () => {
    addFood({ date: selectedDate, meal, name: form.name.trim(), qty: n(form.qty), unitKcal: n(form.kcal), unitCarb: n(form.carb), unitProtein: n(form.protein), unitFat: n(form.fat) });
    onClose();
  };

  return (
    <>
      <DialogHeader><DialogTitle>{MEAL_LABEL[meal]} 음식 추가</DialogTitle></DialogHeader>
      <Tabs defaultValue="scan">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="scan"><Sparkles className="mr-1 h-4 w-4" />AI 사진 스캔</TabsTrigger>
          <TabsTrigger value="manual">직접 입력</TabsTrigger>
        </TabsList>
        <TabsContent value="scan" className="mt-4">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          {scan === "idle" && (
            <button onClick={() => fileRef.current?.click()} className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-accent/40 py-10 text-sm text-accent-foreground">
              <Camera className="h-8 w-8" />음식 사진을 올려주세요
              <span className="text-xs text-muted-foreground">AI가 메뉴와 칼로리를 분석해요</span>
            </button>
          )}
          {scan === "scanning" && (
            <div className="relative h-48 overflow-hidden rounded-2xl bg-muted">
              {preview && <img src={preview} alt="업로드한 음식" className="h-full w-full object-cover opacity-70" />}
              <div className="absolute inset-x-0 h-1 animate-[scan_1.5s_ease-in-out_infinite] bg-primary shadow-[0_0_16px_var(--primary)]" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="flex items-center gap-2 rounded-full bg-background/90 px-4 py-2 text-sm font-semibold text-primary"><ScanLine className="h-4 w-4 animate-pulse" />AI가 분석 중이에요…</span>
              </div>
            </div>
          )}
          {scan === "done" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">이렇게 인식했어요. 수량을 확인해 주세요.</p>
              {SAMPLE.map((s, i) => (
                <div key={s.name} className="flex items-center gap-3 rounded-2xl border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.unitKcal}kcal / 1{s.unit} · 합계 {Math.round(s.unitKcal * (qtys[i] ?? 0))}kcal</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button aria-label="빼기" onClick={() => setQtys(qtys.map((q, j) => (j === i ? Math.max(0, q - 1) : q)))} className="grid h-8 w-8 place-items-center rounded-full bg-secondary"><Minus className="h-4 w-4" /></button>
                    <span className="w-6 text-center font-bold tabular-nums">{qtys[i]}</span>
                    <button aria-label="더하기" onClick={() => setQtys(qtys.map((q, j) => (j === i ? q + 1 : q)))} className="grid h-8 w-8 place-items-center rounded-full bg-secondary"><Plus className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
              <Button className="h-12 w-full" onClick={registerScan}>확인 후 등록</Button>
            </div>
          )}
        </TabsContent>
        <TabsContent value="manual" className="mt-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-1"><Label className="text-xs">음식명</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="예: 현미밥" /></div>
            <div className="space-y-1"><Label className="text-xs">수량</Label><Input type="number" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {([["kcal", "단위 kcal"], ["carb", "탄 g"], ["protein", "단 g"], ["fat", "지 g"]] as const).map(([k, l]) => (
              <div key={k} className="space-y-1"><Label className="text-xs">{l}</Label><Input type="number" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></div>
            ))}
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-accent px-4 py-3 text-accent-foreground">
            <span className="text-sm">총 칼로리</span><span className="text-lg font-bold tabular-nums">{total.toLocaleString()} kcal</span>
          </div>
          <Button className="h-12 w-full" disabled={!form.name.trim() || n(form.qty) <= 0} onClick={registerManual}>등록하기</Button>
        </TabsContent>
      </Tabs>
    </>
  );
}
