/**
 * 로컬 영양 성분 및 운동 공식 데이터베이스 (V1 로직 이식)
 */

export interface CommonFoodItem {
  name: string;
  unit: string;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
}

export const COMMON_FOODS: Record<string, CommonFoodItem> = {
  // 밥 및 탄수화물
  '밥': { calories: 300, carbs: 65, protein: 5, fat: 1, name: '공기밥', unit: '공기' },
  '공기밥': { calories: 300, carbs: 65, protein: 5, fat: 1, name: '공기밥', unit: '공기' },
  '백미': { calories: 300, carbs: 65, protein: 5, fat: 1, name: '공기밥(백미 200g)', unit: '공기' },
  '현미밥': { calories: 280, carbs: 60, protein: 6, fat: 1, name: '현미밥', unit: '공기' },
  '잡곡밥': { calories: 285, carbs: 62, protein: 6, fat: 1, name: '잡곡밥', unit: '공기' },
  '볶음밥': { calories: 520, carbs: 70, protein: 12, fat: 20, name: '볶음밥', unit: '인분' },
  '김치볶음밥': { calories: 480, carbs: 68, protein: 11, fat: 16, name: '김치볶음밥', unit: '인분' },
  '고구마': { calories: 140, carbs: 32, protein: 2, fat: 0, name: '찐고구마(120g)', unit: '개' },
  '감자': { calories: 110, carbs: 26, protein: 2, fat: 0, name: '삶은 감자', unit: '개' },
  '식빵': { calories: 75, carbs: 14, protein: 2.5, fat: 1, name: '식빵', unit: '쪽' },
  '베이글': { calories: 280, carbs: 56, protein: 11, fat: 2, name: '플레인 베이글', unit: '개' },
  '오트밀': { calories: 150, carbs: 27, protein: 5, fat: 3, name: '오트밀(40g)', unit: '그릇' },

  // 단백질 및 육류
  '닭가슴살': { calories: 130, carbs: 0, protein: 26, fat: 2, name: '닭가슴살 100g', unit: '팩' },
  '삶은계란': { calories: 75, carbs: 1, protein: 6, fat: 5, name: '삶은 달걀', unit: '개' },
  '계란': { calories: 75, carbs: 1, protein: 6, fat: 5, name: '달걀', unit: '개' },
  '달걀': { calories: 75, carbs: 1, protein: 6, fat: 5, name: '달걀', unit: '개' },
  '계란후라이': { calories: 100, carbs: 1, protein: 6, fat: 8, name: '계란후라이', unit: '개' },
  '두부': { calories: 85, carbs: 2, protein: 9, fat: 4, name: '두부(100g)', unit: '모' },
  '삼겹살': { calories: 550, carbs: 0, protein: 25, fat: 48, name: '삼겹살 200g', unit: '인분' },
  '목살': { calories: 420, carbs: 0, protein: 35, fat: 30, name: '돼지 목살 200g', unit: '인분' },
  '소고기': { calories: 350, carbs: 0, protein: 38, fat: 20, name: '소고기 등심 150g', unit: '인분' },
  '제육볶음': { calories: 480, carbs: 18, protein: 28, fat: 32, name: '제육볶음', unit: '인분' },
  '불고기': { calories: 380, carbs: 20, protein: 28, fat: 20, name: '소불고기', unit: '인분' },
  '돈까스': { calories: 650, carbs: 50, protein: 28, fat: 38, name: '돈까스', unit: '인분' },
  '치킨': { calories: 320, carbs: 10, protein: 25, fat: 20, name: '후라이드 치킨', unit: '조각' },
  '연어': { calories: 220, carbs: 0, protein: 22, fat: 14, name: '연어 구이 1토막(120g)', unit: '토막' },
  '고등어': { calories: 250, carbs: 0, protein: 20, fat: 18, name: '고등어 구이 1토막', unit: '토막' },

  // 다이어트 / 보충식
  '프로틴': { calories: 120, carbs: 3, protein: 24, fat: 1, name: '단백질 쉐이크', unit: '잔' },
  '단백질쉐이크': { calories: 120, carbs: 3, protein: 24, fat: 1, name: '단백질 쉐이크', unit: '잔' },
  '그릭요거트': { calories: 100, carbs: 4, protein: 10, fat: 5, name: '그릭요거트 100g', unit: '개' },
  '요거트': { calories: 90, carbs: 12, protein: 4, fat: 3, name: '플레인 요거트', unit: '개' },
  '샐러드': { calories: 180, carbs: 15, protein: 5, fat: 11, name: '기본 샐러드', unit: '그릇' },
  '닭가슴살샐러드': { calories: 280, carbs: 15, protein: 28, fat: 12, name: '닭가슴살 샐러드', unit: '그릇' },
  '서브웨이': { calories: 380, carbs: 45, protein: 25, fat: 10, name: '서브웨이 샌드위치 15cm', unit: '개' },

  // 과일 및 간식
  '바나나': { calories: 105, carbs: 27, protein: 1, fat: 0, name: '바나나', unit: '개' },
  '사과': { calories: 95, carbs: 25, protein: 0, fat: 0, name: '사과', unit: '개' },
  '토마토': { calories: 25, carbs: 5, protein: 1, fat: 0, name: '토마토', unit: '개' },
  '방울토마토': { calories: 3.5, carbs: 0.7, protein: 0.2, fat: 0, name: '방울토마토', unit: '알' },
  '견과류': { calories: 160, carbs: 6, protein: 5, fat: 14, name: '하루견과', unit: '봉' },
  '아몬드': { calories: 8, carbs: 0.3, protein: 0.3, fat: 0.7, name: '아몬드', unit: '알' },

  // 면류 및 분식
  '라면': { calories: 500, carbs: 75, protein: 10, fat: 16, name: '라면', unit: '봉지' },
  '신라면': { calories: 500, carbs: 75, protein: 10, fat: 16, name: '신라면', unit: '봉지' },
  '짜파게티': { calories: 610, carbs: 90, protein: 11, fat: 20, name: '짜파게티', unit: '봉지' },
  '떡볶이': { calories: 450, carbs: 80, protein: 8, fat: 8, name: '떡볶이', unit: '인분' },
  '김밥': { calories: 400, carbs: 60, protein: 12, fat: 11, name: '김밥', unit: '줄' },
  '참치김밥': { calories: 480, carbs: 62, protein: 16, fat: 18, name: '참치김밥', unit: '줄' },
  '만두': { calories: 70, carbs: 7, protein: 2.5, fat: 3, name: '만두', unit: '개' },
  '우동': { calories: 420, carbs: 80, protein: 10, fat: 4, name: '우동', unit: '그릇' },
  '파스타': { calories: 550, carbs: 75, protein: 18, fat: 18, name: '파스타', unit: '인분' },

  // 음료
  '아메리카노': { calories: 10, carbs: 1, protein: 1, fat: 0, name: '아메리카노', unit: '잔' },
  '카페라떼': { calories: 150, carbs: 12, protein: 8, fat: 7, name: '카페라떼', unit: '잔' },
  '라떼': { calories: 150, carbs: 12, protein: 8, fat: 7, name: '카페라떼', unit: '잔' },
  '바닐라라떼': { calories: 220, carbs: 32, protein: 7, fat: 6, name: '바닐라라떼', unit: '잔' },
  '콜라': { calories: 140, carbs: 35, protein: 0, fat: 0, name: '콜라 1캔(355ml)', unit: '캔' },
  '제로콜라': { calories: 0, carbs: 0, protein: 0, fat: 0, name: '제로콜라', unit: '캔' },
  '우유': { calories: 130, carbs: 10, protein: 6, fat: 7, name: '우유(200ml)', unit: '팩' },
};

