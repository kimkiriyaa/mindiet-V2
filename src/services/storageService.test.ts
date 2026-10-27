import { describe, it, expect, beforeEach } from 'vitest';
import {
  hashPassword,
  generateSalt,
  migrateLegacyMealItems,
  getProfileKey,
  getLogStorageKey,
} from './storageService';
import type { LegacyMealItem } from '@/lib/diet';

describe('storageService utilities', () => {
  it('hashPassword generates consistent SHA-256 hash with salt', async () => {
    const salt = 'testsalt123';
    const hash1 = await hashPassword('password123', salt);
    const hash2 = await hashPassword('password123', salt);
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64); // SHA-256 hex length
  });

  it('generates non-empty salt', () => {
    const salt = generateSalt();
    expect(salt).toBeTruthy();
    expect(salt.length).toBeGreaterThanOrEqual(16);
  });

  it('uses min_diet_* key convention correctly', () => {
    expect(getProfileKey('userA')).toBe('min_diet_usera_profile');
    expect(getLogStorageKey('2026-10-27', 'userA')).toBe('min_diet_usera_log_2026-10-27');
  });

  it('migrates legacy MealItem to V2 FoodEntry schema', () => {
    const legacyMeals: LegacyMealItem[] = [
      {
        id: 'legacy-1',
        type: 'breakfast',
        name: '사과',
        calories: 120,
        carbs: 30,
        protein: 1,
        fat: 0,
      },
    ];

    const migrated = migrateLegacyMealItems(legacyMeals, '2026-10-27');
    expect(migrated).toHaveLength(1);
    expect(migrated[0]).toEqual({
      id: 'legacy-1',
      date: '2026-10-27',
      meal: 'breakfast',
      name: '사과',
      qty: 1,
      unitKcal: 120,
      unitCarb: 30,
      unitProtein: 1,
      unitFat: 0,
    });
  });
});
