import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { toast } from 'sonner';
import { DietProvider, useDiet } from '@/context/DietContext';
import {
  saveDailyLog,
  saveUserProfile,
  loadDailyLog,
  getSavedSession,
  setSavedSession,
  registerUserLocal,
} from '@/services/storageService';
import { DEFAULT_PROFILE, toLocalDateKey, type DailyLogData } from '@/lib/diet';

describe('엄격 세션 가드 및 비동기 경계 레이스 컨디션 검증 (A~G 필수 실측)', () => {
  const today = toLocalDateKey();

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllTimers();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <DietProvider>{children}</DietProvider>
  );

  it('1) 세션이 null인 상태에서 saveDailyLog / saveUserProfile 호출 시 아무것도 쓰이지 않음 (Null Session 차단)', () => {
    // 세션이 null인 상태 보장
    setSavedSession(null);
    expect(getSavedSession()).toBeNull();

    const sampleLog: DailyLogData = {
      date: today,
      foods: [
        {
          id: 'test-f1',
          date: today,
          meal: 'lunch',
          name: '닭가슴살',
          qty: 1,
          unitKcal: 130,
          unitCarb: 0,
          unitProtein: 26,
          unitFat: 2,
        },
      ],
      exercises: [],
    };

    // 1) 세션 없는 상태에서 saveDailyLog 호출
    saveDailyLog('userGhost', today, sampleLog);

    // 2) 세션 없는 상태에서 saveUserProfile 호출
    saveUserProfile('userGhost', { ...DEFAULT_PROFILE, nickname: '유령' });

    // 로컬 스토리지에 어떤 키도 기록되지 않았는지 검증
    expect(localStorage.getItem(`min_diet_userghost_log_${today}`)).toBeNull();
    expect(localStorage.getItem('min_diet_userghost_profile')).toBeNull();
    expect(loadDailyLog('userGhost', today)).toBeNull();
  });

  it('2) 계정 A 로그인 → 비동기 작업 시작 → 즉시 로그아웃 → 계정 B 로그인 → 비동기 응답 도착 → 계정 B 데이터에 영향 없음', async () => {
    await registerUserLocal('userA', 'pwA', '사용자A');
    await registerUserLocal('userB', 'pwB', '사용자B');

    const { result } = renderHook(() => useDiet(), { wrapper });

    // 1) 계정 A 로그인
    act(() => {
      result.current.login({ userId: 'userA', userName: '사용자A' });
    });
    expect(result.current.session?.userId).toBe('userA');

    // 2) 계정 A에서 비동기 작업 시작 시점 세션 캡처
    const capturedUserId = result.current.session!.userId;

    // 비동기 지연 작업 시뮬레이션 (예: 50ms 후 저장 시도)
    let delayedSaveExecuted = false;
    const triggerDelayedSave = () => {
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          // 비동기 완료 시점: saveDailyLog 호출 시도
          saveDailyLog(capturedUserId, today, {
            date: today,
            foods: [
              {
                id: 'delayed-food',
                date: today,
                meal: 'dinner',
                name: '피자',
                qty: 1,
                unitKcal: 800,
                unitCarb: 90,
                unitProtein: 30,
                unitFat: 35,
              },
            ],
            exercises: [],
          });
          delayedSaveExecuted = true;
          resolve();
        }, 50);
      });
    };

    const delayedPromise = triggerDelayedSave();

    // 3) 비동기 응답이 오기 전에 계정 A 즉시 로그아웃
    act(() => {
      result.current.logout();
    });
    expect(result.current.session).toBeNull();

    // 4) 계정 B로 로그인
    act(() => {
      result.current.login({ userId: 'userB', userName: '사용자B' });
    });
    expect(result.current.session?.userId).toBe('userB');

    // 5) 계정 A의 비동기 지연 응답 도착
    await delayedPromise;
    expect(delayedSaveExecuted).toBe(true);

    // 6) 결과 검증:
    // - 현재 활성 세션은 userB이므로 userA의 saveDailyLog는 엄격 가드에 의해 차단됨
    // - userB의 스토리지 및 Context 상태에 userA의 '피자' 데이터가 0% 침범됨
    const logB = loadDailyLog('userB', today);
    expect(logB).toBeNull();
    expect(result.current.foods).toHaveLength(0);

    // userA의 스토리지에도 저장되지 않았는지 확인
    const logA = loadDailyLog('userA', today);
    expect(logA).toBeNull();
  });

  it('3) 로그아웃 직후 대기 중이던 디바운스/지연 저장이 일체 실행되지 않음 (Stale Callback 방어)', async () => {
    await registerUserLocal('userA', 'pwA', '사용자A');
    const { result } = renderHook(() => useDiet(), { wrapper });

    act(() => {
      result.current.login({ userId: 'userA', userName: '사용자A' });
    });

    // 식단 추가
    act(() => {
      result.current.addFood({
        date: today,
        meal: 'breakfast',
        name: '사과',
        qty: 1,
        unitKcal: 100,
        unitCarb: 25,
        unitProtein: 0,
        unitFat: 0,
      });
    });

    // 로그아웃 실행
    act(() => {
      result.current.logout();
    });

    // 로그아웃 이후 지연된 쓰기 콜백 시뮬레이션
    act(() => {
      // 컴포넌트 클로저 잔여 쓰기 호출 시도
      result.current.setSteps(10000);
      result.current.addWater(1000);
    });

    // 로그아웃 상태이므로 steps/water가 스토리지에 저장되지 않고 차단됨
    expect(getSavedSession()).toBeNull();
    expect(result.current.session).toBeNull();
    expect(result.current.steps).toBe(0);
    expect(result.current.waterMl).toBe(0);
  });

  it('4) 다른 탭에서 세션 키 삭제 시 storage 이벤트로 현재 탭 상태 정리 (다중 탭 동기화)', () => {
    const { result } = renderHook(() => useDiet(), { wrapper });

    // 로그인 상태
    act(() => {
      result.current.login({ userId: 'userMulti', userName: '다중탭유저' });
    });
    expect(result.current.session?.userId).toBe('userMulti');

    // 다른 탭에서 로그아웃(세션 키 삭제) 시뮬레이션
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'min_diet_session',
          oldValue: JSON.stringify({ userId: 'userMulti', userName: '다중탭유저' }),
          newValue: null, // 삭제됨
        })
      );
    });

    // 현재 탭도 즉시 로그아웃되어 세션 및 상태가 리셋됨
    expect(result.current.session).toBeNull();
    expect(result.current.foods).toHaveLength(0);
  });

  it('5) 음식 추가/수량 변경 직후 지연 없이 즉시 로그아웃해도 마지막 입력 항목이 스토리지에 유실 없이 보존됨 (즉시 플러시/동기 저장 보장)', async () => {
    await registerUserLocal('userImmediate', 'pw123', '즉시저장유저');
    const { result } = renderHook(() => useDiet(), { wrapper });

    act(() => {
      result.current.login({ userId: 'userImmediate', userName: '즉시저장유저' });
    });

    // 음식 추가 및 지연 없는 즉시 로그아웃
    act(() => {
      result.current.addFood({
        date: today,
        meal: 'lunch',
        name: '단백질 쉐이크',
        qty: 1,
        unitKcal: 200,
        unitCarb: 5,
        unitProtein: 30,
        unitFat: 3,
      });
      result.current.logout();
    });

    // 로그아웃되었으므로 인메모리 세션은 null
    expect(result.current.session).toBeNull();

    // 동기 저장으로 인해 userImmediate의 스토리지에는 '단백질 쉐이크'가 유실 없이 저장되어 있음
    setSavedSession({ userId: 'userImmediate', userName: '즉시저장유저' });
    const savedLog = loadDailyLog('userImmediate', today);
    expect(savedLog).not.toBeNull();
    expect(savedLog?.foods).toHaveLength(1);
    expect(savedLog?.foods[0]?.name).toBe('단백질 쉐이크');
    expect(savedLog?.foods[0]?.unitKcal).toBe(200);
  });

  it('6) 저장 실패 시 toast.error 피드백 호출 및 세션 가드 차단 피드백 검증 (지침 21)', async () => {
    await registerUserLocal('userToast', 'pw123', '토스트유저');
    const { result } = renderHook(() => useDiet(), { wrapper });

    act(() => {
      result.current.login({ userId: 'userToast', userName: '토스트유저' });
    });

    const toastErrorSpy = vi.spyOn(toast, 'error');

    // 1. QuotaExceededError 시뮬레이션
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      const err = new Error('QuotaExceeded');
      err.name = 'QuotaExceededError';
      throw err;
    });

    act(() => {
      result.current.addFood({
        date: today,
        meal: 'dinner',
        name: '용량초과음식',
        qty: 1,
        unitKcal: 500,
        unitCarb: 50,
        unitProtein: 20,
        unitFat: 10,
      });
    });

    expect(toastErrorSpy).toHaveBeenCalledWith('저장 공간이 부족하여 기록을 저장하지 못했습니다.');
    vi.restoreAllMocks();

    // 2. 세션 가드 차단 시뮬레이션 (외부에서 세션 삭제 후 컴포넌트 액션 트리거)
    const toastGuardSpy = vi.spyOn(toast, 'error');
    setSavedSession(null); // 로컬 스토리지 활성 세션 제거

    act(() => {
      result.current.setWeight(today, 65);
    });

    expect(toastGuardSpy).toHaveBeenCalledWith('세션이 변경되었습니다. 다시 로그인해 주세요.');
    vi.restoreAllMocks();
  });
});
