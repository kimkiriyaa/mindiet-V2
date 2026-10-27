/**
 * 영양 및 신체 활동 계산 무결성 헬퍼 유틸리티
 */

/**
 * 안전한 정수 변환 헬퍼 (NaN 및 음수/무한대 원천 방어)
 */
export const safeVal = (v: unknown, fallback = 0): number => {
  if (typeof v === 'number' && Number.isFinite(v) && !Number.isNaN(v)) {
    return v;
  }
  const parsed = Number(v);
  return Number.isFinite(parsed) && !Number.isNaN(parsed) ? parsed : fallback;
};

/**
 * 체중과 걸음 수를 기반으로 소모 칼로리를 연산하는 공식
 * V1 공식: steps * 0.0005 * weight * 1.036
 */
export const calculateStepCalories = (steps: number = 0, weight: number = 65): number => {
  const safeSteps = Math.max(0, safeVal(steps, 0));
  const safeWeight = safeVal(weight, 65) > 0 ? safeVal(weight, 65) : 65;
  if (safeSteps <= 0) return 0;
  const burned = Math.round(safeSteps * 0.0005 * safeWeight * 1.036);
  return safeVal(burned, 0);
};

/**
 * 생년월일(YYYY-MM-DD) 기준 만 나이 계산
 * V1의 생년월일 데이터를 V2의 만 나이(age)로 1회 마이그레이션할 때 활용
 */
export const calculateAge = (birthDateStr?: string): number => {
  if (!birthDateStr) return 30;
  const birthDate = new Date(birthDateStr);
  if (Number.isNaN(birthDate.getTime())) return 30;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return Math.max(1, age);
};

export interface BMIResult {
  bmi: number;
  status: '저체중' | '정상' | '과체중' | '비만';
  color: string;
}

/**
 * BMI(체질량 지수) 계산
 * BMI = 체중(kg) / (신장(m) * 신장(m))
 */
export const calculateBMI = (heightCm: number, weightKg: number): BMIResult => {
  const safeHeight = safeVal(heightCm, 0);
  const safeWeight = safeVal(weightKg, 0);

  if (safeHeight <= 0 || safeWeight <= 0) {
    return { bmi: 0, status: '정상', color: 'text-muted-foreground' };
  }
  const heightM = safeHeight / 100;
  const bmiRaw = safeWeight / (heightM * heightM);
  const bmi = Number.isFinite(bmiRaw) ? Number(bmiRaw.toFixed(1)) : 0;

  if (bmi < 18.5) {
    return { bmi, status: '저체중', color: 'text-sky-500' };
  }
  if (bmi < 23) {
    return { bmi, status: '정상', color: 'text-primary' };
  }
  if (bmi < 25) {
    return { bmi, status: '과체중', color: 'text-warning' };
  }
  return { bmi, status: '비만', color: 'text-destructive' };
};
