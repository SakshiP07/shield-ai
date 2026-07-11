import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Badge } from '../../components/mobile/Badge';
import { MobileCard, MobilePage } from '../../components/mobile/MobilePage';
import { api, type ScamAlert } from '../../lib/api';
import { badgeFromStatus, timeAgo } from '../../lib/format';

export function ScamAlertsPage() {
  const [alerts, setAlerts] = useState<ScamAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .scamAlerts()
      .then(setAlerts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <MobilePage>
      {alerts.length === 0 ? (
        <p className="text-[15px] leading-relaxed text-slate-500">No scam alerts in your area.</p>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <MobileCard key={alert.id} padding="sm">
              <div className="flex items-start justify-between gap-3">
                <p className="line-clamp-3 min-w-0 flex-1 text-[15px] leading-snug text-white">{alert.title}</p>
                <Badge variant={badgeFromStatus(alert.badge === 'blocked' ? 'danger' : alert.badge)}>
                  {alert.badge === 'blocked' || alert.badge === 'danger' ? 'Danger' : 'Review'}
                </Badge>
              </div>
              <p className="mt-2 text-[13px] text-slate-500">{timeAgo(alert.time)}</p>
            </MobileCard>
          ))}
        </div>
      )}
    </MobilePage>
  );
}
