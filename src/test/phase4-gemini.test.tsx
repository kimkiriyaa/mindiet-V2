import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import {
  validateImagePayload,
  checkGeminiHealthHandler,
  analyzeMealPhotoHandler,
  estimateFoodTextHandler,
  estimateExerciseCaloriesHandler,
} from "@/services/geminiServerFn";
import { getServerEnv, isGeminiConfigured } from "@/services/serverEnv";
import { AddFoodModal } from "@/components/diet/AddFoodModal";
import { ExerciseCard } from "@/components/diet/ExerciseCard";
import { DietProvider } from "@/context/DietContext";
import { setSavedSession } from "@/services/storageService";

// Vitest 환경에서 TanStack Start 클라이언트 RPC를 실제 서버 핸들러로 직접 연결 모킹
vi.mock("@/services/geminiServerFn", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/geminiServerFn")>();
  return {
    ...actual,
    checkGeminiHealthFn: vi.fn(async () => actual.checkGeminiHealthHandler()),
    analyzeMealPhotoFn: vi.fn(async ({ data }: { data: any }) => actual.analyzeMealPhotoHandler(data)),
    estimateFoodTextFn: vi.fn(async ({ data }: { data: any }) => actual.estimateFoodTextHandler(data)),
    estimateExerciseCaloriesFn: vi.fn(async ({ data }: { data: any }) => actual.estimateExerciseCaloriesHandler(data)),
  };
});

