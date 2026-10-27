export type Gender = "male" | "female";
export type Activity = "sedentary" | "light" | "moderate" | "active";
export type Goal = "lose" | "maintain" | "gain";
export type DietType = "normal" | "protein" | "keto" | "vegan";
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface Profile {
  nickname: string;
  gender: Gender;
  age: number;
  height: number;
  startWeight: number;
  targetWeight: number;
  activity: Activity;
  goal: Goal;
  dietType: DietType;
}

export interface FoodEntry {
  id: string;
  date: string;
  meal: MealType;
  name: string;
  qty: number;
  unitKcal: number;
  unitCarb: number;
  unitProtein: number;
  unitFat: number;
}
export interface ExerciseEntry { id: string; date: string; name: string; kcal: number }
export interface WeightEntry { date: string; weight: number }

export interface UserSession {
  userId: string;
  userName: string;
}

export interface StoredAuthUser {
  userId: string;
  userName: string;
  salt: string;
  passwordHash: string;
  createdAt: string;
  // V1 레거시 평문 비밀번호 호환 필드 (마이그레이션 대상)
  password?: string;
}

export interface DailyLogData {
  date: string;
  steps?: number | undefined;
  waterMl?: number | undefined;
  targetWaterMl?: number | undefined;
  foods: FoodEntry[];
  exercises: ExerciseEntry[];
  weight?: number | undefined;
}

// V1 구형 데이터 마이그레이션용 인터페이스
export interface LegacyMealItem {
  id?: string | undefined;
  type: MealType;
  name: string;
  calories: number;
  carbs?: number | undefined;
  protein?: number | undefined;
  fat?: number | undefined;
  imageUrl?: string | undefined;
}

export interface LegacyDailyLog {
  date: string;
  userId?: string | undefined;
  targetCalories?: number | undefined;
  steps?: number | undefined;
  meals?: LegacyMealItem[] | undefined;
  waterIntake?: number | undefined;
  water?: number | undefined;
  weight?: number | undefined;
  exerciseCalories?: number | undefined;
  exerciseNotes?: string | undefined;
}

export interface LegacyUserProfile {
  birthDate?: string | undefined;
  gender?: 'male' | 'female' | undefined;
  height?: number | undefined;
  weight?: number | undefined;
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' | undefined;
  targetWeight?: number | undefined;
  targetCalories?: number | undefined;
  targetWater?: number | undefined;
  geminiApiKey?: string | undefined;
}

export const DEFAULT_TARGET_WATER = 2000;

export const DEFAULT_PROFILE: Profile = {
  nickname: "민다이어터",
  gender: "male",
  age: 30,
  height: 175,
  startWeight: 70,
  targetWeight: 65,
  activity: "moderate",
  goal: "lose",
  dietType: "normal",
};

export const ACTIVITY_FACTOR: Record<Activity, number> = {
  sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725,
};
export const ACTIVITY_LABEL: Record<Activity, string> = {
  sedentary: "좌식", light: "가벼운 활동", moderate: "보통", active: "활동적",
};
export const GOAL_ADJUST: Record<Goal, number> = { lose: -500, maintain: 0, gain: 300 };
export const GOAL_LABEL: Record<Goal, string> = { lose: "감량", maintain: "유지", gain: "증량" };
export const DIET_RATIO: Record<DietType, [number, number, number]> = {
  normal: [5, 3, 2], protein: [4, 4, 2], keto: [1, 3, 6], vegan: [6, 2, 2],
};
export const DIET_LABEL: Record<DietType, string> = {
  normal: "일반식", protein: "운동/고단백", keto: "키토/저탄고지", vegan: "비건",
};
export const MEAL_LABEL: Record<MealType, string> = {
  breakfast: "아침", lunch: "점심", dinner: "저녁", snack: "간식",
};

const num = (v: unknown, fb: number) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : fb);

/** Local-timezone YYYY-MM-DD (never toISOString). */
export function toLocalDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function fromDateKey(key: string): Date {
  const [y = 1970, m = 1, d = 1] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function shiftDateKey(key: string, days: number): string {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + days);
  return toLocalDateKey(d);
}

export function latestWeight(profile: Profile, weights: WeightEntry[], upTo?: string): number {
  const list = weights
    .filter((w) => (upTo ? w.date <= upTo : true) && Number.isFinite(w.weight) && w.weight > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  return list.length ? list[list.length - 1]!.weight : num(profile.startWeight, DEFAULT_PROFILE.startWeight);
}

export function calculateBMR(p: Pick<Profile, "gender" | "age" | "height">, weight: number): number {
  const w = num(weight, DEFAULT_PROFILE.startWeight);
  const h = num(p.height, DEFAULT_PROFILE.height);
  const a = num(p.age, DEFAULT_PROFILE.age);
  return 10 * w + 6.25 * h - 5 * a + (p.gender === "female" ? -161 : 5);
}

export function calculateDailyTargetCalories(profile: Profile, weight: number) {
  const bmrRaw = calculateBMR(profile, weight);
  const factor = ACTIVITY_FACTOR[profile.activity] ?? 1.55;
  let target = Math.round(bmrRaw * factor + (GOAL_ADJUST[profile.goal] ?? 0));
  const floor = profile.gender === "female" ? 1200 : 1500;
  if (target < floor) target = floor;
  return { bmr: Math.round(bmrRaw), target };
}

export function macroTargets(kcal: number, dietType: DietType) {
  const [c, p, f] = DIET_RATIO[dietType] ?? DIET_RATIO.normal;
  const sum = c + p + f;
  return {
    carb: Math.round((kcal * c) / sum / 4),
    protein: Math.round((kcal * p) / sum / 4),
    fat: Math.round((kcal * f) / sum / 9),
  };
}

export function sumFoods(foods: FoodEntry[]) {
  return foods.reduce(
    (a, f) => ({
      kcal: a.kcal + f.unitKcal * f.qty,
      carb: a.carb + f.unitCarb * f.qty,
      protein: a.protein + f.unitProtein * f.qty,
      fat: a.fat + f.unitFat * f.qty,
    }),
    { kcal: 0, carb: 0, protein: 0, fat: 0 },
  );
}

export const uid = () => Math.random().toString(36).slice(2, 10);
