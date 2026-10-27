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
  const [session, setSession] = useState<UserSession | null>(null);
  const [profile, setProfileState] = useState<Profile | null>(null);

  const [selectedDate, setSelectedDate] = useState<string>(() => toLocalDateKey());
  const [foods, setFoods] = useState<FoodEntry[]>([]);
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [steps, setStepsState] = useState<number>(0);
  const [waterMl, setWaterMl] = useState<number>(0);

  // 진행 중인 비동기/타이머 작업 차단을 위한 Ref
  const isLoggingOutRef = useRef(false);

  // 1. 초기 마운트 시 세션 및 로컬 데이터 복원 (SSR Hydration 방어)
  useEffect(() => {
    const savedSession = getSavedSession();
    if (savedSession) {
      setSession(savedSession);
      const loadedProfile = loadUserProfile(savedSession.userId);
      setProfileState(loadedProfile);
    }
    const today = toLocalDateKey();
    setSelectedDate(today);
    setHydrated(true);
  }, []);

  // 2. 날짜나 세션이 변경될 때 해당 계정의 일일 로그 및 최근 체중 로드
  useEffect(() => {
    if (!hydrated || isLoggingOutRef.current) return;

    if (!session) {
      setFoods([]);
      setExercises([]);
      setWeights([]);
      setStepsState(0);
      setWaterMl(0);
      return;
    }

    const log = loadDailyLog(session.userId, selectedDate);
    if (log) {
      setFoods(log.foods || []);
      setExercises(log.exercises || []);
      setStepsState(safeVal(log.steps, 0));
      setWaterMl(safeVal(log.waterMl, 0));
    } else {
      setFoods([]);
      setExercises([]);
      setStepsState(0);
      setWaterMl(0);
    }

    const recentWeights = getRecentWeightLogs(session.userId, selectedDate, 14);
    setWeights(recentWeights);
  }, [hydrated, session, selectedDate]);

  // 3. 프로필 저장
  const setProfile = useCallback(
    (newProfile: Profile) => {
      if (!session || isLoggingOutRef.current) return;
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
      if (!session || isLoggingOutRef.current) return;

      const currentUid = session.userId;
      const dataToSave = {
        date: selectedDate,
        foods: newFoods,
        exercises: newExercises,
        steps: newSteps,
        waterMl: newWater,
        targetWaterMl: DEFAULT_TARGET_WATER,
        weight: currentWeightVal,
      };
      saveDailyLog(currentUid, selectedDate, dataToSave);
      syncDailyLogToGoogleSheet(currentUid, dataToSave, profile);
    },
    [session, selectedDate, profile]
  );

  // 5. 로그인 및 로그아웃 핸들러 (Race Condition 방어)
  const login = useCallback(
    (newSession: UserSession) => {
      isLoggingOutRef.current = false;
      setSession(newSession);
      setSavedSession(newSession);

      // 새 계정의 프로필 및 당일 기록 즉시 로드
      const loadedProfile = loadUserProfile(newSession.userId);
      setProfileState(loadedProfile);

      const log = loadDailyLog(newSession.userId, selectedDate);
      if (log) {
        setFoods(log.foods || []);
        setExercises(log.exercises || []);
        setStepsState(safeVal(log.steps, 0));
        setWaterMl(safeVal(log.waterMl, 0));
      } else {
        setFoods([]);
        setExercises([]);
        setStepsState(0);
        setWaterMl(0);
      }

      const recentWeights = getRecentWeightLogs(newSession.userId, selectedDate, 14);
      setWeights(recentWeights);
    },
    [selectedDate]
  );

  const logout = useCallback(() => {
    isLoggingOutRef.current = true;
    setSavedSession(null);
    setSession(null);
    setProfileState(null);
    setFoods([]);
    setExercises([]);
    setWeights([]);
    setStepsState(0);
    setWaterMl(0);
    setTimeout(() => {
      isLoggingOutRef.current = false;
    }, 50);
  }, []);

  // 6. 식단 액션 (추가, 삭제, 수량 증감)
  const addFood = useCallback(
    (f: Omit<FoodEntry, 'id'>) => {
      const newEntry: FoodEntry = { ...f, id: uid() };
      const updated = [...foods, newEntry];
      setFoods(updated);
      persistDailyData(updated, exercises, steps, waterMl);
    },
    [foods, exercises, steps, waterMl, persistDailyData]
  );

  const removeFood = useCallback(
    (id: string) => {
      const updated = foods.filter((f) => f.id !== id);
      setFoods(updated);
      persistDailyData(updated, exercises, steps, waterMl);
    },
    [foods, exercises, steps, waterMl, persistDailyData]
  );

  const updateFoodQty = useCallback(
    (id: string, delta: number) => {
      const updated = foods
        .map((f) => {
          if (f.id === id) {
            const nextQty = Math.max(0, f.qty + delta);
            return { ...f, qty: nextQty };
          }
          return f;
        })
        .filter((f) => f.qty > 0); // 수량이 0이 되면 자동 삭제
      setFoods(updated);
      persistDailyData(updated, exercises, steps, waterMl);
    },
    [foods, exercises, steps, waterMl, persistDailyData]
  );

  // 7. 운동 액션 (추가, 삭제)
  const addExercise = useCallback(
    (e: Omit<ExerciseEntry, 'id'>) => {
      const newEntry: ExerciseEntry = { ...e, id: uid() };
      const updated = [...exercises, newEntry];
      setExercises(updated);
      persistDailyData(foods, updated, steps, waterMl);
    },
    [foods, exercises, steps, waterMl, persistDailyData]
  );

  const removeExercise = useCallback(
    (id: string) => {
      const updated = exercises.filter((e) => e.id !== id);
      setExercises(updated);
      persistDailyData(foods, updated, steps, waterMl);
    },
    [foods, exercises, steps, waterMl, persistDailyData]
  );

  // 8. 걸음 수 액션
  const setSteps = useCallback(
    (newSteps: number) => {
      const safeNum = Math.max(0, safeVal(newSteps, 0));
      setStepsState(safeNum);
      persistDailyData(foods, exercises, safeNum, waterMl);
    },
    [foods, exercises, waterMl, persistDailyData]
  );

  // 9. 수분 섭취 액션
  const addWater = useCallback(
    (amount: number) => {
      const updated = Math.max(0, waterMl + safeVal(amount, 0));
      setWaterMl(updated);
      persistDailyData(foods, exercises, steps, updated);
    },
    [foods, exercises, steps, waterMl, persistDailyData]
  );

  const resetWater = useCallback(() => {
    setWaterMl(0);
    persistDailyData(foods, exercises, steps, 0);
  }, [foods, exercises, steps, persistDailyData]);

  // 10. 체중 기록 액션
  const setWeight = useCallback(
    (date: string, weight: number) => {
      if (!session || isLoggingOutRef.current) return;
      const currentUid = session.userId;
      const validWeight = Math.round(safeVal(weight, 70) * 10) / 10;
      setWeights((prev) => {
        const filtered = prev.filter((w) => w.date !== date);
        return [...filtered, { date, weight: validWeight }].sort((a, b) => a.date.localeCompare(b.date));
      });

      // 일일 데이터에도 체중 저장
      const curLog = loadDailyLog(currentUid, date);
      const updatedLog = {
        date,
        foods: curLog?.foods || (date === selectedDate ? foods : []),
        exercises: curLog?.exercises || (date === selectedDate ? exercises : []),
        steps: curLog?.steps ?? (date === selectedDate ? steps : 0),
        waterMl: curLog?.waterMl ?? (date === selectedDate ? waterMl : 0),
        targetWaterMl: DEFAULT_TARGET_WATER,
        weight: validWeight,
      };
      saveDailyLog(currentUid, date, updatedLog);
      syncDailyLogToGoogleSheet(currentUid, updatedLog, profile);
    },
    [session, selectedDate, foods, exercises, steps, waterMl, profile]
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