describe("Phase 4: Gemini 서버 함수 및 클라이언트 AI 연동 정밀 검증", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    delete process.env["GEMINI_API_KEY"];
    setSavedSession({ userId: "testUser", userName: "테스터" });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("1. 서버 환경변수(getServerEnv) 및 진단 헬퍼 보안 검증", () => {
    it("GEMINI_API_KEY가 없을 때 getServerEnv는 빈 객체를 반환하고 isGeminiConfigured는 false를 반환", () => {
      delete process.env["GEMINI_API_KEY"];
      const env = getServerEnv();
      expect(env.GEMINI_API_KEY).toBeUndefined();
      expect(isGeminiConfigured()).toBe(false);
    });

    it("GEMINI_API_KEY가 설정되어 있을 때 isGeminiConfigured는 true를 반환하고, 키 원문은 노출되지 않음", () => {
      process.env["GEMINI_API_KEY"] = "mock_secret_key_12345";
      expect(isGeminiConfigured()).toBe(true);
    });

    it("checkGeminiHealthHandler 진단 서버 함수는 키 원문 대신 오직 { configured: boolean }만 반환", async () => {
      // 1) 키 없음
      delete process.env["GEMINI_API_KEY"];
      const health1 = await checkGeminiHealthHandler();
      expect(health1).toEqual({ configured: false });
      expect((health1 as any).key).toBeUndefined();
      expect((health1 as any).GEMINI_API_KEY).toBeUndefined();

      // 2) 키 있음
      process.env["GEMINI_API_KEY"] = "mock_secret_key_12345";
      const health2 = await checkGeminiHealthHandler();
      expect(health2).toEqual({ configured: true });
      expect((health2 as any).key).toBeUndefined();
      expect((health2 as any).GEMINI_API_KEY).toBeUndefined();
    });
  });

  describe("2. 이미지 유효성 검사 (5MB 제한 및 MIME 타입)", () => {
    it("지원하지 않는 MIME 타입(e.g. image/gif) 업로드 시 거부 에러 발생", () => {
      const gifDataUrl = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
      expect(() => validateImagePayload(gifDataUrl)).toThrow(
        "지원하지 않는 이미지 형식입니다. JPEG, PNG, WEBP 이미지만 지원합니다."
      );
    });

    it("지원하는 MIME 타입(image/jpeg, image/png, image/webp) 정상 통과", () => {
      const validPng =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
      const res = validateImagePayload(validPng);
      expect(res.mimeType).toBe("image/png");
      expect(res.rawBase64.length).toBeGreaterThan(0);
    });

    it("4MB를 초과하는 대용량 이미지 업로드 시 크기 제한 에러 발생", () => {
      // 4MB = 4 * 1024 * 1024 = 4,194,304 bytes.
      // Base64 문자열 약 6,000,000자 생성 (~4.5MB)
      const oversizedBase64 = "A".repeat(6000000);
      const oversizedDataUrl = `data:image/jpeg;base64,${oversizedBase64}`;
      expect(() => validateImagePayload(oversizedDataUrl)).toThrow(
        "이미지 크기는 4MB 이하여야 합니다."
      );
    });
  });

  describe("3. 사진 및 텍스트/운동 추정 서버 함수 (geminiServerFn)", () => {
    it("사진 분석(analyzeMealPhotoHandler): API 키 부재 시 안전한 에러 반환", async () => {
      delete process.env["GEMINI_API_KEY"];
      const smallPng =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

      await expect(
        analyzeMealPhotoHandler({ image: smallPng })
      ).rejects.toThrow("Gemini API 키가 설정되지 않았습니다. [ERR_CONFIG_MISSING]");
    });

    it("음식 텍스트 추정(estimateFoodTextHandler): 로컬 사전 매칭 시 0ms 즉시 반환 및 source: 'local'", async () => {
      const res = await estimateFoodTextHandler({ text: "공기밥 2공기" });
      expect(res.name).toContain("공기밥");
      expect(res.quantity).toBe(2);
      expect(res.unitKcal).toBe(300);
      expect(res.totalKcal).toBe(600);
      expect(res.isEstimate).toBe(true);
      expect(res.source).toBe("local");
      expect(res.description).toContain("로컬 DB");
    });

    it("음식 텍스트 추정(estimateFoodTextHandler): 사전에 없고 API 키 없을 때 동적 자체 추정(조리법 기반) 반환 및 source: 'fallback'", async () => {
      delete process.env["GEMINI_API_KEY"];
      const resFried = await estimateFoodTextHandler({ text: "오징어 튀김 2인분" });
      expect(resFried.totalKcal).toBe(620 * 2);
      expect(resFried.isEstimate).toBe(true);
      expect(resFried.source).toBe("fallback");
      expect(resFried.description).toContain("[자체 추정]");
    });

    it("운동 칼로리 추정(estimateExerciseCaloriesHandler): 키워드 매칭(수영 40분) 시 MET 공식 적용 및 source: 'local'", async () => {
      const res = await estimateExerciseCaloriesHandler({
        text: "수영 40분",
        weight: 60,
      });
      // 수영 met 7.5 * 60kg * (40/60) * 1.05 = 315 kcal
      expect(res.calories).toBe(315);
      expect(res.durationMinutes).toBe(40);
      expect(res.isEstimate).toBe(true);
      expect(res.source).toBe("local");
    });

    it("운동 칼로리 추정(estimateExerciseCaloriesHandler): 알 수 없는 운동이며 API 키 없을 때 MET 5.0 중강도 공식 적용 및 source: 'fallback'", async () => {
      delete process.env["GEMINI_API_KEY"];
      const res = await estimateExerciseCaloriesHandler({
        text: "이색 스포츠 30분",
        weight: 70,
      });
      // MET 5.0 * 70kg * (30/60) * 1.05 = 184 kcal
      expect(res.calories).toBe(184);
      expect(res.isEstimate).toBe(true);
      expect(res.source).toBe("fallback");
      expect(res.description).toContain("중강도 운동 기준 예상치");
    });
  });

  describe("4. AddFoodModal UI 플로우 및 [직접 입력으로 전환] 검증", () => {
    it(".env에 키가 없는 상태에서 사진 업로드 시 앱이 멈추지 않고 [분석 실패 → 직접 입력 탭 전환]이 정상 작동함", async () => {
      delete process.env["GEMINI_API_KEY"];
      const onClose = vi.fn();

      render(
        <DietProvider>
          <AddFoodModal meal="lunch" onClose={onClose} />
        </DietProvider>
      );

      // 모달 열림 확인
      expect(screen.getByText("점심 음식 추가")).toBeInTheDocument();
      expect(screen.getByText("음식 사진을 올려주세요")).toBeInTheDocument();

      // 파일 업로드 시뮬레이션
      const file = new File(["dummy content"], "test.png", { type: "image/png" });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).not.toBeNull();

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      // API 키 부재로 인한 분석 실패 에러 UI 렌더링 확인
      await waitFor(() => {
        expect(screen.getByText("AI 분석에 실패했습니다")).toBeInTheDocument();
      });

      // [직접 입력으로 전환] 버튼 확인
      const switchToManualBtn = screen.getByRole("button", { name: /직접 입력으로 전환/ });
      expect(switchToManualBtn).toBeInTheDocument();

      // 직접 입력으로 전환 클릭
      await act(async () => {
        fireEvent.click(switchToManualBtn);
      });

      // 직접 입력 탭의 음식명 인풋 및 등록하기 버튼이 화면에 즉시 노출됨 (앱 멈춤 없음)
      expect(screen.getByPlaceholderText("예: 현미밥 또는 닭가슴살 샐러드")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "등록하기" })).toBeInTheDocument();
    });

    it("직접 입력 탭에서 음식명 입력 후 [AI 추정] 클릭 시 영양정보 자동 채우기 및 '대략적 추정값' 뱃지 표시", async () => {
      const onClose = vi.fn();
      render(
        <DietProvider>
          <AddFoodModal meal="dinner" onClose={onClose} />
        </DietProvider>
      );

      // 직접 입력 탭으로 전환
      const manualTab = screen.getByRole("tab", { name: "직접 입력" });
      await act(async () => {
        fireEvent.pointerDown(manualTab);
        fireEvent.click(manualTab);
      });

      const foodInput = screen.getByPlaceholderText("예: 현미밥 또는 닭가슴살 샐러드");
      fireEvent.change(foodInput, { target: { value: "삶은계란 2개" } });

      const estimateBtn = screen.getByRole("button", { name: /AI 추정/ });
      await act(async () => {
        fireEvent.click(estimateBtn);
      });

      // 대략적 추정값 뱃지 표시 확인
      await waitFor(() => {
        expect(screen.getByText("대략적 추정값")).toBeInTheDocument();
      });

      // 총 칼로리가 150kcal (75 * 2)로 자동 계산됨 확인
      expect(screen.getByText("150 kcal")).toBeInTheDocument();
    });
  });

  describe("5. ExerciseCard AI 추정 및 '대략적 추정값' 뱃지 검증", () => {
    it("운동 종목 입력 후 [AI 추정] 클릭 시 MET 공식으로 계산되고 '대략적 추정값' 뱃지 표시", async () => {
      render(
        <DietProvider>
          <ExerciseCard />
        </DietProvider>
      );

      const exerciseInput = screen.getByPlaceholderText("운동 종목 (예: 수영 40분)");
      fireEvent.change(exerciseInput, { target: { value: "달리기 30분" } });

      const estimateBtn = screen.getByRole("button", { name: /AI 추정/ });
      await act(async () => {
        fireEvent.click(estimateBtn);
      });

      await waitFor(() => {
        expect(screen.getByText("대략적 추정값")).toBeInTheDocument();
      });

      // kcal 인풋에 숫자가 자동 입력되었음을 확인
      const kcalInput = screen.getByPlaceholderText("kcal") as HTMLInputElement;
      expect(Number(kcalInput.value)).toBeGreaterThan(0);
    });
  });

  describe("6. source 메타데이터에 따른 UI 뱃지 정확성 단독 검증 (지침 4)", () => {
    it("AddFoodModal: source가 'ai'일 때 'AI 정밀 분석' 뱃지 표시, source가 'fallback'일 때 '대략적 추정값' 뱃지 표시", async () => {
      const { estimateFoodTextFn } = await import("@/services/geminiServerFn");
      const onClose = vi.fn();

      // 1) source: 'ai' 시뮬레이션
      vi.mocked(estimateFoodTextFn).mockResolvedValueOnce({
        name: "정밀 분석 샐러드",
        quantity: 1,
        unit: "그릇",
        unitKcal: 220,
        unitCarb: 15,
        unitProtein: 20,
        unitFat: 8,
        totalKcal: 220,
        isEstimate: false,
        source: "ai",
      });

      const { unmount } = render(
        <DietProvider>
          <AddFoodModal meal="lunch" onClose={onClose} />
        </DietProvider>
      );

      const manualTab = screen.getByRole("tab", { name: "직접 입력" });
      await act(async () => {
        fireEvent.pointerDown(manualTab);
        fireEvent.click(manualTab);
      });

      const input = screen.getByPlaceholderText("예: 현미밥 또는 닭가슴살 샐러드");
      fireEvent.change(input, { target: { value: "샐러드" } });

      const estimateBtn = screen.getByRole("button", { name: /AI 추정/ });
      await act(async () => {
        fireEvent.click(estimateBtn);
      });

      await waitFor(() => {
        expect(screen.getByText("AI 정밀 분석")).toBeInTheDocument();
      });
      expect(screen.queryByText("대략적 추정값")).not.toBeInTheDocument();
      unmount();

      // 2) source: 'fallback' 시뮬레이션
      vi.mocked(estimateFoodTextFn).mockResolvedValueOnce({
        name: "추정 볶음밥",
        quantity: 1,
        unit: "인분",
        unitKcal: 520,
        unitCarb: 70,
        unitProtein: 12,
        unitFat: 20,
        totalKcal: 520,
        isEstimate: true,
        source: "fallback",
      });

      render(
        <DietProvider>
          <AddFoodModal meal="lunch" onClose={onClose} />
        </DietProvider>
      );

      const manualTab2 = screen.getByRole("tab", { name: "직접 입력" });
      await act(async () => {
        fireEvent.pointerDown(manualTab2);
        fireEvent.click(manualTab2);
      });

      const input2 = screen.getByPlaceholderText("예: 현미밥 또는 닭가슴살 샐러드");
      fireEvent.change(input2, { target: { value: "볶음밥" } });

      const estimateBtn2 = screen.getByRole("button", { name: /AI 추정/ });
      await act(async () => {
        fireEvent.click(estimateBtn2);
      });

      await waitFor(() => {
        expect(screen.getByText("대략적 추정값")).toBeInTheDocument();
      });
      expect(screen.queryByText("AI 정밀 분석")).not.toBeInTheDocument();
    });
  });

  describe("7. Gemini 업스트림 네트워크 호출 및 에러 마스킹 (지침 1)", () => {
    const validPng =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

    it("(a) 정상 200 응답: source가 'ai'이고, URL에 쿼리스트링 키(?key=)가 없으며 x-goog-api-key 헤더 검증", async () => {
      process.env["GEMINI_API_KEY"] = "SECURE_TEST_KEY_456";
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      name: "신선한 사과",
                      quantity: 1,
                      unit: "개",
                      calories: 95,
                      carbs: 25,
                      protein: 0.5,
                      fat: 0.3,
                      description: "AI 사과 분석 완료",
                    }),
                  },
                ],
              },
            },
          ],
        }),
      } as any);

      const res = await analyzeMealPhotoHandler({ image: validPng });
      expect(res.source).toBe("ai");
      expect(res.name).toBe("신선한 사과");
      expect(res.totalKcal).toBe(95);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [calledUrl, calledOptions] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(calledUrl).not.toContain("?key=");
      expect(calledUrl).not.toContain("SECURE_TEST_KEY_456");
      expect((calledOptions.headers as Record<string, string>)["x-goog-api-key"]).toBe("SECURE_TEST_KEY_456");
    });

    it("(b) HTTP 500 에러: 던져진 예외 메시지에 API 키나 원본 응답 본문이 없고 표준 한글 메시지만 노출", async () => {
      process.env["GEMINI_API_KEY"] = "SECURE_TEST_KEY_456";
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Crash",
        text: async () => "Secret Raw Stacktrace with AIzaSyDummyKey",
      } as any);

      await expect(analyzeMealPhotoHandler({ image: validPng })).rejects.toThrow(
        "식단 분석에 실패했습니다. 다시 시도해 주세요. [ERR_UPSTREAM_FAIL]"
      );

      try {
        await analyzeMealPhotoHandler({ image: validPng });
      } catch (err: any) {
        expect(err.message).not.toContain("SECURE_TEST_KEY_456");
        expect(err.message).not.toContain("Secret");
        expect(err.message).not.toContain("AIza");
        expect(err.message).not.toContain("Crash");
      }
    });

    it("(c) HTTP 429 에러: [ERR_RATE_LIMIT] 에러 코드가 정상 반환", async () => {
      process.env["GEMINI_API_KEY"] = "SECURE_TEST_KEY_456";
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
      } as any);

      await expect(analyzeMealPhotoHandler({ image: validPng })).rejects.toThrow("[ERR_RATE_LIMIT]");
    });

    it("(d) 네트워크 예외(reject with SENTINEL): 메시지와 콘솔 로그 어디에도 SENTINEL 미노출 및 안전 에러 변환", async () => {
      process.env["GEMINI_API_KEY"] = "SECURE_TEST_KEY_456";
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
        new Error("network connection dropped boom SENTINEL_KEY_XYZ_123")
      );

      const warnSpy = vi.spyOn(console, "warn");
      const errorSpy = vi.spyOn(console, "error");

      await expect(analyzeMealPhotoHandler({ image: validPng })).rejects.toThrow(
        "식단 분석에 실패했습니다. 네트워크 상태를 확인해 주세요. [ERR_NETWORK]"
      );

      // 콘솔 로그 전수 조사
      const allWarnLogs = warnSpy.mock.calls.map((c) => c.join(" ")).join("\n");
      const allErrorLogs = errorSpy.mock.calls.map((c) => c.join(" ")).join("\n");
      expect(allWarnLogs).not.toContain("SENTINEL_KEY_XYZ_123");
      expect(allErrorLogs).not.toContain("SENTINEL_KEY_XYZ_123");
    });

    it("(e) 텍스트 음식/운동 추정 시 Gemini 호출 실패 시 fallback으로 전환되며 source가 절대 'ai'가 아님", async () => {
      process.env["GEMINI_API_KEY"] = "SECURE_TEST_KEY_456";
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Upstream Network Timeout"));

      // 1) 텍스트 음식 추정 (사전에 없는 신규 메뉴)
      const foodRes = await estimateFoodTextHandler({ text: "알수없는마법스튜 1그릇" });
      expect(foodRes.source).toBe("fallback");
      expect(foodRes.source).not.toBe("ai");
      expect(foodRes.isEstimate).toBe(true);

      // 2) 운동 추정 (사전에 없는 종목)
      const exerciseRes = await estimateExerciseCaloriesHandler({ text: "무중력 유영 45분", weight: 70 });
      expect(exerciseRes.source).toBe("fallback");
      expect(exerciseRes.source).not.toBe("ai");
      expect(exerciseRes.isEstimate).toBe(true);
    });
  });

  describe("8. UI 뱃지 결정 조건 독립성 테스트 보강 (AddFoodModal & ExerciseCard) (지침 2)", () => {
    it("AddFoodModal: source: 'fallback' + isEstimate: false 조합 시 '대략적 추정값' 뱃지 렌더링", async () => {
      const { estimateFoodTextFn } = await import("@/services/geminiServerFn");
      vi.mocked(estimateFoodTextFn).mockResolvedValueOnce({
        name: "테스트 불일치 음식 A",
        quantity: 1,
        unit: "인분",
        unitKcal: 350,
        unitCarb: 40,
        unitProtein: 15,
        unitFat: 10,
        totalKcal: 350,
        isEstimate: false, // isEstimate는 false이나
        source: "fallback", // source는 fallback
      });

      render(
        <DietProvider>
          <AddFoodModal meal="lunch" onClose={vi.fn()} />
        </DietProvider>
      );

      const manualTab = screen.getByRole("tab", { name: "직접 입력" });
      await act(async () => {
        fireEvent.pointerDown(manualTab);
        fireEvent.click(manualTab);
      });

      const input = screen.getByPlaceholderText("예: 현미밥 또는 닭가슴살 샐러드");
      fireEvent.change(input, { target: { value: "임의음식A" } });

      const estimateBtn = screen.getByRole("button", { name: /AI 추정/ });
      await act(async () => {
        fireEvent.click(estimateBtn);
      });

      await waitFor(() => {
        expect(screen.getByText("대략적 추정값")).toBeInTheDocument();
      });
      expect(screen.queryByText("AI 정밀 분석")).not.toBeInTheDocument();
    });

    it("AddFoodModal: source: 'ai' + isEstimate: true 조합 시 'AI 정밀 분석' 뱃지 렌더링", async () => {
      const { estimateFoodTextFn } = await import("@/services/geminiServerFn");
      vi.mocked(estimateFoodTextFn).mockResolvedValueOnce({
        name: "테스트 불일치 음식 B",
        quantity: 1,
        unit: "인분",
        unitKcal: 450,
        unitCarb: 50,
        unitProtein: 20,
        unitFat: 15,
        totalKcal: 450,
        isEstimate: true, // isEstimate는 true이나
        source: "ai", // source는 ai
      });

      render(
        <DietProvider>
          <AddFoodModal meal="lunch" onClose={vi.fn()} />
        </DietProvider>
      );

      const manualTab = screen.getByRole("tab", { name: "직접 입력" });
      await act(async () => {
        fireEvent.pointerDown(manualTab);
        fireEvent.click(manualTab);
      });

      const input = screen.getByPlaceholderText("예: 현미밥 또는 닭가슴살 샐러드");
      fireEvent.change(input, { target: { value: "임의음식B" } });

      const estimateBtn = screen.getByRole("button", { name: /AI 추정/ });
      await act(async () => {
        fireEvent.click(estimateBtn);
      });

      await waitFor(() => {
        expect(screen.getByText("AI 정밀 분석")).toBeInTheDocument();
      });
      expect(screen.queryByText("대략적 추정값")).not.toBeInTheDocument();
    });

    it("ExerciseCard: source: 'fallback' + isEstimate: false 조합 시 '대략적 추정값' 뱃지 렌더링", async () => {
      const { estimateExerciseCaloriesFn } = await import("@/services/geminiServerFn");
      vi.mocked(estimateExerciseCaloriesFn).mockResolvedValueOnce({
        name: "불일치 운동 A",
        durationMinutes: 30,
        calories: 180,
        description: "추정 운동 A",
        isEstimate: false, // isEstimate는 false이나
        source: "fallback", // source는 fallback
      });

      render(
        <DietProvider>
          <ExerciseCard />
        </DietProvider>
      );

      const input = screen.getByPlaceholderText("운동 종목 (예: 수영 40분)");
      fireEvent.change(input, { target: { value: "불일치 운동 A" } });

      const estimateBtn = screen.getByRole("button", { name: /AI 추정/ });
      await act(async () => {
        fireEvent.click(estimateBtn);
      });

      await waitFor(() => {
        expect(screen.getByText("대략적 추정값")).toBeInTheDocument();
      });
      expect(screen.queryByText("AI 정밀 분석")).not.toBeInTheDocument();
    });

    it("ExerciseCard: source: 'ai' + isEstimate: true 조합 시 'AI 정밀 분석' 뱃지 렌더링", async () => {
      const { estimateExerciseCaloriesFn } = await import("@/services/geminiServerFn");
      vi.mocked(estimateExerciseCaloriesFn).mockResolvedValueOnce({
        name: "불일치 운동 B",
        durationMinutes: 40,
        calories: 280,
        description: "AI 운동 B",
        isEstimate: true, // isEstimate는 true이나
        source: "ai", // source는 ai
      });

      render(
        <DietProvider>
          <ExerciseCard />
        </DietProvider>
      );

      const input = screen.getByPlaceholderText("운동 종목 (예: 수영 40분)");
      fireEvent.change(input, { target: { value: "불일치 운동 B" } });

      const estimateBtn = screen.getByRole("button", { name: /AI 추정/ });
      await act(async () => {
        fireEvent.click(estimateBtn);
      });

      await waitFor(() => {
        expect(screen.getByText("AI 정밀 분석")).toBeInTheDocument();
      });
      expect(screen.queryByText("대략적 추정값")).not.toBeInTheDocument();
    });
  });

  describe("9. Gemini 연동 점검·복구·속도 개선 및 안정성 검증", () => {
    const validPng =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    const testSecretKey = "TEST_SECRET_KEY_987654";

    it("(a) 404 → 폴백 모델 재시도 성공", async () => {
      process.env["GEMINI_API_KEY"] = testSecretKey;
      const fetchSpy = vi.spyOn(globalThis, "fetch")
        // 1차: 주 모델 (gemini-3.5-flash-lite) 404
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: "Not Found",
          clone: () => ({
            text: async () => JSON.stringify({ error: { message: "models/gemini-3.5-flash-lite is not found" } }),
          }),
          text: async () => JSON.stringify({ error: { message: "models/gemini-3.5-flash-lite is not found" } }),
        } as any)
        // 2차: 폴백 모델 (gemini-3.5-flash) 200 성공
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        name: "폴백 김치찌개",
                        quantity: 1,
                        unit: "인분",
                        unitKcal: 450,
                        unitCarb: 25,
                        unitProtein: 28,
                        unitFat: 20,
                        description: "폴백 모델로 분석 성공",
                      }),
                    },
                  ],
                },
              },
            ],
          }),
        } as any);

      const res = await analyzeMealPhotoHandler({ image: validPng });
      expect(res.source).toBe("ai");
      expect(res.name).toBe("폴백 김치찌개");
      expect(res.totalKcal).toBe(450);

      // 1차 주 모델 호출 후 2차 폴백 모델 호출 확인
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      const [url1] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const [url2] = fetchSpy.mock.calls[1] as [string, RequestInit];
      expect(url1).toContain("gemini-3.5-flash-lite");
      expect(url2).toContain("gemini-3.5-flash");
    });

    it("(b) 폴백도 실패 시 ERR_MODEL_UNAVAILABLE, 로그에 키 없음", async () => {
      process.env["GEMINI_API_KEY"] = testSecretKey;
      const logSpy = vi.spyOn(console, "log");

      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: "Not Found",
          clone: () => ({ text: async () => "Not Found" }),
          text: async () => "Not Found",
        } as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: "Not Found",
          clone: () => ({ text: async () => "Not Found" }),
          text: async () => "Not Found",
        } as any);

      await expect(analyzeMealPhotoHandler({ image: validPng })).rejects.toThrow(
        "[ERR_MODEL_UNAVAILABLE]"
      );

      // 콘솔 로그 확인: 키는 절대 없고 status, model, duration만 기록
      const allLogs = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
      expect(allLogs).not.toContain(testSecretKey);
      expect(allLogs).toContain("status=404 model=gemini-3.5-flash-lite");
      expect(allLogs).toContain("status=404 model=gemini-3.5-flash");
    });

    it("(c) 429 폴백 재시도 및 500 처리 검증", async () => {
      process.env["GEMINI_API_KEY"] = testSecretKey;

      // 1) 429 발생 시 폴백 모델로 1회 재시도하여 성공하는 케이스
      const fetchSpy429 = vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: "Too Many Requests",
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        name: "재시도 성공 샐러드",
                        quantity: 1,
                        unit: "접시",
                        unitKcal: 200,
                        unitCarb: 15,
                        unitProtein: 10,
                        unitFat: 5,
                      }),
                    },
                  ],
                },
              },
            ],
          }),
        } as any);

      const res429 = await analyzeMealPhotoHandler({ image: validPng });
      expect(res429.name).toBe("재시도 성공 샐러드");
      expect(fetchSpy429).toHaveBeenCalledTimes(2);
      fetchSpy429.mockRestore();

      // 2) 폴백 모델까지 모두 429인 경우 [ERR_RATE_LIMIT]
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: "Too Many Requests",
        } as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: "Too Many Requests",
        } as any);

      await expect(analyzeMealPhotoHandler({ image: validPng })).rejects.toThrow(
        "[ERR_RATE_LIMIT]"
      );
    });

    it("(c-1) 503/5xx 서버 오류 시 폴백 모델 재시도 및 양쪽 실패 시 ERR_UPSTREAM_FAIL", async () => {
      process.env["GEMINI_API_KEY"] = testSecretKey;

      // 1) 1차 모델 503 (Service Unavailable) -> 2차 폴백 모델 재시도 200 성공
      const fetchSpy503 = vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: "Service Unavailable",
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        name: "503 폴백 성공 비빔밥",
                        quantity: 1,
                        unit: "그릇",
                        unitKcal: 550,
                        unitCarb: 70,
                        unitProtein: 20,
                        unitFat: 15,
                      }),
                    },
                  ],
                },
              },
            ],
          }),
        } as any);

      const res503 = await analyzeMealPhotoHandler({ image: validPng });
      expect(res503.name).toBe("503 폴백 성공 비빔밥");
      expect(fetchSpy503).toHaveBeenCalledTimes(2);
      fetchSpy503.mockRestore();

      // 2) 503 + 503 (양쪽 모두 503 실패) -> [ERR_UPSTREAM_FAIL] 에러 마스킹
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: "Service Unavailable",
        } as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: "Service Unavailable",
        } as any);

      await expect(analyzeMealPhotoHandler({ image: validPng })).rejects.toThrow(
        "[ERR_UPSTREAM_FAIL]"
      );
    });

    it("(c-2) MAX_TOKENS finishReason 발생 시 폴백 모델로 1회 재시도 및 한도 초과 처리", async () => {
      process.env["GEMINI_API_KEY"] = testSecretKey;

      // 1) 1차 모델 MAX_TOKENS 잘림 -> 2차 폴백 모델 재시도 성공
      const fetchSpyMax = vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                finishReason: "MAX_TOKENS",
                content: { parts: [{ text: "{\"name\":\"잘린응답" }] },
              },
            ],
          }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                finishReason: "STOP",
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        name: "완전한 식단",
                        quantity: 1,
                        unit: "인분",
                        unitKcal: 350,
                        unitCarb: 40,
                        unitProtein: 20,
                        unitFat: 10,
                      }),
                    },
                  ],
                },
              },
            ],
          }),
        } as any);

      const resMax = await analyzeMealPhotoHandler({ image: validPng });
      expect(resMax.name).toBe("완전한 식단");
      expect(fetchSpyMax).toHaveBeenCalledTimes(2);
      fetchSpyMax.mockRestore();

      // 2) 폴백 모델까지 모두 MAX_TOKENS인 경우 [ERR_MAX_TOKENS]
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{ finishReason: "MAX_TOKENS" }],
          }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{ finishReason: "MAX_TOKENS" }],
          }),
        } as any);

      await expect(analyzeMealPhotoHandler({ image: validPng })).rejects.toThrow(
        "[ERR_MAX_TOKENS]"
      );
    });

    it("(d) 스키마 응답 파싱과 서버의 source 및 isEstimate 부여", async () => {
      process.env["GEMINI_API_KEY"] = testSecretKey;

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    // 모델이 source나 isEstimate를 전혀 주지 않음
                    text: JSON.stringify({
                      name: "현미밥과 두부",
                      quantity: 2,
                      unit: "공기",
                      unitKcal: 320,
                      unitCarb: 65,
                      unitProtein: 15,
                      unitFat: 3,
                      description: "영양 만점 식단",
                    }),
                  },
                ],
              },
            },
          ],
        }),
      } as any);

      const res = await analyzeMealPhotoHandler({ image: validPng });
      // 서버가 직접 source와 isEstimate 부여
      expect(res.source).toBe("ai");
      expect(res.isEstimate).toBe(false);
      expect(res.quantity).toBe(2);
      expect(res.unitKcal).toBe(320);
      expect(res.totalKcal).toBe(640);
      expect(res.unitCarb).toBe(65);
      expect(res.unitProtein).toBe(15);
      expect(res.unitFat).toBe(3);
    });

    it("(e) 4MB 초과 거부 [ERR_PAYLOAD_TOO_LARGE]", () => {
      // 4MB = 4,194,304 bytes. 약 5.7MB 생성
      const hugeBase64 = "X".repeat(5700000);
      const hugeDataUrl = `data:image/jpeg;base64,${hugeBase64}`;
      expect(() => validateImagePayload(hugeDataUrl)).toThrow("[ERR_PAYLOAD_TOO_LARGE]");
    });

    it("(f) 요청 본문에 thinking 설정 포함, 3.x temperature 미전송 및 2.x temperature 0.1 전송", async () => {
      process.env["GEMINI_API_KEY"] = testSecretKey;

      // 1) 3.x 기본 모델 (gemini-3.5-flash-lite) -> thinkingLevel: "minimal", temperature 미설정
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      name: "샐러드",
                      quantity: 1,
                      unit: "그릇",
                      unitKcal: 150,
                      unitCarb: 10,
                      unitProtein: 5,
                      unitFat: 8,
                    }),
                  },
                ],
              },
            },
          ],
        }),
      } as any);

      await analyzeMealPhotoHandler({ image: validPng });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url1, opt1] = fetchSpy.mock.calls[0] as [string, RequestInit];

      // URL에 키 없음 및 주 모델명 확인
      expect(url1).toContain("gemini-3.5-flash-lite");
      expect(url1).not.toContain("?key=");
      expect(url1).not.toContain(testSecretKey);
      // 헤더에만 키 존재
      expect((opt1.headers as Record<string, string>)["x-goog-api-key"]).toBe(testSecretKey);

      // 요청 본문에 thinkingLevel: "minimal" 및 3.x temperature 미설정 확인
      const body1 = JSON.parse(opt1.body as string);
      expect(body1.generationConfig.thinkingConfig).toEqual({ thinkingLevel: "minimal" });
      expect(body1.generationConfig.temperature).toBeUndefined();
      expect(body1.generationConfig.responseSchema).toBeDefined();
      expect(body1.generationConfig.responseSchema.properties.name).toBeDefined();

      fetchSpy.mockRestore();

      // 2) 2.x 모델 (gemini-2.5-flash) 명시 시 -> thinkingBudget: 0, temperature: 0.1
      process.env["GEMINI_MODEL"] = "gemini-2.5-flash";
      const fetchSpy2 = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      name: "계란",
                      quantity: 1,
                      unit: "개",
                      unitKcal: 80,
                      unitCarb: 1,
                      unitProtein: 7,
                      unitFat: 5,
                    }),
                  },
                ],
              },
            },
          ],
        }),
      } as any);

      await analyzeMealPhotoHandler({ image: validPng });
      expect(fetchSpy2).toHaveBeenCalledTimes(1);
      const [url2, opt2] = fetchSpy2.mock.calls[0] as [string, RequestInit];
      expect(url2).toContain("gemini-2.5-flash");
      const body2 = JSON.parse(opt2.body as string);
      expect(body2.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
      expect(body2.generationConfig.temperature).toBe(0.1);
    });
  });
});
