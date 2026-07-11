import { useRef } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { MobileFrame } from '../components/mobile/MobileFrame';
import { AppBar } from '../components/mobile/AppBar';
import { BottomNav } from '../components/mobile/BottomNav';
import { AlertsSocketProvider } from '../hooks/AlertsSocketContext';
import { useAuth } from '../hooks/AuthContext';
import { useScrollRestoration } from '../hooks/useScrollRestoration';
import { useTabMemory } from '../hooks/useTabMemory';
import { getAppBarConfig } from './appBarConfig';

export function AppLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollRestoration(scrollRef);
  useTabMemory();

  const appBar = getAppBarConfig(location.pathname);

  if (loading) {
    return (
      <MobileFrame>
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      </MobileFrame>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!user.profile_completed) return <Navigate to="/setup" replace />;

  return (
    <AlertsSocketProvider>
      <MobileFrame className="pb-0">
        <div className="flex min-h-0 flex-1 flex-col">
          <AppBar title={appBar.title} showBack={appBar.showBack} backTo={appBar.backTo} />
          <main ref={scrollRef} className="mobile-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <Outlet />
          </main>
          <BottomNav />
        </div>
      </MobileFrame>
    </AlertsSocketProvider>
  );
}
