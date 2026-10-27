/**
 * 본 인증 로직은 브라우저 로컬 데이터 격리용(Multi-profile Namespacing)이며,
 * 서버 보안 인증을 대체하지 않습니다.
 * 
 * Radix Dialog 기반 모달로 V2 디자인 토큰(에메랄드 그린, 둥근 모서리, 모바일 뷰포트) 준수
 */

import { useState } from 'react';
import { AlertCircle, Lock, LogIn, Sparkles, User, UserCheck, UserPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDiet } from '@/context/DietContext';
import { loginUserLocal, registerUserLocal } from '@/services/storageService';

export function AuthModal() {
  const { session, login } = useDiet();
  const [isRegister, setIsRegister] = useState(false);
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [userName, setUserName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 이미 로그인되어 있으면 렌더링하지 않음
  if (session) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        if (!userName.trim()) {
          setError('이름(닉네임)을 입력해 주세요.');
          setLoading(false);
          return;
        }
        const res = await registerUserLocal(userId, password, userName);
        if (!res.success || !res.user) {
          setError(res.message || '회원가입에 실패했습니다.');
          setLoading(false);
          return;
        }
        login(res.user);
      } else {
        const res = await loginUserLocal(userId, password);
        if (!res.success || !res.user) {
          setError(res.message || '아이디 또는 비밀번호가 일치하지 않습니다.');
          setLoading(false);
          return;
        }
        login(res.user);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '인증 처리 중 오류가 발생했습니다.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegister((prev) => !prev);
    setError(null);
  };

  return (
    <Dialog open={!session} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-[400px] rounded-3xl p-6 [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="items-center text-center space-y-2">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary shadow-xs">
            {isRegister ? <UserPlus className="h-7 w-7" /> : <UserCheck className="h-7 w-7" />}
          </div>
          <DialogTitle className="text-xl font-extrabold text-foreground">
            {isRegister ? '민다이어트 계정 등록' : '민다이어트 로그인'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {isRegister
              ? '나만의 계정으로 식단과 건강 데이터를 안전하게 분리 보관하세요'
              : '아이디와 비밀번호를 입력해 나만의 기록을 불러오세요'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 rounded-2xl bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 mt-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              아이디
            </Label>
            <Input
              type="text"
              placeholder="아이디 입력 (영문/숫자)"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="h-11 rounded-xl text-sm font-medium"
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Lock className="h-3.5 w-3.5" />
              비밀번호
            </Label>
            <Input
              type="password"
              placeholder="비밀번호 입력"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 rounded-xl text-sm font-medium"
              required
            />
          </div>

          {isRegister && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                이름 (닉네임)
              </Label>
              <Input
                type="text"
                placeholder="예: 민다이어터"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="h-11 rounded-xl text-sm font-medium"
                required
              />
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full h-12 rounded-xl text-sm font-bold mt-2">
            {loading ? (
              '처리 중...'
            ) : isRegister ? (
              <span className="flex items-center gap-1.5">
                <UserPlus className="h-4 w-4" />
                회원가입 및 시작하기
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <LogIn className="h-4 w-4" />
                로그인
              </span>
            )}
          </Button>
        </form>

        <div className="pt-2 text-center border-t border-border mt-3">
          <button
            type="button"
            onClick={toggleMode}
            className="text-xs font-semibold text-primary hover:underline transition"
          >
            {isRegister ? '이미 계정이 있으신가요? 로그인하기' : '처음 이용하시나요? 새 계정 등록하기'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
