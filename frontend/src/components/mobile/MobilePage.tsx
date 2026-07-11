import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type MobilePageProps = {
  children: ReactNode;
  className?: string;
};

/** Consistent page padding and width for scrollable app content. */
export function MobilePage({ children, className = '' }: MobilePageProps) {
  return <div className={`mobile-page w-full max-w-full px-4 pb-6 pt-4 ${className}`}>{children}</div>;
}

type MobileCardProps = {
  children: ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
  bordered?: boolean;
};

export function MobileCard({ children, className = '', padding = 'md', bordered = false }: MobileCardProps) {
  const pad = padding === 'sm' ? 'p-4' : padding === 'lg' ? 'p-6' : 'p-5';
  const border = bordered ? 'border border-white/[0.05]' : '';
  return (
    <div className={`mobile-card w-full rounded-3xl ${border} ${pad} ${className}`}>
      {children}
    </div>
  );
}

type SectionHeaderProps = {
  title: string;
  actionLabel?: string;
  actionTo?: string;
};

export function SectionHeader({ title, actionLabel, actionTo }: SectionHeaderProps) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-[15px] font-semibold tracking-tight text-white">{title}</h2>
      {actionLabel && actionTo ? (
        <Link to={actionTo} className="btn-text shrink-0 text-[13px] font-medium text-blue-500">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
