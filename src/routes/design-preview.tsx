import React, { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { DesignPreviewHeader, type ProposalType } from '@/components/design-preview/DesignPreviewHeader';
import { ProposalA } from '@/components/design-preview/ProposalA';
import { ProposalB } from '@/components/design-preview/ProposalB';
import { ProposalC } from '@/components/design-preview/ProposalC';
import { MockBottomBar } from '@/components/design-preview/MockBottomBar';
import { PREVIEW_MOCK_DATA, type PreviewStateType } from '@/components/design-preview/previewMockData';

export const Route = createFileRoute('/design-preview')({
  head: () => ({
    meta: [
      { title: 'MinDiet V2 - 홈 탭 UI 개선 3대 시안 실시간 비교' },
      { name: 'description', content: 'MinDiet 홈 탭 UI 3대 시안 실시간 인터랙션 프리뷰 (A안: 요약 우선, B안: 세그먼트 분리, C안: 기록 버튼 중심)' },
    ],
  }),
  component: DesignPreviewPage,
});

export function DesignPreviewPage() {
  const [proposal, setProposal] = useState<ProposalType>('A');
  const [dataState, setDataState] = useState<PreviewStateType>('normal');

  const currentData = PREVIEW_MOCK_DATA[dataState];

  return (
    <div className="min-h-screen bg-canvas">
      {/* 480px 모바일 퍼스트 프레임 */}
      <div className="relative mx-auto min-h-screen w-full max-w-[480px] bg-background shadow-md flex flex-col justify-between">
        <div>
          {/* 상단 시안 [A][B][C] 및 상태 토글 스위처 */}
          <DesignPreviewHeader
            proposal={proposal}
            onSelectProposal={setProposal}
            state={dataState}
            onSelectState={setDataState}
          />

          {/* 메인 뷰포트 영역 */}
          <main className="px-4 pt-3">
            {proposal === 'A' && <ProposalA data={currentData} />}
            {proposal === 'B' && <ProposalB data={currentData} />}
            {proposal === 'C' && <ProposalC data={currentData} />}
          </main>
        </div>

        {/* 목업 하단 탭바 */}
        <MockBottomBar />
      </div>
    </div>
  );
}

export default DesignPreviewPage;
