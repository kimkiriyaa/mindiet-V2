import { useEffect, useState } from "react";
import { Scale } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDiet } from "@/context/DietContext";
import { shiftDateKey } from "@/lib/diet";

export function WeightCard() {
  const { weights, selectedDate, setWeight, profile, currentWeight } = useDiet();
  const todays = weights.find((w) => w.date === selectedDate);
  const [val, setVal] = useState("");
  useEffect(() => setVal(todays ? String(todays.weight) : ""), [selectedDate, todays]);

  const data = Array.from({ length: 14 }, (_, i) => {
    const d = shiftDateKey(selectedDate, i - 13);
    const w = weights.find((x) => x.date === d);
    return { date: d.slice(5).replace("-", "/"), weight: w?.weight ?? null };
  });
  const target = profile?.targetWeight ?? 0;
  const vals = data.map((d) => d.weight).filter((x): x is number => x != null).concat(target, currentWeight);
  const min = Math.floor(Math.min(...vals) - 1), max = Math.ceil(Math.max(...vals) + 1);
  const v = parseFloat(val);

  return (
    <section className="rounded-3xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-bold"><Scale className="h-4 w-4 text-primary" />체중 기록</h2>
        <span className="text-sm text-muted-foreground">목표 {target}kg</span>
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (v > 0) setWeight(selectedDate, v); }}>
        <div className="relative flex-1">
          <Input type="number" step="0.1" placeholder={`${currentWeight}`} value={val} onChange={(e) => setVal(e.target.value)} className="pr-10" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">kg</span>
        </div>
        <Button type="submit" disabled={!(v > 0)}>{todays ? "수정" : "기록"}</Button>
      </form>
      <div className="mt-4 h-44">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} interval={2} tickLine={false} axisLine={false} />
            <YAxis domain={[min, max]} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
            <Tooltip formatter={(x) => [`${x}kg`, "체중"]} />
            <ReferenceLine y={target} stroke="var(--primary)" strokeDasharray="6 4" label={{ value: "목표", position: "insideTopRight", fontSize: 10, fill: "var(--primary)" }} />
            <Line type="monotone" dataKey="weight" stroke="var(--foreground)" strokeWidth={2} dot={{ r: 3, fill: "var(--primary)" }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
