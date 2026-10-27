/**
 * 본 인증 로직은 브라우저 로컬 데이터 격리용이며, 서버 보안 인증을 대체하지 않음.
 * 
 * V1 로컬 스토리지 키 규칙(min_diet_*) 단일 기준 적용 및 안전한 영속성 관리
 * - 세션: min_diet_session
 * - 등록 계정: registered_users (salt + SHA-256 해시)
 * - 사용자 프로필: min_diet_{userId}_profile
 * - 사용자 일일 기록: min_diet_{userId}_log_{date}
 */

import {
  DEFAULT_PROFILE,
  DEFAULT_TARGET_WATER,
  type DailyLogData,
  type ExerciseEntry,
  type FoodEntry,
  type LegacyDailyLog,
  type LegacyMealItem,
  type LegacyUserProfile,
  type Profile,
  type StoredAuthUser,
  type UserSession,
  type WeightEntry,
  uid,
} from '@/lib/diet';
import { calculateAge, safeVal } from '@/lib/nutritionCalc';

const REGISTERED_USERS_KEY = 'registered_users';
const CURRENT_SESSION_KEY = 'min_diet_session';

/**
 * 환경변수 격리: 하드코딩 Fallback을 일체 두지 않고 .env의 VITE_GOOGLE_SHEET_SCRIPT_URL만 사용.
 * 값이 없으면 동기화 시도를 조용히 건너뜀(No-op).
 */
const getGoogleSheetUrl = (): string | undefined => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const url = import.meta.env['VITE_GOOGLE_SHEET_SCRIPT_URL'];
    if (typeof url === 'string' && url.trim().length > 0) {
      return url.trim();
    }
  }
  return undefined;
};

// ==========================================
// 1. 암호화 헬퍼 (salt + SHA-256 & 비-HTTPS 방어)
// ==========================================

/**
 * 비-HTTPS(crypto.subtle 미지원) 환경에서도 크래시 없이 동작하도록
 * 순수 JS 기반 SHA-256 폴백 알고리즘을 내장함.
 */
function sha256Fallback(str: string): string {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  const rotr = (n: number, x: number) => (x >>> n) | (x << (32 - n));
  const ch = (x: number, y: number, z: number) => (x & y) ^ (~x & z);
  const maj = (x: number, y: number, z: number) => (x & y) ^ (x & z) ^ (y & z);
  const sigma0 = (x: number) => rotr(2, x) ^ rotr(13, x) ^ rotr(22, x);
  const sigma1 = (x: number) => rotr(6, x) ^ rotr(11, x) ^ rotr(25, x);
  const gamma0 = (x: number) => rotr(7, x) ^ rotr(18, x) ^ (x >>> 3);
  const gamma1 = (x: number) => rotr(17, x) ^ rotr(19, x) ^ (x >>> 10);

  const utf8: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 128) utf8.push(c);
    else if (c < 2048) utf8.push((c >> 6) | 192, (c & 63) | 128);
    else if (c < 65536) utf8.push((c >> 12) | 224, ((c >> 6) & 63) | 128, (c & 63) | 128);
    else utf8.push((c >> 18) | 240, ((c >> 12) & 63) | 128, ((c >> 6) & 63) | 128, (c & 63) | 128);
  }

  const bitLength = utf8.length * 8;
  utf8.push(0x80);
  while ((utf8.length % 64) !== 56) utf8.push(0);
  for (let i = 7; i >= 0; i--) utf8.push((bitLength >>> (i * 8)) & 0xff);

  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const W = new Uint32Array(64);

  for (let i = 0; i < utf8.length; i += 64) {
    for (let t = 0; t < 16; t++) {
      const b0 = utf8[i + t * 4] ?? 0;
      const b1 = utf8[i + t * 4 + 1] ?? 0;
      const b2 = utf8[i + t * 4 + 2] ?? 0;
      const b3 = utf8[i + t * 4 + 3] ?? 0;
      W[t] = (b0 << 24) | (b1 << 16) | (b2 << 8) | b3;
    }
    for (let t = 16; t < 64; t++) {
      const wt2 = W[t - 2] ?? 0;
      const wt7 = W[t - 7] ?? 0;
      const wt15 = W[t - 15] ?? 0;
      const wt16 = W[t - 16] ?? 0;
      W[t] = (gamma1(wt2) + wt7 + gamma0(wt15) + wt16) | 0;
    }

    let a = H[0] ?? 0;
    let b = H[1] ?? 0;
    let c = H[2] ?? 0;
    let d = H[3] ?? 0;
    let e = H[4] ?? 0;
    let f = H[5] ?? 0;
    let g = H[6] ?? 0;
    let h = H[7] ?? 0;

    for (let t = 0; t < 64; t++) {
      const kt = K[t] ?? 0;
      const wt = W[t] ?? 0;
      const T1 = (h + sigma1(e) + ch(e, f, g) + kt + wt) | 0;
      const T2 = (sigma0(a) + maj(a, b, c)) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + T1) | 0;
      d = c;
      c = b;
      b = a;
      a = (T1 + T2) | 0;
    }
    H[0] = ((H[0] ?? 0) + a) | 0;
    H[1] = ((H[1] ?? 0) + b) | 0;
    H[2] = ((H[2] ?? 0) + c) | 0;
    H[3] = ((H[3] ?? 0) + d) | 0;
    H[4] = ((H[4] ?? 0) + e) | 0;
    H[5] = ((H[5] ?? 0) + f) | 0;
    H[6] = ((H[6] ?? 0) + g) | 0;
    H[7] = ((H[7] ?? 0) + h) | 0;
  }

  return Array.from(H).map((val) => (val >>> 0).toString(16).padStart(8, '0')).join('');
}

