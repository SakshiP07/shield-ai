import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { MobilePage, MobileCard } from '../../../components/mobile/MobilePage';
import { useToast } from '../../../hooks/ToastContext';
import { api, type UserPreferences } from '../../../lib/api';
import { theme } from '../../../theme';

const LEVELS: { id: 'standard' | 'strict' | 'minimal'; label: string; desc: string }[] = [
  { id: 'standard', label: 'Standard', desc: 'Balanced privacy for everyday use' },
  { id: 'strict', label: 'Strict', desc: 'Share less data; stricter controls' },
  { id: 'minimal', label: 'Minimal', desc: 'Only what ShieldAI needs to protect you' },
];

const DEFAULT_PREFS: UserPreferences = {
  notifications_enabled: true,
  push_alerts: true,
  email_alerts: false,
  sms_alerts: false,
  android_sms_connected: false,
  ai_sensitivity: 'balanced',
  privacy_level: 'standard',
};

export function PrivacySettingsPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setPrefs(await api.getPreferences());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load');
      setPrefs(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (privacy_level: 'standard' | 'strict' | 'minimal') => {
    const previous = prefs ?? DEFAULT_PREFS;
    setPrefs({ ...previous, privacy_level });
    setSaving(true);
    try {
      const saved = await api.updatePreferences({ privacy_level });
      setPrefs(saved);
      setError('');
      showToast('Privacy saved', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Save failed', 'error');
      await load();
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

  const current = prefs ?? DEFAULT_PREFS;

  return (
    <MobilePage style={styles.page}>
      <Text style={styles.description}>
        Control how much data ShieldAI keeps. Selection is saved to your account.
      </Text>
      {saving ? <Text style={styles.saving}>Saving…</Text> : null}
      <MobileCard padding="sm">
        {LEVELS.map((level, index) => {
          const on = current.privacy_level === level.id;
          return (
            <Pressable
              key={level.id}
              onPress={() => void save(level.id)}
              disabled={saving}
              style={[styles.row, index < LEVELS.length - 1 && styles.border]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{level.label}</Text>
                <Text style={styles.desc}>{level.desc}</Text>
              </View>
              <View style={[styles.radio, on && styles.radioOn]} />
            </Pressable>
          );
        })}
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
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  border: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  title: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
  desc: { fontSize: 13, color: theme.colors.slate400, marginTop: 4, lineHeight: 18 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.colors.slate500,
  },
  radioOn: {
    borderColor: theme.colors.blue500,
    backgroundColor: theme.colors.blue500,
  },
});
