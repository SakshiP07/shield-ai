import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { MobileCard, MobilePage } from '../../../components/mobile/MobilePage';
import { useToast } from '../../../hooks/ToastContext';
import { api, type UserPreferences } from '../../../lib/api';

const PRIVACY_OPTIONS = [
  { id: 'standard', label: 'Standard', description: 'Balanced protection with scan history retained' },
  { id: 'strict', label: 'Strict', description: 'Maximum scrutiny on every scan' },
  { id: 'minimal', label: 'Minimal', description: 'Essential checks only, fewer data signals' },
] as const;

export function PrivacySettingsPage() {
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

  const selectLevel = async (privacy_level: string) => {
    if (!prefs || prefs.privacy_level === privacy_level) return;
    setSaving(true);
    const previous = prefs.privacy_level;
    setPrefs({ ...prefs, privacy_level });
    try {
      const updated = await api.updatePreferences({ privacy_level });
      setPrefs(updated);
      showToast('Privacy settings saved', 'success');
    } catch {
      setPrefs({ ...prefs, privacy_level: previous });
      showToast('Failed to save privacy settings', 'error');
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
      <p className="mb-4 text-[15px] leading-relaxed text-slate-500">Choose how aggressively ShieldAI protects your account.</p>
      <div className="space-y-3">
        {PRIVACY_OPTIONS.map((option) => {
          const selected = prefs.privacy_level === option.id;
          return (
            <button
              key={option.id}
              type="button"
              disabled={saving}
              onClick={() => selectLevel(option.id)}
              className={`w-full rounded-3xl p-5 text-left transition ${
                selected ? 'bg-blue-500/10' : 'bg-surface-card hover:bg-white/[0.02]'
              }`}
            >
              <p className="text-[15px] font-semibold text-white">{option.label}</p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-slate-400">{option.description}</p>
            </button>
          );
        })}
      </div>
      <MobileCard padding="sm" className="mt-4 text-[13px] text-slate-500">
        Current level: <span className="capitalize text-slate-300">{prefs.privacy_level}</span>
      </MobileCard>
    </MobilePage>
  );
}
