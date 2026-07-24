import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Share } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Copy, Share2, ShieldAlert, ShieldCheck } from 'lucide-react-native';
import { SoftCard, StatusPill } from '../../components/ui/Premium';
import { useToast } from '../../hooks/ToastContext';
import { formatTime, timeAgo } from '../../lib/format';
import { theme } from '../../theme';
import type { RootStackParamList } from '../../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'SmsDetail'>;

function extractLinks(body: string): string[] {
  return body.match(/https?:\/\/[^\s]+/gi) ?? [];
}

export function SmsDetailPage({ route }: Props) {
  const { message } = route.params;
  const { showToast } = useToast();
  const links = useMemo(() => extractLinks(message.body || ''), [message.body]);

  const recommendation =
    message.badge === 'danger'
      ? 'Do not share OTP or tap links. Report this as a scam.'
      : message.is_otp
        ? 'Confirm the sender before using this OTP.'
        : 'Looks routine — stay cautious with payment requests.';

  const riskTone =
    message.risk_level === 'high' || message.badge === 'danger'
      ? 'danger'
      : message.risk_level === 'medium'
        ? 'warning'
        : 'info';

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <SoftCard style={styles.hero}>
        <Text style={styles.sender}>{message.sender}</Text>
        <Text style={styles.phone}>{message.phone_number || message.address || '—'}</Text>
        <Text style={styles.time}>
          {formatTime(message.timestamp || message.received_at)} ·{' '}
          {timeAgo(message.timestamp || message.received_at)}
        </Text>
        <View style={styles.pillRow}>
          {message.is_otp ? <StatusPill label="OTP" tone="warning" /> : null}
          {message.badge === 'danger' ? <StatusPill label="Fraud" tone="danger" /> : null}
          {message.badge === 'safe' ? <StatusPill label="Safe" tone="success" /> : null}
          {message.risk_level ? (
            <StatusPill label={`Risk ${message.risk_level}`} tone={riskTone} />
          ) : null}
        </View>
      </SoftCard>

      <Text style={styles.label}>Complete message</Text>
      <SoftCard>
        <Text style={styles.body}>{message.body}</Text>
      </SoftCard>

      {message.otp_code ? (
        <>
          <Text style={styles.label}>OTP detected</Text>
          <SoftCard style={styles.otpCard}>
            <Text style={styles.otpCode}>{message.otp_code}</Text>
          </SoftCard>
        </>
      ) : null}

      <View style={styles.grid}>
        <SoftCard style={styles.metric}>
          <Text style={styles.metricLabel}>Fraud score</Text>
          <Text style={styles.metricValue}>
            {message.fraud_score != null ? `${Math.round(message.fraud_score * 100)}%` : '—'}
          </Text>
        </SoftCard>
        <SoftCard style={styles.metric}>
          <Text style={styles.metricLabel}>Risk level</Text>
          <Text style={styles.metricValue}>{message.risk_level ?? '—'}</Text>
        </SoftCard>
      </View>

      {links.length > 0 ? (
        <>
          <Text style={styles.label}>Detected links</Text>
          <SoftCard style={{ gap: 8 }}>
            {links.map((link) => (
              <Text key={link} style={styles.link} numberOfLines={2}>
                {link}
              </Text>
            ))}
          </SoftCard>
        </>
      ) : null}

      <Text style={styles.label}>ML analysis</Text>
      <SoftCard>
        <Text style={styles.value}>
          Decision: {message.decision ?? 'pending'}
          {'\n'}
          Confidence:{' '}
          {message.confidence != null ? `${Math.round(message.confidence * 100)}%` : '—'}
          {message.processing_time_ms != null
            ? `\nProcessing: ${message.processing_time_ms} ms`
            : ''}
        </Text>
      </SoftCard>

      <Text style={styles.label}>Recommendation</Text>
      <SoftCard>
        <Text style={styles.value}>{recommendation}</Text>
      </SoftCard>

      <View style={styles.actions}>
        <Pressable
          style={styles.action}
          disabled={!message.otp_code}
          onPress={async () => {
            if (!message.otp_code) return;
            await Share.share({ message: message.otp_code });
            showToast('OTP ready to copy', 'success');
          }}
        >
          <Copy color={theme.colors.blue400} size={18} />
          <Text style={styles.actionText}>Copy OTP</Text>
        </Pressable>
        <Pressable
          style={styles.action}
          onPress={() =>
            void Share.share({
              message: `${message.sender}\n${message.phone_number}\n\n${message.body}`,
            })
          }
        >
          <Share2 color={theme.colors.blue400} size={18} />
          <Text style={styles.actionText}>Share</Text>
        </Pressable>
      </View>
      <View style={styles.actions}>
        <Pressable
          style={styles.action}
          onPress={() => showToast('Marked as safe on this device', 'success')}
        >
          <ShieldCheck color={theme.colors.emerald400} size={18} />
          <Text style={[styles.actionText, { color: theme.colors.emerald400 }]}>Mark Safe</Text>
        </Pressable>
        <Pressable
          style={[styles.action, styles.actionDanger]}
          onPress={() => showToast('Reported for review', 'success')}
        >
          <ShieldAlert color={theme.colors.rose400} size={18} />
          <Text style={[styles.actionText, { color: theme.colors.rose400 }]}>Report Scam</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: 16, paddingBottom: 40, gap: 4 },
  hero: { marginBottom: 8, gap: 6 },
  sender: { color: theme.colors.textPrimary, fontSize: 22, fontWeight: '700' },
  phone: { color: theme.colors.slate400, fontSize: 14 },
  time: { color: theme.colors.slate500, fontSize: 12, marginTop: 2 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  label: {
    color: theme.colors.slate500,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 8,
  },
  body: { color: theme.colors.slate200, fontSize: 16, lineHeight: 24 },
  otpCard: { alignItems: 'center', paddingVertical: 20 },
  otpCode: {
    color: theme.colors.blue400,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 6,
  },
  grid: { flexDirection: 'row', gap: 12, marginTop: 16 },
  metric: { flex: 1 },
  metricLabel: { color: theme.colors.slate500, fontSize: 12 },
  metricValue: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 6,
  },
  link: { color: theme.colors.rose400, fontSize: 13 },
  value: { color: theme.colors.textPrimary, fontSize: 14, lineHeight: 21 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.blueSoft,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionDanger: { backgroundColor: theme.colors.roseSoft },
  actionText: { color: theme.colors.blue400, fontWeight: '700', fontSize: 13 },
});