export const COMMON_EXERCISES = [
  { keywords: ['헬스', '웨이트', '쇠질', '근력', '피트니스', '가슴', '하체', '등운동', '어깨'], met: 5.5, label: '웨이트 트레이닝' },
  { keywords: ['조깅', '러닝', '달리기', '런닝'], met: 8.0, label: '러닝/조깅' },
  { keywords: ['걷기', '산책', '걸음', '보행'], met: 3.5, label: '빠른 걷기' },
  { keywords: ['자전거', '사이클', '실내자전거'], met: 6.5, label: '사이클링' },
  { keywords: ['수영', '자유형'], met: 7.5, label: '수영' },
  { keywords: ['줄넘기'], met: 9.0, label: '줄넘기' },
  { keywords: ['계단', '천국의계단', '스텝밀'], met: 8.5, label: '계단 오르기' },
  { keywords: ['필라테스', '요가', '스트레칭'], met: 3.0, label: '필라테스/요가' },
  { keywords: ['등산', '트레킹'], met: 7.0, label: '등산' },
  { keywords: ['축구', '농구', '배드민턴', '테니스'], met: 7.0, label: '구기 운동' },
];

/**
 * 텍스트에서 수량과 단위를 추출하는 유틸리티
 */
export const extractQuantityAndUnit = (
  text: string
): { quantity: number; unit?: string | undefined; cleanText: string } => {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(개|알|개입|줄|공기|그릇|인분|조각|토막|캔|잔|병|봉지|봉|팩|g|ml)?/i);
  if (match && match[1]) {
    const qty = parseFloat(match[1]);
    const unit = match[2] || '개';
    const cleanText = text.replace(match[0] || '', '').trim();
    return { quantity: qty > 0 ? qty : 1, unit, cleanText };
  }
  return { quantity: 1, unit: undefined, cleanText: text };
};

