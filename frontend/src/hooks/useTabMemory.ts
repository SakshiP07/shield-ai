import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const STORAGE_KEY = 'shieldai_tab_paths';

type TabDef = { key: string; defaultPath: string; match: (path: string) => boolean };

const TABS: TabDef[] = [
  { key: 'home', defaultPath: '/app', match: (p) => p === '/app' || p === '/app/' },
  { key: 'scan', defaultPath: '/app/scan', match: (p) => p.startsWith('/app/scan') },
  { key: 'sms', defaultPath: '/app/sms', match: (p) => p.startsWith('/app/sms') },
  { key: 'alerts', defaultPath: '/app/alerts', match: (p) => p.startsWith('/app/alerts') },
  { key: 'profile', defaultPath: '/app/profile', match: (p) => p.startsWith('/app/profile') },
];

function readPaths(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

function writePaths(paths: Record<string, string>) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(paths));
}

export function tabForPath(pathname: string): TabDef | undefined {
  return TABS.find((tab) => tab.match(pathname));
}

export function getTabPath(tabKey: string): string {
  const tab = TABS.find((t) => t.key === tabKey);
  if (!tab) return '/app';
  return readPaths()[tabKey] ?? tab.defaultPath;
}

export function useTabMemory() {
  const { pathname } = useLocation();

  useEffect(() => {
    const tab = tabForPath(pathname);
    if (!tab) return;
    const paths = readPaths();
    if (paths[tab.key] !== pathname) {
      paths[tab.key] = pathname;
      writePaths(paths);
    }
  }, [pathname]);
}
