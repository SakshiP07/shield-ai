import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { ShieldCheck, ShieldAlert, ScanSearch } from 'lucide-react-native';
import { QrScanner } from '../../components/scan/QrScanner';
import { Badge } from '../../components/mobile/Badge';
import { MobilePage } from '../../components/mobile/MobilePage';
import { SoftCard, StatusPill } from '../../components/ui/Premium';
import { useToast } from '../../hooks/ToastContext';
import { ApiError, api, type ScanResult } from '../../lib/api';
import { theme } from '../../theme';
import type { TabParamList } from '../../navigation/AppNavigator';

const TABS = [
  { id: 'qr', label: 'QR' },
  { id: 'upi', label: 'UPI' },
  { id: 'phone', label: 'Phone' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const TAB_CONFIG: Record<
  TabId,
  { placeholder: string; button: string; hint: string }
> = {
  qr: {
    placeholder: 'Or paste QR text here',
    button: 'Analyze QR',
    hint: 'Point your camera at a payment QR',
  },
  upi: {
    placeholder: 'name@upi',
    button: 'Analyze UPI',
    hint: 'Check a UPI ID before paying',
  },
  phone: {
    placeholder: '+91 98765 43210',
    button: 'Analyze Phone',
    hint: 'Look up a phone number for fraud risk',
  },
};

const DECISION_VARIANT: Record<string, 'safe' | 'warning' | 'danger'> = {
  approve: 'safe',
  otp: 'warning',
  hold: 'warning',
  block: 'danger',
};

const DECISION_LABEL: Record<string, string> = {
  approve: 'Safe',
  otp: 'Verify OTP',
  hold: 'Review',
  block: 'Block',
};

function formatScanError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Session expired — sign in again';
    if (err.status >= 500) return 'Scan service unavailable';
    return err.message.slice(0, 80);
  }
  if (err instanceof TypeError && String(err.message).includes('Network request failed')) {
    return 'Cannot reach server';
  }
  return err instanceof Error ? err.message.slice(0, 80) : 'Scan failed';
}

function decisionCopy(result: ScanResult): string {
  if (result.message?.trim()) return result.message.trim();
  if (result.decision === 'approve') return 'Looks safe to continue.';
  if (result.decision === 'block') return 'High fraud risk — do not pay.';
  if (result.decision === 'hold') return 'Needs a closer look before you pay.';
  return 'Extra verification recommended.';
}

