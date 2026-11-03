import { createServerFn } from "@tanstack/react-start";
import { getServerEnv, isGeminiConfigured } from "./serverEnv";
import {
  COMMON_FOODS,
  COMMON_EXERCISES,
  extractQuantityAndUnit,
  estimateFallbackNutrition,
} from "@/lib/nutritionDictionary";

export type NutritionSource = "ai" | "local" | "fallback";

export interface FoodVisionResult {
  name: string;
  quantity: number;
  unit: string;
  unitKcal: number;
  unitCarb: number;
  unitProtein: number;
  unitFat: number;
  totalKcal: number;
  description?: string | undefined;
  isEstimate: boolean;
  source: NutritionSource;
}

export interface ExerciseVisionResult {
  name: string;
  durationMinutes: number;
  calories: number;
  description: string;
  isEstimate: boolean;
  source: NutritionSource;
}

// ==========================================
// 1. 모델·타임아웃·크기 관련 상수 (한 곳에서 일원화 관리)
// ==========================================
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";
export const DEFAULT_GEMINI_MODEL_FALLBACK = "gemini-3.5-flash";
export const SERVER_GEMINI_TIMEOUT_MS = 15000; // 15초 (실측 정상 응답 ~1-3s 기준, 25초 이내 상한)
export const CLIENT_GEMINI_TIMEOUT_MS = 20000; // 20초 (클라이언트 대기 상한, 30초 이내 상한)
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB (Vercel 4.5MB 상한 준수)

export const STANDARD_PORTION_PROMPT =
  "한국 일반 음식점 1인분 표준 서빙량 기준으로 정수로 추정하고, 확신이 낮으면 보수적으로";

// ==========================================
// 2. responseSchema 정의 (출력 스키마 강제)
// ==========================================
export const FOOD_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    name: { type: "STRING", description: "음식명" },
    quantity: { type: "NUMBER", description: "총 섭취 수량/분량" },
    unit: { type: "STRING", description: "단위 (인분, 개, 그릇 등)" },
    unitKcal: { type: "INTEGER", description: "1단위당 칼로리 (kcal)" },
    unitCarb: { type: "NUMBER", description: "1단위당 탄수화물 (g)" },
    unitProtein: { type: "NUMBER", description: "1단위당 단백질 (g)" },
    unitFat: { type: "NUMBER", description: "1단위당 지방 (g)" },
    description: { type: "STRING", description: "조리법 및 주요 식재료 간단 설명" },
  },
  required: ["name", "quantity", "unit", "unitKcal", "unitCarb", "unitProtein", "unitFat"],
};

export const EXERCISE_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    calories: { type: "INTEGER", description: "총 예상 소모 칼로리 (kcal)" },
    description: { type: "STRING", description: "운동 강도 및 소모 칼로리 산출 설명" },
  },
  required: ["calories"],
};

/**
 * 3. thinking 설정 생성 헬퍼 (공식 문서: ai.google.dev/gemini-api/docs/thinking)
 * - 2.x 세대: thinkingBudget(0) (수치형 토큰 버짓)
 * - 3.x 세대: thinkingLevel("minimal" 기본, 환경변수로 지정 가능)
 */
export function buildThinkingConfig(model: string, customLevel?: string) {
  if (model.startsWith("gemini-2.")) {
    return { thinkingBudget: 0 };
  }
  const level = (customLevel || "minimal").toLowerCase();
  return { thinkingLevel: level };
}

/**
 * 4. 이미지 입력값 유효성 검증 헬퍼 (4MB 이하, jpeg/png/webp)
 */
export function validateImagePayload(imageDataUrl: string): { mimeType: string; rawBase64: string } {
  if (!imageDataUrl || typeof imageDataUrl !== "string") {
    throw new Error("분석할 이미지 데이터가 없습니다.");
  }

  // MIME 타입 추출 및 검증
  const mimeMatch = imageDataUrl.match(/^data:([^;]+);base64,/);
  let mimeType: string = mimeMatch && mimeMatch[1] ? mimeMatch[1].toLowerCase() : "image/jpeg";
  if (mimeType === "image/jpg") mimeType = "image/jpeg";

  const allowedMimeTypes: readonly string[] = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedMimeTypes.includes(mimeType)) {
    throw new Error("지원하지 않는 이미지 형식입니다. JPEG, PNG, WEBP 이미지만 지원합니다.");
  }

  // Base64 추출 및 크기 검사 (최대 4MB)
  const splitIndex = imageDataUrl.indexOf(",");
  const rawBase64 = splitIndex !== -1 ? imageDataUrl.slice(splitIndex + 1).trim() : imageDataUrl.trim();

  // 대략적인 바이트 크기: (base64 길이의 3/4)
  const approxBytes = Math.ceil((rawBase64.length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) {
    throw new Error("이미지 크기는 4MB 이하여야 합니다. [ERR_PAYLOAD_TOO_LARGE]");
  }

  return { mimeType, rawBase64 };
}

