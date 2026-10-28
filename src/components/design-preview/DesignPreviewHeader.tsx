import React from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, Sparkles, CheckCircle2, AlertTriangle, CircleDashed } from 'lucide-react';
import type { PreviewStateType } from './previewMockData';

export type ProposalType = 'A' | 'B' | 'C';

interface DesignPreviewHeaderProps {
  proposal: ProposalType;
  onSelectProposal: (p: ProposalType) => void;
  state: PreviewStateType;
  onSelectState: (s: PreviewStateType) => void;
}

export function DesignPreviewHeader({
  proposal,
  onSelectProposal,
  state,
  onSelectState,
}: DesignPreviewHeaderProps) {
  const proposalTitles: Record<ProposalType, { name: string; tag: string }> = {
    A: { name: 'A안 요약 우선', tag: 'Fold 압축 + 아코디언' },
    B: { name: 'B안 세그먼트 분리', tag: '식단 / 바디 탭 분리' },
    C: { name: 'C안 기록 버튼 중심', tag: '타임라인 + 엄지 FAB' },
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/95 backdrop-blur-md px-4 py-3 shadow-xs">
      {/* 1. 상단 바: 홈 바로가기 + 프리뷰 타이틀 */}
      <div className="flex items-center justify-between pb-2.5">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition rounded-lg px-2 py-1 bg-secondary/80 hover:bg-secondary"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>실제 앱으로 복귀</span>
        </Link>
        <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          <span>홈 탭 UI 개선 3대 시안</span>
        </div>
      </div>

      {/* 2. 시안 선택 스위치 [A] [B] [C] */}
      <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-secondary/80 p-1">
        {(['A', 'B', 'C'] as ProposalType[]).map((p) => {
          const active = proposal === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onSelectProposal(p)}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg text-xs font-bold transition-all min-h-[44px] ${
                active
                  ? 'bg-background text-foreground shadow-xs border border-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="flex items-center gap-1">
                <span className={`inline-block w-2 h-2 rounded-full ${active ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
                {proposalTitles[p].name}
              </span>
              <span className="text-[10px] font-normal opacity-70 truncate max-w-full">
                {proposalTitles[p].tag}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. 데이터 상태 토글 ([기록 있음] / [기록 없음] / [목표 초과]) */}
      <div className="mt-2.5 flex items-center justify-between gap-1 text-[11px]">
        <span className="text-muted-foreground shrink-0 font-medium hidden sm:inline">상태 테스트:</span>
        <div className="grid grid-cols-3 gap-1 w-full sm:w-auto flex-1">
          <button
            type="button"
            onClick={() => onSelectState('normal')}
            className={`flex items-center justify-center gap-1 py-1 px-2 rounded-md font-semibold transition min-h-[36px] ${
              state === 'normal'
                ? 'bg-emerald-500 text-white shadow-xs'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            <CheckCircle2 className="h-3 w-3" />
            <span>기록 있음 (660kcal 남음)</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectState('empty')}
            className={`flex items-center justify-center gap-1 py-1 px-2 rounded-md font-semibold transition min-h-[36px] ${
              state === 'empty'
                ? 'bg-zinc-800 text-white shadow-xs dark:bg-zinc-200 dark:text-zinc-900'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            <CircleDashed className="h-3 w-3" />
            <span>기록 없음 (0kcal)</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectState('over')}
            className={`flex items-center justify-center gap-1 py-1 px-2 rounded-md font-semibold transition min-h-[36px] ${
              state === 'over'
                ? 'bg-orange-500 text-white shadow-xs'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            <AlertTriangle className="h-3 w-3" />
            <span>목표 초과 (+400kcal)</span>
          </button>
        </div>
      </div>
    </header>
  );
}
