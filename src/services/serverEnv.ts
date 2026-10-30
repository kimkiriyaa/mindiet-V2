/**
 * 서버 환경변수 일원화 접근 모듈 (serverEnv.ts)
 * 
 * - 개발 모드(Node.js / Vite dev server): process.env 우선 조회
 * - Workers 환경(배포 환경): globalThis.__cf_env / globalThis.env 폴백
 * - 안전성 보장: 'cloudflare:workers' 모듈의 정적 import를 사용하지 않아
 *   로컬 Vite dev server 실행 시 모듈 해석(Module Not Found) 에러로 크래시되지 않음.
 * - 보안 원칙: GEMINI_API_KEY 원문은 절대 클라이언트로 전송하거나 로그에 출력하지 않음.
 */

export interface ServerEnv {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  GEMINI_MODEL_FALLBACK?: string;
  GEMINI_THINKING_LEVEL?: string;
  [key: string]: string | undefined;
}

export function getServerEnv(): ServerEnv {
  const result: ServerEnv = {};

  // 1. Node.js / Vite dev server 환경 (process.env 우선)
  if (typeof process !== 'undefined' && process.env) {
    const nodeKey = process.env['GEMINI_API_KEY'];
    if (nodeKey && typeof nodeKey === 'string' && nodeKey.trim()) {
      result.GEMINI_API_KEY = nodeKey.trim();
    }
    const model = process.env['GEMINI_MODEL'];
    if (model && typeof model === 'string' && model.trim()) {
      result.GEMINI_MODEL = model.trim();
    }
    const fallback = process.env['GEMINI_MODEL_FALLBACK'];
    if (fallback && typeof fallback === 'string' && fallback.trim()) {
      result.GEMINI_MODEL_FALLBACK = fallback.trim();
    }
    const thinking = process.env['GEMINI_THINKING_LEVEL'];
    if (thinking && typeof thinking === 'string' && thinking.trim()) {
      result.GEMINI_THINKING_LEVEL = thinking.trim();
    }
    if (result.GEMINI_API_KEY) return result;
  }

  // 2. Cloudflare Workers / Nitro 런타임 환경 바인딩 폴백 (globalThis)
  const g = globalThis as Record<string, any>;
  const cfEnv = g["__cf_env"];
  if (cfEnv && typeof cfEnv === "object") {
    const cfKey = cfEnv["GEMINI_API_KEY"];
    if (cfKey && typeof cfKey === "string" && cfKey.trim()) {
      result.GEMINI_API_KEY = cfKey.trim();
    }
    if (cfEnv["GEMINI_MODEL"]) result.GEMINI_MODEL = String(cfEnv["GEMINI_MODEL"]).trim();
    if (cfEnv["GEMINI_MODEL_FALLBACK"]) result.GEMINI_MODEL_FALLBACK = String(cfEnv["GEMINI_MODEL_FALLBACK"]).trim();
    if (cfEnv["GEMINI_THINKING_LEVEL"]) result.GEMINI_THINKING_LEVEL = String(cfEnv["GEMINI_THINKING_LEVEL"]).trim();
    if (result.GEMINI_API_KEY) return result;
  }

  const gEnv = g["env"];
  if (gEnv && typeof gEnv === "object") {
    const cfKey = gEnv["GEMINI_API_KEY"];
    if (cfKey && typeof cfKey === "string" && cfKey.trim()) {
      result.GEMINI_API_KEY = cfKey.trim();
    }
    if (gEnv["GEMINI_MODEL"]) result.GEMINI_MODEL = String(gEnv["GEMINI_MODEL"]).trim();
    if (gEnv["GEMINI_MODEL_FALLBACK"]) result.GEMINI_MODEL_FALLBACK = String(gEnv["GEMINI_MODEL_FALLBACK"]).trim();
    if (gEnv["GEMINI_THINKING_LEVEL"]) result.GEMINI_THINKING_LEVEL = String(gEnv["GEMINI_THINKING_LEVEL"]).trim();
    if (result.GEMINI_API_KEY) return result;
  }

  return result;
}

/**
 * Gemini API Key 설정 여부만 안전하게 확인하는 진단 헬퍼
 * 키 원문을 절대 노출하지 않고 boolean만 반환
 */
export function isGeminiConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY.length > 0);
}
