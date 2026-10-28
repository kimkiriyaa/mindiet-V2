import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { DietProvider, useDiet } from "@/context/DietContext";
import { HomeTab } from "@/components/diet/HomeTab";
import { DEFAULT_PROFILE, type Profile, toLocalDateKey } from "@/lib/diet";
import {
  registerUserLocal,
  saveUserProfile,
  setSavedSession,
} from "@/services/storageService";

describe("홈 탭 확정 UI 레이아웃 및 컴포넌트 실시간 연동 검증", () => {
  const today = toLocalDateKey();

  beforeEach(async () => {
    localStorage.clear();
    await registerUserLocal("tester", "pass123", "민수");
    setSavedSession({ userId: "tester", userName: "민수" });
    const profile: Profile = {
      ...DEFAULT_PROFILE,
      nickname: "민수",
      startWeight: 70,
      targetWeight: 65,
      gender: "male",
      height: 175,
      age: 30,
      activityLevel: "moderate",
    };
    saveUserProfile("tester", profile);
  });

  const setupTest = () => {
    let dietContextRef: ReturnType<typeof useDiet>;
    function TestConsumer() {
      dietContextRef = useDiet();
      return <HomeTab />;
    }

    const renderResult = render(
      <DietProvider>
        <TestConsumer />
      </DietProvider>
    );

    return {
      ...renderResult,
      getDiet: () => dietContextRef,
    };
  };

  it("Test (a): 메인 요약 보드의 잔여 칼로리(방안 C: 목표 - 섭취) 및 소모 칼로리 실시간 바인딩 검증", async () => {
    const { getDiet } = setupTest();

    // 초기 상태 확인 (섭취 0)
    expect(screen.getByText("✨ 오늘 남은 여유 칼로리")).toBeInTheDocument();
    expect(screen.getByText("첫 끼니를 기록해 보세요 🌱")).toBeInTheDocument();

    const initialTarget = getDiet().targetKcal;
    expect(initialTarget).toBeGreaterThan(0);

    // 1) 500 kcal 식단 추가
    act(() => {
      getDiet().addFood({
        date: today,
        meal: "breakfast",
        name: "오트밀과 사과",
        qty: 1,
        unitKcal: 500,
        unitCarb: 80,
        unitProtein: 15,
        unitFat: 10,
      });
    });

    // 2) 300 kcal 운동 추가 및 5,000 걸음 설정
    act(() => {
      getDiet().addExercise({
        date: today,
        name: "조깅 30분",
        kcal: 300,
      });
      getDiet().setSteps(5000);
    });

    const targetKcal = getDiet().targetKcal;
    const expectedRemaining = targetKcal - 500;
    const expectedBurned = 300 + getDiet().stepCalories;
    const expectedNet = 500 - expectedBurned;

    // 대형 폰트 잔여 칼로리 및 단위 표시 확인
    expect(screen.getByText(expectedRemaining.toLocaleString())).toBeInTheDocument();
    expect(screen.getByText("kcal 남음")).toBeInTheDocument();

    // 하단 3종 알약 칩 [섭취 / 소모 / 순 섭취]
    expect(screen.getByText("500")).toBeInTheDocument();
    expect(screen.getByText(`-${expectedBurned.toLocaleString()}`)).toBeInTheDocument();
    expect(screen.getByText(expectedNet.toLocaleString())).toBeInTheDocument();

    // 세그먼트 스위처 버튼의 칼로리 반영 확인
    expect(screen.getByRole("button", { name: /식단 기록 \(500 kcal\)/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: new RegExp(`바디 & 활동 \\(-${expectedBurned} kcal\\)`) })
    ).toBeInTheDocument();
  });

  it("Test (b): 칼로리 목표 초과 시 주황색 경고 테마 및 문구 전환 검증 (방안 C)", async () => {
    const { getDiet } = setupTest();
    const targetKcal = getDiet().targetKcal;

    // 목표치보다 400 kcal 초과하도록 대량 식단 추가
    const overIntake = targetKcal + 400;
    act(() => {
      getDiet().addFood({
        date: today,
        meal: "dinner",
        name: "삼겹살 회식",
        qty: 1,
        unitKcal: overIntake,
        unitCarb: 20,
        unitProtein: 80,
        unitFat: 120,
      });
    });

    // 초과 타이틀 및 안내 문구 확인
    expect(screen.getByText("⚠️ 칼로리 목표 초과")).toBeInTheDocument();
    expect(screen.getByText("+400")).toBeInTheDocument();
    expect(screen.getByText("kcal 초과 ⚠️")).toBeInTheDocument();
    expect(screen.getByText("목표보다 400 kcal 초과했어요")).toBeInTheDocument();

    // 경고 클래스 (text-warning) 적용 확인
    const overNumber = screen.getByText("+400");
    expect(overNumber).toHaveClass("text-warning");
  });

  it("Test (c): 2-탭 세그먼트 스위처(식단 기록 ↔ 바디 & 활동) 전환 검증", async () => {
    setupTest();

    // 기본 탭은 '식단 기록'이 활성화되어 있어야 함
    expect(screen.getByText("오늘의 끼니 현황")).toBeInTheDocument();
    expect(screen.queryByText("활동 및 운동 기록")).not.toBeInTheDocument();
    expect(screen.queryByText("수분 섭취")).not.toBeInTheDocument();

    // '바디 & 활동' 탭 클릭
    const bodyTabButton = screen.getByRole("button", { name: /바디 & 활동/ });
    fireEvent.click(bodyTabButton);

    // 바디 & 활동 컴포넌트들(걸음수/운동, 수분, 체중)이 렌더링되고 식단 그리드는 사라져야 함
    expect(screen.getByText("활동 및 운동 기록")).toBeInTheDocument();
    expect(screen.getByText("수분 섭취")).toBeInTheDocument();
    expect(screen.getByText("체중 기록")).toBeInTheDocument();
    expect(screen.getByText("+1,000보")).toBeInTheDocument();
    expect(screen.queryByText("오늘의 끼니 현황")).not.toBeInTheDocument();

    // 다시 '식단 기록' 탭 클릭
    const mealsTabButton = screen.getByRole("button", { name: /식단 기록/ });
    fireEvent.click(mealsTabButton);

    // 다시 식단 그리드가 나타남
    expect(screen.getByText("오늘의 끼니 현황")).toBeInTheDocument();
    expect(screen.queryByText("활동 및 운동 기록")).not.toBeInTheDocument();
  });

  it("Test (d): 2x2 끼니 카드 클릭 상호작용 (미입력 -> 모달 호출, 입력됨 -> 바텀 시트 열림 및 수량 조절)", async () => {
    const { getDiet } = setupTest();

    // 1) 점심에 식단 등록
    act(() => {
      getDiet().addFood({
        date: today,
        meal: "lunch",
        name: "닭가슴살 샐러드",
        qty: 1,
        unitKcal: 250,
        unitCarb: 10,
        unitProtein: 35,
        unitFat: 5,
      });
    });

    // 2x2 카드 확인: 아침(미입력), 점심(250 kcal), 저녁(미입력), 간식(미입력)
    expect(screen.getAllByText("미입력")).toHaveLength(3);
    expect(screen.getByText("250 kcal")).toBeInTheDocument();
    expect(screen.getByText("닭가슴살 샐러드")).toBeInTheDocument();

    // 2) 입력된 점심 카드 클릭 -> 바텀 시트 열림
    const lunchCard = screen.getByText("250 kcal").closest("button");
    expect(lunchCard).not.toBeNull();
    fireEvent.click(lunchCard!);

    // 바텀 시트 헤더 확인
    expect(screen.getByText("점심 식단 상세")).toBeInTheDocument();
    expect(screen.getByText("음식별 수량 조절(±0.5) 및 삭제, 추가가 가능합니다.")).toBeInTheDocument();

    // 수량 조절 버튼 (+) 클릭 -> 1 -> 1.5로 증가
    const plusButton = screen.getByTitle("수량 0.5 증가");
    act(() => {
      fireEvent.click(plusButton);
    });

    // DietContext 수량 반영 확인 (1.5)
    expect(getDiet().foods[0]?.qty).toBe(1.5);
    expect(screen.getByText("1.5")).toBeInTheDocument();
    // 250 * 1.5 = 375 kcal (카드, 시트 헤더, 아이템 행 모두 실시간 반영)
    expect(screen.getAllByText("375 kcal").length).toBeGreaterThanOrEqual(2);

    // 바텀 시트 내 "+ 음식 추가하기" 버튼 존재 확인
    expect(screen.getByRole("button", { name: /\+ 음식 추가하기/ })).toBeInTheDocument();
  });

  it("Test (e): 바디 탭에서 걸음 수 +1,000보 퀵 추가 및 수분 -250ml 차감 동작 검증", async () => {
    const { getDiet } = setupTest();

    // 초기 수분 500ml 추가, 걸음 수 3,000보 설정
    act(() => {
      getDiet().addWater(500);
      getDiet().setSteps(3000);
    });

    // 바디 & 활동 탭으로 이동
    const bodyTabButton = screen.getByRole("button", { name: /바디 & 활동/ });
    fireEvent.click(bodyTabButton);

    // 걸음 수 +1,000보 클릭
    const step1000Btn = screen.getByRole("button", { name: "+1,000보" });
    act(() => {
      fireEvent.click(step1000Btn);
    });
    expect(getDiet().steps).toBe(4000);

    // 수분 -250ml 클릭
    const waterMinusBtn = screen.getByRole("button", { name: /-250 ml/ });
    act(() => {
      fireEvent.click(waterMinusBtn);
    });
    expect(getDiet().waterMl).toBe(250);
  });
});
