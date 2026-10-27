import { useRef, useState } from "react";
import {
  Camera,
  Minus,
  Plus,
  ScanLine,
  Sparkles,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Wand2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useDiet } from "@/context/DietContext";
import { MEAL_LABEL, type MealType } from "@/lib/diet";
import { fileToDataUrl, resizeAndCompressImage } from "@/lib/imageUtils";
import {
  analyzeMealPhotoFn,
  estimateFoodTextFn,
  type FoodVisionResult,
} from "@/services/geminiServerFn";

export function AddFoodModal({ meal, onClose }: { meal: MealType | null; onClose: () => void }) {
  return (
    <Dialog open={!!meal} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[440px] rounded-3xl p-6">
        {meal && <Body meal={meal} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function Body({ meal, onClose }: { meal: MealType; onClose: () => void }) {
  const { addFood, selectedDate, runWithSessionEpoch } = useDiet();
  const fileRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"scan" | "manual">("scan");
  const [scan, setScan] = useState<"idle" | "compressing" | "scanning" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<FoodVisionResult | null>(null);
  const [scanQty, setScanQty] = useState(1);

  // 직접 입력 폼
  const [form, setForm] = useState({
    name: "",
    qty: "1",
    kcal: "",
    carb: "",
    protein: "",
    fat: "",
  });
  const [isTextEstimating, setIsTextEstimating] = useState(false);
  const [textEstimateSource, setTextEstimateSource] = useState<"ai" | "local" | "fallback" | null>(null);

  const n = (s: string) => (Number.isFinite(parseFloat(s)) ? parseFloat(s) : 0);

  const onFile = async (f?: File) => {
    if (!f) return;
    try {
      setErrorMessage(null);
      setScan("compressing");
      const rawDataUrl = await fileToDataUrl(f);
      setPreview(rawDataUrl);

      // 클라이언트 Canvas 기반 압축 및 리사이징 (최대 1024px, JPEG 0.75)
      const compressed = await resizeAndCompressImage(rawDataUrl, 1024, 0.75);
      setScan("scanning");

      await runWithSessionEpoch(
        async (signal) => {
          return await analyzeMealPhotoFn({
            data: { image: compressed },
            signal,
          });
        },
        (result) => {
          setAnalysisResult(result);
          setScanQty(result.quantity || 1);
          setScan("done");
        },
        (err) => {
          console.warn("[AddFoodModal] 사진 분석 실패:", err);
          const msg = err instanceof Error ? err.message : "AI 분석에 실패했습니다.";
          setErrorMessage(msg);
          setScan("error");
        }
      );
    } catch (err) {
      console.error("[AddFoodModal] 파일 처리 오류:", err);
      setErrorMessage(err instanceof Error ? err.message : "이미지 처리에 실패했습니다.");
      setScan("error");
    }
  };

  const registerScan = () => {
    if (!analysisResult) return;
    addFood({
      date: selectedDate,
      meal,
      name: analysisResult.name,
      qty: scanQty,
      unitKcal: analysisResult.unitKcal,
      unitCarb: analysisResult.unitCarb,
      unitProtein: analysisResult.unitProtein,
      unitFat: analysisResult.unitFat,
    });
    onClose();
  };

  const handleEstimateText = async () => {
    if (!form.name.trim()) return;
    setIsTextEstimating(true);
    try {
      await runWithSessionEpoch(
        async (signal) => {
          return await estimateFoodTextFn({
            data: { text: form.name.trim() },
            signal,
          });
        },
        (res) => {
          setForm((prev) => ({
            ...prev,
            name: res.name || prev.name,
            qty: String(res.quantity || 1),
            kcal: String(res.unitKcal || 0),
            carb: String(res.unitCarb || 0),
            protein: String(res.unitProtein || 0),
            fat: String(res.unitFat || 0),
          }));
          setTextEstimateSource(res.source);
        },
        (err) => {
          console.warn("[AddFoodModal] 텍스트 영양 추정 오류:", err);
        }
      );
    } finally {
      setIsTextEstimating(false);
    }
  };

  const total = Math.round(n(form.kcal) * n(form.qty));
  const registerManual = () => {
    addFood({
      date: selectedDate,
      meal,
      name: form.name.trim(),
      qty: n(form.qty),
      unitKcal: n(form.kcal),
      unitCarb: n(form.carb),
      unitProtein: n(form.protein),
      unitFat: n(form.fat),
    });
    onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{MEAL_LABEL[meal]} 음식 추가</DialogTitle>
      </DialogHeader>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "scan" | "manual")}
        className="mt-2"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="scan" onClick={() => setActiveTab("scan")}>
            <Sparkles className="mr-1 h-4 w-4" />
            AI 사진 스캔
          </TabsTrigger>
          <TabsTrigger value="manual" onClick={() => setActiveTab("manual")}>
            직접 입력
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scan" className="mt-4 space-y-4">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />

          {scan === "idle" && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-accent/40 py-10 text-sm text-accent-foreground hover:bg-accent/60 transition"
            >
              <Camera className="h-8 w-8 text-primary" />
              <span className="font-semibold">음식 사진을 올려주세요</span>
              <span className="text-xs text-muted-foreground">
                AI가 메뉴와 칼로리, 영양소를 정밀 분석해요
              </span>
            </button>
          )}

          {(scan === "compressing" || scan === "scanning") && (
            <div className="relative h-48 overflow-hidden rounded-2xl bg-muted">
              {preview && (
                <img
                  src={preview}
                  alt="업로드한 음식"
                  className="h-full w-full object-cover opacity-70"
                />
              )}
              <div className="absolute inset-x-0 h-1 animate-[scan_1.5s_ease-in-out_infinite] bg-primary shadow-[0_0_16px_var(--primary)]" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="flex items-center gap-2 rounded-full bg-background/90 px-4 py-2 text-sm font-semibold text-primary shadow-xs">
                  <ScanLine className="h-4 w-4 animate-pulse" />
                  {scan === "compressing" ? "이미지 최적화 중…" : "AI가 사진을 분석 중이에요…"}
                </span>
              </div>
            </div>
          )}

          {scan === "error" && (
            <div className="space-y-4 rounded-2xl border border-destructive/20 bg-destructive/5 p-5 text-center">
              <div className="flex flex-col items-center gap-2">
                <AlertCircle className="h-8 w-8 text-destructive" />
                <h3 className="text-sm font-bold text-destructive">AI 분석에 실패했습니다</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {errorMessage || "일시적인 서버 지연 또는 API 키가 설정되지 않았습니다."}
                </p>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <Button
                  type="button"
                  variant="default"
                  className="w-full h-11 text-xs font-semibold gap-1.5"
                  onClick={() => setActiveTab("manual")}
                >
                  직접 입력으로 전환
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-10 text-xs font-medium gap-1.5"
                  onClick={() => {
                    setScan("idle");
                    setErrorMessage(null);
                    fileRef.current?.click();
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  사진 다시 선택
                </Button>
              </div>
            </div>
          )}

          {scan === "done" && analysisResult && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">이렇게 인식했어요. 수량을 확인해 주세요.</p>
                {analysisResult.source === "ai" ? (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 text-xs">
                    AI 정밀 분석
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 text-xs">
                    대략적 추정값
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 rounded-2xl border p-3.5 bg-card">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">{analysisResult.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {analysisResult.unitKcal} kcal / 1{analysisResult.unit} · 합계{" "}
                    {Math.round(analysisResult.unitKcal * scanQty)} kcal
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="빼기"
                    onClick={() => setScanQty((q) => Math.max(0.5, Math.round((q - 0.5) * 10) / 10))}
                    className="grid h-8 w-8 place-items-center rounded-full bg-secondary hover:bg-secondary/80 transition"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center font-bold tabular-nums text-sm">{scanQty}</span>
                  <button
                    type="button"
                    aria-label="더하기"
                    onClick={() => setScanQty((q) => Math.round((q + 0.5) * 10) / 10)}
                    className="grid h-8 w-8 place-items-center rounded-full bg-secondary hover:bg-secondary/80 transition"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <Button className="h-12 w-full font-semibold" onClick={registerScan}>
                확인 후 등록 ({Math.round(analysisResult.unitKcal * scanQty)} kcal)
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="manual" className="mt-4 space-y-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">음식명</Label>
              {textEstimateSource && (
                <Badge
                  variant="outline"
                  className={
                    textEstimateSource === "ai"
                      ? "bg-emerald-50 text-emerald-600 border-emerald-200 text-[11px]"
                      : "bg-amber-50 text-amber-600 border-amber-200 text-[11px]"
                  }
                >
                  {textEstimateSource === "ai" ? "AI 정밀 분석" : "대략적 추정값"}
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="예: 현미밥 또는 닭가슴살 샐러드"
                className="flex-1 text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleEstimateText}
                disabled={!form.name.trim() || isTextEstimating}
                className="h-10 px-3 text-xs font-semibold gap-1 shrink-0"
              >
                <Wand2 className="h-3.5 w-3.5 text-primary" />
                {isTextEstimating ? "분석 중..." : "AI 추정"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">수량</Label>
              <Input
                type="number"
                value={form.qty}
                onChange={(e) => setForm({ ...form, qty: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">단위 kcal</Label>
              <Input
                type="number"
                value={form.kcal}
                onChange={(e) => setForm({ ...form, kcal: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">탄 (g)</Label>
              <Input
                type="number"
                value={form.carb}
                onChange={(e) => setForm({ ...form, carb: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">단 (g)</Label>
              <Input
                type="number"
                value={form.protein}
                onChange={(e) => setForm({ ...form, protein: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">지방 (g)</Label>
            <Input
              type="number"
              value={form.fat}
              onChange={(e) => setForm({ ...form, fat: e.target.value })}
              className="w-1/3"
            />
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-accent px-4 py-3 text-accent-foreground mt-2">
            <span className="text-sm font-medium">총 칼로리</span>
            <span className="text-lg font-bold tabular-nums">
              {total.toLocaleString()} kcal
            </span>
          </div>

          <Button
            className="h-12 w-full font-semibold"
            disabled={!form.name.trim() || n(form.qty) <= 0}
            onClick={registerManual}
          >
            등록하기
          </Button>
        </TabsContent>
      </Tabs>
    </>
  );
}