/**
 * 조리법/식재료 기반 동적 자체 추정 (API 비상 상황 또는 키 미설정 시)
 */
export const estimateFallbackNutrition = (
  foodName: string,
  quantity: number = 1
): {
  name: string;
  quantity: number;
  unit: string;
  unitKcal: number;
  unitCarb: number;
  unitProtein: number;
  unitFat: number;
  totalKcal: number;
  description: string;
} => {
  const lower = foodName.toLowerCase();
  let baseCal = 350;
  let baseCarbs = 40;
  let baseProtein = 15;
  let baseFat = 12;

  if (lower.includes('튀김') || lower.includes('돈까스') || lower.includes('치킨') || lower.includes('탕수육') || lower.includes('전')) {
    baseCal = 620;
    baseCarbs = 48;
    baseProtein = 24;
    baseFat = 36;
  } else if (lower.includes('샐러드') || lower.includes('채소') || lower.includes('야채') || lower.includes('과일')) {
    baseCal = 150;
    baseCarbs = 20;
    baseProtein = 4;
    baseFat = 5;
  } else if (lower.includes('국') || lower.includes('찌개') || lower.includes('탕')) {
    baseCal = 280;
    baseCarbs = 18;
    baseProtein = 18;
    baseFat = 14;
  } else if (lower.includes('면') || lower.includes('국수') || lower.includes('파스타') || lower.includes('우동') || lower.includes('라면') || lower.includes('짜장') || lower.includes('짬뽕')) {
    baseCal = 550;
    baseCarbs = 82;
    baseProtein = 14;
    baseFat = 16;
  } else if (lower.includes('고기') || lower.includes('구이') || lower.includes('스테이크') || lower.includes('삼겹') || lower.includes('갈비')) {
    baseCal = 480;
    baseCarbs = 6;
    baseProtein = 35;
    baseFat = 32;
  } else if (lower.includes('빵') || lower.includes('케이크') || lower.includes('과자') || lower.includes('디저트') || lower.includes('쿠키')) {
    baseCal = 380;
    baseCarbs = 56;
    baseProtein = 6;
    baseFat = 16;
  }

  const factor = Math.max(0.5, quantity);
  const totalKcal = Math.round(baseCal * factor);

  return {
    name: foodName,
    quantity,
    unit: '인분',
    unitKcal: baseCal,
    unitCarb: baseCarbs,
    unitProtein: baseProtein,
    unitFat: baseFat,
    totalKcal,
    description: `[자체 추정] ${foodName}${quantity > 1 ? ` x${quantity}` : ''} 영양성분`,
  };
};
