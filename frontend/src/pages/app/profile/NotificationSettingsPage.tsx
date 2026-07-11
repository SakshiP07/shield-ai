import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { MobileCard, MobilePage } from '../../../components/mobile/MobilePage';
import { useToast } from '../../../hooks/ToastContext';
import { api, type UserPreferences } from '../../../lib/api';

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.04] px-4 py-3.5 last:border-b-0">
      <div className="min-w-0">
        <p className="text-[15px] text-white">{label}</p>
        <p className="text-[13px] leading-relaxed text-slate-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-blue-600' : 'bg-slate-700'} disabled:opacity-50`}
      >
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition ${checked ? 'left-5' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

export function NotificationSettingsPage() {
  const { showToast } = useToast();
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .getPreferences()
      .then(setPrefs)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const update = async (patch: Partial<UserPreferences>) => {
    if (!prefs) return;
    setSaving(true);
    const optimistic = { ...prefs, ...patch };
    setPrefs(optimistic);
    try {
      const updated = await api.updatePreferences(patch);
      setPrefs(updated);
      showToast('Notification settings saved', 'success');
    } catch {
      setPrefs(prefs);
      showToast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !prefs) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <MobilePage>
      <MobileCard padding="sm" className="p-0">
        <ToggleRow
          label="Notifications enabled"
          description="Master switch for all ShieldAI alerts"
          checked={prefs.notifications_enabled}
          disabled={saving}
          onChange={(v) => update({ notifications_enabled: v })}
        />
        <ToggleRow
          label="Push alerts"
          description="Real-time alerts via WebSocket"
          checked={prefs.push_alerts}
          disabled={saving || !prefs.notifications_enabled}
          onChange={(v) => update({ push_alerts: v })}
        />
        <ToggleRow
          label="Email alerts"
          description="Send alerts to your linked email"
          checked={prefs.email_alerts}
          disabled={saving || !prefs.notifications_enabled}
          onChange={(v) => update({ email_alerts: v })}
        />
        <ToggleRow
          label="SMS alerts"
          description="Send alerts to your linked phone"
          checked={prefs.sms_alerts}
          disabled={saving || !prefs.notifications_enabled}
          onChange={(v) => update({ sms_alerts: v })}
        />
      </MobileCard>
    </MobilePage>
  );
}
