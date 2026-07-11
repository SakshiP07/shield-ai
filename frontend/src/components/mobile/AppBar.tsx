import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ChevronLeft, Shield } from 'lucide-react';
import { useAlertsSocket } from '../../hooks/AlertsSocketContext';

type AppBarProps = {
  title: string;
  showBack?: boolean;
  backTo?: string;
  trailing?: ReactNode;
};

export function AppBar({ title, showBack, backTo = '/app', trailing }: AppBarProps) {
  const isHome = title === 'ShieldAI';
  const { unreadCount } = useAlertsSocket();

  return (
    <header className="safe-area-top z-20 flex-shrink-0 border-b border-white/[0.06] bg-shield/95 backdrop-blur-md">
      <div className="flex h-12 min-h-[48px] items-center gap-2 px-4">
        {showBack ? (
          <Link
            to={backTo}
            className="btn-touch -ml-2 flex items-center justify-center rounded-xl text-slate-300 transition hover:text-white"
            aria-label="Go back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
        ) : isHome ? (
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600">
              <Shield className="h-4 w-4 text-white" strokeWidth={2} />
            </div>
            <span className="truncate text-base font-bold text-white">ShieldAI</span>
          </div>
        ) : (
          <h1 className="min-w-0 truncate text-base font-semibold text-white">{title}</h1>
        )}

        {showBack && <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-white">{title}</h1>}

        <div className="flex-1" />

        {trailing ??
          (isHome ? (
            <Link
              to="/app/alerts"
              className="btn-touch relative flex items-center justify-center rounded-xl text-slate-300 transition hover:text-white"
              aria-label={unreadCount > 0 ? `${unreadCount} unread alerts` : 'Open alerts'}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-500 px-1 text-[9px] font-bold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
          ) : null)}
      </div>
    </header>
  );
}
