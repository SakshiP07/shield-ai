import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SoftCard, StatusPill } from '../../components/ui/Premium';
import { api, type AlertDetail } from '../../lib/api';
import {
  alertChannel,
  alertReason,
  alertScorePercent,
  alertStatus,
  alertThreatKind,
} from '../../lib/alertDisplay';
import { formatTime, timeAgo } from '../../lib/format';
import { theme } from '../../theme';
import type { RootStackParamList } from '../../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'AlertDetail'>;

function statusTone(
  tone: ReturnType<typeof alertStatus>['tone'],
): 'success' | 'warning' | 'danger' | 'info' {
  if (tone === 'blocked') return 'danger';
  if (tone === 'review') return 'warning';
  return 'info';
}

export function AlertDetailPage({ route }: Props) {
  const { alertId } = route.params;
  const [alert, setAlert] = useState<AlertDetail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const detail = await api.alertDetail(alertId);
      setAlert(detail);
      void api.markAlertRead(alertId).catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load threat');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [alertId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.blue500} size="large" />
      </View>
    );
  }

  if (!alert || error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || 'Threat not found'}</Text>
        <Pressable style={styles.retry} onPress={() => void load()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const status = alertStatus(alert);
  const channel = alertChannel(alert.alert_type);
  const kind = alertThreatKind(alert);
  const reason = alertReason(alert.description || '');
  const score = alertScorePercent(alert.fraud_score ?? alert.risk_score);

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <SoftCard style={styles.hero}>
        <View style={styles.pillRow}>
          <StatusPill label={status.label} tone={statusTone(status.tone)} />
          <StatusPill label={kind} tone="info" />
          <StatusPill label={channel} tone="info" />
        </View>
        <Text style={styles.title}>{alert.title || 'Security threat'}</Text>
        <Text style={styles.meta}>
          {formatTime(alert.created_at)} · {timeAgo(alert.created_at)}
        </Text>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreLabel}>Risk score</Text>
          <Text style={styles.scoreValue}>{score}%</Text>
        </View>
      </SoftCard>

      <Text style={styles.section}>Why flagged</Text>
      <SoftCard>
        <Text style={styles.value}>{alert.recommendation || reason || 'Elevated fraud risk'}</Text>
        {alert.flagged_reasons.length > 0 ? (
          <Text style={[styles.value, { marginTop: 12, color: theme.colors.slate300 }]}>
            {alert.flagged_reasons.join('\n')}
          </Text>
        ) : null}
      </SoftCard>

      {!!alert.full_message && (
        <>
          <Text style={styles.section}>Evidence</Text>
          <SoftCard>
            <Text style={styles.value}>{alert.full_message}</Text>
          </SoftCard>
        </>
      )}

      <Row label="Decision" value={(alert.decision || status.label).toUpperCase()} />
      <Row label="Risk level" value={String(alert.risk_level || alert.severity || '—')} />
      <Row label="Channel" value={channel} />
      <Row label="Source" value={alert.source || 'ShieldAI pipeline'} />
      <Row label="Transaction ID" value={alert.transaction_id || '—'} />
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <SoftCard>
        <Text style={styles.value}>{value}</Text>
      </SoftCard>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  error: { color: theme.colors.rose400, fontSize: 15, textAlign: 'center' },
  retry: {
    backgroundColor: theme.colors.blueSoft,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryText: { color: theme.colors.blue400, fontWeight: '700' },
  hero: { marginBottom: 8, gap: 10 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  title: { color: theme.colors.textPrimary, fontSize: 20, fontWeight: '700', lineHeight: 28 },
  meta: { color: theme.colors.slate500, fontSize: 12 },
  scoreBox: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(251,191,36,0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  scoreLabel: { color: theme.colors.slate400, fontWeight: '600', fontSize: 13 },
  scoreValue: { color: theme.colors.amber400, fontWeight: '800', fontSize: 22 },
  section: {
    color: theme.colors.slate500,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
  },
  row: { marginTop: 12, gap: 8 },
  rowLabel: {
    color: theme.colors.slate500,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  value: { color: theme.colors.textPrimary, fontSize: 14, lineHeight: 21 },
});
