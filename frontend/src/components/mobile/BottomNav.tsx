import { useLocation, useNavigate } from 'react-router-dom';
import { Home, ScanLine, MessageSquare, Bell, User } from 'lucide-react';
import { getTabPath, tabForPath } from '../../hooks/useTabMemory';

const TABS: { key: string; label: string; icon: typeof Home; defaultPath: string }[] = [
  { key: 'home', label: 'Home', icon: Home, defaultPath: '/app' },
  { key: 'scan', label: 'Scan', icon: ScanLine, defaultPath: '/app/scan' },
  { key: 'sms', label: 'SMS', icon: MessageSquare, defaultPath: '/app/sms' },
  { key: 'alerts', label: 'Alerts', icon: Bell, defaultPath: '/app/alerts' },
  { key: 'profile', label: 'Profile', icon: User, defaultPath: '/app/profile' },
];

export function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const activeTab = tabForPath(pathname)?.key;

  return (
    <nav className="safe-area-bottom z-20 flex-shrink-0 border-t border-white/[0.06] bg-shield/95 backdrop-blur-md">
      <div className="flex items-stretch justify-around px-1 pt-1">
        {TABS.map(({ key, label, icon: Icon, defaultPath }) => {
          const target = getTabPath(key) || defaultPath;
          const isActive = activeTab === key;

          return (
            <button
              key={key}
              type="button"
              onClick={() => navigate(target)}
              className={`flex min-h-[52px] min-w-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 transition ${
                isActive ? 'text-blue-500' : 'text-slate-500'
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? 'fill-blue-500/20' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[11px] font-medium leading-none">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
