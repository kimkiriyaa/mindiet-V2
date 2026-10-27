import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
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

function App() {
  const { hydrated, session, profile, isProfileLoaded } = useDiet();
  const [tab, setTab] = useState<TabKey>("home");

  // SSR / Hydration 로딩 중 또는 세션은 있으나 프로필 조회가 진행 중인 찰나의 플리커 차단
  if (!hydrated || (session && !isProfileLoaded)) {
    return null;
  }

  // 1. 로그인 세션이 없으면 AuthModal 표시
  if (!session) return <AuthModal />;

  // 2. 세션은 있으나 프로필이 없으면 OnboardingModal 표시
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

function Index() {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto min-h-screen w-full max-w-[480px] bg-background shadow-sm">
        <DietProvider><App /></DietProvider>
      </div>
      <Toaster position="top-center" />
    </div>
  );
}