/**
 * 5. 타임아웃 fetch 헬퍼 (오류 마스킹 적용)
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = SERVER_GEMINI_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return res;
  } catch (err: any) {
    if (err?.name === "AbortError" || err?.message?.includes("aborted")) {
      throw new Error(`AI 분석 서버 응답 시간이 초과되었습니다 (${Math.round(timeoutMs / 1000)}초 타임아웃). [ERR_TIMEOUT]`);
    }
    throw new Error("식단 분석에 실패했습니다. 네트워크 상태를 확인해 주세요. [ERR_NETWORK]");
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 6. 모델 호출 및 404/종료 시 폴백 재시도 공통 헬퍼
 * - 사진, 텍스트, 운동 서버 함수가 모두 이 헬퍼를 거침
 * - 주 모델 404 / no longer available 시 폴백 모델로 1회 재시도
 * - 서버 로그에는 HTTP 상태, 모델 ID, 소요 ms만 기록 (키, 헤더, 응답 본문 기록 금지)
 */
export async function callGeminiWithFallback(params: {
  apiKey: string;
  contents: any[];
  responseSchema: any;
  maxOutputTokens: number;
}): Promise<any> {
  const env = getServerEnv();
  const primaryModel = env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const fallbackModel = env.GEMINI_MODEL_FALLBACK || DEFAULT_GEMINI_MODEL_FALLBACK;
  const thinkingLevel = env.GEMINI_THINKING_LEVEL;

  const tryCall = async (modelId: string) => {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`;
    const generationConfig: Record<string, any> = {
      maxOutputTokens: params.maxOutputTokens,
      responseMimeType: "application/json",
      responseSchema: params.responseSchema,
      thinkingConfig: buildThinkingConfig(modelId, thinkingLevel),
    };
    // 3.x 세대는 temperature 기본값(미설정) 권장, 2.x 세대만 0.1 전달
    if (modelId.startsWith("gemini-2.")) {
      generationConfig["temperature"] = 0.1;
    }

    const requestBody = {
      contents: params.contents,
      generationConfig,
    };

    const startTime = Date.now();
    let res: Response;
    try {
      res = await fetchWithTimeout(
        endpoint,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": params.apiKey,
          },
          body: JSON.stringify(requestBody),
        },
        SERVER_GEMINI_TIMEOUT_MS
      );
    } catch (fetchErr) {
      const durationMs = Date.now() - startTime;
      console.log(`[geminiServerFn] status=NETWORK_ERROR model=${modelId} duration=${durationMs}ms`);
      throw fetchErr;
    }

    const durationMs = Date.now() - startTime;
    console.log(`[geminiServerFn] status=${res.status} model=${modelId} duration=${durationMs}ms`);

    let isUnavailable = res.status === 404 || res.status === 410;
    let isRateLimit = res.status === 429;
    let isMaxTokens = false;
    let json: any = undefined;

    if (!res.ok && !isUnavailable) {
      try {
        const errClone = res.clone();
        const errText = await errClone.text();
        if (/no longer available|not found|is not supported/i.test(errText)) {
          isUnavailable = true;
        }
      } catch {
        // ignore
      }
    } else if (res.ok) {
      try {
        json = await res.json();
        const finishReason = json?.candidates?.[0]?.finishReason;
        if (finishReason === "MAX_TOKENS") {
          isMaxTokens = true;
        }
      } catch {
        // ignore
      }
    }

    return { res, modelId, json, isUnavailable, isRateLimit, isMaxTokens };
  };

  // 1차 시도 (주 모델)
  let attempt = await tryCall(primaryModel);

  const shouldFallback = attempt.isUnavailable || attempt.isRateLimit || attempt.isMaxTokens;

  // 폴백 조건 충족 시(404/410/미지원, 429 한도 초과, MAX_TOKENS 잘림) 폴백 모델로 1회 재시도
  if (shouldFallback && fallbackModel && fallbackModel !== primaryModel) {
    attempt = await tryCall(fallbackModel);
  }

  // 최종 결과 검증 및 에러 마스킹
  if (attempt.isUnavailable) {
    throw new Error("선택한 모델을 사용할 수 없습니다. [ERR_MODEL_UNAVAILABLE]");
  }
  if (attempt.isRateLimit) {
    throw new Error("일시적인 요청 한도 초과입니다. 잠시 후 다시 시도해 주세요. [ERR_RATE_LIMIT]");
  }
  if (attempt.isMaxTokens) {
    throw new Error("식단 분석 토큰 한도를 초과했습니다. [ERR_MAX_TOKENS]");
  }
  if (!attempt.res.ok) {
    throw new Error("식단 분석에 실패했습니다. 다시 시도해 주세요. [ERR_UPSTREAM_FAIL]");
  }

  let json = attempt.json;
  if (!json) {
    try {
      json = await attempt.res.json();
    } catch {
      throw new Error("식단 분석 결과를 처리하지 못했습니다. [ERR_PARSE_FAIL]");
    }
  }

  const candidateText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!candidateText) {
    throw new Error("식단 분석 결과를 전달받지 못했습니다. [ERR_EMPTY_RESPONSE]");
  }

  const cleaned = candidateText.replace(/```json/g, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error("식단 분석 데이터 형식이 올바르지 않습니다. [ERR_INVALID_SCHEMA]");
  }
}

