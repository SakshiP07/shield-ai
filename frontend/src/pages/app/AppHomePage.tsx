import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, QrCode, CreditCard, Phone, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { ScoreRing } from '../../components/mobile/ScoreRing';
import { Badge } from '../../components/mobile/Badge';
import { MobileCard, MobilePage, SectionHeader } from '../../components/mobile/MobilePage';
import { useAuth } from '../../hooks/AuthContext';
import { api, type ActivityItem, type DashboardStats, type ScamAlert } from '../../lib/api';
import {
  badgeFromStatus,
  riskBarGradient,
  riskLabel,
  scoreProtectionColor,
  scoreProtectionDot,
  scoreProtectionLabel,
  statusIconColor,
  timeAgo,
  timeGreeting,
} from '../../lib/format';

const QUICK_ACTIONS: {
  icon: typeof QrCode;
  label: string;
  to: string;
  danger?: boolean;
}[] = [
  { icon: QrCode, label: 'Scan QR', to: '/app/scan' },
  { icon: CreditCard, label: 'Check UPI', to: '/app/scan?tab=upi' },
  { icon: Phone, label: 'Phone', to: '/app/scan?tab=phone' },
  { icon: AlertTriangle, label: 'Report', to: '/app/alerts', danger: true },
];

const ICON_MAP = {
  safe: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  blocked: XCircle,
};

function riskBarWidth(level: string): string {
  const map: Record<string, string> = { low: '22%', medium: '55%', high: '85%', critical: '95%' };
  return map[level] ?? '22%';
}

const PREVIEW_LIMIT = 3;

