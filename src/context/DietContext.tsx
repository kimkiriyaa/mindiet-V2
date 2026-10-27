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
import {
  getRecentWeightLogs,
  getSavedSession,
  loadDailyLog,
  loadUserProfile,
  saveDailyLog,
  saveUserProfile,
  setSavedSession,
  syncDailyLogToGoogleSheet,
} from '@/services/storageService';

interface Ctx {
  hydrated: boolean;
  isProfileLoaded: boolean;
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
  const [session, setSession] = useState<UserSession | null>(null);
  const [profile, setProfileState] = useState<Profile | null>(null);

  const [selectedDate, setSelectedDate] = useState<string>(() => toLocalDateKey());
  const [foods, setFoods] = useState<FoodEntry[]>([]);
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [steps, setStepsState] = useState<number>(0);
  const [waterMl, setWaterMl] = useState<number>(0);

  // [Race Condition 방어] 세션 ID 일치 검증용 Ref & 비동기 취소용 AbortController Ref
  const sessionRef = useRef<UserSession | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isLoggingOutRef = useRef(false);

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

  // 컴포넌트 언마운트 시 백그라운드 요청 정리 (cleanup)
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // 1. 초기 마운트 시 세션 및 로컬 데이터 복원 (SSR Hydration 방어)
  useEffect(() => {
    const savedSession = getSavedSession();
    if (savedSession) {
      setSession(savedSession);
      sessionRef.current = savedSession;
      const loadedProfile = loadUserProfile(savedSession.userId);
      setProfileState(loadedProfile);
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

    const log = loadDailyLog(session.userId, selectedDate);
    if (log) {
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
    } else {
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
      setProfileState(newProfile);
      saveUserProfile(session.userId, newProfile);
    },
    [session]
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
      saveDailyLog(currentUid, selectedDate, dataToSave);

      // 이전 진행 중이던 비동기 동기화 취소 후 새 요청 생성
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();
      syncDailyLogToGoogleSheet(currentUid, dataToSave, profile, abortControllerRef.current.signal);
    },
    [session, selectedDate, profile]
  );

  // 5. 로그인 및 로그아웃 핸들러 (Race Condition 방어)
  const login = useCallback(
    (newSession: UserSession) => {
      isLoggingOutRef.current = false;
      sessionRef.current = newSession;
      setSession(newSession);
      setSavedSession(newSession);

      // 새 계정의 프로필 및 당일 기록 즉시 동기 로드
      setIsProfileLoaded(false);
      const loadedProfile = loadUserProfile(newSession.userId);
      setProfileState(loadedProfile);
      setIsProfileLoaded(true);

      const log = loadDailyLog(newSession.userId, selectedDate);
      if (log) {
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
      } else {
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
    [selectedDate]
  );

  const logout = useCallback(() => {
    isLoggingOutRef.current = true;
    sessionRef.current = null; // 세션 Ref 즉시 해제 (어떤 지연 저장도 발생 불가)
    abortControllerRef.current?.abort(); // 진행 중인 백그라운드 동기화 즉시 중단

    setSavedSession(null);
    setSession(null);
    setProfileState(null);
    setIsProfileLoaded(false);
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
  }, []);

  // 6. 식단 액션 (추가, 삭제, 수량 증감)
  const addFood = useCallback(
    (f: Omit<FoodEntry, 'id'>) => {
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
      const updated = foodsRef.current.filter((f) => f.id !== id);
      foodsRef.current = updated;
      setFoods(updated);
      persistDailyData(updated, exercisesRef.current, stepsRef.current, waterMlRef.current);
    },
    [persistDailyData]
  );

  const updateFoodQty = useCallback(
    (id: string, delta: number) => {
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
      const updated = Math.max(0, waterMlRef.current + safeVal(amount, 0));
      waterMlRef.current = updated;
      setWaterMl(updated);
      persistDailyData(foodsRef.current, exercisesRef.current, stepsRef.current, updated);
    },
    [persistDailyData]
  );

  const resetWater = useCallback(() => {
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
      const currentUid = session.userId;
      const validWeight = Math.round(safeVal(weight, 70) * 10) / 10;
      const updatedWeights = (() => {
        const filtered = weightsRef.current.filter((w) => w.date !== date);
        return [...filtered, { date, weight: validWeight }].sort((a, b) => a.date.localeCompare(b.date));
      })();
      weightsRef.current = updatedWeights;
      setWeights(updatedWeights);

      // 일일 데이터에도 체중 저장
      const curLog = loadDailyLog(currentUid, date);
      const updatedLog = {
        date,
        foods: curLog?.foods || (date === selectedDate ? foodsRef.current : []),
        exercises: curLog?.exercises || (date === selectedDate ? exercisesRef.current : []),
        steps: curLog?.steps ?? (date === selectedDate ? stepsRef.current : 0),
        waterMl: curLog?.waterMl ?? (date === selectedDate ? waterMlRef.current : 0),
        targetWaterMl: DEFAULT_TARGET_WATER,
        weight: validWeight,
      };
      saveDailyLog(currentUid, date, updatedLog);

      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();
      syncDailyLogToGoogleSheet(currentUid, updatedLog, profile, abortControllerRef.current.signal);
    },
    [session, selectedDate, profile]
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
