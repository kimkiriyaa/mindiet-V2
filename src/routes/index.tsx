import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { DietProvider, useDiet } from "@/context/DietContext";
import { BottomTabBar, type TabKey } from "@/components/diet/BottomTabBar";
import { HomeTab } from "@/components/diet/HomeTab";
import { CoachTab } from "@/components/diet/CoachTab";
import { BattleTab } from "@/components/diet/BattleTab";
import { MyInfoTab } from "@/components/diet/MyInfoTab";
import { AuthModal } from "@/components/diet/AuthModal";
import { OnboardingModal } from "@/components/diet/OnboardingModal";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "민다이어트 MinDiet - 오늘의 식단·운동·체중 기록" },
      { name: "description", content: "목표 칼로리와 탄단지를 자동 계산하고 식단, 운동, 체중을 한 곳에서 기록하는 민다이어트." },
      { property: "og:title", content: "민다이어트 MinDiet" },
      { property: "og:description", content: "목표 칼로리 자동 계산과 간편한 식단·운동·체중 기록." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

export function App() {
  const { hydrated, session, profile, isProfileLoaded, profileLoadStatus, logout, recoverCorruptedProfile } = useDiet();
  const [tab, setTab] = useState<TabKey>("home");

  // SSR / Hydration 로딩 중 또는 세션은 있으나 프로필 조회가 진행 중인 찰나의 플리커 차단
  if (!hydrated || (session && !isProfileLoaded)) {
    return null;
  }

  // 1. 로그인 세션이 없으면 AuthModal 표시
  if (!session) return <AuthModal />;

  // 1-1. 스토리지 읽기 에러 발생 시 온보딩(신규 유저)으로 오판하지 않고 안전한 복구 에러 화면 표시
  if (profileLoadStatus === 'error') {
    const handleReset = () => {
      const confirmed = typeof window !== 'undefined' && window.confirm
        ? window.confirm('손상된 기존 프로필을 백업하고 초기 설정으로 새로 시작하시겠습니까?')
        : false;
      if (confirmed) {
        recoverCorruptedProfile();
      }
    };

    return (
      <div className="flex h-screen items-center justify-center p-6 text-center" data-testid="storage-error-screen">
        <div className="max-w-md rounded-2xl border border-destructive/20 bg-destructive/10 p-6 space-y-4">
          <h2 className="text-lg font-bold text-destructive">데이터 읽기 오류</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            저장소에서 프로필을 불러오는 중 오류가 발생했습니다.<br />
            기존 데이터를 안전하게 보호하기 위해 자동 저장이 중단되었습니다.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2 px-4 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition shadow-xs"
            >
              새로고침
            </button>
            <button
              onClick={logout}
              data-testid="error-logout-btn"
              className="w-full py-2 px-4 rounded-xl border border-border bg-card font-medium text-sm hover:bg-muted transition"
            >
              로그아웃
            </button>
            <button
              onClick={handleReset}
              data-testid="error-reset-btn"
              className="w-full py-2 px-4 rounded-xl border border-destructive/40 text-destructive text-sm font-medium hover:bg-destructive/10 transition"
            >
              손상 데이터 백업 후 새로 시작
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. 세션은 있으나 정상적으로 프로필이 없는 경우(신규 사용자)에만 OnboardingModal 표시
  if (!profile) return <OnboardingModal />;

  // 3. 인증 및 프로필 완료 시 메인 화면 진입
  return (
    <>
      <main className="px-5 pb-24 pt-5">
        {tab === "home" && <HomeTab />}
        {tab === "coach" && <CoachTab />}
        {tab === "battle" && <BattleTab />}
        {tab === "me" && <MyInfoTab onSaved={() => setTab("home")} />}
      </main>
      <BottomTabBar tab={tab} onChange={setTab} />
    </>
  );
}

export function Index() {
  return (
    <div className="min-h-screen bg-canvas">
      {import.meta.env.DEV && (
        <aside className="bg-emerald-600 text-white text-xs font-bold py-1.5 px-4 text-center sticky top-0 z-50 shadow-xs flex items-center justify-center gap-2">
          <span>🎨 홈 탭 UI 개선 3대 시안 실시간 비교:</span>
          <Link to="/design-preview" className="underline hover:opacity-90 font-extrabold bg-emerald-700/80 px-2 py-0.5 rounded">시안 보러가기 →</Link>
        </aside>
      )}
      <div className="mx-auto min-h-screen w-full max-w-[480px] bg-background shadow-sm">
        <DietProvider><App /></DietProvider>
      </div>
      <Toaster position="top-center" />
    </div>
  );
}
