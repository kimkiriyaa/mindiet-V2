export type PreviewStateType = 'normal' | 'empty' | 'over';

export interface FoodItemMock {
  id: string;
  name: string;
  kcal: number;
  qty: number;
  unit: string;
}

export interface MealMock {
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  label: string;
  emoji: string;
  time?: string;
  items: FoodItemMock[];
}

export interface ExerciseItemMock {
  id: string;
  name: string;
  duration: number; // minutes
  kcal: number;
}

export interface PreviewData {
  state: PreviewStateType;
  targetKcal: number;
  intakeKcal: number;
  burnedKcal: number;
  remainingKcal: number;
  netKcal: number;
  isOver: boolean;
  overKcal: number;
  intakePct: number;
  macros: {
    carb: { cur: number; goal: number };
    protein: { cur: number; goal: number };
    fat: { cur: number; goal: number };
  };
  steps: number;
  stepKcal: number;
  waterMl: number;
  targetWaterMl: number;
  currentWeight: number;
  targetWeight: number;
  weightDiff: number;
  weightHistory: { date: string; weight: number | null }[];
  meals: MealMock[];
  exercises: ExerciseItemMock[];
}

export const PREVIEW_MOCK_DATA: Record<PreviewStateType, PreviewData> = {
  // 1. 정상 기록 (1,240 kcal / 목표 1,900 kcal / 소모 180 kcal)
  normal: {
    state: 'normal',
    targetKcal: 1900,
    intakeKcal: 1240,
    burnedKcal: 180,
    remainingKcal: 660, // 1900 - 1240
    netKcal: 1060,      // 1240 - 180
    isOver: false,
    overKcal: 0,
    intakePct: Math.round((1240 / 1900) * 100), // 65%
    macros: {
      carb: { cur: 145, goal: 238 },
      protein: { cur: 85, goal: 95 },
      fat: { cur: 36, goal: 42 },
    },
    steps: 6200,
    stepKcal: 60,
    waterMl: 1200,
    targetWaterMl: 2000,
    currentWeight: 68.2,
    targetWeight: 65.0,
    weightDiff: -0.2,
    weightHistory: [
      { date: '10/14', weight: 69.1 },
      { date: '10/16', weight: 68.9 },
      { date: '10/18', weight: 68.7 },
      { date: '10/20', weight: 68.8 },
      { date: '10/22', weight: 68.5 },
      { date: '10/24', weight: 68.4 },
      { date: '10/27', weight: 68.2 },
    ],
    meals: [
      {
        type: 'breakfast',
        label: '아침',
        emoji: '🌅',
        time: '08:30',
        items: [
          { id: 'b1', name: '사과', kcal: 95, qty: 1, unit: '개' },
          { id: 'b2', name: '그릭 요거트', kcal: 120, qty: 1, unit: '컵' },
          { id: 'b3', name: '삶은 달걀', kcal: 75, qty: 1, unit: '개' },
          { id: 'b4', name: '그래놀라', kcal: 50, qty: 1, unit: '스쿱' },
        ],
      },
      {
        type: 'lunch',
        label: '점심',
        emoji: '☀️',
        time: '12:40',
        items: [
          { id: 'l1', name: '현미밥', kcal: 300, qty: 1, unit: '공기' },
          { id: 'l2', name: '닭가슴살 구이', kcal: 180, qty: 1, unit: '팩' },
          { id: 'l3', name: '방울토마토 샐러드', kcal: 100, qty: 1, unit: '그릇' },
        ],
      },
      {
        type: 'dinner',
        label: '저녁',
        emoji: '🌙',
        time: '18:50',
        items: [
          { id: 'd1', name: '소고기 샤브샤브', kcal: 250, qty: 1, unit: '인분' },
          { id: 'd2', name: '모둠 버섯 구이', kcal: 70, qty: 1, unit: '접시' },
        ],
      },
      {
        type: 'snack',
        label: '간식',
        emoji: '☕',
        time: '16:00',
        items: [],
      },
    ],
    exercises: [
      { id: 'e1', name: '빠르게 걷기', duration: 30, kcal: 120 },
    ],
  },

  // 2. 기록 없음 (빈 상태, 0 kcal)
  empty: {
    state: 'empty',
    targetKcal: 1900,
    intakeKcal: 0,
    burnedKcal: 0,
    remainingKcal: 1900,
    netKcal: 0,
    isOver: false,
    overKcal: 0,
    intakePct: 0,
    macros: {
      carb: { cur: 0, goal: 238 },
      protein: { cur: 0, goal: 95 },
      fat: { cur: 0, goal: 42 },
    },
    steps: 0,
    stepKcal: 0,
    waterMl: 0,
    targetWaterMl: 2000,
    currentWeight: 68.4,
    targetWeight: 65.0,
    weightDiff: 0,
    weightHistory: [
      { date: '10/24', weight: 68.4 },
    ],
    meals: [
      { type: 'breakfast', label: '아침', emoji: '🌅', items: [] },
      { type: 'lunch', label: '점심', emoji: '☀️', items: [] },
      { type: 'dinner', label: '저녁', emoji: '🌙', items: [] },
      { type: 'snack', label: '간식', emoji: '☕', items: [] },
    ],
    exercises: [],
  },

  // 3. 목표 초과 (2,300 kcal / 목표 1,900 kcal / 400 kcal 초과)
  over: {
    state: 'over',
    targetKcal: 1900,
    intakeKcal: 2300,
    burnedKcal: 250,
    remainingKcal: 0,
    netKcal: 2050, // 2300 - 250
    isOver: true,
    overKcal: 400, // 2300 - 1900
    intakePct: 121,
    macros: {
      carb: { cur: 290, goal: 238 },
      protein: { cur: 110, goal: 95 },
      fat: { cur: 58, goal: 42 },
    },
    steps: 8400,
    stepKcal: 90,
    waterMl: 1800,
    targetWaterMl: 2000,
    currentWeight: 68.5,
    targetWeight: 65.0,
    weightDiff: +0.3,
    weightHistory: [
      { date: '10/18', weight: 68.7 },
      { date: '10/22', weight: 68.5 },
      { date: '10/27', weight: 68.5 },
    ],
    meals: [
      {
        type: 'breakfast',
        label: '아침',
        emoji: '🌅',
        time: '08:30',
        items: [
          { id: 'b1', name: '토스트 2장 & 버터', kcal: 320, qty: 1, unit: '세트' },
          { id: 'b2', name: '라떼', kcal: 180, qty: 1, unit: '잔' },
        ],
      },
      {
        type: 'lunch',
        label: '점심',
        emoji: '☀️',
        time: '12:40',
        items: [
          { id: 'l1', name: '삼겹살 정식', kcal: 980, qty: 1, unit: '인분' },
          { id: 'l2', name: '된장찌개 & 밥', kcal: 380, qty: 1, unit: '공기' },
        ],
      },
      {
        type: 'dinner',
        label: '저녁',
        emoji: '🌙',
        time: '19:10',
        items: [
          { id: 'd1', name: '치킨 반마리', kcal: 440, qty: 0.5, unit: '마리' },
        ],
      },
      {
        type: 'snack',
        label: '간식',
        emoji: '☕',
        time: '15:30',
        items: [
          { id: 's1', name: '초콜릿 쿠키', kcal: 200, qty: 1, unit: '개' },
        ],
      },
    ],
    exercises: [
      { id: 'e1', name: '웨이트 트레이닝', duration: 45, kcal: 160 },
    ],
  },
};