export function ScanPage() {
  const route = useRoute<RouteProp<TabParamList, 'Scan'>>();
  const requested = route.params?.tab;
  const initialTab: TabId =
    requested === 'upi' || requested === 'phone' || requested === 'qr' ? requested : 'qr';

  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [value, setValue] = useState('');
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    if (requested === 'upi' || requested === 'phone' || requested === 'qr') {
      setActiveTab(requested);
      setValue('');
      setError('');
      setResult(null);
    }
  }, [requested]);

  const config = TAB_CONFIG[activeTab];

  const runScan = async (content: string, scanType: TabId = activeTab) => {
    const trimmed = content.trim();
    if (!trimmed) {
      setError('Enter something to analyze');
      return;
    }

    setScanning(true);
    setError('');
    setResult(null);
    try {
      const scanResult = await api.analyzeScan(scanType, trimmed);
      setResult(scanResult);
      const label = DECISION_LABEL[scanResult.decision] ?? 'Checked';
      showToast(label, scanResult.decision === 'block' ? 'error' : 'success');
      if (scanResult.decision === 'approve') setValue('');
    } catch (err) {
      setResult(null);
      const message = formatScanError(err);
      setError(message);
      showToast(message, 'error');
    } finally {
      setScanning(false);
    }
  };

  const resultTone = useMemo(() => {
    if (!result) return null;
    if (result.decision === 'approve') return 'success' as const;
    if (result.decision === 'block') return 'danger' as const;
    return 'warning' as const;
  }, [result]);

  return (
    <MobilePage style={styles.page}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
      >
        <Text style={styles.heading}>Scanner</Text>
        <Text style={styles.sub}>AI checks QR, UPI, and phone before you pay</Text>

        <View style={styles.tabs}>
          {TABS.map((tab) => {
            const on = tab.id === activeTab;
            return (
              <Pressable
                key={tab.id}
                onPress={() => {
                  setActiveTab(tab.id);
                  setValue('');
                  setError('');
                  setResult(null);
                }}
                style={[styles.tab, on && styles.tabOn]}
              >
                <Text style={[styles.tabText, on && styles.tabTextOn]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {activeTab === 'qr' ? (
          <View style={styles.qrBlock}>
            <SoftCard style={styles.qrCard}>
              <QrScanner
                onScan={(decoded) => {
                  setValue(decoded);
                  void runScan(decoded, 'qr');
                }}
                onError={(message) => setError(message)}
              />
            </SoftCard>
            <Text style={styles.qrHint}>{config.hint}</Text>
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={setValue}
              placeholder={config.placeholder}
              placeholderTextColor={theme.colors.slate500}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        ) : (
          <SoftCard style={styles.formCard}>
            <Text style={styles.hint}>{config.hint}</Text>
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={setValue}
              placeholder={config.placeholder}
              placeholderTextColor={theme.colors.slate500}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={activeTab === 'phone' ? 'phone-pad' : 'default'}
            />
          </SoftCard>
        )}

        <Pressable
          onPress={() => void runScan(value)}
          disabled={scanning}
          style={({ pressed }) => [
            styles.analyzeBtn,
            scanning && styles.analyzeDisabled,
            pressed && !scanning && styles.analyzePressed,
          ]}
        >
          {scanning ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <ScanSearch color="#fff" size={18} />
              <Text style={styles.analyzeText}>{config.button}</Text>
            </>
          )}
        </Pressable>

        {!!error && <Text style={styles.error}>{error}</Text>}

        {result ? (
          <SoftCard style={styles.result}>
            <View style={styles.resultTop}>
              {result.decision === 'approve' ? (
                <ShieldCheck color={theme.colors.emerald400} size={22} />
              ) : (
                <ShieldAlert
                  color={
                    result.decision === 'block' ? theme.colors.rose400 : theme.colors.amber400
                  }
                  size={22}
                />
              )}
              <Text style={styles.resultTitle}>ML result</Text>
              <StatusPill
                label={DECISION_LABEL[result.decision] ?? result.decision}
                tone={resultTone ?? 'info'}
              />
            </View>
            <Text style={styles.resultMsg}>{decisionCopy(result)}</Text>
            <View style={styles.metrics}>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>{Math.round(result.fraud_score * 100)}%</Text>
                <Text style={styles.metricLabel}>Fraud</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>{result.risk_score}</Text>
                <Text style={styles.metricLabel}>Risk</Text>
              </View>
              <View style={styles.metric}>
                <Text style={[styles.metricValue, { textTransform: 'capitalize' }]}>
                  {result.risk_level}
                </Text>
                <Text style={styles.metricLabel}>Level</Text>
              </View>
            </View>
            <Badge variant={DECISION_VARIANT[result.decision] ?? 'warning'}>
              {result.status || result.decision}
            </Badge>
          </SoftCard>
        ) : null}
      </ScrollView>
    </MobilePage>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingBottom: 0 },
  scroll: { paddingBottom: 40 },
  heading: {
    color: theme.colors.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  sub: {
    color: theme.colors.slate400,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 18,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  tab: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceCard,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tabOn: {
    backgroundColor: theme.colors.blue600,
    borderColor: theme.colors.blue600,
  },
  tabText: {
    color: theme.colors.slate300,
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextOn: { color: '#fff' },
  qrBlock: { alignItems: 'center', gap: 12 },
  qrCard: { width: '100%', padding: 12, alignItems: 'center' },
  qrHint: {
    color: theme.colors.slate400,
    fontSize: 13,
    textAlign: 'center',
  },
  formCard: { gap: 12 },
  hint: {
    color: theme.colors.slate400,
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    width: '100%',
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceInput,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    paddingHorizontal: 14,
    color: theme.colors.textPrimary,
    fontSize: 16,
  },
  analyzeBtn: {
    marginTop: 16,
    height: 52,
    borderRadius: 16,
    backgroundColor: theme.colors.blue600,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  analyzePressed: { backgroundColor: theme.colors.blue500 },
  analyzeDisabled: { opacity: 0.6 },
  analyzeText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  error: {
    marginTop: 12,
    color: theme.colors.rose400,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  result: { marginTop: 16, gap: 12 },
  resultTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  resultTitle: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  resultMsg: {
    color: theme.colors.slate200,
    fontSize: 15,
    lineHeight: 22,
  },
  metrics: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    paddingTop: 12,
  },
  metric: { flex: 1, alignItems: 'center', gap: 4 },
  metricValue: {
    color: theme.colors.blue400,
    fontSize: 18,
    fontWeight: '700',
  },
  metricLabel: { color: theme.colors.slate500, fontSize: 12 },
});
