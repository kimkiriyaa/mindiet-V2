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

const GEMINI_API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

/**
 * 1. 이미지 입력값 유효성 검증 헬퍼 (5MB 이하, jpeg/png/webp)
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

  // Base64 추출 및 크기 검사 (최대 5MB)
  const splitIndex = imageDataUrl.indexOf(",");
  const rawBase64 = splitIndex !== -1 ? imageDataUrl.slice(splitIndex + 1).trim() : imageDataUrl.trim();

  // 대략적인 바이트 크기: (base64 길이의 3/4)
  const approxBytes = Math.ceil((rawBase64.length * 3) / 4);
  const maxBytes = 5 * 1024 * 1024; // 5MB = 5,242,880 bytes
  if (approxBytes > maxBytes) {
    throw new Error("이미지 크기는 5MB 이하여야 합니다.");
  }

  return { mimeType, rawBase64 };
}

/**
 * 2. 12초 타임아웃 fetch 헬퍼 (오류 마스킹 적용)
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 12000
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
      throw new Error("AI 분석 서버 응답 시간이 초과되었습니다 (12초 타임아웃). [ERR_TIMEOUT]");
    }
    throw new Error("식단 분석에 실패했습니다. 네트워크 상태를 확인해 주세요. [ERR_NETWORK]");
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * [Handler 1] 환경 설정 진단 핸들러: 오직 { configured: boolean }만 반환
 */
export async function checkGeminiHealthHandler(): Promise<{ configured: boolean }> {
  return { configured: isGeminiConfigured() };
}