/**
 * [Handler 1] 환경 설정 진단 핸들러: 오직 { configured: boolean }만 반환
 */
export async function checkGeminiHealthHandler(): Promise<{ configured: boolean }> {
  return { configured: isGeminiConfigured() };
}

/**
 * [Handler 2] 사진 음식 분석 핸들러
 */
export async function analyzeMealPhotoHandler(data: {
  image: string;
  userNotes?: string | undefined;
}): Promise<FoodVisionResult> {
  const { mimeType, rawBase64 } = validateImagePayload(data.image);
  const env = getServerEnv();
  const apiKey = env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Gemini API 키가 설정되지 않았습니다. [ERR_CONFIG_MISSING]");
  }

  const notesContext = data.userNotes && data.userNotes.trim() ? ` 사용자메모: ${data.userNotes.trim()}` : "";
  const promptRules = `너는 대한민국 최고의 임상영양사 AI다.
[핵심 규칙]
1. 사진 속 각 음식의 총 수량/개수(예: 삶은 달걀 3개면 3개 전체 분량, 만두 6개면 6개 전체, 밥 한 공기 반이면 1.5공기)를 반드시 정확히 파악하라.
2. 단위 1개당 영양소가 아니라, 사진에 보이는 전체 섭취량 기준의 총 수량(quantity)을 반영하여 "총 칼로리 = 개당 칼로리 × quantity" 및 총 탄/단/지를 계산하라.
3. 250kcal 같은 임의 고정값을 절대 사용하지 말 것. 식재료와 조리 형태(튀김, 볶음, 찜, 구이, 국물 등), 총 섭취 분량을 종합하여 가장 합리적이고 정확한 추정치를 직접 계산하여 반환하라.
4. ${STANDARD_PORTION_PROMPT}.
${notesContext}`.trim();

  const contents = [
    {
      parts: [
        { text: promptRules },
        {
          inline_data: {
            mime_type: mimeType,
            data: rawBase64,
          },
        },
      ],
    },
  ];

  const parsed = await callGeminiWithFallback({
    apiKey,
    contents,
    responseSchema: FOOD_RESPONSE_SCHEMA,
    maxOutputTokens: 1024,
  });

  const qty = Math.max(0.5, Number(parsed.quantity) || 1);
  // unitKcal 필드 우선, 없을 경우 calories에서 계산
  let unitKcal = 0;
  if (parsed.unitKcal != null && Number.isFinite(Number(parsed.unitKcal))) {
    unitKcal = Math.max(0, Math.round(Number(parsed.unitKcal)));
  } else if (parsed.calories != null && Number.isFinite(Number(parsed.calories))) {
    unitKcal = Math.round(Number(parsed.calories) / qty);
  }

  const totalCal = Math.round(unitKcal * qty);
  const unitCarb = Math.max(0, Math.round((Number(parsed.unitCarb) || (parsed.carbs ? Number(parsed.carbs) / qty : 0)) * 10) / 10);
  const unitProtein = Math.max(0, Math.round((Number(parsed.unitProtein) || (parsed.protein ? Number(parsed.protein) / qty : 0)) * 10) / 10);
  const unitFat = Math.max(0, Math.round((Number(parsed.unitFat) || (parsed.fat ? Number(parsed.fat) / qty : 0)) * 10) / 10);

  return {
    name: String(parsed.name || "식단").trim(),
    quantity: qty,
    unit: parsed.unit ? String(parsed.unit).trim() : "인분",
    unitKcal,
    unitCarb,
    unitProtein,
    unitFat,
    totalKcal: totalCal,
    description: parsed.description ? String(parsed.description).trim() : undefined,
    isEstimate: false,
    source: "ai",
  };
}

