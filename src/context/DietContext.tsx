import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  calculateDailyTargetCalories,
  DEFAULT_TARGET_WATER,
  latestWeight,
  macroTargets,
  toLocalDateKey,
  uid,
  type ExerciseEntry,
  type FoodEntry,
  type Profile,
  type UserSession,
  type WeightEntry,
} from '@/lib/diet';
import { calculateStepCalories, safeVal } from '@/lib/nutritionCalc';
import { toast } from 'sonner';
import {
  backupAndResetCorruptedProfile,
  getRecentWeightLogs,
  getSavedSession,
  loadDailyLogSafe,
  loadUserProfileSafe,
  normalizeUserId,
  saveDailyLog,
  saveUserProfile,
  setSavedSession,
  syncDailyLogToGoogleSheet,
  type StorageLoadStatus,
} from '@/services/storageService';

interface Ctx {
  hydrated: boolean;
  isProfileLoaded: boolean;
  profileLoadStatus: StorageLoadStatus;
  hasStorageError: boolean;
  sessionEpoch: number;
  runWithSessionEpoch: <T>(
    asyncFn: (signal: AbortSignal) => Promise<T>,
    onSuccess: (data: T) => void,
    onError?: (err: unknown) => void
  ) => Promise<boolean>;
  recoverCorruptedProfile: () => boolean;
  session: UserSession | null;
  login: (session: UserSession) => void;
  logout: () => void;
  profile: Profile | null;
  setProfile: (p: Profile) => void;
  foods: FoodEntry[];
  addFood: (f: Omit<FoodEntry, 'id'>) => void;
  removeFood: (id: string) => void;
  updateFoodQty: (id: string, delta: number) => void;
  exercises: ExerciseEntry[];
  addExercise: (e: Omit<ExerciseEntry, 'id'>) => void;
  removeExercise: (id: string) => void;
  weights: WeightEntry[];
  setWeight: (date: string, weight: number) => void;
  steps: number;
  setSteps: (steps: number) => void;
  stepCalories: number;
  waterMl: number;
  addWater: (amount: number) => void;
  resetWater: () => void;
  targetWaterMl: number;
  selectedDate: string;
  setSelectedDate: (d: string) => void;
  currentWeight: number;
  bmr: number;
  targetKcal: number;
  macros: { carb: number; protein: number; fat: number };
}

const DietContext = createContext<Ctx | null>(null);