export const generateSalt = (): string => {
  if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return uid() + uid();
};

export const hashPassword = async (password: string, salt: string): Promise<string> => {
  const combined = `${salt}:${password}`;
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(combined);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // subtle 실패 시 fallback
    }
  }
  return sha256Fallback(combined);
};

// ==========================================
// 2. 키 규칙 및 세션 관리
// ==========================================

/**
 * 아이디 정규화 단일 표준:
 * normalize('NFC') -> trim() -> toLowerCase() -> encodeURIComponent()
 * - 기존 [a-z0-9_-] 조합의 영문 계정은 결과가 100% 동일하여 마이그레이션 불필요
 * - 한글, 마침표(.), 공백 등 비ASCII/특수문자 간 네임스페이스 충돌을 원천 차단
 */
export const normalizeUserId = (userId?: string): string => {
  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    return 'default';
  }
  try {
    return encodeURIComponent(userId.normalize('NFC').trim().toLowerCase());
  } catch {
    // Unpaired Surrogate (e.g. '\uD800') 등 URIError 방어
    return 'invalid_id';
  }
};

// 하위 호환성을 위해 sanitizeUserId도 normalizeUserId를 참조하도록 일원화
export const sanitizeUserId = normalizeUserId;

export const getProfileKey = (userId?: string): string => {
  return `min_diet_${normalizeUserId(userId)}_profile`;
};

export const getLogStorageKey = (date: string, userId?: string): string => {
  return `min_diet_${normalizeUserId(userId)}_log_${date}`;
};

export const getSavedSession = (): UserSession | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CURRENT_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserSession;
  } catch {
    return null;
  }
};

export const setSavedSession = (session: UserSession | null): void => {
  if (typeof window === 'undefined') return;
  try {
    if (session) {
      localStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(CURRENT_SESSION_KEY);
    }
  } catch (e) {
    console.error('Failed to set session in localStorage:', e);
  }
};

// ==========================================
// 2-1. 스토리지 로드 상태 구분 및 안전 백업 저장
// ==========================================

export type StorageLoadStatus = 'ok' | 'missing' | 'error';

export interface StorageLoadResult<T> {
  status: StorageLoadStatus;
  data: T | null;
  error?: unknown;
  rawValue?: string | null;
}

export type StorageSaveResult =
  | { ok: true }
  | { ok: false; reason: 'guard' | 'quota' | 'error'; error?: unknown };

/**
 * 손상 데이터 덮어쓰기 방지를 위한 원본 백업 저장 헬퍼
 * 백업 저장이 성공해야만 원본 변경을 허용한다.
 * 실패 시 명시적인 StorageSaveResult 객체를 반환한다.
 */
