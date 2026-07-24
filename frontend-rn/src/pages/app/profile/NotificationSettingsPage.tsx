import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, Pressable, ActivityIndicator } from 'react-native';
import { MobilePage, MobileCard } from '../../../components/mobile/MobilePage';
import { useToast } from '../../../hooks/ToastContext';
import { api, type UserPreferences } from '../../../lib/api';
import { theme } from '../../../theme';

type SettingToggleProps = {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  isLast?: boolean;
  disabled?: boolean;
};

function SettingToggle({
  title,
  description,
  value,
  onValueChange,
  isLast,
  disabled,
}: SettingToggleProps) {
  return (
    <View style={[styles.toggleContainer, !isLast && styles.toggleBorder]}>
      <View style={styles.toggleText}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.toggleDesc}>{description}</Text>
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{ false: theme.colors.surfaceInput, true: theme.colors.blue500 }}
        thumbColor="#ffffff"
        ios_backgroundColor={theme.colors.surfaceInput}
      />
    </View>
  );
}

export function NotificationSettingsPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setPrefs(await api.getPreferences());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load settings');
      setPrefs(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (patch: Partial<UserPreferences>) => {
    if (!prefs) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setSaving(true);
    try {
      const saved = await api.updatePreferences(patch);
      setPrefs(saved);
      showToast('Saved', 'success');
    } catch (err) {
      await load();
      showToast(err instanceof Error ? err.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MobilePage style={styles.page}>
        <ActivityIndicator color={theme.colors.blue500} />
      </MobilePage>
    );
  }

  if (error && !prefs) {
    return (
      <MobilePage style={styles.page}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryBtn} onPress={() => void load()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </MobilePage>
    );
  }

  if (!prefs) return null;

  return (
    <MobilePage style={styles.page}>
      <Text style={styles.description}>
        Choose how ShieldAI notifies you. Changes are saved to your account.
      </Text>
      {saving ? <Text style={styles.saving}>Saving…</Text> : null}

      <MobileCard padding="sm">
        <SettingToggle
          title="Push alerts"
          description="Instant alerts for high-risk threats"
          value={prefs.push_alerts}
          disabled={saving}
          onValueChange={(v) =>
            void save({
              push_alerts: v,
              notifications_enabled: v || prefs.sms_alerts || prefs.email_alerts,
            })
          }
        />
        <SettingToggle
          title="SMS alerts"
          description="Text when your number is involved in a risk event"
          value={prefs.sms_alerts}
          disabled={saving}
          onValueChange={(v) => void save({ sms_alerts: v })}
        />
        <SettingToggle
          title="Email summary"
          description="Weekly security digest"
          value={prefs.email_alerts}
          disabled={saving}
          onValueChange={(v) => void save({ email_alerts: v })}
          isLast
        />
      </MobileCard>
    </MobilePage>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: 16 },
  description: {
    fontSize: 15,
    color: theme.colors.slate400,
    lineHeight: 22,
    marginBottom: 16,
  },
  saving: { color: theme.colors.blue400, marginBottom: 8, fontSize: 13, fontWeight: '600' },
  errorText: { color: theme.colors.rose400, fontSize: 14, marginBottom: 12, lineHeight: 20 },
  retryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.blueSoft,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryText: { color: theme.colors.blue400, fontWeight: '700' },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  toggleBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  toggleText: { flex: 1, paddingRight: 12 },
  toggleTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
  toggleDesc: { fontSize: 13, color: theme.colors.slate400, marginTop: 4, lineHeight: 18 },
});