export function DietProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [isProfileLoaded, setIsProfileLoaded] = useState(false);
  const [profileLoadStatus, setProfileLoadStatus] = useState<StorageLoadStatus>('missing');
  const [hasStorageError, setHasStorageError] = useState(false);
  const [session, setSession] = useState<UserSession | null>(null);
  const [sessionEpoch, setSessionEpoch] = useState(1);
  const [profile, setProfileState] = useState<Profile | null>(null);

  const [selectedDate, setSelectedDate] = useState<string>(() => toLocalDateKey());
  const [corruptedDates, setCorruptedDates] = useState<Set<string>>(new Set());
  const [foods, setFoods] = useState<FoodEntry[]>([]);
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [steps, setStepsState] = useState<number>(0);
  const [waterMl, setWaterMl] = useState<number>(0);

  // [Race Condition 방어] 세션 ID 일치 검증용 Ref & 세션 에포크 Ref & 활성 비동기 AbortController 추적
  const sessionRef = useRef<UserSession | null>(null);
  const sessionEpochRef = useRef(1);
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeAbortControllersRef = useRef<Set<AbortController>>(new Set());
  const isLoggingOutRef = useRef(false);

  // 모든 활성 비동기 작업 및 백그라운드 요청 취소
  const abortAllActiveTasks = useCallback(() => {
    activeAbortControllersRef.current.forEach((controller) => {
      try {
        controller.abort();
      } catch {
        // ignore
      }
    });
    activeAbortControllersRef.current.clear();
    abortControllerRef.current?.abort();
  }, []);

  // 최신 일일 데이터 Ref (비동기 배치 및 연속 업데이트 시 상태 유실 방어)
  const foodsRef = useRef(foods);
  const exercisesRef = useRef(exercises);
  const stepsRef = useRef(steps);
  const waterMlRef = useRef(waterMl);
  const weightsRef = useRef(weights);

  useEffect(() => { foodsRef.current = foods; }, [foods]);
  useEffect(() => { exercisesRef.current = exercises; }, [exercises]);
  useEffect(() => { stepsRef.current = steps; }, [steps]);
  useEffect(() => { waterMlRef.current = waterMl; }, [waterMl]);
  useEffect(() => { weightsRef.current = weights; }, [weights]);

  // session 상태가 바뀔 때마다 sessionRef 동기화
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // 컴포넌트 언마운트 시 활성 비동기 요청 일괄 정리 (cleanup)
  useEffect(() => {
    return () => {
      abortAllActiveTasks();
    };
  }, [abortAllActiveTasks]);

  // 1. 초기 마운트 시 세션 및 로컬 데이터 복원 (SSR Hydration 방어)
  useEffect(() => {
    const savedSession = getSavedSession();
    if (savedSession) {
      setSession(savedSession);
      sessionRef.current = savedSession;
      const profileResult = loadUserProfileSafe(savedSession.userId);
      setProfileLoadStatus(profileResult.status);
      if (profileResult.status === 'ok') {
        setProfileState(profileResult.data);
      } else if (profileResult.status === 'error') {
        setHasStorageError(true);
        console.error('[DietContext] 프로필 스토리지 읽기 에러 발생 - 덮어쓰기 방지 가드 가동');
      }
    }
    const today = toLocalDateKey();
    setSelectedDate(today);
    setIsProfileLoaded(true); // 프로필 스토리지 조회가 완료된 시점에 true 설정
    setHydrated(true);
  }, []);

  // 2. 날짜나 세션이 변경될 때 해당 계정의 일일 로그 및 최근 체중 로드
  useEffect(() => {
    if (!hydrated || isLoggingOutRef.current) return;

    if (!session) {
      foodsRef.current = [];
      exercisesRef.current = [];
      weightsRef.current = [];
      stepsRef.current = 0;
      waterMlRef.current = 0;
      setFoods([]);
      setExercises([]);
      setWeights([]);
      setStepsState(0);
      setWaterMl(0);
      return;
    }

    const logResult = loadDailyLogSafe(session.userId, selectedDate);
    if (logResult.status === 'ok' && logResult.data) {
      const log = logResult.data;
      const f = log.foods || [];
      const e = log.exercises || [];
      const s = safeVal(log.steps, 0);
      const w = safeVal(log.waterMl, 0);
      foodsRef.current = f;
      exercisesRef.current = e;
      stepsRef.current = s;
      waterMlRef.current = w;
      setFoods(f);
      setExercises(e);
      setStepsState(s);
      setWaterMl(w);
      setCorruptedDates((prev) => {
        if (!prev.has(selectedDate)) return prev;
        const next = new Set(prev);
        next.delete(selectedDate);
        return next;
      });
    } else if (logResult.status === 'error') {
      console.error(`[DietContext] 일일 로그(${selectedDate}) 스토리지 읽기 에러 발생 - 해당 일자 자동 저장 차단 가드 가동`);
      toast.error(`${selectedDate} 일일 기록 데이터 손상이 감지되어 해당 일자의 자동 저장이 차단되었습니다.`);
      setCorruptedDates((prev) => new Set(prev).add(selectedDate));
    } else {
      setCorruptedDates((prev) => {
        if (!prev.has(selectedDate)) return prev;
        const next = new Set(prev);
        next.delete(selectedDate);
        return next;
      });
      foodsRef.current = [];
      exercisesRef.current = [];
      stepsRef.current = 0;
      waterMlRef.current = 0;
      setFoods([]);
      setExercises([]);
      setStepsState(0);
      setWaterMl(0);
    }

    const recentWeights = getRecentWeightLogs(session.userId, selectedDate, 14);
    weightsRef.current = recentWeights;
    setWeights(recentWeights);
  }, [hydrated, session, selectedDate]);

  // 3. 프로필 저장
  const setProfile = useCallback(
    (newProfile: Profile) => {
      if (!session || !sessionRef.current || session.userId !== sessionRef.current.userId || isLoggingOutRef.current) {
        return;
      }
      if (hasStorageError) {
        console.warn('[DietContext] 스토리지 읽기 에러 상태이므로 기존 데이터 손상 방지를 위해 저장을 차단합니다.');
        return;
      }
      setProfileState(newProfile);
      const res = saveUserProfile(session.userId, newProfile);
      if (!res.ok) {
        if (res.reason === 'quota') {
          toast.error('저장 공간이 부족하여 프로필을 저장하지 못했습니다.');
        } else if (res.reason === 'guard') {
          toast.error('세션이 변경되었습니다. 다시 로그인해 주세요.');
        } else if (res.reason === 'error') {
          toast.error('프로필 저장 중 오류가 발생했습니다.');
        }
      }
    },
    [session, hasStorageError]
  );

  // 4. 일일 데이터 변경 시 로컬 스토리지 즉시 저장 및 Google Sheets 백그라운드 동기화 (계정 격리 보장)
  const persistDailyData = useCallback(
    (
      newFoods: FoodEntry[],
      newExercises: ExerciseEntry[],
      newSteps: number,
      newWater: number,
      currentWeightVal?: number
    ) => {
      // [Race Condition 0% 보장] 현재 세션 부재이거나 세션 불일치/로그아웃 진행 중이면 즉시 차단
      if (!session || !sessionRef.current || session.userId !== sessionRef.current.userId || isLoggingOutRef.current) {
        return;
      }

      // [특정 날짜 손상 덮어쓰기 방지 가드] 해당 날짜 데이터가 손상된 경우 덮어쓰기 차단 (다른 날짜는 영향 없음)
      if (corruptedDates.has(selectedDate)) {
        console.warn(`[DietContext] ${selectedDate} 기록이 손상 상태이므로 데이터 보호를 위해 저장을 차단합니다.`);
        toast.error(`${selectedDate} 일일 기록이 손상되어 덮어쓰기를 차단했습니다.`);
        return;
      }

      const currentUid = session.userId;
      const todayLoggedWeight = currentWeightVal ?? weightsRef.current.find((w) => w.date === selectedDate)?.weight;
      const dataToSave = {
        date: selectedDate,
        foods: newFoods,
        exercises: newExercises,
        steps: newSteps,
        waterMl: newWater,
        targetWaterMl: DEFAULT_TARGET_WATER,
        weight: todayLoggedWeight,
      };
      const res = saveDailyLog(currentUid, selectedDate, dataToSave);
      if (!res.ok) {
        if (res.reason === 'quota') {
          toast.error('저장 공간이 부족하여 기록을 저장하지 못했습니다.');
        } else if (res.reason === 'guard') {
          toast.error('세션이 변경되었습니다. 다시 로그인해 주세요.');
        } else if (res.reason === 'error') {
          toast.error('기록 저장 중 오류가 발생했습니다.');
        }
      }

      // 이전 진행 중이던 비동기 동기화 취소 후 새 요청 생성
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();
      syncDailyLogToGoogleSheet(currentUid, dataToSave, profile, abortControllerRef.current.signal);
    },
    [session, selectedDate, profile, corruptedDates]
  );

  // 5. 로그인 및 로그아웃 핸들러 (Race Condition 및 Session Epoch 갱신)
  const login = useCallback(
    (newSession: UserSession) => {
      abortAllActiveTasks(); // 진행 중이던 비동기 컨트롤러 일괄 취소
      isLoggingOutRef.current = false;
      sessionEpochRef.current += 1; // 세션 에포크 증가
      setSessionEpoch(sessionEpochRef.current);
      sessionRef.current = newSession;
      setSession(newSession);
      setSavedSession(newSession);
      setHasStorageError(false);

      // 새 계정의 프로필 및 당일 기록 즉시 동기 로드
      setIsProfileLoaded(false);
      const profileResult = loadUserProfileSafe(newSession.userId);
      setProfileLoadStatus(profileResult.status);
      if (profileResult.status === 'ok') {
        setProfileState(profileResult.data);
      } else if (profileResult.status === 'error') {
        setHasStorageError(true);
        console.error('[DietContext] 프로필 스토리지 읽기 에러 발생 - 덮어쓰기 방지 가드 가동');
      } else {
        setProfileState(null);
      }
      setIsProfileLoaded(true);

      const logResult = loadDailyLogSafe(newSession.userId, selectedDate);
      if (logResult.status === 'ok' && logResult.data) {
        const log = logResult.data;
        const f = log.foods || [];
        const e = log.exercises || [];
        const s = safeVal(log.steps, 0);
        const w = safeVal(log.waterMl, 0);
        foodsRef.current = f;
        exercisesRef.current = e;
        stepsRef.current = s;
        waterMlRef.current = w;
        setFoods(f);
        setExercises(e);
        setStepsState(s);
        setWaterMl(w);
        setCorruptedDates((prev) => {
          if (!prev.has(selectedDate)) return prev;
          const next = new Set(prev);
          next.delete(selectedDate);
          return next;
        });
      } else if (logResult.status === 'error') {
        console.error(`[DietContext] 일일 로그(${selectedDate}) 스토리지 읽기 에러 발생 - 해당 일자 자동 저장 차단 가드 가동`);
        toast.error(`${selectedDate} 일일 기록 데이터 손상이 감지되어 해당 일자의 자동 저장이 차단되었습니다.`);
        setCorruptedDates((prev) => new Set(prev).add(selectedDate));
      } else {
        setCorruptedDates((prev) => {
          if (!prev.has(selectedDate)) return prev;
          const next = new Set(prev);
          next.delete(selectedDate);
          return next;
        });
        foodsRef.current = [];
        exercisesRef.current = [];
        stepsRef.current = 0;
        waterMlRef.current = 0;
        setFoods([]);
        setExercises([]);
        setStepsState(0);
        setWaterMl(0);
      }

      const recentWeights = getRecentWeightLogs(newSession.userId, selectedDate, 14);
      weightsRef.current = recentWeights;
      setWeights(recentWeights);
    },
    [selectedDate, abortAllActiveTasks]
  );

  const logout = useCallback(() => {
    isLoggingOutRef.current = true;
    abortAllActiveTasks(); // 활성 비동기 AbortController 일괄 취소
    sessionEpochRef.current += 1; // 세션 에포크 증가 (기존 비동기 콜백 즉시 무효화)
    setSessionEpoch(sessionEpochRef.current);
    sessionRef.current = null; // 세션 Ref 즉시 해제 (어떤 지연 저장도 발생 불가)

    setSavedSession(null);
    setSession(null);
    setProfileState(null);
    setIsProfileLoaded(false);
    setProfileLoadStatus('missing');
    setHasStorageError(false);
    setCorruptedDates(new Set());
    foodsRef.current = [];
    exercisesRef.current = [];
    weightsRef.current = [];
    stepsRef.current = 0;
    waterMlRef.current = 0;
    setFoods([]);
    setExercises([]);
    setWeights([]);
    setStepsState(0);
    setWaterMl(0);
    isLoggingOutRef.current = false; // 타이머 없이 즉시 완료
  }, [abortAllActiveTasks]);

  // 5-0. 손상된 프로필 복구 (백업 후 신규 설정 진입 허용)
  const recoverCorruptedProfile = useCallback((): boolean => {
    if (!sessionRef.current) return false;
    const res = backupAndResetCorruptedProfile(sessionRef.current.userId);
    if (res.ok) {
      setHasStorageError(false);
      setProfileLoadStatus('missing');
      setProfileState(null);
      toast.success('손상된 데이터를 백업하고 초기화했습니다.');
      return true;
    }
    toast.error('손상된 데이터 백업에 실패하여 초기화를 중단했습니다.');
    return false;
  }, []);

  // 5-0-1. 비동기 작업 세션 에포크 보호 헬퍼
  const runWithSessionEpoch = useCallback(
    async <T,>(
      asyncFn: (signal: AbortSignal) => Promise<T>,
      onSuccess: (data: T) => void,
      onError?: (err: unknown) => void
    ): Promise<boolean> => {
      const startEpoch = sessionEpochRef.current;
      const currentActiveSession = getSavedSession();
      const startUid = currentActiveSession?.userId;

      if (!startUid) {
        const err = new Error('No active session at start of async operation');
        onError?.(err);
        return false;
      }

      const controller = new AbortController();
      activeAbortControllersRef.current.add(controller);

      try {
        const result = await asyncFn(controller.signal);
        activeAbortControllersRef.current.delete(controller);
        const latestSession = getSavedSession();
        // 비동기 완료 시점 및 상태 변경 직전 세션 유효성 원자적 검증
        if (
          sessionEpochRef.current !== startEpoch ||
          isLoggingOutRef.current ||
          !latestSession ||
          normalizeUserId(latestSession.userId) !== normalizeUserId(startUid)
        ) {
          console.warn('[DietContext] 세션 에포크 불일치 또는 로그아웃으로 비동기 후속 처리 취소');
          return false;
        }
        onSuccess(result);
        return true;
      } catch (err) {
        activeAbortControllersRef.current.delete(controller);
        // 이미 세션이 전환된 후의 오류는 조용히 무시 (새 세션 오염 방지)
        if (sessionEpochRef.current !== startEpoch) {
          return false;
        }
        if (onError) {
          onError(err);
        } else {
          console.error('[DietContext] runWithSessionEpoch 비동기 실패:', err);
        }
        return false;
      }
    },
    []
  );

  // 5-1. 다중 탭 세션 동기화 (다른 탭에서 세션 키 삭제/변경 시 현재 탭 상태 즉시 동기화)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'min_diet_session') {
        abortAllActiveTasks(); // 세션 변경 감지 즉시 활성 비동기 태스크 취소
        if (!e.newValue) {
          logout();
        } else {
          try {
            const nextSession = JSON.parse(e.newValue) as UserSession;
            if (nextSession && nextSession.userId !== sessionRef.current?.userId) {
              login(nextSession);
            }
          } catch {
            logout();
          }
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [logout, login, abortAllActiveTasks]);

  // 6. 식단 액션 (추가, 삭제, 수량 증감)
  const addFood = useCallback(
    (f: Omit<FoodEntry, 'id'>) => {
      if (!sessionRef.current || isLoggingOutRef.current) return;
      const newEntry: FoodEntry = { ...f, id: uid() };
      const updated = [...foodsRef.current, newEntry];
      foodsRef.current = updated;
      setFoods(updated);
      persistDailyData(updated, exercisesRef.current, stepsRef.current, waterMlRef.current);
    },
    [persistDailyData]
  );

  const removeFood = useCallback(
    (id: string) => {
      if (!sessionRef.current || isLoggingOutRef.current) return;
      const updated = foodsRef.current.filter((f) => f.id !== id);
      foodsRef.current = updated;
      setFoods(updated);
      persistDailyData(updated, exercisesRef.current, stepsRef.current, waterMlRef.current);
    },
    [persistDailyData]
  );

  const updateFoodQty = useCallback(
    (id: string, delta: number) => {
      if (!sessionRef.current || isLoggingOutRef.current) return;
      const updated = foodsRef.current
        .map((f) => {
          if (f.id === id) {
            const nextQty = Math.round(Math.max(0, f.qty + delta) * 100) / 100;
            return { ...f, qty: nextQty };
          }
          return f;
        })
        .filter((f) => f.qty > 0); // 수량이 0이 되면 자동 삭제
      foodsRef.current = updated;
      setFoods(updated);
      persistDailyData(updated, exercisesRef.current, stepsRef.current, waterMlRef.current);
    },
    [persistDailyData]
  );

  // 7. 운동 액션 (추가, 삭제)
  const addExercise = useCallback(
    (e: Omit<ExerciseEntry, 'id'>) => {
      if (!sessionRef.current || isLoggingOutRef.current) return;
      const newEntry: ExerciseEntry = { ...e, id: uid() };
      const updated = [...exercisesRef.current, newEntry];
      exercisesRef.current = updated;
      setExercises(updated);
      persistDailyData(foodsRef.current, updated, stepsRef.current, waterMlRef.current);
    },
    [persistDailyData]
  );

  const removeExercise = useCallback(
    (id: string) => {
      if (!sessionRef.current || isLoggingOutRef.current) return;
      const updated = exercisesRef.current.filter((e) => e.id !== id);
      exercisesRef.current = updated;
      setExercises(updated);
      persistDailyData(foodsRef.current, updated, stepsRef.current, waterMlRef.current);
    },
    [persistDailyData]
  );

  // 8. 걸음 수 액션
  const setSteps = useCallback(
    (newSteps: number) => {
      if (!sessionRef.current || isLoggingOutRef.current) return;
      const safeNum = Math.max(0, safeVal(newSteps, 0));
      stepsRef.current = safeNum;
      setStepsState(safeNum);
      persistDailyData(foodsRef.current, exercisesRef.current, safeNum, waterMlRef.current);
    },
    [persistDailyData]
  );

  // 9. 수분 섭취 액션
  const addWater = useCallback(
    (amount: number) => {
      if (!sessionRef.current || isLoggingOutRef.current) return;
      const updated = Math.max(0, waterMlRef.current + safeVal(amount, 0));
      waterMlRef.current = updated;
      setWaterMl(updated);
      persistDailyData(foodsRef.current, exercisesRef.current, stepsRef.current, updated);
    },
    [persistDailyData]
  );

  const resetWater = useCallback(() => {
    if (!sessionRef.current || isLoggingOutRef.current) return;
    waterMlRef.current = 0;
    setWaterMl(0);
    persistDailyData(foodsRef.current, exercisesRef.current, stepsRef.current, 0);
  }, [persistDailyData]);

  // 10. 체중 기록 액션
  const setWeight = useCallback(
    (date: string, weight: number) => {
      if (!session || !sessionRef.current || session.userId !== sessionRef.current.userId || isLoggingOutRef.current) {
        return;
      }
      if (hasStorageError) {
        console.warn('[DietContext] 스토리지 읽기 에러 상태이므로 기존 데이터 손상 방지를 위해 저장을 차단합니다.');
        return;
      }
      if (corruptedDates.has(date)) {
        console.warn(`[DietContext] ${date} 기록이 손상 상태이므로 체중 저장을 차단합니다.`);
        toast.error(`${date} 일일 기록이 손상되어 체중 저장을 차단했습니다.`);
        return;
      }
      const currentUid = session.userId;
      const validWeight = Math.round(safeVal(weight, 70) * 10) / 10;
      const updatedWeights = (() => {
        const filtered = weightsRef.current.filter((w) => w.date !== date);
        return [...filtered, { date, weight: validWeight }].sort((a, b) => a.date.localeCompare(b.date));
      })();
      weightsRef.current = updatedWeights;
      setWeights(updatedWeights);

      // 일일 데이터에도 체중 저장
      const curLogRes = loadDailyLogSafe(currentUid, date);
      const curLog = curLogRes.status === 'ok' ? curLogRes.data : null;
      const updatedLog = {
        date,
        foods: curLog?.foods || (date === selectedDate ? foodsRef.current : []),
        exercises: curLog?.exercises || (date === selectedDate ? exercisesRef.current : []),
        steps: curLog?.steps ?? (date === selectedDate ? stepsRef.current : 0),
        waterMl: curLog?.waterMl ?? (date === selectedDate ? waterMlRef.current : 0),
        targetWaterMl: DEFAULT_TARGET_WATER,
        weight: validWeight,
      };
      const res = saveDailyLog(currentUid, date, updatedLog);
      if (!res.ok) {
        if (res.reason === 'quota') {
          toast.error('저장 공간이 부족하여 체중 기록을 저장하지 못했습니다.');
        } else if (res.reason === 'guard') {
          toast.error('세션이 변경되었습니다. 다시 로그인해 주세요.');
        } else if (res.reason === 'error') {
          toast.error('체중 기록 저장 중 오류가 발생했습니다.');
        }
      }

      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();
      syncDailyLogToGoogleSheet(currentUid, updatedLog, profile, abortControllerRef.current.signal);
    },
    [session, selectedDate, profile, hasStorageError]
  );

  // 11. 계산 프로퍼티 도출 (BMR, 일일 목표, 탄단지, 걸음 소모량)
  const currentWeight = useMemo(() => {
    return profile ? latestWeight(profile, weights, selectedDate) : 70;
  }, [profile, weights, selectedDate]);

  const { bmr, target: targetKcal } = useMemo(() => {
    return profile
      ? calculateDailyTargetCalories(profile, currentWeight)
      : { bmr: 0, target: 0 };
  }, [profile, currentWeight]);

  const macros = useMemo(() => {
    return profile ? macroTargets(targetKcal, profile.dietType) : { carb: 0, protein: 0, fat: 0 };
  }, [profile, targetKcal]);

  const stepCalories = useMemo(() => {
    return calculateStepCalories(steps, currentWeight);
  }, [steps, currentWeight]);

  const value = useMemo<Ctx>(() => {
    return {
      hydrated,
      isProfileLoaded,
      profileLoadStatus,
      hasStorageError,
      sessionEpoch,
      runWithSessionEpoch,
      recoverCorruptedProfile,
      session,
      login,
      logout,
      profile,
      setProfile,
      foods,
      addFood,
      removeFood,
      updateFoodQty,
      exercises,
      addExercise,
      removeExercise,
      weights,
      setWeight,
      steps,
      setSteps,
      stepCalories,
      waterMl,
      addWater,
      resetWater,
      targetWaterMl: DEFAULT_TARGET_WATER,
      selectedDate,
      setSelectedDate,
      currentWeight,
      bmr,
      targetKcal,
      macros,
    };
  }, [
    hydrated,
    isProfileLoaded,
    profileLoadStatus,
    hasStorageError,
    sessionEpoch,
    runWithSessionEpoch,
    recoverCorruptedProfile,
    session,
    login,
    logout,
    profile,
    setProfile,
    foods,
    addFood,
    removeFood,
    updateFoodQty,
    exercises,
    addExercise,
    removeExercise,
    weights,
    setWeight,
    steps,
    setSteps,
    stepCalories,
    waterMl,
    addWater,
    resetWater,
    selectedDate,
    currentWeight,
    bmr,
    targetKcal,
    macros,
  ]);

  return <DietContext.Provider value={value}>{children}</DietContext.Provider>;
}

export function useDiet() {
  const c = useContext(DietContext);
  if (!c) throw new Error('useDiet must be inside DietProvider');
  return c;
}