/**
 * [Handler 2] 사진 음식 분석 핸들러 (gemini-2.5-flash)
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
4. 반드시 아래 JSON 형식으로만 순수 텍스트로 응답하라 (코드블록 마크다운 기호 없이 순수 JSON만 반환):
{"name": string, "quantity": number, "unit": string, "calories": number, "carbs": number, "protein": number, "fat": number, "description": string}
${notesContext}`.trim();

  const requestBody = {
    contents: [
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
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 300,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const response = await fetchWithTimeout(
    GEMINI_API_ENDPOINT,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(requestBody),
    },
    12000
  );

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("일시적인 요청 한도 초과입니다. 잠시 후 다시 시도해 주세요. [ERR_RATE_LIMIT]");
    }
    throw new Error("식단 분석에 실패했습니다. 다시 시도해 주세요. [ERR_UPSTREAM_FAIL]");
  }

  let candidateText: string | undefined;
  try {
    const json = await response.json();
    candidateText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  } catch {
    throw new Error("식단 분석 결과를 처리하지 못했습니다. [ERR_PARSE_FAIL]");
  }

  if (!candidateText) {
    throw new Error("식단 분석 결과를 전달받지 못했습니다. [ERR_EMPTY_RESPONSE]");
  }

  const cleaned = candidateText.replace(/```json/g, "").replace(/```/g, "").trim();
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("식단 분석 데이터 형식이 올바르지 않습니다. [ERR_INVALID_SCHEMA]");
  }

  const qty = Math.max(0.5, Number(parsed.quantity) || 1);
  const totalCal = Math.max(0, Math.round(Number(parsed.calories) || 0));
  const totalCarb = Math.max(0, Math.round(Number(parsed.carbs) || 0));
  const totalProtein = Math.max(0, Math.round(Number(parsed.protein) || 0));
  const totalFat = Math.max(0, Math.round(Number(parsed.fat) || 0));

  const unitKcal = Math.round(totalCal / qty);
  const unitCarb = Math.round((totalCarb / qty) * 10) / 10;
  const unitProtein = Math.round((totalProtein / qty) * 10) / 10;
  const unitFat = Math.round((totalFat / qty) * 10) / 10;

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

  // 2. Gemini 2.5 Flash 호출 (API 키가 있을 때, 성공 시 source: 'ai')
  const env = getServerEnv();
  const apiKey = env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const prompt = `음식명: "${trimmed}"
반드시 음식의 조리 방식, 주재료 구성, 총 분량/수량(예: ${quantity}${unit || "개"})을 엄밀히 반영하여 총 칼로리와 영양성분을 계산하라.
단위 1개가 아닌 사용자가 입력한 총량 전체의 칼로리(총 칼로리 = 단위 칼로리 × 수량)와 탄수화물, 단백질, 지방을 계산하라.
250kcal 같은 임의 고정값을 절대 넣지 말고 식재료와 조리 형태에 맞는 실제적인 추정치를 JSON 형식으로만 응답하라:
{"name":"${trimmed}","quantity":${quantity},"unit":"${unit || "인분"}","calories":number,"carbs":number,"protein":number,"fat":number,"description":string}`;

      const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 200,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 0 },
        },
      };

      const response = await fetchWithTimeout(
        GEMINI_API_ENDPOINT,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify(requestBody),
        },
        12000
      );

      if (response.ok) {
        const json = await response.json();
        const candidateText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidateText) {
          const cleaned = candidateText.replace(/```json/g, "").replace(/```/g, "").trim();
          const parsed = JSON.parse(cleaned);

          const q = Math.max(0.5, Number(parsed.quantity) || quantity);
          const totalCal = Math.max(0, Math.round(Number(parsed.calories) || 0));
          const totalCarb = Math.max(0, Math.round(Number(parsed.carbs) || 0));
          const totalProtein = Math.max(0, Math.round(Number(parsed.protein) || 0));
          const totalFat = Math.max(0, Math.round(Number(parsed.fat) || 0));

          return {
            name: String(parsed.name || trimmed).trim(),
            quantity: q,
            unit: parsed.unit ? String(parsed.unit).trim() : unit || "인분",
            unitKcal: Math.round(totalCal / q),
            unitCarb: Math.round((totalCarb / q) * 10) / 10,
            unitProtein: Math.round((totalProtein / q) * 10) / 10,
            unitFat: Math.round((totalFat / q) * 10) / 10,
            totalKcal: totalCal,
            description: parsed.description ? String(parsed.description).trim() : undefined,
            isEstimate: false,
            source: "ai",
          };
        }
      }
    } catch (err) {
      console.warn("[geminiServerFn] 텍스트 분석 API 실패, 자체 추정으로 대체:", err);
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

  // 2. Gemini 2.5 Flash 호출 (API 키가 있을 때, 성공 시 source: 'ai')
  const env = getServerEnv();
  const apiKey = env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const prompt = `체중: ${safeWeight}kg, 운동: "${trimmed}". 운동 강도와 시간을 종합해 소모 칼로리를 정확히 계산하라. JSON으로만 반환: {"calories": number, "description": string}`;

      const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 150,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 0 },
        },
      };

      const response = await fetchWithTimeout(
        GEMINI_API_ENDPOINT,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify(requestBody),
        },
        12000
      );

      if (response.ok) {
        const json = await response.json();
        const candidateText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidateText) {
          const cleaned = candidateText.replace(/```json/g, "").replace(/```/g, "").trim();
          const parsed = JSON.parse(cleaned);
          return {
            name: trimmed,
            durationMinutes,
            calories: Math.max(0, Math.round(Number(parsed.calories) || 0)),
            description: parsed.description ? String(parsed.description).trim() : `${trimmed} 예상 소모량`,
            isEstimate: false,
            source: "ai",
          };
        }
      }
    } catch (err) {
      console.warn("[geminiServerFn] 운동 추정 API 실패, MET 5.0 기본 공식 적용:", err);
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
 * [ServerFn 2] 사진 음식 분석 서버 함수 (gemini-2.5-flash)
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
 * [ServerFn 4] 운동 칼로리 소모량 추정 서버 함수 (MET 5.0 기본 공식 / Gemini 2.5 Flash)
 */
export const estimateExerciseCaloriesFn = createServerFn({ method: "POST" })
  .validator((data: { text: string; weight?: number | undefined }) => data)
  .handler(async ({ data }) => estimateExerciseCaloriesHandler(data));
