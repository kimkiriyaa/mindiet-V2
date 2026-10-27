import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { DietProvider, useDiet } from '@/context/DietContext';
import { DEFAULT_PROFILE, type Profile, toLocalDateKey } from '@/lib/diet';
import {
  registerUserLocal,
  saveUserProfile,
  loadDailyLog,
  getProfileKey,
} from '@/services/storageService';

describe('Phase 3: 식단·운동·체중 실데이터 CRUD 및 계산 실시간 연동 검증', () => {
  const today = toLocalDateKey();

  beforeEach(() => {
    localStorage.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <DietProvider>{children}</DietProvider>
  );

  it('1. 식단 추가 및 수량 곱셈 실시간 반영 검증 (120kcal * 3 = 360kcal)', async () => {
    // 1) 사용자 등록 및 프로필 설정
    await registerUserLocal('testUser', 'pass123', '테스터');
    const profile: Profile = {
      ...DEFAULT_PROFILE,
      nickname: '테스터',
      startWeight: 70,
    };
    saveUserProfile('testUser', profile);

    const { result } = renderHook(() => useDiet(), { wrapper });

    // 로그인
    act(() => {
      result.current.login({ userId: 'testUser', userName: '테스터' });
    });

    // 식단 추가 (단위 120kcal, 수량 3 -> 총 360kcal)
    act(() => {
      result.current.addFood({
        date: today,
        meal: 'lunch',
        name: '현미밥',
        qty: 3,
        unitKcal: 120,
        unitCarb: 25,
        unitProtein: 3,
        unitFat: 1,
      });
    });

    // Context 상태 검증
    expect(result.current.foods).toHaveLength(1);
    const item = result.current.foods[0]!;
    expect(item.name).toBe('현미밥');
    expect(item.qty).toBe(3);
    expect(item.unitKcal).toBe(120);

    // 총 칼로리 계산: 120 * 3 = 360
    const totalFoodKcal = result.current.foods.reduce((a, f) => a + f.unitKcal * f.qty, 0);
    expect(totalFoodKcal).toBe(360);

    // 영양성분 합계 검증
    const totalCarb = result.current.foods.reduce((a, f) => a + f.unitCarb * f.qty, 0);
    const totalProtein = result.current.foods.reduce((a, f) => a + f.unitProtein * f.qty, 0);
    const totalFat = result.current.foods.reduce((a, f) => a + f.unitFat * f.qty, 0);
    expect(totalCarb).toBe(75);
    expect(totalProtein).toBe(9);
    expect(totalFat).toBe(3);

    // 로컬 스토리지 영속성 검증
    const savedLog = loadDailyLog('testUser', today);
    expect(savedLog).not.toBeNull();
    expect(savedLog?.foods).toHaveLength(1);
    expect(savedLog?.foods[0]?.qty).toBe(3);
    expect(savedLog?.foods[0]?.unitKcal).toBe(120);
  });

  it('2. 식단 수량 조절(+/-) 및 자동 삭제, 수동 삭제 검증', async () => {
    await registerUserLocal('testUser', 'pass123', '테스터');
    saveUserProfile('testUser', { ...DEFAULT_PROFILE, nickname: '테스터' });

    const { result } = renderHook(() => useDiet(), { wrapper });

    act(() => {
      result.current.login({ userId: 'testUser', userName: '테스터' });
    });

    act(() => {
      result.current.addFood({
        date: today,
        meal: 'dinner',
        name: '닭가슴살',
        qty: 2,
        unitKcal: 130,
        unitCarb: 1,
        unitProtein: 28,
        unitFat: 2,
      });
    });

    const foodId = result.current.foods[0]!.id;

    // 수량 1 증가: 2 -> 3 (390 kcal)
    act(() => {
      result.current.updateFoodQty(foodId, 1);
    });
    expect(result.current.foods[0]?.qty).toBe(3);
    let totalKcal = result.current.foods.reduce((a, f) => a + f.unitKcal * f.qty, 0);
    expect(totalKcal).toBe(390);

    // 수량 1 감소: 3 -> 2 (260 kcal)
    act(() => {
      result.current.updateFoodQty(foodId, -1);
    });
    expect(result.current.foods[0]?.qty).toBe(2);
    totalKcal = result.current.foods.reduce((a, f) => a + f.unitKcal * f.qty, 0);
    expect(totalKcal).toBe(260);

    // 수량 2 감소 -> 0이 되므로 자동 삭제 검증
    act(() => {
      result.current.updateFoodQty(foodId, -2);
    });
    expect(result.current.foods).toHaveLength(0);

    // 새 음식 추가 후 수동 삭제(removeFood) 검증
    act(() => {
      result.current.addFood({
        date: today,
        meal: 'snack',
        name: '사과',
        qty: 1,
        unitKcal: 80,
        unitCarb: 20,
        unitProtein: 0,
        unitFat: 0,
      });
    });
    expect(result.current.foods).toHaveLength(1);
    const appleId = result.current.foods[0]!.id;

    act(() => {
      result.current.removeFood(appleId);
    });
    expect(result.current.foods).toHaveLength(0);

    // 스토리지에도 삭제가 동기화되었는지 확인
    const savedLog = loadDailyLog('testUser', today);
    expect(savedLog?.foods).toHaveLength(0);
  });

  it('3. 체중 입력에 따른 일일 목표 칼로리(Mifflin-St Jeor TDEE) 실시간 재계산 검증', async () => {
    // 남성 30세, 175cm, 보통 활동(1.55), 감량(-500)
    await registerUserLocal('testUser', 'pass123', '테스터');
    const profile: Profile = {
      nickname: '테스터',
      gender: 'male',
      age: 30,
      height: 175,
      startWeight: 70,
      targetWeight: 65,
      activity: 'moderate',
      goal: 'lose',
      dietType: 'normal',
    };
    saveUserProfile('testUser', profile);

    const { result } = renderHook(() => useDiet(), { wrapper });

    act(() => {
      result.current.login({ userId: 'testUser', userName: '테스터' });
    });

    // 1) 체중 미입력 시 startWeight (70kg) 기준 계산:
    // BMR = 10 * 70 + 6.25 * 175 - 5 * 30 + 5 = 1648.75 -> 1649
    // Target = Math.round(1648.75 * 1.55 - 500) = 2056 kcal
    expect(result.current.currentWeight).toBe(70);
    expect(result.current.bmr).toBe(1649);
    expect(result.current.targetKcal).toBe(2056);

    // 2) 오늘 체중 75kg 입력 시:
    // BMR = 10 * 75 + 6.25 * 175 - 5 * 30 + 5 = 1698.75 -> 1699
    // Target = Math.round(1698.75 * 1.55 - 500) = 2133 kcal
    act(() => {
      result.current.setWeight(today, 75);
    });

    expect(result.current.currentWeight).toBe(75);
    expect(result.current.bmr).toBe(1699);
    expect(result.current.targetKcal).toBe(2133);

    // weights 배열에 포함되었는지 확인
    expect(result.current.weights.some((w) => w.date === today && w.weight === 75)).toBe(true);

    // 로컬 스토리지 일일 로그에 weight 필드가 저장되었는지 확인
    const savedLog = loadDailyLog('testUser', today);
    expect(savedLog?.weight).toBe(75);
  });

  it('4. 운동 및 걸음 수 CRUD 및 활동 소모량(Burned) 합산 검증', async () => {
    await registerUserLocal('testUser', 'pass123', '테스터');
    saveUserProfile('testUser', {
      ...DEFAULT_PROFILE,
      nickname: '테스터',
      startWeight: 70,
    });

    const { result } = renderHook(() => useDiet(), { wrapper });

    act(() => {
      result.current.login({ userId: 'testUser', userName: '테스터' });
    });

    // 1) 걸음 수 6,000보 입력:
    // V1 공식: calculateStepCalories(6000, 70) = Math.round(6000 * 0.0005 * 70 * 1.036) = 218 kcal
    act(() => {
      result.current.setSteps(6000);
    });

    expect(result.current.steps).toBe(6000);
    expect(result.current.stepCalories).toBe(218);

    // 2) 운동 추가: 러닝 300 kcal
    act(() => {
      result.current.addExercise({
        date: today,
        name: '조깅/러닝',
        kcal: 300,
      });
    });

    expect(result.current.exercises).toHaveLength(1);
    expect(result.current.exercises[0]?.kcal).toBe(300);

    // 총 활동 소모량 = 운동(300) + 걸음(218) = 518 kcal
    const exerciseTotal = result.current.exercises.reduce((a, e) => a + e.kcal, 0);
    const totalBurned = exerciseTotal + result.current.stepCalories;
    expect(totalBurned).toBe(518);

    // 3) 운동 삭제
    const exerciseId = result.current.exercises[0]!.id;
    act(() => {
      result.current.removeExercise(exerciseId);
    });
    expect(result.current.exercises).toHaveLength(0);
    expect(result.current.stepCalories).toBe(218); // 걸음 수 소모 칼로리는 유지
  });

  it('5. 체중 기록 후 다른 데이터(식단/걸음/물) 수정 시 체중 유실 방지(데이터 무결성) 검증', async () => {
    await registerUserLocal('testUser', 'pass123', '테스터');
    saveUserProfile('testUser', {
      ...DEFAULT_PROFILE,
      nickname: '테스터',
      startWeight: 70,
    });

    const { result } = renderHook(() => useDiet(), { wrapper });

    act(() => {
      result.current.login({ userId: 'testUser', userName: '테스터' });
    });

    // 1) 당일 체중 73.5kg 기록
    act(() => {
      result.current.setWeight(today, 73.5);
    });

    let log = loadDailyLog('testUser', today);
    expect(log?.weight).toBe(73.5);

    // 2) 이후 식단 추가
    act(() => {
      result.current.addFood({
        date: today,
        meal: 'breakfast',
        name: '그릭요거트',
        qty: 1,
        unitKcal: 110,
        unitCarb: 4,
        unitProtein: 15,
        unitFat: 2,
      });
    });

    // 식단 추가 후에도 체중이 유지되어야 함
    log = loadDailyLog('testUser', today);
    expect(log?.weight).toBe(73.5);
    expect(log?.foods).toHaveLength(1);

    // 3) 물 섭취 추가 및 걸음 수 수정
    act(() => {
      result.current.addWater(500);
      result.current.setSteps(5000);
    });

    log = loadDailyLog('testUser', today);
    expect(log?.weight).toBe(73.5);
    expect(log?.waterMl).toBe(500);
    expect(log?.steps).toBe(5000);
    expect(log?.foods).toHaveLength(1);
  });
});
