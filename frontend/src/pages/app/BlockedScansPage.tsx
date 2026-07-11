import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { Badge } from '../../components/mobile/Badge';
import { MobileCard, MobilePage } from '../../components/mobile/MobilePage';
import { api, type ActivityItem } from '../../lib/api';
import { badgeFromStatus, statusIconColor, timeAgo } from '../../lib/format';

const ICON_MAP = {
  safe: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  blocked: XCircle,
};

export function BlockedScansPage() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .blockedScans()
      .then(setItems)
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
      {items.length === 0 ? (
        <p className="text-[15px] leading-relaxed text-slate-500">No blocked or held scans yet.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const badge = badgeFromStatus(item.badge);
            const Icon = ICON_MAP[badge] ?? ICON_MAP.warning;
            return (
              <MobileCard key={item.id} padding="sm" className="flex items-center gap-4">
                <Icon className={`h-5 w-5 shrink-0 ${statusIconColor(badge)}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-white">{item.title}</p>
                  <p className="mt-1 text-[13px] text-slate-500">{timeAgo(item.time)}</p>
                  {item.sub && <p className="mt-1 line-clamp-2 text-[14px] text-slate-400">{item.sub}</p>}
                </div>
                <Badge variant={badge}>{badge === 'safe' ? 'Safe' : badge === 'danger' ? 'Danger' : 'Review'}</Badge>
              </MobileCard>
            );
          })}
        </div>
      )}
    </MobilePage>
  );
}