export const saveWithBackup = (key: string, value: string): StorageSaveResult => {
  if (typeof window === 'undefined') {
    return { ok: false, reason: 'error', error: new Error('window is undefined') };
  }
  const backupKey = `${key}_backup`;
  const existing = localStorage.getItem(key);

  if (existing !== null) {
    try {
      localStorage.setItem(backupKey, existing);
      const verified = localStorage.getItem(backupKey);
      if (verified !== existing) {
        throw new Error('Backup verification failed: content mismatch');
      }
    } catch (err: any) {
      console.error(`[storageService] 백업 생성 실패로 원본 보존 (key: ${key}):`, err);
      const isQuota = err?.name === 'QuotaExceededError' || err?.code === 22 || err?.number === -2147024882;
      return { ok: false, reason: isQuota ? 'quota' : 'error', error: err };
    }
  }

  try {
    localStorage.setItem(key, value);
    return { ok: true };
  } catch (err: any) {
    console.error(`[storageService] 원본 저장 실패 (key: ${key}):`, err);
    if (existing !== null) {
      try {
        localStorage.setItem(key, existing);
      } catch {
        // ignore
      }
    }
    const isQuota = err?.name === 'QuotaExceededError' || err?.code === 22 || err?.number === -2147024882;
    return { ok: false, reason: isQuota ? 'quota' : 'error', error: err };
  }
};

/**
 * 손상된 프로필 데이터를 타임스탬프 백업 키로 격리하고 원본 키를 초기화하는 복구 헬퍼
 */
export const backupAndResetCorruptedProfile = (userId: string): { ok: boolean; corruptBackupKey?: string; error?: unknown } => {
  if (typeof window === 'undefined') return { ok: false, error: new Error('window is undefined') };
  const key = getProfileKey(userId);
  try {
    const raw = localStorage.getItem(key);
    const corruptBackupKey = `${key}.corrupt_${Date.now()}`;
    if (raw !== null) {
      localStorage.setItem(corruptBackupKey, raw);
      const verified = localStorage.getItem(corruptBackupKey);
      if (verified !== raw) {
        throw new Error('Backup verification failed: content mismatch');
      }
    }
    localStorage.removeItem(key);
    return { ok: true, corruptBackupKey };
  } catch (err) {
    console.error('[storageService] 손상 프로필 격리 백업 실패:', err);
    return { ok: false, error: err };
  }
};

export const getRegisteredUsers = (): StoredAuthUser[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(REGISTERED_USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveRegisteredUsers = (users: StoredAuthUser[]): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(users));
  } catch (e) {
    console.error('Failed to save registered users in localStorage:', e);
  }
};

// ==========================================
// 3. 계정 등록 및 로그인 (보안 마이그레이션 포함)
// ==========================================

export interface AuthResult {
  success: boolean;
  message?: string;
  user?: UserSession;
}

