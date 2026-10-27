import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerUserLocal,
  loginUserLocal,
  saveUserProfile,
  loadUserProfile,
  saveDailyLog,
  loadDailyLog,
  getSavedSession,
  setSavedSession,
} from '@/services/storageService';
import { DEFAULT_PROFILE, type DailyLogData, type Profile } from '@/lib/diet';

describe('Phase 2: 계정 인증, 데이터 격리 및 온보딩 가드 검증', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('1. 계정 등록 및 SHA-256 보안 해시 저장 검증', async () => {
    const res = await registerUserLocal('userA', 'passwordA123', '사용자A');
    expect(res.success).toBe(true);
    expect(res.user?.userId).toBe('userA');
    expect(res.user?.userName).toBe('사용자A');

    // 비밀번호가 평문으로 저장되지 않고 salt + SHA-256 해시로 저장되었는지 검증
    const rawUsers = localStorage.getItem('registered_users');
    expect(rawUsers).not.toBeNull();
    const users = JSON.parse(rawUsers!);
    expect(users[0].userId).toBe('userA');
    expect(users[0].passwordHash).toHaveLength(64);
    expect(users[0].salt).toBeTruthy();
    expect(users[0].password).toBeUndefined(); // 평문 비밀번호 미존재
  });

  it('2. 계정 격리 검증: 계정 A 기록 후 로그아웃 -> 계정 B 로그인 시 A 데이터 미노출', async () => {
    // 1) 계정 A 등록 및 기록
    await registerUserLocal('userA', 'pwA', '사용자A');
    const profileA: Profile = {
      ...DEFAULT_PROFILE,
      nickname: '사용자A',
      startWeight: 75,
    };
    saveUserProfile('userA', profileA);

    const logA: DailyLogData = {
      date: '2026-10-27',
      steps: 8000,
      waterMl: 1500,
      foods: [
        {
          id: 'food-a1',
          date: '2026-10-27',
          meal: 'lunch',
          name: '닭가슴살',
          qty: 2,
          unitKcal: 130,
          unitCarb: 0,
          unitProtein: 26,
          unitFat: 2,
        },
      ],
      exercises: [],
    };
    saveDailyLog('userA', '2026-10-27', logA);

    // 2) 계정 A 로그아웃 및 계정 B 등록
    await registerUserLocal('userB', 'pwB', '사용자B');

    // 계정 B로 조회 시 계정 A의 프로필과 로그가 일체 조회되지 않음 (완벽한 격리)
    const profileB = loadUserProfile('userB');
    const logB = loadDailyLog('userB', '2026-10-27');

    expect(profileB).toBeNull(); // 온보딩 대상
    expect(logB).toBeNull(); // 기록 없음

    // 3) 계정 B 기록 후 다시 계정 A로 로그인 시 계정 A 데이터 완벽 보존 확인
    const profileBNew: Profile = {
      ...DEFAULT_PROFILE,
      nickname: '사용자B',
      startWeight: 60,
    };
    saveUserProfile('userB', profileBNew);

    const reloadedProfileA = loadUserProfile('userA');
    const reloadedLogA = loadDailyLog('userA', '2026-10-27');

    expect(reloadedProfileA?.nickname).toBe('사용자A');
    expect(reloadedProfileA?.startWeight).toBe(75);
    expect(reloadedLogA?.steps).toBe(8000);
    expect(reloadedLogA?.foods[0]?.name).toBe('닭가슴살');
  });

  it('3. 세션 복원 검증: 브라우저 새로고침(F5) 시 로그인 세션 유지', async () => {
    await registerUserLocal('userTest', 'pw123', '테스터');
    const loginRes = await loginUserLocal('userTest', 'pw123');
    expect(loginRes.success).toBe(true);

    setSavedSession(loginRes.user!);

    // 새로고침 상황 시뮬레이션
    const restoredSession = getSavedSession();
    expect(restoredSession).not.toBeNull();
    expect(restoredSession?.userId).toBe('userTest');
    expect(restoredSession?.userName).toBe('테스터');
  });

  it('4. 온보딩 가드 검증: 프로필 존재 계정은 온보딩 패스, 미존재 계정은 온보딩 대상 판정', async () => {
    // 1) 신규 가입 계정: 프로필 미존재 -> 온보딩 대상 (profile === null)
    await registerUserLocal('newUser', 'pw123', '신규유저');
    const profile1 = loadUserProfile('newUser');
    expect(profile1).toBeNull();

    // 2) 온보딩 완료 후 프로필 저장 -> 이후 로그인 시 프로필 즉시 로드 (온보딩 불필요)
    saveUserProfile('newUser', { ...DEFAULT_PROFILE, nickname: '신규유저' });
    const profile2 = loadUserProfile('newUser');
    expect(profile2).not.toBeNull();
    expect(profile2?.nickname).toBe('신규유저');
  });
});
