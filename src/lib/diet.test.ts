import { describe, it, expect } from "vitest";
import { calculateDailyTargetCalories, macroTargets, DEFAULT_PROFILE, toLocalDateKey, latestWeight } from "./diet";

describe("diet rules", () => {
  it("male 30/175/70 moderate lose → BMR 1649, target 2056", () => {
    expect(calculateDailyTargetCalories(DEFAULT_PROFILE, 70)).toEqual({ bmr: 1649, target: 2056 });
  });
  it("2000kcal 5:3:2 → 250/150/44 g", () => {
    expect(macroTargets(2000, "normal")).toEqual({ carb: 250, protein: 150, fat: 44 });
  });
  it("female floor 1200", () => {
    const r = calculateDailyTargetCalories({ ...DEFAULT_PROFILE, gender: "female", age: 80, height: 140, activity: "sedentary" }, 35);
    expect(r.target).toBe(1200);
  });
  it("male floor 1500", () => {
    const r = calculateDailyTargetCalories({ ...DEFAULT_PROFILE, age: 80, height: 150, activity: "sedentary" }, 45);
    expect(r.target).toBe(1500);
  });
  it("local date key", () => {
    expect(toLocalDateKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
  it("falls back to start weight", () => {
    expect(latestWeight(DEFAULT_PROFILE, [])).toBe(70);
    expect(latestWeight(DEFAULT_PROFILE, [{ date: "2026-01-01", weight: 69 }])).toBe(69);
  });
});
