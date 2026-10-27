import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { DietProvider, useDiet } from "@/context/DietContext";
import { BottomTabBar, type TabKey } from "@/components/diet/BottomTabBar";
import { HomeTab } from "@/components/diet/HomeTab";
import { CoachTab } from "@/components/diet/CoachTab";
import { BattleTab } from "@/components/diet/BattleTab";
import { MyInfoTab } from "@/components/diet/MyInfoTab";
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
  const { hydrated, profile } = useDiet();
  const [tab, setTab] = useState<TabKey>("home");
  if (!hydrated) return null;
  if (!profile) return <OnboardingModal />;
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
