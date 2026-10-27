import { Send } from "lucide-react";
import { useDiet } from "@/context/DietContext";
import { sumFoods } from "@/lib/diet";

const CHAT = [
  { me: false, text: "점심에 단백질이 조금 부족해요! 저녁엔 닭가슴살이나 두부를 추가해 볼까요? 🥗" },
  { me: true, text: "좋아요! 두부 샐러드 어때요?" },
  { me: false, text: "완벽해요 👍 두부 반 모면 단백질 약 15g을 채울 수 있어요. 드레싱은 오리엔탈로 가볍게!" },
];

export function CoachTab() {
  const { foods, selectedDate } = useDiet();
  const t = sumFoods(foods.filter((f) => f.date === selectedDate));
  const kc = t.carb * 4 + t.protein * 4 + t.fat * 9;
  const pct = (v: number) => (kc ? Math.round((v / kc) * 100) : 0);
  return (
    <div className="flex min-h-[calc(100vh-7rem)] flex-col">
      <div className="flex items-start gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-accent text-3xl ring-4 ring-primary/20">🥑</div>
        <div className="min-w-0 rounded-2xl rounded-tl-sm bg-secondary p-3 text-sm">
          <p className="font-bold text-primary">민코치</p>
          {kc ? (
            <p className="mt-1">오늘 탄:단:지 비율은 <b>{pct(t.carb * 4)} : {pct(t.protein * 4)} : {pct(t.fat * 9)}</b> 이에요.</p>
          ) : (
            <p className="mt-1">아직 오늘 식단 기록이 없어요. 기록하면 비율을 분석해 드릴게요!</p>
          )}
        </div>
      </div>
      <div className="mt-6 flex-1 space-y-3">
        {CHAT.map((c, i) => (
          <div key={i} className={`flex ${c.me ? "justify-end" : "justify-start"}`}>
            <p className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${c.me ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm border bg-card"}`}>{c.text}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-full border bg-card p-1.5 pl-4">
        <input disabled placeholder="코치에게 물어보기 (준비 중)" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        <button disabled aria-label="전송" className="grid h-9 w-9 place-items-center rounded-full bg-primary/50 text-primary-foreground"><Send className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
