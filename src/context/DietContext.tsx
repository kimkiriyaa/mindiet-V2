import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  calculateDailyTargetCalories, latestWeight, macroTargets, toLocalDateKey, uid,
  type ExerciseEntry, type FoodEntry, type Profile, type WeightEntry,
} from "@/lib/diet";

const KEY = "mindiet-state-v1";

interface Ctx {
  hydrated: boolean;
  profile: Profile | null;
  setProfile: (p: Profile) => void;
  foods: FoodEntry[];
  addFood: (f: Omit<FoodEntry, "id">) => void;
  removeFood: (id: string) => void;
  exercises: ExerciseEntry[];
  addExercise: (e: Omit<ExerciseEntry, "id">) => void;
  removeExercise: (id: string) => void;
  weights: WeightEntry[];
  setWeight: (date: string, weight: number) => void;
  selectedDate: string;
  setSelectedDate: (d: string) => void;
  currentWeight: number;
  bmr: number;
  targetKcal: number;
  macros: { carb: number; protein: number; fat: number };
}

const DietContext = createContext<Ctx | null>(null);

export function DietProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [foods, setFoods] = useState<FoodEntry[]>([]);
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateKey());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        setProfile(s.profile ?? null);
        setFoods(s.foods ?? []);
        setExercises(s.exercises ?? []);
        setWeights(s.weights ?? []);
      }
    } catch { /* ignore */ }
    setSelectedDate(toLocalDateKey());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(KEY, JSON.stringify({ profile, foods, exercises, weights }));
  }, [hydrated, profile, foods, exercises, weights]);

  const value = useMemo<Ctx>(() => {
    const p = profile;
    const currentWeight = p ? latestWeight(p, weights, selectedDate) : 70;
    const { bmr, target } = p ? calculateDailyTargetCalories(p, currentWeight) : { bmr: 0, target: 0 };
    return {
      hydrated, profile, setProfile,
      foods,
      addFood: (f) => setFoods((x) => [...x, { ...f, id: uid() }]),
      removeFood: (id) => setFoods((x) => x.filter((f) => f.id !== id)),
      exercises,
      addExercise: (e) => setExercises((x) => [...x, { ...e, id: uid() }]),
      removeExercise: (id) => setExercises((x) => x.filter((e) => e.id !== id)),
      weights,
      setWeight: (date, weight) =>
        setWeights((x) => [...x.filter((w) => w.date !== date), { date, weight }]),
      selectedDate, setSelectedDate,
      currentWeight, bmr, targetKcal: target,
      macros: p ? macroTargets(target, p.dietType) : { carb: 0, protein: 0, fat: 0 },
    };
  }, [hydrated, profile, foods, exercises, weights, selectedDate]);

  return <DietContext.Provider value={value}>{children}</DietContext.Provider>;
}

export function useDiet() {
  const c = useContext(DietContext);
  if (!c) throw new Error("useDiet must be inside DietProvider");
  return c;
}
