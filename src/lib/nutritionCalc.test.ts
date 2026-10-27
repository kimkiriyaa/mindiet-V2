import { describe, it, expect } from 'vitest';
import { calculateStepCalories, calculateAge, calculateBMI, safeVal } from './nutritionCalc';

describe('nutritionCalc utilities', () => {
  it('safeVal handles invalid values safely', () => {
    expect(safeVal(undefined, 10)).toBe(10);
    expect(safeVal(NaN, 5)).toBe(5);
    expect(safeVal('123', 0)).toBe(123);
    expect(safeVal(50, 0)).toBe(50);
  });

  it('calculateStepCalories calculates accurately', () => {
    // 6000 steps, 70kg -> 6000 * 0.0005 * 70 * 1.036 = 217.56 -> 218 kcal
    expect(calculateStepCalories(6000, 70)).toBe(218);
    expect(calculateStepCalories(0, 70)).toBe(0);
    expect(calculateStepCalories(-500, 70)).toBe(0);
  });

  it('calculateAge calculates correct age from birthDate', () => {
    expect(calculateAge('1995-01-01')).toBeGreaterThanOrEqual(30);
    expect(calculateAge(undefined)).toBe(30);
    expect(calculateAge('invalid-date')).toBe(30);
  });

  it('calculateBMI classifies properly', () => {
    // 175cm, 70kg -> 70 / (1.75 * 1.75) = 22.86 -> 22.9 (정상)
    const res = calculateBMI(175, 70);
    expect(res.bmi).toBe(22.9);
    expect(res.status).toBe('정상');
  });
});
