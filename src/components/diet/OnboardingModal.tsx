import { useState } from "react";
import { Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDiet } from "@/context/DietContext";
import { DEFAULT_PROFILE, type Profile } from "@/lib/diet";
import { ProfileFields } from "./ProfileFields";

export function OnboardingModal() {
  const { setProfile, session, profile } = useDiet();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Profile>(() => ({
    ...DEFAULT_PROFILE,
    nickname: session?.userName || DEFAULT_PROFILE.nickname,
  }));
  const sections = [["basic"], ["weight"], ["plan"]] as const;
  const titles = ["기본 정보를 알려주세요", "체중 목표를 정해요", "생활 패턴과 식단"];

  const handleSkip = () => {
    // 기존 프로필이 없을 때만 안전하게 기본 프로필 적용
    if (!profile) {
      setProfile({
        ...DEFAULT_PROFILE,
        nickname: session?.userName || DEFAULT_PROFILE.nickname,
      });
    }
  };

  const handleComplete = () => {
    setProfile(draft);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-canvas">
      <div className="flex w-full max-w-[480px] flex-col bg-background p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-primary">
            <Sprout className="h-5 w-5" />
            민다이어트
          </div>
          <button
            type="button"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition"
            onClick={handleSkip}
          >
            건너뛰기
          </button>
        </div>
        <div className="mt-6 flex gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                i <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
        <p className="mt-6 text-sm font-semibold text-primary">STEP {step + 1} / 3</p>
        <h1 className="mt-1 text-2xl font-bold">{titles[step]}</h1>
        <div className="mt-6 flex-1 overflow-y-auto">
          <ProfileFields value={draft} onChange={setDraft} sections={sections[step] ?? sections[0]} />
        </div>
        <div className="mt-4 flex gap-2">
          {step > 0 && (
            <Button variant="outline" className="h-12 flex-1 font-semibold" onClick={() => setStep(step - 1)}>
              이전
            </Button>
          )}
          <Button
            className="h-12 flex-[2] font-bold"
            onClick={() => (step < 2 ? setStep(step + 1) : handleComplete())}
          >
            {step < 2 ? "다음" : "시작하기"}
          </Button>
        </div>
      </div>
    </div>
  );
}
