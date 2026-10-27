import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { DietProvider, useDiet } from '@/context/DietContext';
import {
  loadUserProfileSafe,
  loadDailyLogSafe,
  saveWithBackup,
  saveUserProfile,
  saveDailyLog,
  setSavedSession,
  getProfileKey,
  getLogStorageKey,
  backupAndResetCorruptedProfile,
} from '@/services/storageService';
import { DEFAULT_PROFILE, type Profile, type DailyLogData } from '@/lib/diet';

describe('지침 12 & 13: 스토리지 저장 결과 명시화 및 로더 에러 처리 검증', () => {
  const userId = 'userSafe';
  const date = '2026-10-27';

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    setSavedSession({ userId, userName: '안전유저' });
  });

  it('1. 로드 결과 구분: 정상(ok), 데이터 없음(missing), JSON 손상(error)', () => {
    const profileKey = getProfileKey(userId);

    // 1) missing: 키가 존재하지 않을 때
    const resMissing = loadUserProfileSafe(userId);
    expect(resMissing.status).toBe('missing');
    expect(resMissing.data).toBeNull();
    expect(resMissing.rawValue).toBeNull();

    // 2) ok: 정상 데이터일 때
    const validProfile: Profile = { ...DEFAULT_PROFILE, nickname: '안전유저' };
    localStorage.setItem(profileKey, JSON.stringify(validProfile));
    const resOk = loadUserProfileSafe(userId);
    expect(resOk.status).toBe('ok');
    expect(resOk.data?.nickname).toBe('안전유저');
    expect(resOk.rawValue).toBeDefined();

    // 3) error: 손상된 JSON 문자열일 때 (신규 유저로 오판하지 않고 status: error 반환)
    localStorage.setItem(profileKey, '{ invalid_json: corrupted');
    const resError = loadUserProfileSafe(userId);
    expect(resError.status).toBe('error');
    expect(resError.data).toBeNull();
    expect(resError.error).toBeDefined();
    expect(resError.rawValue).toBe('{ invalid_json: corrupted');

    // 4) error: 객체가 아닌 배열이나 원시값일 때
    localStorage.setItem(profileKey, JSON.stringify(['corrupted', 123]));
    const resSchemaError = loadUserProfileSafe(userId);
    expect(resSchemaError.status).toBe('error');
  });

  it('2. loadDailyLogSafe 결과 구분: ok, missing, error 검증', () => {
    const logKey = getLogStorageKey(date, userId);

    // missing
    const resMissing = loadDailyLogSafe(userId, date);
    expect(resMissing.status).toBe('missing');
    expect(resMissing.rawValue).toBeNull();

    // ok
    const sampleLog: DailyLogData = {
      date,
      foods: [{ id: 'f1', date, meal: 'breakfast', name: '오트밀', qty: 1, unitKcal: 150, unitCarb: 27, unitProtein: 5, unitFat: 3 }],
      exercises: [],
    };
    localStorage.setItem(logKey, JSON.stringify(sampleLog));
    const resOk = loadDailyLogSafe(userId, date);
    expect(resOk.status).toBe('ok');
    expect(resOk.data?.foods[0]?.name).toBe('오트밀');

    // error (손상 JSON)
    localStorage.setItem(logKey, '<<<BROKEN_DATA>>>');
    const resError = loadDailyLogSafe(userId, date);
    expect(resError.status).toBe('error');
    expect(resError.rawValue).toBe('<<<BROKEN_DATA>>>');
  });

  it('3. getItem이 항상 throw해도 함수가 크래시되지 않고 { status: "error", rawValue: null } 반환 (지침 13)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage permission denied / SecurityError');
    });

    const res = loadUserProfileSafe(userId);
    expect(res.status).toBe('error');
    expect(res.data).toBeNull();
    expect(res.rawValue).toBeNull();
    expect(res.error).toBeDefined();

    const logRes = loadDailyLogSafe(userId, date);
    expect(logRes.status).toBe('error');
    expect(logRes.data).toBeNull();
    expect(logRes.rawValue).toBeNull();
  });

  it('4. saveWithBackup: 2단계 롤백 검증 (백업 단계 실패 vs 본 쓰기 단계 실패 롤백) (지침 21)', () => {
    const key = 'test_key';
    const backupKey = `${key}_backup`;

    // 1) 초기 데이터 기록
    localStorage.setItem(key, 'initial_content');

    // 2) 정상 백업 및 본 쓰기 확인
    const res = saveWithBackup(key, 'new_content');
    expect(res.ok).toBe(true);
    expect(localStorage.getItem(backupKey)).toBe('initial_content');
    expect(localStorage.getItem(key)).toBe('new_content');

    // [경로 1] 백업 쓰기(backupKey) 단계에서 QuotaExceededError 발생 -> 원본 건드리지 않고 즉시 중단
    const realSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === backupKey) {
        const err = new Error('QuotaExceededError at backup');
        err.name = 'QuotaExceededError';
        throw err;
      }
      return realSetItem.call(this, k, v);
    });

    const quotaRes1 = saveWithBackup(key, 'path1_content');
    expect(quotaRes1.ok).toBe(false);
    if (!quotaRes1.ok) {
      expect(quotaRes1.reason).toBe('quota');
    }
    // 원본 데이터가 'new_content' 그대로 온전히 유지됨
    expect(localStorage.getItem(key)).toBe('new_content');
    vi.restoreAllMocks();

    // [경로 2] 백업 쓰기는 성공했으나, 본 쓰기(key) 단계에서 QuotaExceededError 발생 -> 백업본으로 롤백 복원
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === key && v === 'path2_content') {
        const err = new Error('QuotaExceededError at primary write');
        err.name = 'QuotaExceededError';
        throw err;
      }
      return realSetItem.call(this, k, v);
    });

    const quotaRes2 = saveWithBackup(key, 'path2_content');
    expect(quotaRes2.ok).toBe(false);
    if (!quotaRes2.ok) {
      expect(quotaRes2.reason).toBe('quota');
    }
    // 롤백 복원되어 기존 원본 'new_content'가 유지됨
    expect(localStorage.getItem(key)).toBe('new_content');
    vi.restoreAllMocks();
  });

  it('5. backupAndResetCorruptedProfile: 손상 데이터 타임스탬프 격리 백업 및 초기화 검증 (지침 14)', () => {
    const profileKey = getProfileKey(userId);
    const corruptedRaw = '{"corrupted": true, broken';
    localStorage.setItem(profileKey, corruptedRaw);

    const resetRes = backupAndResetCorruptedProfile(userId);
    expect(resetRes.ok).toBe(true);
    expect(resetRes.corruptBackupKey).toBeDefined();

    // 메인 키는 삭제되어 초기화 상태가 됨
    expect(localStorage.getItem(profileKey)).toBeNull();

    // 백업 키에 원본 손상 데이터가 100% 동일하게 보존됨
    const backupContent = localStorage.getItem(resetRes.corruptBackupKey!);
    expect(backupContent).toBe(corruptedRaw);
  });

  it('6. 정상 키의 읽기/쓰기가 StorageSaveResult 형식으로 정확히 작동', () => {
    const profile: Profile = { ...DEFAULT_PROFILE, nickname: '정상작동' };
    const saveRes = saveUserProfile(userId, profile);
    expect(saveRes.ok).toBe(true);

    const loaded = loadUserProfileSafe(userId);
    expect(loaded.status).toBe('ok');
    expect(loaded.data?.nickname).toBe('정상작동');

    const dailyData: DailyLogData = {
      date,
      foods: [],
      exercises: [],
      steps: 5000,
    };
    const logSaveRes = saveDailyLog(userId, date, dailyData);
    expect(logSaveRes.ok).toBe(true);

    const loadedLog = loadDailyLogSafe(userId, date);
    expect(loadedLog.status).toBe('ok');
    expect(loadedLog.data?.steps).toBe(5000);
  });

  it('7. 특정 일자의 일일 기록이 손상되었을 때 addFood를 호출해도 기존 손상 원문이 보존되고 덮어쓰기가 차단됨 (지침 20)', async () => {
    const corruptDate = '2026-10-27';
    const logKey = getLogStorageKey(corruptDate, userId);
    const brokenJson = '<<<CRITICAL_CORRUPTED_DAILY_LOG_PAYLOAD>>>';
    localStorage.setItem(logKey, brokenJson);

    // 프로필은 정상 저장
    saveUserProfile(userId, { ...DEFAULT_PROFILE, nickname: '안전유저' });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(DietProvider, null, children);
    const { result } = renderHook(() => useDiet(), { wrapper });

    act(() => {
      result.current.login({ userId, userName: '안전유저' });
    });

    // 손상된 날짜에 식단 추가 시도
    act(() => {
      result.current.addFood({
        date: corruptDate,
        meal: 'lunch',
        name: '샐러드',
        qty: 1,
        unitKcal: 150,
        unitCarb: 10,
        unitProtein: 2,
        unitFat: 5,
      });
    });

    // 기존 손상 데이터가 덮어써지지 않고 원문 그대로 100% 보존되었음을 단언
    expect(localStorage.getItem(logKey)).toBe(brokenJson);
  });
});
