import type { ReactNode } from 'react';

interface MobileFrameProps {
  children: ReactNode;
  className?: string;
}

export function MobileFrame({ children, className = '' }: MobileFrameProps) {
  return (
    <div className="mobile-shell flex min-h-[100dvh] w-full justify-center bg-shield">
      <div
        className={`mobile-frame relative flex h-[100dvh] w-full max-w-[480px] flex-col overflow-hidden bg-shield md:my-auto md:h-[min(844px,100dvh)] md:max-w-[390px] md:rounded-[2rem] md:border md:border-white/[0.06] ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