export function AppHomePage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [scamAlerts, setScamAlerts] = useState<ScamAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.dashboardStats(), api.dashboardActivity(), api.scamAlerts()])
      .then(([s, a, alerts]) => {
        if (cancelled) return;
        setStats(s);
        setActivities(a);
        setScamAlerts(alerts);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('Failed to fetch')) return;
        console.error(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const score = stats?.security_score ?? 0;
  const recentActivities = activities.slice(0, PREVIEW_LIMIT);
  const recentScamAlerts = scamAlerts.slice(0, PREVIEW_LIMIT);
  const firstName = user?.name?.split(' ')[0] ?? 'User';
  const breakdown = stats?.score_breakdown ?? [];
  const riskLevel = stats?.risk_level ?? 'low';

  return (
    <MobilePage className="pb-6">
      <div className="mb-6">
        <p className="text-[15px] leading-relaxed text-slate-400">{timeGreeting()}</p>
        <h2 className="truncate text-[22px] font-bold tracking-tight text-white">{firstName}</h2>
      </div>

      <MobileCard padding="lg">
        <p className="text-[13px] font-semibold uppercase tracking-wider text-blue-400">AI Security Score</p>
        <div className="mt-5 flex items-center justify-between gap-5">
          <div className="min-w-0 flex-1">
            <p className="text-4xl font-bold tabular-nums text-white sm:text-5xl">
              {score}
              <span className="text-lg font-medium text-slate-500">/100</span>
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${scoreProtectionDot(score)}`} />
              <span className={`truncate text-[15px] font-medium leading-relaxed ${scoreProtectionColor(score)}`}>
                {scoreProtectionLabel(score)}
              </span>
            </div>
            <p className="mt-2 truncate text-[13px] leading-relaxed text-slate-500">
              {stats?.last_scan_at ? `Last scan: ${timeAgo(stats.last_scan_at)}` : 'No scans yet'}
            </p>
          </div>
          <ScoreRing score={score} />
        </div>

        {breakdown.length > 0 && (
          <div className="mt-6 border-t border-white/[0.06] pt-5">
            <p className="mb-3 text-[13px] font-medium text-slate-400">Reason</p>
            <ul className="space-y-2">
              {breakdown.map((reason) => (
                <li key={reason} className="flex items-start gap-2.5 text-[15px] leading-relaxed text-slate-300">
                  <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-slate-500" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 grid grid-cols-3 gap-4 border-t border-white/[0.06] pt-5">
          <div className="text-center">
            <p className="text-lg font-bold tabular-nums text-rose-400">{stats?.blocked_count ?? 0}</p>
            <p className="mt-1 text-[13px] text-slate-500">Blocked</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold tabular-nums text-blue-400">{stats?.warning_count ?? 0}</p>
            <p className="mt-1 text-[13px] text-slate-500">Warnings</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold tabular-nums text-blue-400">{stats?.safe_count ?? 0}</p>
            <p className="mt-1 text-[13px] text-slate-500">Safe</p>
          </div>
        </div>
      </MobileCard>

      <div className="mt-6 grid grid-cols-4 gap-3">
        {QUICK_ACTIONS.map(({ icon: Icon, label, to, danger }) => (
          <Link
            key={label}
            to={to}
            className="mobile-card flex min-h-[80px] flex-col items-center justify-center gap-2.5 rounded-3xl py-4 transition hover:bg-white/[0.03]"
          >
            <Icon className={`h-5 w-5 ${danger ? 'text-rose-400' : 'text-blue-400'}`} />
            <span className={`truncate px-1 text-[13px] font-medium ${danger ? 'text-rose-400' : 'text-blue-400'}`}>
              {label}
            </span>
          </Link>
        ))}
      </div>

      <MobileCard className="mt-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-white">Today&apos;s Risk Level</h2>
          <Badge variant={badgeFromStatus(riskLevel)}>{riskLabel(riskLevel)}</Badge>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${riskBarGradient(riskLevel)}`}
            style={{ width: riskBarWidth(riskLevel) }}
          />
        </div>
        <div className="mt-3 flex justify-between text-[13px] text-slate-500">
          <span>Low</span>
          <span>Medium</span>
          <span>High</span>
        </div>
      </MobileCard>

      <section className="mt-7">
        <SectionHeader title="Recent Activity" actionLabel="View All" actionTo="/app/activity" />
        {recentActivities.length === 0 ? (
          <p className="text-[15px] leading-relaxed text-slate-500">No activity yet. Run a scan to get started.</p>
        ) : (
          <div className="space-y-3">
            {recentActivities.map((item) => {
              const badge = badgeFromStatus(item.badge);
              const Icon = ICON_MAP[badge] ?? ICON_MAP.warning;
              return (
                <MobileCard key={item.id} padding="sm" className="flex items-center gap-4">
                  <Icon className={`h-5 w-5 shrink-0 ${statusIconColor(badge)}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-white">{item.title}</p>
                    <p className="mt-1 text-[13px] text-slate-500">{timeAgo(item.time)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {item.amount && <span className="text-[15px] font-semibold tabular-nums text-white">₹{item.amount}</span>}
                    <Badge variant={badge}>{badge === 'safe' ? 'Safe' : badge === 'danger' ? 'Danger' : 'Review'}</Badge>
                  </div>
                </MobileCard>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-7">
        <SectionHeader title="Scam Alerts Near You" actionLabel="View All" actionTo="/app/scam-alerts" />
        {recentScamAlerts.length === 0 ? (
          <p className="text-[15px] leading-relaxed text-slate-500">No scam alerts in your area.</p>
        ) : (
          <div className="space-y-3">
            {recentScamAlerts.map((alert) => (
              <MobileCard key={alert.id} padding="sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="line-clamp-2 min-w-0 flex-1 text-[15px] leading-snug text-white">{alert.title}</p>
                  <Badge variant={badgeFromStatus(alert.badge === 'blocked' ? 'danger' : alert.badge)}>
                    {alert.badge === 'blocked' || alert.badge === 'danger' ? 'Danger' : 'Review'}
                  </Badge>
                </div>
                <p className="mt-2 text-[13px] text-slate-500">{timeAgo(alert.time)}</p>
              </MobileCard>
            ))}
          </div>
        )}
      </section>
    </MobilePage>
  );
}
