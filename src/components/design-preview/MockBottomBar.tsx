import React from 'react';
import { Home, Bot, Swords, User } from 'lucide-react';

export function MockBottomBar() {
  return (
    <nav className="sticky bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-md px-4 py-2">
      <div className="mx-auto flex max-w-[480px] items-center justify-around">
        <button
          type="button"
          className="flex flex-col items-center gap-1 text-primary min-w-[56px] py-1 cursor-default"
        >
          <div className="rounded-full bg-primary/10 p-1.5">
            <Home className="h-5 w-5" />
          </div>
          <span className="text-[11px] font-bold">홈</span>
        </button>

        <button
          type="button"
          className="flex flex-col items-center gap-1 text-muted-foreground/60 min-w-[56px] py-1 cursor-default"
        >
          <div className="p-1.5">
            <Bot className="h-5 w-5" />
          </div>
          <span className="text-[11px] font-medium">AI 코치</span>
        </button>

        <button
          type="button"
          className="flex flex-col items-center gap-1 text-muted-foreground/60 min-w-[56px] py-1 cursor-default"
        >
          <div className="p-1.5">
            <Swords className="h-5 w-5" />
          </div>
          <span className="text-[11px] font-medium">챌린지</span>
        </button>

        <button
          type="button"
          className="flex flex-col items-center gap-1 text-muted-foreground/60 min-w-[56px] py-1 cursor-default"
        >
          <div className="p-1.5">
            <User className="h-5 w-5" />
          </div>
          <span className="text-[11px] font-medium">내 정보</span>
        </button>
      </div>
    </nav>
  );
}
