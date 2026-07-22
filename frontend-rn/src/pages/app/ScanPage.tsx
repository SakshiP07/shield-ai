import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { Eye } from 'lucide-react-native';
import { QrScanner } from '../../components/scan/QrScanner';
import { Badge } from '../../components/mobile/Badge';
import { MobileCard, MobilePage } from '../../components/mobile/MobilePage';
import { useToast } from '../../hooks/ToastContext';
import { ApiError, api, type ScanResult } from '../../lib/api';
import { theme } from '../../theme';
import type { TabParamList } from '../../navigation/AppNavigator';

const TABS = [
  { id: 'qr', label: 'QR Code' },
  { id: 'sms', label: 'SMS' },
  { id: 'upi', label: 'UPI ID' },
  { id: 'phone', label: 'Phone No.' },
  { id: 'link', label: 'Link' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const TAB_CONFIG: Record<
  TabId,
  { label: string; placeholder: string; button: string; multiline?: boolean }
> = {
  qr: { label: '', placeholder: 'Or paste QR payload / URL', button: 'Analyze QR' },
  sms: { label: 'SMS CONTENT', placeholder: 'Paste SMS text here...', button: 'Analyze SMS', multiline: true },
  upi: { label: 'UPI ID', placeholder: 'e.g. merchant@okaxis', button: 'Analyze UPI ID' },
  phone: { label: 'PHONE NUMBER', placeholder: '+91 XXXXX XXXXX', button: 'Analyze Phone' },
  link: { label: 'LINK', placeholder: 'https://payment-link.com/...', button: 'Analyze Link' },
};

const DECISION_VARIANT: Record<string, 'safe' | 'warning' | 'danger'> = {
  approve: 'safe',
  otp: 'warning',
  hold: 'warning',
  block: 'danger',
};

const DECISION_TOAST: Record<string, 'success' | 'error' | 'info'> = {
  approve: 'success',
  otp: 'info',
  hold: 'info',
  block: 'error',
};

function formatScanError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Session expired. Please sign in again.';
    if (err.status >= 500) return 'Scan service is temporarily unavailable.';
    return err.message;
  }
  if (err instanceof TypeError && String(err.message).includes('Network request failed')) {
    return 'Cannot reach the server. Check your connection.';
  }
  return err instanceof Error ? err.message : 'Scan failed';
}

