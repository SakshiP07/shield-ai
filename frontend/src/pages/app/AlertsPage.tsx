import { useEffect, useMemo, useState } from 'react';
import { Ban, Loader2, ShieldCheck, ShieldAlert, Wifi, WifiOff } from 'lucide-react';
import { AlertDetailSheet } from '../../components/mobile/AlertDetailSheet';
import { AlertStatusBadge } from '../../components/mobile/AlertStatusBadge';
import { MobilePage } from '../../components/mobile/MobilePage';
import { useAlertsSocket } from '../../hooks/AlertsSocketContext';
import { useToast } from '../../hooks/ToastContext';
import { api, type AlertDetail, type AlertItem } from '../../lib/api';
import { alertCardTitle, alertStatus, alertSummary } from '../../lib/alertDisplay';
import { dateGroupLabel, formatDateLabel, formatTime } from '../../lib/format';

type DateGroup = 'today' | 'yesterday' | 'earlier';

function groupAlerts(alerts: AlertItem[]): { group: DateGroup; items: AlertItem[] }[] {
  const buckets: Record<DateGroup, AlertItem[]> = { today: [], yesterday: [], earlier: [] };
  for (const alert of alerts) {
    buckets[formatDateLabel(alert.created_at)].push(alert);
  }
  return (['today', 'yesterday', 'earlier'] as const)
    .filter((g) => buckets[g].length > 0)
    .map((group) => ({ group, items: buckets[group] }));
}

function AlertIcon({ tone }: { tone: 'blocked' | 'review' | 'safe' }) {
  if (tone === 'blocked') {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-500/10">
        <Ban className="h-4 w-4 text-rose-400" />
      </div>
    );
  }
  if (tone === 'safe') {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
        <ShieldCheck className="h-4 w-4 text-blue-400" />
      </div>
    );
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
      <ShieldAlert className="h-4 w-4 text-blue-400" />
    </div>
  );
}

export function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AlertDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const { showToast } = useToast();
  const { connected, subscribe, refreshUnreadCount } = useAlertsSocket();

  const loadAlerts = () => {
    api
      .alerts()
      .then(setAlerts)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  useEffect(() => {
    return subscribe((alert) => {
      setAlerts((prev) => {
        if (prev.some((a) => a.id === alert.id)) return prev;
        return [alert, ...prev];
      });
    });
  }, [subscribe]);

  const grouped = useMemo(() => groupAlerts(alerts), [alerts]);
  const unreadCount = alerts.filter((a) => !a.is_read).length;

  const markAllRead = async () => {
    try {
      await api.markAllAlertsRead();
      setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
      refreshUnreadCount();
      showToast('All alerts marked as read', 'success');
    } catch {
      showToast('Failed to mark alerts', 'error');
    }
  };

  const openAlert = async (alert: AlertItem) => {
    setSelectedId(alert.id);
    setDetailLoading(true);
    setDetail(null);

    if (!alert.is_read) {
      try {
        await api.markAlertRead(alert.id);
        setAlerts((prev) => prev.map((a) => (a.id === alert.id ? { ...a, is_read: true } : a)));
        refreshUnreadCount();
      } catch {
        showToast('Failed to mark alert as read', 'error');
      }
    }

    try {
      const data = await api.alertDetail(alert.id);
      setDetail(data);
    } catch {
      showToast('Could not load alert details', 'error');
      setSelectedId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedId(null);
    setDetail(null);
    setDetailLoading(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <MobilePage>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {connected ? (
              <Wifi className="h-4 w-4 text-blue-400" aria-label="Live alerts connected" />
            ) : (
              <WifiOff className="h-4 w-4 text-slate-500" aria-label="Live alerts disconnected" />
            )}
            <span className="text-[13px] text-slate-500">{connected ? 'Live' : 'Offline'}</span>
          </div>
          {unreadCount > 0 && (
            <p className="mt-1.5 text-[15px] leading-relaxed text-slate-400">
              {unreadCount} unread
            </p>
          )}
        </div>
        {alerts.length > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="text-[13px] font-medium text-blue-400 transition hover:text-blue-300 active:opacity-70"
          >
            Mark all read
          </button>
        )}
      </div>

      {alerts.length === 0 ? (
        <p className="text-[15px] leading-relaxed text-slate-500">No alerts yet.</p>
      ) : (
        <div className="space-y-7">
          {grouped.map(({ group, items }) => (
            <section key={group}>
              <h2 className="mb-3.5 text-[13px] font-medium uppercase tracking-wider text-slate-500">
                {dateGroupLabel(group)}
              </h2>
              <div className="space-y-3">
                {items.map((alert) => {
                  const status = alertStatus(alert);
                  const isUnread = !alert.is_read;
                  const isSelected = selectedId === alert.id;

                  return (
                    <button
                      key={alert.id}
                      type="button"
                      onClick={() => openAlert(alert)}
                      className={`group w-full rounded-3xl px-5 py-4 text-left transition duration-200 active:scale-[0.99] ${
                        isUnread
                          ? 'bg-blue-500/[0.05] hover:bg-blue-500/[0.07]'
                          : 'bg-white/[0.02] hover:bg-white/[0.04]'
                      } ${isSelected ? 'bg-blue-500/[0.08]' : ''}`}
                    >
                      <div className="flex items-start gap-4">
                        <AlertIcon tone={status.tone} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2.5">
                            <h3
                              className={`min-w-0 flex-1 truncate text-[16px] font-semibold leading-[1.35] ${
                                isUnread ? 'text-white' : 'text-slate-300'
                              }`}
                            >
                              {alertCardTitle(alert.title)}
                            </h3>
                            <AlertStatusBadge label={status.label} tone={status.tone} />
                          </div>
                          <p className="mt-2.5 truncate text-[14px] leading-[1.45] text-slate-400">
                            {alertSummary(alert.description)}
                          </p>
                          <p className="mt-2 text-[12px] leading-normal text-slate-500">
                            {formatTime(alert.created_at)}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {(selectedId || detailLoading) && (
        <AlertDetailSheet detail={detail} loading={detailLoading} onClose={closeDetail} />
      )}
    </MobilePage>
  );
}
