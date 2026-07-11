import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, PhoneOff, Lock, Cpu, Bell, Activity, Star, LogOut, Loader2, KeyRound, ChevronRight, Pencil, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AccountLinkSection } from '../../components/AccountLinkSection';
import { MobileCard, MobilePage } from '../../components/mobile/MobilePage';
import { UserAvatar } from '../../components/mobile/UserAvatar';
import { useAuth } from '../../hooks/AuthContext';
import { useBiometricAuth } from '../../hooks/useBiometricAuth';
import { useToast } from '../../hooks/ToastContext';
import { api, type DashboardStats, type UserPreferences } from '../../lib/api';
import { BiometricAuthError } from '../../lib/biometric';
import { riskLabel } from '../../lib/format';

type ProfileRow = {
  icon: typeof Shield;
  label: string;
  value: string;
  to?: string;
};

function sensitivityLabel(value: string) {
  if (value === 'high') return 'High sensitivity';
  if (value === 'balanced') return 'Balanced';
  return 'Standard';
}

function privacyLabel(value: string) {
  if (value === 'strict') return 'Strict protection';
  if (value === 'minimal') return 'Minimal protection';
  return 'Standard protection';
}

function buildSections(
  stats: DashboardStats | null,
  plan: string,
  prefs: UserPreferences | null,
): { title: string; items: ProfileRow[] }[] {
  return [
    {
      title: 'SECURITY',
      items: [
        {
          icon: Shield,
          label: 'Protection History',
          value: `${stats?.threats_blocked ?? 0} threats blocked`,
          to: '/app/alerts',
        },
        {
          icon: PhoneOff,
          label: 'Blocked Scans',
          value: `${stats?.blocked_scans_count ?? 0} flagged`,
          to: '/app/blocked-scans',
        },
        {
          icon: Lock,
          label: 'Privacy Settings',
          value: privacyLabel(prefs?.privacy_level ?? 'standard'),
          to: '/app/profile/privacy',
        },
      ],
    },
    {
      title: 'AI & SCANS',
      items: [
        {
          icon: Cpu,
          label: 'AI Preferences',
          value: sensitivityLabel(prefs?.ai_sensitivity ?? 'balanced'),
          to: '/app/profile/ai',
        },
        {
          icon: Bell,
          label: 'Notifications',
          value: prefs?.notifications_enabled
            ? prefs.push_alerts
              ? 'Live alerts enabled'
              : 'Alerts enabled'
            : 'Alerts disabled',
          to: '/app/profile/notifications',
        },
        {
          icon: Activity,
          label: 'Scan History',
          value: `${stats?.items_scanned ?? 0} scans`,
          to: '/app/activity',
        },
      ],
    },
    {
      title: 'PREMIUM',
      items: [{ icon: Star, label: 'Current Plan', value: plan, to: '/app/profile/plan' }],
    },
  ];
}

