import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { MobileCard, MobilePage } from '../../../components/mobile/MobilePage';
import { useToast } from '../../../hooks/ToastContext';
import { api, type UserPreferences } from '../../../lib/api';

const AI_OPTIONS = [
  { id: 'standard', label: 'Standard', description: 'Fewer false positives, flags only clear threats' },
  { id: 'balanced', label: 'Balanced', description: 'Recommended — balances safety and convenience' },
  { id: 'high', label: 'High sensitivity', description: 'Flags more suspicious patterns aggressively' },
] as const;

export function AiPreferencesPage() {
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

  const selectSensitivity = async (ai_sensitivity: string) => {
    if (!prefs || prefs.ai_sensitivity === ai_sensitivity) return;
    setSaving(true);
    const previous = prefs.ai_sensitivity;
    setPrefs({ ...prefs, ai_sensitivity });
    try {
      const updated = await api.updatePreferences({ ai_sensitivity });
      setPrefs(updated);
      showToast('AI preferences saved', 'success');
    } catch {
      setPrefs({ ...prefs, ai_sensitivity: previous });
      showToast('Failed to save AI preferences', 'error');
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
      <p className="mb-4 text-[15px] leading-relaxed text-slate-500">Adjust how sensitive the fraud detection AI is to threats.</p>
      <div className="space-y-3">
        {AI_OPTIONS.map((option) => {
          const selected = prefs.ai_sensitivity === option.id;
          return (
            <button
              key={option.id}
              type="button"
              disabled={saving}
              onClick={() => selectSensitivity(option.id)}
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
        Active sensitivity: <span className="capitalize text-slate-300">{prefs.ai_sensitivity}</span>
      </MobileCard>
    </MobilePage>
  );
}
