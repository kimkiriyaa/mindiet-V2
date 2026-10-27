import { Bot, Home, Trophy, User } from "lucide-react";

export type TabKey = "home" | "coach" | "battle" | "me";
const TABS = [
  { key: "home", label: "홈", icon: Home },
  { key: "coach", label: "AI 코치", icon: Bot },
  { key: "battle", label: "챌린지", icon: Trophy },
  { key: "me", label: "내 정보", icon: User },
] as const;

export function BottomTabBar({ tab, onChange }: { tab: TabKey; onChange: (t: TabKey) => void }) {
  return (
    <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-[480px] -translate-x-1/2 border-t bg-background/95 backdrop-blur">
      <div className="grid grid-cols-4">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => onChange(key)}
            className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${tab === key ? "text-primary" : "text-muted-foreground"}`}>
            <Icon className="h-5 w-5" strokeWidth={tab === key ? 2.5 : 2} />{label}
          </button>
        ))}
      </div>
    </nav>
  );
}
