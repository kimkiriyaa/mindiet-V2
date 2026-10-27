import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeUserId,
  getProfileKey,
  getLogStorageKey,
  registerUserLocal,
  saveUserProfile,
  loadUserProfileSafe,
  setSavedSession,
} from '@/services/storageService';
import { DEFAULT_PROFILE } from '@/lib/diet';

describe('지침 11: 아이디 정규화 일원화 및 키 충돌 원천 차단 검증', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('1. 비ASCII(한글) 계정 키 격리: "민수" vs "다영" 충돌 완벽 방지', async () => {
    const id1 = '민수';
    const id2 = '다영';

    const safe1 = normalizeUserId(id1);
    const safe2 = normalizeUserId(id2);

    expect(safe1).toBe(encodeURIComponent('민수'));
    expect(safe2).toBe(encodeURIComponent('다영'));
    expect(safe1).not.toBe(safe2);

    const keyProfile1 = getProfileKey(id1);
    const keyProfile2 = getProfileKey(id2);

    expect(keyProfile1).toBe(`min_diet_${encodeURIComponent('민수')}_profile`);
    expect(keyProfile2).toBe(`min_diet_${encodeURIComponent('다영')}_profile`);
    expect(keyProfile1).not.toBe(keyProfile2);

    const keyLog1 = getLogStorageKey('2026-10-27', id1);
    const keyLog2 = getLogStorageKey('2026-10-27', id2);
    expect(keyLog1).not.toBe(keyLog2);

    // 실제 데이터 분리 저장 및 상호 간섭 불가 검증
    setSavedSession({ userId: id1, userName: '민수' });
    saveUserProfile(id1, { ...DEFAULT_PROFILE, nickname: '민수프로필' });

    setSavedSession({ userId: id2, userName: '다영' });
    saveUserProfile(id2, { ...DEFAULT_PROFILE, nickname: '다영프로필' });

    const load1 = loadUserProfileSafe(id1);
    const load2 = loadUserProfileSafe(id2);
    expect(load1.data?.nickname).toBe('민수프로필');
    expect(load2.data?.nickname).toBe('다영프로필');
  });

  it('2. 특수문자/구분자 계정 키 격리: "a.b" vs "a_b" 충돌 완벽 방지', async () => {
    const id1 = 'a.b';
    const id2 = 'a_b';

    const safe1 = normalizeUserId(id1);
    const safe2 = normalizeUserId(id2);

    expect(safe1).toBe('a.b');
    expect(safe2).toBe('a_b');
    expect(safe1).not.toBe(safe2);

    const key1 = getProfileKey(id1);
    const key2 = getProfileKey(id2);

    expect(key1).toBe('min_diet_a.b_profile');
    expect(key2).toBe('min_diet_a_b_profile');
    expect(key1).not.toBe(key2);

    setSavedSession({ userId: id1, userName: 'A.B' });
    saveUserProfile(id1, { ...DEFAULT_PROFILE, nickname: '점 계정' });

    setSavedSession({ userId: id2, userName: 'A_B' });
    saveUserProfile(id2, { ...DEFAULT_PROFILE, nickname: '언더바 계정' });

    expect(loadUserProfileSafe(id1).data?.nickname).toBe('점 계정');
    expect(loadUserProfileSafe(id2).data?.nickname).toBe('언더바 계정');
  });

  it('3. 기존 [a-z0-9_-] 표준 영문 계정의 100% 하위 호환성 유지 (마이그레이션 불필요)', () => {
    expect(normalizeUserId('user_123')).toBe('user_123');
    expect(normalizeUserId('diet-master_99')).toBe('diet-master_99');
    expect(getProfileKey('user_123')).toBe('min_diet_user_123_profile');
  });

  it('4. 단일 정규화 함수 일원화: 회원가입 중복 체크 및 세션 가드 일치 검증', async () => {
    const res1 = await registerUserLocal('Minsu ', 'pw123', '민수1');
    expect(res1.success).toBe(true);

    // 공백 및 대소문자 차이가 있어도 정규화 일원화로 중복 차단
    const res2 = await registerUserLocal(' minsu', 'pw456', '민수2');
    expect(res2.success).toBe(false);
    expect(res2.message).toBe('이미 존재하는 아이디입니다.');
  });

  it('5. 짝이 맞지 않는 유니코드 서로게이트(Unpaired Surrogate) URIError 방어 (지침 25)', () => {
    // 단독 상위 서로게이트: encodeURIComponent 호출 시 URIError 발생 문자열
    const unpairedSurrogate = '\uD800';
    let result = '';
    expect(() => {
      result = normalizeUserId(unpairedSurrogate);
    }).not.toThrow();
    expect(result).toBe('invalid_id');
  });

  it('6. 시스템 예약어 "default" 계정 회원가입 명시적 거부 (지침 25)', async () => {
    const res = await registerUserLocal('default', 'pw123', '기본사용자');
    expect(res.success).toBe(false);
    expect(res.message).toBe('사용할 수 없는 예약된 아이디입니다.');

    const resCaps = await registerUserLocal('DEFAULT', 'pw123', '기본사용자2');
    expect(resCaps.success).toBe(false);
    expect(resCaps.message).toBe('사용할 수 없는 예약된 아이디입니다.');
  });
});