export function ScanPage() {
  const route = useRoute<RouteProp<TabParamList, 'Scan'>>();
  const initialTab = (route.params?.tab as TabId) || 'qr';
  const [activeTab, setActiveTab] = useState<TabId>(
    TABS.some((t) => t.id === initialTab) ? initialTab : 'qr',
  );
  const [value, setValue] = useState('');
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const { showToast } = useToast();

  const config = TAB_CONFIG[activeTab];

  const runScan = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) {
      setError('Enter or scan content to analyze.');
      return;
    }

    setScanning(true);
    setError('');
    try {
      const scanResult = await api.analyzeScan(activeTab, trimmed);
      setResult(scanResult);
      const toastType = DECISION_TOAST[scanResult.decision] ?? 'info';
      showToast(`${scanResult.decision.toUpperCase()}: ${scanResult.message}`, toastType);
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

  return (
    <MobilePage>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.tabContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScrollContent}>
            {TABS.map((tab) => (
              <Pressable
                key={tab.id}
                onPress={() => {
                  setActiveTab(tab.id);
                  setValue('');
                  setError('');
                  setResult(null);
                }}
                style={[
                  styles.tabButton,
                  activeTab === tab.id ? styles.tabButtonActive : styles.tabButtonInactive,
                ]}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    activeTab === tab.id ? styles.tabButtonTextActive : styles.tabButtonTextInactive,
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {activeTab === 'qr' ? (
          <MobileCard padding="lg">
            <QrScanner
              onScan={(decoded) => {
                setValue(decoded);
                void runScan(decoded);
              }}
              onError={(message) => setError(message)}
            />
            <TextInput
              style={[styles.input, styles.qrInput]}
              value={value}
              onChangeText={setValue}
              placeholder={config.placeholder}
              placeholderTextColor={theme.colors.slate600}
              autoCapitalize="none"
              autoCorrect={false}
              textAlign="center"
            />
          </MobileCard>
        ) : (
          <MobileCard>
            <Text style={styles.inputLabel}>{config.label}</Text>
            <TextInput
              style={[styles.input, config.multiline && styles.inputMultiline]}
              value={value}
              onChangeText={setValue}
              placeholder={config.placeholder}
              placeholderTextColor={theme.colors.slate600}
              autoCapitalize="none"
              autoCorrect={false}
              multiline={config.multiline}
              numberOfLines={config.multiline ? 6 : 1}
              textAlignVertical={config.multiline ? 'top' : 'center'}
            />
          </MobileCard>
        )}

        <Pressable
          onPress={() => void runScan(value)}
          disabled={scanning}
          style={({ pressed }) => [
            styles.scanButton,
            scanning && styles.scanButtonDisabled,
            pressed && !scanning && styles.scanButtonPressed,
          ]}
        >
          {scanning ? (
            <ActivityIndicator color={theme.colors.textPrimary} size="small" />
          ) : (
            <>
              <Eye color={theme.colors.textPrimary} size={18} />
              <Text style={styles.scanButtonText}>{config.button}</Text>
            </>
          )}
        </Pressable>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {result && (
          <MobileCard style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>Scan result</Text>
              <Badge variant={DECISION_VARIANT[result.decision] ?? 'warning'}>
                {result.decision.toUpperCase()}
              </Badge>
            </View>
            <Text style={styles.resultMessage}>{result.message}</Text>
            
            <View style={styles.resultGrid}>
              <View style={styles.resultGridItem}>
                <Text style={styles.resultGridValue}>{result.risk_score}</Text>
                <Text style={styles.resultGridLabel}>Risk score</Text>
              </View>
              <View style={styles.resultGridItem}>
                <Text style={styles.resultGridValue}>{Math.round(result.fraud_score * 100)}%</Text>
                <Text style={styles.resultGridLabel}>Fraud prob.</Text>
              </View>
              <View style={styles.resultGridItem}>
                <Text style={[styles.resultGridValue, { color: theme.colors.textPrimary, textTransform: 'capitalize' }]} numberOfLines={1}>
                  {result.risk_level}
                </Text>
                <Text style={styles.resultGridLabel}>Risk level</Text>
              </View>
            </View>
          </MobileCard>
        )}
      </ScrollView>
    </MobilePage>
  );
}

const styles = StyleSheet.create({
  tabContainer: {
    marginBottom: 16,
  },
  tabScrollContent: {
    gap: 8,
    paddingBottom: 4,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
  },
  tabButtonActive: {
    backgroundColor: theme.colors.blue600,
  },
  tabButtonInactive: {
    backgroundColor: theme.colors.surfaceCard,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  tabButtonTextActive: {
    color: theme.colors.textPrimary,
  },
  tabButtonTextInactive: {
    color: theme.colors.slate400,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.slate500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  input: {
    width: '100%',
    fontSize: 15,
    color: theme.colors.textPrimary,
    minHeight: 24,
  },
  qrInput: {
    marginTop: 16,
  },
  inputMultiline: {
    minHeight: 120,
    lineHeight: 22,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.blue600,
    height: 52,
    borderRadius: 16,
    marginTop: 16,
  },
  scanButtonPressed: {
    backgroundColor: theme.colors.blue500,
  },
  scanButtonDisabled: {
    opacity: 0.6,
  },
  scanButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  errorText: {
    fontSize: 15,
    color: theme.colors.rose400,
    marginTop: 12,
  },
  resultCard: {
    marginTop: 16,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  resultMessage: {
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.slate300,
  },
  resultGrid: {
    flexDirection: 'row',
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    paddingTop: 16,
  },
  resultGridItem: {
    flex: 1,
    alignItems: 'center',
  },
  resultGridValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.blue400,
  },
  resultGridLabel: {
    fontSize: 13,
    color: theme.colors.slate500,
    marginTop: 4,
  },
});