export const registerUserLocal = async (
  userIdInput: string,
  passwordInput: string,
  userNameInput: string
): Promise<AuthResult> => {
  const trimmedId = userIdInput.trim();
  const trimmedPw = passwordInput.trim();
  const trimmedName = userNameInput.trim();

  if (!trimmedId || !trimmedPw || !trimmedName) {
    return { success: false, message: '모든 필드를 입력해 주세요.' };
  }

  // 시스템 예약어 검사: 'default' 아이디 가입 차단
  if (trimmedId.toLowerCase() === 'default') {
    return { success: false, message: '사용할 수 없는 예약된 아이디입니다.' };
  }

  const users = getRegisteredUsers();
  const exists = users.some((u) => normalizeUserId(u.userId) === normalizeUserId(trimmedId));
  if (exists) {
    return { success: false, message: '이미 존재하는 아이디입니다.' };
  }

  const salt = generateSalt();
  const passwordHash = await hashPassword(trimmedPw, salt);

  const newUser: StoredAuthUser = {
    userId: trimmedId,
    userName: trimmedName,
    salt,
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  saveRegisteredUsers([...users, newUser]);

  // Google Sheets 백그라운드 동기화 (비밀번호 필드는 전송 제외)
  syncAuthToGoogleSheet('register', {
    userId: trimmedId,
    userName: trimmedName,
  });

  return {
    success: true,
    message: '회원가입이 완료되었습니다.',
    user: { userId: trimmedId, userName: trimmedName },
  };
};

export const loginUserLocal = async (
  userIdInput: string,
  passwordInput: string
): Promise<AuthResult> => {
  const trimmedId = userIdInput.trim();
  const trimmedPw = passwordInput.trim();

  if (!trimmedId || !trimmedPw) {
    return { success: false, message: '아이디와 비밀번호를 모두 입력해 주세요.' };
  }

  const users = getRegisteredUsers();
  const index = users.findIndex((u) => normalizeUserId(u.userId) === normalizeUserId(trimmedId));
  if (index === -1) {
    return { success: false, message: '아이디 또는 비밀번호가 일치하지 않습니다.' };
  }

  const targetUser = users[index];
  if (!targetUser) {
    return { success: false, message: '사용자 정보를 찾을 수 없습니다.' };
  }

  let isPasswordValid = false;

  // 1. salt + SHA-256 저장된 경우
  if (targetUser.salt && targetUser.passwordHash) {
    const computedHash = await hashPassword(trimmedPw, targetUser.salt);
    if (computedHash === targetUser.passwordHash) {
      isPasswordValid = true;
    }
  } else if (targetUser.password) {
    // 2. V1 레거시 평문 비밀번호인 경우: 검증 후 자동 SHA-256 마이그레이션 실행
    if (targetUser.password === trimmedPw) {
      isPasswordValid = true;
      const newSalt = generateSalt();
      const newHash = await hashPassword(trimmedPw, newSalt);
      users[index] = {
        userId: targetUser.userId,
        userName: targetUser.userName,
        salt: newSalt,
        passwordHash: newHash,
        createdAt: targetUser.createdAt || new Date().toISOString(),
      };
      saveRegisteredUsers(users);
    }
  }

  if (!isPasswordValid) {
    return { success: false, message: '아이디 또는 비밀번호가 일치하지 않습니다.' };
  }

  // Google Sheets 백그라운드 동기화 (비밀번호 필드는 전송 제외)
  syncAuthToGoogleSheet('login', {
    userId: targetUser.userId,
    userName: targetUser.userName,
  });

  return {
    success: true,
    user: { userId: targetUser.userId, userName: targetUser.userName },
  };
};

// ==========================================
// 4. 프로필 로드 / 저장 및 스키마 마이그레이션
// ==========================================

export const loadUserProfileSafe = (userId?: string): StorageLoadResult<Profile> => {
  if (typeof window === 'undefined') return { status: 'missing', data: null, rawValue: null };
  const key = getProfileKey(userId);
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch (err) {
    console.error('[storageService] getItem 예외 (프로필):', err);
    return { status: 'error', data: null, error: err, rawValue: null };
  }

  if (raw === null) {
    return { status: 'missing', data: null, rawValue: null };
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { status: 'error', data: null, error: new Error('Invalid profile schema: not an object'), rawValue: raw };
    }
    const legacy = parsed as LegacyUserProfile;
    let age = parsed.age;
    if (!age && legacy.birthDate) {
      age = calculateAge(legacy.birthDate);
    }

    const profile: Profile = {
      nickname: parsed.nickname || parsed.userName || (userId || '민다이어터'),
      gender: parsed.gender === 'female' ? 'female' : 'male',
      age: safeVal(age, DEFAULT_PROFILE.age),
      height: safeVal(parsed.height, DEFAULT_PROFILE.height),
      startWeight: safeVal(parsed.startWeight || parsed.weight, DEFAULT_PROFILE.startWeight),
      targetWeight: safeVal(parsed.targetWeight, DEFAULT_PROFILE.targetWeight),
      activity: parsed.activity || (legacy.activityLevel === 'sedentary' ? 'sedentary' : legacy.activityLevel === 'light' ? 'light' : legacy.activityLevel === 'active' ? 'active' : 'moderate'),
      goal: parsed.goal || 'lose',
      dietType: parsed.dietType || 'normal',
    };
    return { status: 'ok', data: profile, rawValue: raw };
  } catch (err) {
    console.error('[storageService] JSON 파싱 손상 (프로필):', err);
    return { status: 'error', data: null, error: err, rawValue: raw };
  }
};

export const loadUserProfile = (userId?: string): Profile | null => {
  const result = loadUserProfileSafe(userId);
  return result.status === 'ok' ? result.data : null;
};