/**
 * [Handler 3] 텍스트 음식 영양성분 추정 핸들러
 */
export async function estimateFoodTextHandler(data: { text: string }): Promise<FoodVisionResult> {
  const trimmed = data.text.trim();
  if (!trimmed) {
    throw new Error("음식명을 입력해 주세요.");
  }

  const { quantity, unit, cleanText } = extractQuantityAndUnit(trimmed);

  // 1. 로컬 사전 매칭 (0ms 즉시 반환, source: 'local')
  const normalized = (cleanText || trimmed).replace(/\s+/g, "").toLowerCase();
  for (const [key, value] of Object.entries(COMMON_FOODS)) {
    const cleanKey = key.replace(/\s+/g, "").toLowerCase();
    if (normalized.includes(cleanKey) || cleanKey.includes(normalized)) {
      const q = quantity || 1;
      const u = unit || value.unit;
      return {
        name: `${value.name}${q > 1 ? ` ${q}${u}` : ""}`,
        quantity: q,
        unit: u,
        unitKcal: value.calories,
        unitCarb: value.carbs,
        unitProtein: value.protein,
        unitFat: value.fat,
        totalKcal: Math.round(value.calories * q),
        description: `로컬 DB (${value.name} × ${q}${u})`,
        isEstimate: true,
        source: "local",
      };
    }
  }

  // 2. Gemini 호출 (API 키가 있을 때, 성공 시 source: 'ai')
  const env = getServerEnv();
  const apiKey = env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const prompt = `음식명: "${trimmed}"
반드시 음식의 조리 방식, 주재료 구성, 총 분량/수량(예: ${quantity}${unit || "개"})을 엄밀히 반영하여 1단위당 및 총 칼로리와 영양성분을 계산하라.
250kcal 같은 임의 고정값을 절대 넣지 말고 식재료와 조리 형태에 맞는 실제적인 추정치를 JSON 형식으로 응답하라.
${STANDARD_PORTION_PROMPT}.`;

      const contents = [{ parts: [{ text: prompt }] }];
      const parsed = await callGeminiWithFallback({
        apiKey,
        contents,
        responseSchema: FOOD_RESPONSE_SCHEMA,
        maxOutputTokens: 1024,
      });

      const q = Math.max(0.5, Number(parsed.quantity) || quantity);
      let unitKcal = 0;
      if (parsed.unitKcal != null && Number.isFinite(Number(parsed.unitKcal))) {
        unitKcal = Math.max(0, Math.round(Number(parsed.unitKcal)));
      } else if (parsed.calories != null && Number.isFinite(Number(parsed.calories))) {
        unitKcal = Math.round(Number(parsed.calories) / q);
      }
      const totalCal = Math.round(unitKcal * q);
      const unitCarb = Math.max(0, Math.round((Number(parsed.unitCarb) || (parsed.carbs ? Number(parsed.carbs) / q : 0)) * 10) / 10);
      const unitProtein = Math.max(0, Math.round((Number(parsed.unitProtein) || (parsed.protein ? Number(parsed.protein) / q : 0)) * 10) / 10);
      const unitFat = Math.max(0, Math.round((Number(parsed.unitFat) || (parsed.fat ? Number(parsed.fat) / q : 0)) * 10) / 10);

      return {
        name: String(parsed.name || trimmed).trim(),
        quantity: q,
        unit: parsed.unit ? String(parsed.unit).trim() : unit || "인분",
        unitKcal,
        unitCarb,
        unitProtein,
        unitFat,
        totalKcal: totalCal,
        description: parsed.description ? String(parsed.description).trim() : undefined,
        isEstimate: false,
        source: "ai",
      };
    } catch (err: any) {
      const errCode = err?.message?.match(/\[ERR_[A-Z_]+\]/)?.[0] || "[ERR_UPSTREAM_FAIL]";
      console.warn(`[geminiServerFn] 텍스트 분석 API 실패 ${errCode}, 자체 추정으로 대체`);
    }
  }

  // 3. API 비상 상황 또는 키 미설정 시 조리법/식재료 기반 동적 자체 추정 (source: 'fallback')
  const fallback = estimateFallbackNutrition(trimmed, quantity);
  return {
    ...fallback,
    isEstimate: true,
    source: "fallback",
  };
}

