import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, type AlertItem } from '../lib/api';
import { useAlertsWebSocket } from './useAlertsWebSocket';
import { useToast } from './ToastContext';

type AlertsSocketContextValue = {
  connected: boolean;
  unreadCount: number;
  refreshUnreadCount: () => void;
  subscribe: (listener: (alert: AlertItem) => void) => () => void;
};

const AlertsSocketContext = createContext<AlertsSocketContextValue | null>(null);

export function AlertsSocketProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast();
  const listenersRef = useRef(new Set<(alert: AlertItem) => void>());
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(() => {
    api
      .alertsUnreadCount()
      .then((res) => setUnreadCount(res.count))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshUnreadCount();
  }, [refreshUnreadCount]);

  const handleAlert = useCallback(
    (alert: AlertItem) => {
      listenersRef.current.forEach((listener) => listener(alert));
      if (!alert.is_read) {
        setUnreadCount((c) => c + 1);
      }
      showToast(`New alert: ${alert.title}`, alert.severity === 'safe' ? 'success' : 'info');
    },
    [showToast],
  );

  const { connected } = useAlertsWebSocket(true, handleAlert);

  const subscribe = useCallback((listener: (alert: AlertItem) => void) => {
    listenersRef.current.add(listener);
    return () => listenersRef.current.delete(listener);
  }, []);

  const value = useMemo(
    () => ({ connected, unreadCount, refreshUnreadCount, subscribe }),
    [connected, unreadCount, refreshUnreadCount, subscribe],
  );

  return <AlertsSocketContext.Provider value={value}>{children}</AlertsSocketContext.Provider>;
}

export function useAlertsSocket() {
  const ctx = useContext(AlertsSocketContext);
  if (!ctx) throw new Error('useAlertsSocket must be used within AlertsSocketProvider');
  return ctx;
}