export const saveUserProfile = (userId: string, profile: Profile): StorageSaveResult => {
  if (typeof window === 'undefined') {
    return { ok: false, reason: 'error', error: new Error('window is undefined') };
  }

  const trimmedId = userId ? userId.trim() : '';
  if (!trimmedId) {
    console.warn('[storageService] saveUserProfile 차단: 유효하지 않은 userId');
    return { ok: false, reason: 'guard', error: new Error('Invalid userId') };
  }

  // [엄격 세션 일치 검증] 활성 세션이 반드시 존재하고 세션 ID 정규화 결과가 일치할 때만 저장 허용
  const currentSession = getSavedSession();
  if (!currentSession || normalizeUserId(currentSession.userId) !== normalizeUserId(trimmedId)) {
    console.warn(`[storageService] saveUserProfile 차단: 활성 세션 부재 또는 세션 불일치 (${currentSession?.userId ?? 'none'} vs ${trimmedId})`);
    return { ok: false, reason: 'guard', error: new Error('Session mismatch or absent') };
  }

  const key = getProfileKey(trimmedId);
  return saveWithBackup(key, JSON.stringify(profile));
};

// ==========================================
// 5. 일일 데이터 로드 / 저장 및 구형 식단 마이그레이션
// ==========================================

/**
 * V1 구형 MealItem(단일 calories)을 V2 FoodEntry(unitKcal, qty: 1)로 변환
 */
export const migrateLegacyMealItems = (
  meals: (FoodEntry | LegacyMealItem)[],
  date: string
): FoodEntry[] => {
  if (!Array.isArray(meals)) return [];
  return meals.map((m) => {
    // 이미 V2 FoodEntry 규격인 경우
    if ('unitKcal' in m && 'qty' in m) {
      return m as FoodEntry;
    }
    // V1 구형 MealItem인 경우 안전하게 변환
    const leg = m as LegacyMealItem;
    const cal = safeVal(leg.calories, 0);
    return {
      id: leg.id || uid(),
      date,
      meal: leg.type || 'lunch',
      name: leg.name || '식단',
      qty: 1,
      unitKcal: cal,
      unitCarb: safeVal(leg.carbs, 0),
      unitProtein: safeVal(leg.protein, 0),
      unitFat: safeVal(leg.fat, 0),
    };
  });
};

export const loadDailyLogSafe = (userId: string, date: string): StorageLoadResult<DailyLogData> => {
  if (typeof window === 'undefined') return { status: 'missing', data: null, rawValue: null };
  const key = getLogStorageKey(date, userId);
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch (err) {
    console.error('[storageService] getItem 예외 (일일 로그):', err);
    return { status: 'error', data: null, error: err, rawValue: null };
  }

  if (raw === null) {
    return { status: 'missing', data: null, rawValue: null };
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { status: 'error', data: null, error: new Error('Invalid daily log schema: not an object'), rawValue: raw };
    }
    const legacyLog = parsed as LegacyDailyLog;
    const foods: FoodEntry[] = Array.isArray(parsed.foods)
      ? parsed.foods
      : migrateLegacyMealItems(legacyLog.meals || [], date);

    let exercises: ExerciseEntry[] = Array.isArray(parsed.exercises) ? parsed.exercises : [];
    if (exercises.length === 0 && legacyLog.exerciseCalories && legacyLog.exerciseCalories > 0) {
      exercises = [{
        id: uid(),
        date,
        name: legacyLog.exerciseNotes || '운동',
        kcal: legacyLog.exerciseCalories,
      }];
    }

    const dailyData: DailyLogData = {
      date,
      steps: safeVal(parsed.steps, 0),
      waterMl: safeVal(parsed.waterMl ?? legacyLog.waterIntake ?? legacyLog.water, 0),
      targetWaterMl: safeVal(parsed.targetWaterMl, DEFAULT_TARGET_WATER),
      foods,
      exercises,
      weight: parsed.weight !== undefined ? safeVal(parsed.weight, 0) : undefined,
    };
    return { status: 'ok', data: dailyData, rawValue: raw };
  } catch (err) {
    console.error('[storageService] JSON 파싱 손상 (일일 로그):', err);
    return { status: 'error', data: null, error: err, rawValue: raw };
  }
};

export const loadDailyLog = (userId: string, date: string): DailyLogData | null => {
  const result = loadDailyLogSafe(userId, date);
  return result.status === 'ok' ? result.data : null;
};

