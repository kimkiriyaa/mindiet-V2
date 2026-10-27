import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

import { routeTree } from "@/routeTree.gen";
import { DietProvider } from "@/context/DietContext";
import { App } from "@/routes/index";
import { setSavedSession, getProfileKey } from "@/services/storageService";

describe("지침 14: App routing 및 복구 에러 화면 검증", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    const matches = router.matchRoutes("/");
    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("시나리오 1: 세션 부재/로그아웃 직후 즉시 AuthModal이 렌더링되는지 검증", () => {
    setSavedSession(null);

    render(
      <DietProvider>
        <App />
      </DietProvider>
    );

    // AuthModal 렌더링 확인 (로그인 버튼 및 회원가입 전환 안내)
    expect(screen.getByRole("button", { name: /로그인/ })).toBeInTheDocument();
    expect(screen.getByText("처음 이용하시나요? 새 계정 등록하기")).toBeInTheDocument();
  });

  it("시나리오 2: 프로필 status === 'error' 시 신규 유저 온보딩 모달이 뜨지 않고 에러 화면이 렌더링되는지 검증", () => {
    const testUser = "corrupt_user";
    setSavedSession({ userId: testUser, userName: "손상계정" });

    // 손상된 프로필 JSON 데이터 주입
    const profileKey = getProfileKey(testUser);
    localStorage.setItem(profileKey, "{ broken: invalid_json");

    render(
      <DietProvider>
        <App />
      </DietProvider>
    );

    // 1) 복구 가능한 에러 화면 렌더링 확인
    expect(screen.getByTestId("storage-error-screen")).toBeInTheDocument();
    expect(screen.getByText("데이터 읽기 오류")).toBeInTheDocument();

    // 2) 신규 유저 온보딩 모달은 절대 뜨지 않아야 함 (데이터 오판 방어)
    expect(screen.queryByText("기본 정보를 알려주세요")).not.toBeInTheDocument();
    expect(screen.queryByText("민다이어트 시작하기")).not.toBeInTheDocument();
  });

  it("시나리오 3: 에러 화면에서 [로그아웃] 버튼 클릭 시 세션이 정리되고 AuthModal로 정상 전환되는지 검증", async () => {
    const testUser = "corrupt_user2";
    setSavedSession({ userId: testUser, userName: "손상계정2" });
    const profileKey = getProfileKey(testUser);
    localStorage.setItem(profileKey, "{ broken: invalid_json");

    render(
      <DietProvider>
        <App />
      </DietProvider>
    );

    expect(screen.getByTestId("storage-error-screen")).toBeInTheDocument();

    // 로그아웃 버튼 클릭
    const logoutBtn = screen.getByTestId("error-logout-btn");
    act(() => {
      fireEvent.click(logoutBtn);
    });

    // 에러 화면이 언마운트되고 즉시 AuthModal이 렌더링됨
    expect(screen.queryByTestId("storage-error-screen")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /로그인/ })).toBeInTheDocument();
    expect(screen.getByText("처음 이용하시나요? 새 계정 등록하기")).toBeInTheDocument();
  });

  it("시나리오 4: 손상 복구 확인 거절(confirm: false) 시 원본 유지 및 에러 화면 유지 (지침 26)", () => {
    const testUser = "corrupt_user_cancel";
    setSavedSession({ userId: testUser, userName: "취소계정" });
    const profileKey = getProfileKey(testUser);
    const brokenData = "{ broken: cancel_test";
    localStorage.setItem(profileKey, brokenData);

    // confirm 모킹: 사용자가 '취소' 클릭
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(
      <DietProvider>
        <App />
      </DietProvider>
    );

    const resetBtn = screen.getByTestId("error-reset-btn");
    act(() => {
      fireEvent.click(resetBtn);
    });

    expect(confirmSpy).toHaveBeenCalled();
    // 데이터가 삭제되지 않고 유지됨
    expect(localStorage.getItem(profileKey)).toBe(brokenData);
    // 여전히 에러 화면 유지
    expect(screen.getByTestId("storage-error-screen")).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it("시나리오 5: 손상 복구 승인(confirm: true) 시 타임스탬프 격리 백업 후 온보딩 화면으로 안전 리셋 (지침 26)", () => {
    const testUser = "corrupt_user_ok";
    setSavedSession({ userId: testUser, userName: "복구계정" });
    const profileKey = getProfileKey(testUser);
    const brokenData = "{ broken: restore_test";
    localStorage.setItem(profileKey, brokenData);

    // confirm 모킹: 사용자가 '확인' 클릭
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <DietProvider>
        <App />
      </DietProvider>
    );

    const resetBtn = screen.getByTestId("error-reset-btn");
    act(() => {
      fireEvent.click(resetBtn);
    });

    expect(confirmSpy).toHaveBeenCalled();
    // 원본 손상 키는 안전하게 삭제됨
    expect(localStorage.getItem(profileKey)).toBeNull();
    // 온보딩 모달 타이틀이 화면에 표시됨
    expect(screen.getByText("기본 정보를 알려주세요")).toBeInTheDocument();
    confirmSpy.mockRestore();
  });
});