export function ProfilePage() {
  const { user, signOut, registerBiometric } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [biometricStatus, setBiometricStatus] = useState<{ registered: boolean; credential_count: number } | null>(null);
  const [biometricServerEnabled, setBiometricServerEnabled] = useState(false);
  const [registeringBiometric, setRegisteringBiometric] = useState(false);
  const { canUseBiometrics, unavailableMessage } = useBiometricAuth(biometricServerEnabled);

  useEffect(() => {
    Promise.all([api.dashboardStats(), api.biometricStatus(), api.getPreferences()])
      .then(([dashboardStats, status, preferences]) => {
        setStats(dashboardStats);
        setBiometricServerEnabled(status.server_enabled);
        setBiometricStatus({ registered: status.registered, credential_count: status.credential_count });
        setPrefs(preferences);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleEnableBiometric = async () => {
    setRegisteringBiometric(true);
    try {
      await registerBiometric(`${user?.name || 'ShieldAI'} device`);
      setBiometricStatus((prev) => ({
        registered: true,
        credential_count: (prev?.credential_count ?? 0) + 1,
      }));
      showToast('Passkey created', 'success');
    } catch (err) {
      const msg = err instanceof BiometricAuthError ? err.message : 'Could not create passkey';
      showToast(msg, 'error');
    } finally {
      setRegisteringBiometric(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const sections = buildSections(stats, user?.plan ?? 'Free Shield', prefs);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <MobilePage>
      <MobileCard padding="lg" className="relative mb-6">
        <Link
          to="/app/profile/edit"
          className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-slate-300 transition hover:bg-white/[0.1] hover:text-white"
          aria-label="Edit profile"
        >
          <Pencil className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-4 pr-10">
          <UserAvatar avatarUrl={user?.avatar_url} name={user?.name} size="md" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[20px] font-bold tracking-tight text-white">{user?.name ?? 'User'}</h2>
            <p className="mt-0.5 truncate text-[15px] text-blue-400">{user?.phone ?? user?.email ?? ''}</p>
            {user?.auth_provider === 'linked' && (
              <p className="mt-0.5 text-[13px] text-slate-500">Phone + Google linked</p>
            )}
            <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1">
              <Star className="h-3.5 w-3.5 fill-blue-400 text-blue-400" />
              <span className="text-[13px] font-medium text-blue-400">{user?.plan ?? 'Free Shield'}</span>
            </div>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-4 border-t border-white/[0.06] pt-5">
          <div className="text-center">
            <p className="text-xl font-bold tabular-nums text-blue-400">{stats?.security_score ?? 0}</p>
            <p className="mt-1 text-[13px] text-slate-500">Security Score</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold tabular-nums text-rose-400">{stats?.threats_blocked ?? 0}</p>
            <p className="mt-1 text-[13px] text-slate-500">Threats Blocked</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold tabular-nums text-blue-400">{stats?.items_scanned ?? 0}</p>
            <p className="mt-1 text-[13px] text-slate-500">Items Scanned</p>
          </div>
        </div>
        {stats?.risk_level && (
          <p className="mt-4 text-center text-[13px] text-slate-500">
            Risk level: <span className="text-slate-300">{riskLabel(stats.risk_level)}</span>
          </p>
        )}
      </MobileCard>

      {user && <AccountLinkSection user={user} />}

      <div className="mb-6">
        <p className="mb-2.5 text-[13px] font-semibold uppercase tracking-wider text-slate-500">Passkey Sign-In</p>
        <div className="overflow-hidden rounded-3xl bg-surface-card px-5 py-5">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/15">
              <KeyRound className="h-[18px] w-[18px] text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-white">Passkeys</p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-slate-400">
                {biometricStatus?.registered
                  ? `${biometricStatus.credential_count} passkey${biometricStatus.credential_count === 1 ? '' : 's'} registered for your account.`
                  : canUseBiometrics
                    ? 'Create a passkey secured by your device screen lock or biometric verification.'
                    : unavailableMessage}
              </p>
              {canUseBiometrics && (
                <button
                  type="button"
                  onClick={handleEnableBiometric}
                  disabled={registeringBiometric}
                  className="mt-3 inline-flex h-10 w-fit min-w-[180px] max-w-[220px] shrink-0 items-center justify-center gap-1.5 self-start whitespace-nowrap rounded-xl border border-blue-500/35 bg-blue-500/[0.06] px-4 text-[14px] font-medium text-blue-400 transition hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-300 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
                >
                  {registeringBiometric ? (
                    <>
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : biometricStatus?.registered ? (
                    <>
                      <Plus className="h-4 w-4 shrink-0 stroke-[2.5]" />
                      <span>Add another passkey</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4 shrink-0" />
                      <span>Create a passkey</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {sections.map((section) => (
        <div key={section.title} className="mb-6">
          <p className="mb-2.5 text-[13px] font-semibold uppercase tracking-wider text-slate-500">{section.title}</p>
          <div className="overflow-hidden rounded-3xl bg-surface-card">
            {section.items.map((item, i) => {
              const Icon = item.icon;
              const rowClass = `flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-white/[0.03] ${
                i < section.items.length - 1 ? 'border-b border-white/[0.05]' : ''
              }`;
              const content = (
                <>
                  <Icon className="h-5 w-5 shrink-0 text-slate-400" />
                  <span className="flex-1 truncate text-[15px] font-medium text-white">{item.label}</span>
                  <span className="max-w-[42%] truncate text-right text-[13px] text-slate-500">{item.value}</span>
                  {item.to && <ChevronRight className="h-5 w-5 shrink-0 text-slate-600" />}
                </>
              );
              if (item.to) {
                return (
                  <Link key={item.label} to={item.to} className={rowClass}>
                    {content}
                  </Link>
                );
              }
              return (
                <div key={item.label} className={rowClass}>
                  {content}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={handleSignOut}
        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-rose-500/10 text-[15px] font-medium text-rose-400 transition hover:bg-rose-500/15"
      >
        <LogOut className="h-5 w-5" />
        Sign Out
      </button>
    </MobilePage>
  );
}