/**
 * [Handler 4] 운동 칼로리 소모량 추정 핸들러
 */
export async function estimateExerciseCaloriesHandler(data: {
  text: string;
  weight?: number | undefined;
}): Promise<ExerciseVisionResult> {
  const trimmed = data.text.trim();
  if (!trimmed) {
    throw new Error("운동 내용을 입력해 주세요.");
  }

  const safeWeight = data.weight && data.weight > 0 ? data.weight : 65;
  let durationMinutes = 30;
  const hourMatch = trimmed.match(/(\d+)\s*(시간|h|hr)/i);
  const minMatch = trimmed.match(/(\d+)\s*(분|m|min)/i);

  if (hourMatch) {
    durationMinutes = parseInt(hourMatch[1] || "0", 10) * 60;
    if (minMatch) {
      durationMinutes += parseInt(minMatch[1] || "0", 10);
    }
  } else if (minMatch) {
    durationMinutes = parseInt(minMatch[1] || "0", 10);
  }
  durationMinutes = Math.min(300, Math.max(5, durationMinutes));

  // 1. 대표 운동 키워드 로컬 매칭 (MET 공식, source: 'local')
  for (const item of COMMON_EXERCISES) {
    if (item.keywords.some((k) => trimmed.includes(k))) {
      const burned = Math.round(item.met * safeWeight * (durationMinutes / 60) * 1.05);
      return {
        name: trimmed,
        durationMinutes,
        calories: burned,
        description: `${item.label} ${durationMinutes}분 기준 예상 소모량`,
        isEstimate: true,
        source: "local",
      };
    }
  }

  // 2. Gemini 호출 (API 키가 있을 때, 성공 시 source: 'ai')
  const env = getServerEnv();
  const apiKey = env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const prompt = `체중: ${safeWeight}kg, 운동: "${trimmed}". 운동 강도와 시간(${durationMinutes}분)을 종합해 소모 칼로리를 정수로 정확히 계산하라.`;
      const contents = [{ parts: [{ text: prompt }] }];
      const parsed = await callGeminiWithFallback({
        apiKey,
        contents,
        responseSchema: EXERCISE_RESPONSE_SCHEMA,
        maxOutputTokens: 512,
      });

      return {
        name: trimmed,
        durationMinutes,
        calories: Math.max(0, Math.round(Number(parsed.calories) || 0)),
        description: parsed.description ? String(parsed.description).trim() : `${trimmed} 예상 소모량`,
        isEstimate: false,
        source: "ai",
      };
    } catch (err: any) {
      const errCode = err?.message?.match(/\[ERR_[A-Z_]+\]/)?.[0] || "[ERR_UPSTREAM_FAIL]";
      console.warn(`[geminiServerFn] 운동 추정 API 실패 ${errCode}, MET 5.0 기본 공식 적용`);
    }
  }

  // 3. API 키 부재 또는 실패 시 MET 5.0 기본 공식 적용 (source: 'fallback')
  const fallbackBurned = Math.round(5.0 * safeWeight * (durationMinutes / 60) * 1.05);
  return {
    name: trimmed,
    durationMinutes,
    calories: fallbackBurned,
    description: `${trimmed} (${durationMinutes}분 중강도 운동 기준 예상치)`,
    isEstimate: true,
    source: "fallback",
  };
}

/**
 * [ServerFn 1] 환경 설정 진단용 서버 함수: 오직 { configured: boolean }만 반환
 */
export const checkGeminiHealthFn = createServerFn({ method: "GET" }).handler(
  checkGeminiHealthHandler
);

/**
 * [ServerFn 2] 사진 음식 분석 서버 함수
 */
export const analyzeMealPhotoFn = createServerFn({ method: "POST" })
  .validator((data: { image: string; userNotes?: string | undefined }) => data)
  .handler(async ({ data }) => analyzeMealPhotoHandler(data));

/**
 * [ServerFn 3] 텍스트 음식 영양성분 추정 서버 함수
 */
export const estimateFoodTextFn = createServerFn({ method: "POST" })
  .validator((data: { text: string }) => data)
  .handler(async ({ data }) => estimateFoodTextHandler(data));

/**
 * [ServerFn 4] 운동 칼로리 소모량 추정 서버 함수
 */
export const estimateExerciseCaloriesFn = createServerFn({ method: "POST" })
  .validator((data: { text: string; weight?: number | undefined }) => data)
  .handler(async ({ data }) => estimateExerciseCaloriesHandler(data));
