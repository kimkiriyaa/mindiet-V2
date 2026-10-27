import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { DietProvider, useDiet } from '@/context/DietContext';
import { registerUserLocal, loadDailyLog } from '@/services/storageService';
import { toLocalDateKey } from '@/lib/diet';

describe('지침 16: 비동기 작업과 세션 에포크 (Session Epoch) 무결성 및 에러 전파 검증', () => {
  const today = toLocalDateKey();

  beforeEach(() => {
    localStorage.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <DietProvider>{children}</DietProvider>
  );

  it('1. 로그인·로그아웃 및 계정 전환 시 sessionEpoch 증가 규칙 검증', async () => {
    await registerUserLocal('user1', 'pw1', '유저1');
    await registerUserLocal('user2', 'pw2', '유저2');

    const { result } = renderHook(() => useDiet(), { wrapper });

    const initialEpoch = result.current.sessionEpoch;

    // 1) user1 로그인 -> epoch 증가
    act(() => {
      result.current.login({ userId: 'user1', userName: '유저1' });
    });
    expect(result.current.sessionEpoch).toBe(initialEpoch + 1);

    // 2) 로그아웃 -> epoch 증가
    act(() => {
      result.current.logout();
    });
    expect(result.current.sessionEpoch).toBe(initialEpoch + 2);

    // 3) user2 로그인 -> epoch 증가
    act(() => {
      result.current.login({ userId: 'user2', userName: '유저2' });
    });
    expect(result.current.sessionEpoch).toBe(initialEpoch + 3);
  });

  it('2. runWithSessionEpoch: 비동기 중간에 계정 전환 발생 시 콜백 및 저장 원천 차단 검증', async () => {
    await registerUserLocal('userA', 'pwA', '유저A');
    await registerUserLocal('userB', 'pwB', '유저B');

    const { result } = renderHook(() => useDiet(), { wrapper });

    // 계정 A 로그인
    act(() => {
      result.current.login({ userId: 'userA', userName: '유저A' });
    });

    let callbackExecuted = false;

    // 비동기 작업 시작 (예: 50ms 후 칼로리 추정 결과 도착 시뮬레이션)
    let executionPromise: Promise<boolean>;
    act(() => {
      executionPromise = result.current.runWithSessionEpoch(
        () => new Promise<string>((resolve) => setTimeout(() => resolve('분석완료: 샐러드 250kcal'), 50)),
        (data) => {
          callbackExecuted = true;
          result.current.addFood({
            date: today,
            meal: 'lunch',
            name: data,
            qty: 1,
            unitKcal: 250,
            unitCarb: 20,
            unitProtein: 5,
            unitFat: 10,
          });
        }
      );
    });

    // 비동기 응답 도착 전, 계정 A 로그아웃 후 계정 B로 로그인 (에포크 변경!)
    act(() => {
      result.current.logout();
      result.current.login({ userId: 'userB', userName: '유저B' });
    });

    // 비동기 작업 대기 완료
    const success = await executionPromise!;

    // 에포크 불일치로 onSuccess 콜백이 절대 실행되지 않았음을 검증
    expect(success).toBe(false);
    expect(callbackExecuted).toBe(false);

    // 계정 B의 식단 목록과 스토리지에 계정 A의 '샐러드'가 일체 유입되지 않음을 검증
    expect(result.current.foods).toHaveLength(0);
    expect(loadDailyLog('userB', today)).toBeNull();
    expect(loadDailyLog('userA', today)).toBeNull();
  });

  it('3. 동일 계정 세션 재갱신(재로그인) 시 오직 sessionEpoch만으로 이전 비동기 작업 차단 검증', async () => {
    await registerUserLocal('userA', 'pwA', '유저A');
    const { result } = renderHook(() => useDiet(), { wrapper });

    act(() => {
      result.current.login({ userId: 'userA', userName: '유저A' });
    });

    let delayedSuccess = false;
    let executionPromise: Promise<boolean>;

    act(() => {
      executionPromise = result.current.runWithSessionEpoch(
        () => new Promise<string>((resolve) => setTimeout(() => resolve('이전 세션 지연 데이터'), 50)),
        () => {
          delayedSuccess = true;
        }
      );
    });

    // userId는 동일하지만 재로그인으로 sessionEpoch가 증가함!
    act(() => {
      result.current.login({ userId: 'userA', userName: '유저A' });
    });

    const success = await executionPromise!;
    // userId가 같더라도 epoch가 변경되었으므로 반드시 차단되어야 함
    expect(success).toBe(false);
    expect(delayedSuccess).toBe(false);
  });

  it('4. onError 콜백 및 AbortSignal 전달 정상 동작 검증 (지침 16)', async () => {
    await registerUserLocal('userA', 'pwA', '유저A');
    const { result } = renderHook(() => useDiet(), { wrapper });

    act(() => {
      result.current.login({ userId: 'userA', userName: '유저A' });
    });

    let capturedError: unknown = null;
    let receivedSignal: AbortSignal | null = null;

    await act(async () => {
      await result.current.runWithSessionEpoch(
        async (signal) => {
          receivedSignal = signal;
          throw new Error('AI Vision Network Failure');
        },
        () => {},
        (err) => {
          capturedError = err;
        }
      );
    });

    expect(receivedSignal).toBeInstanceOf(AbortSignal);
    expect((capturedError as Error)?.message).toBe('AI Vision Network Failure');
  });

  it('5. runWithSessionEpoch 작업 도중 logout() 실행 시 signal.aborted === true 단언 (지침 22)', async () => {
    await registerUserLocal('userAbortTest', 'pw123', '취소테스트');
    const { result } = renderHook(() => useDiet(), { wrapper });

    act(() => {
      result.current.login({ userId: 'userAbortTest', userName: '취소테스트' });
    });

    let receivedSignal: AbortSignal | null = null;
    let abortEventTriggered = false;

    let executionPromise: Promise<boolean>;
    act(() => {
      executionPromise = result.current.runWithSessionEpoch(
        (signal) => {
          receivedSignal = signal;
          return new Promise<string>((resolve) => {
            signal.addEventListener('abort', () => {
              abortEventTriggered = true;
            });
            setTimeout(() => resolve('완료'), 100);
          });
        },
        () => {}
      );
    });

    expect(receivedSignal).not.toBeNull();
    expect(receivedSignal!.aborted).toBe(false);

    // 비동기 실행 도중 즉시 로그아웃 실행
    act(() => {
      result.current.logout();
    });

    // AbortController가 즉시 중단되었음을 단언
    expect(receivedSignal!.aborted).toBe(true);
    expect(abortEventTriggered).toBe(true);

    const success = await executionPromise!;
    expect(success).toBe(false);
  });
});