export const saveDailyLog = (userId: string, date: string, data: DailyLogData): StorageSaveResult => {
  if (typeof window === 'undefined') {
    return { ok: false, reason: 'error', error: new Error('window is undefined') };
  }

  const trimmedId = userId ? userId.trim() : '';
  if (!trimmedId) {
    console.warn('[storageService] saveDailyLog 차단: 유효하지 않은 userId');
    return { ok: false, reason: 'guard', error: new Error('Invalid userId') };
  }

  // [엄격 세션 일치 검증] 활성 세션이 반드시 존재하고 세션 ID 정규화 결과가 일치할 때만 저장 허용
  const currentSession = getSavedSession();
  if (!currentSession || normalizeUserId(currentSession.userId) !== normalizeUserId(trimmedId)) {
    console.warn(`[storageService] saveDailyLog 차단: 활성 세션 부재 또는 세션 불일치 (${currentSession?.userId ?? 'none'} vs ${trimmedId})`);
    return { ok: false, reason: 'guard', error: new Error('Session mismatch or absent') };
  }

  const key = getLogStorageKey(date, trimmedId);
  return saveWithBackup(key, JSON.stringify(data));
};

export const getRecentWeightLogs = (
  userId: string,
  endDate: string,
  days: number = 14
): WeightEntry[] => {
  const results: WeightEntry[] = [];
  if (typeof window === 'undefined') return results;

  const [y = 1970, m = 1, d = 1] = endDate.split('-').map(Number);
  const end = new Date(y, m - 1, d);

  for (let i = days - 1; i >= 0; i--) {
    const cur = new Date(end);
    cur.setDate(cur.getDate() - i);
    const dateStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
    const logRes = loadDailyLogSafe(userId, dateStr);
    if (logRes.status === 'ok' && logRes.data && logRes.data.weight && logRes.data.weight > 0) {
      results.push({ date: dateStr, weight: logRes.data.weight });
    } else if (logRes.status === 'error') {
      console.warn(`[storageService] 체중 조회 중 일일 로그 손상 감지 (date: ${dateStr}) - 덮어쓰지 않고 안전 스킵`);
    }
  }

  return results;
};

// ==========================================
// 6. Google Sheets 백그라운드 동기화 (fire-and-forget, 비밀번호 제외)
// ==========================================

export const syncAuthToGoogleSheet = async (
  mode: 'register' | 'login',
  user: { userId: string; userName: string }
): Promise<void> => {
  const url = getGoogleSheetUrl();
  if (!url) return; // 환경변수가 없으면 No-op 건너뜀

  try {
    // 비밀번호 필드는 절대 포함하지 않음
    const payload = {
      action: 'auth',
      mode,
      userId: user.userId,
      userName: user.userName,
      timestamp: new Date().toISOString(),
    };

    fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {
      // fire-and-forget 무시
    });
  } catch {
    // UI 블로킹 방지
  }
};

export const syncDailyLogToGoogleSheet = async (
  userId: string,
  log: DailyLogData,
  profile?: Profile | null,
  signal?: AbortSignal
): Promise<void> => {
  const url = getGoogleSheetUrl();
  if (!url) return; // 환경변수가 없으면 No-op 건너뜀

  try {
    const totalIntake = log.foods.reduce((acc, f) => acc + f.unitKcal * f.qty, 0);
    const totalExercise = log.exercises.reduce((acc, e) => acc + e.kcal, 0);

    const payload = {
      action: 'saveDailyLog',
      userId,
      date: log.date,
      steps: log.steps || 0,
      waterIntake: log.waterMl || 0,
      weight: log.weight || (profile?.startWeight ?? 0),
      totalIntakeKcal: Math.round(totalIntake),
      exerciseKcal: Math.round(totalExercise),
      meals: log.foods.map((f) => ({
        id: f.id,
        type: f.meal,
        name: f.name,
        qty: f.qty,
        calories: Math.round(f.unitKcal * f.qty),
        carbs: Math.round(f.unitCarb * f.qty),
        protein: Math.round(f.unitProtein * f.qty),
        fat: Math.round(f.unitFat * f.qty),
      })),
      timestamp: new Date().toISOString(),
    };

    fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: signal ?? null,
    }).catch(() => {
      // fire-and-forget 무시
    });
  } catch {
    // UI 블로킹 방지
  }
};
