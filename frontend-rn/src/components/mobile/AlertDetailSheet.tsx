import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Modal } from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AlertDetail } from '../../lib/api';
import { alertStatus } from '../../lib/alertDisplay';
import { AlertStatusBadge } from './AlertStatusBadge';
import { formatTime } from '../../lib/format';
import { theme } from '../../theme';

interface AlertDetailSheetProps {
  alert: AlertDetail;
  onClose: () => void;
}

export function AlertDetailSheet({ alert, onClose }: AlertDetailSheetProps) {
  const status = alertStatus(alert);
  const insets = useSafeAreaInsets();
  
  const rulesList = (alert.rules?.results as Array<Record<string, unknown>>) || [];
  const activeRules = rulesList.filter((r) => r.triggered);

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <Text style={styles.title} numberOfLines={1}>{alert.title}</Text>
              <Text style={styles.time}>{formatTime(alert.created_at)}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeButton}>
              <X color={theme.colors.slate400} size={20} />
            </Pressable>
          </View>

          <View style={styles.badgeRow}>
            <AlertStatusBadge label={status.label} tone={status.tone} />
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Action / Recommendation */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recommendation</Text>
              <View style={[styles.card, { backgroundColor: theme.colors.surfaceInput }]}>
                <Text style={styles.text}>{alert.recommendation}</Text>
              </View>
            </View>

            {/* Context */}
            {alert.full_message && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Context</Text>
                <View style={styles.card}>
                  <Text style={styles.text}>{alert.full_message}</Text>
                </View>
              </View>
            )}

            {/* Why flagged */}
            {alert.flagged_reasons.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Why it was flagged</Text>
                <View style={styles.reasonsList}>
                  {alert.flagged_reasons.map((reason, i) => (
                    <View key={i} style={styles.reasonItem}>
                      <View style={styles.bullet} />
                      <Text style={styles.text}>{reason}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Engine Data */}
            {(activeRules.length > 0 || alert.ml_prediction || alert.behaviour) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Engine Data</Text>
                
                {activeRules.length > 0 && (
                  <View style={styles.engineCard}>
                    <Text style={styles.engineTitle}>Rule Engine</Text>
                    {activeRules.map((rule, i) => (
                      <Text key={i} style={styles.engineText}>
                        • {String(rule.name)}: {String(rule.detail)}
                      </Text>
                    ))}
                  </View>
                )}

                {alert.ml_prediction && (
                  <View style={styles.engineCard}>
                    <Text style={styles.engineTitle}>ML Prediction</Text>
                    <Text style={styles.engineText}>Fraud Probability: {Math.round(Number(alert.ml_prediction.fraud_score ?? 0) * 100)}%</Text>
                    <Text style={styles.engineText}>Risk Level: {String(alert.ml_prediction.risk_level ?? 'unknown')}</Text>
                  </View>
                )}

                {alert.behaviour && (
                  <View style={styles.engineCard}>
                    <Text style={styles.engineTitle}>Behaviour Analytics</Text>
                    <Text style={styles.engineText}>Deviation Score: {String(alert.behaviour.deviation_score ?? '—')}</Text>
                    {Array.isArray(alert.behaviour.flags) && alert.behaviour.flags.length > 0 && (
                      <Text style={styles.engineText}>Flags: {alert.behaviour.flags.join(', ')}</Text>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Debug Info */}
            <View style={styles.debugSection}>
              <Text style={styles.debugText}>Alert ID: {alert.id}</Text>
              {alert.transaction_id && <Text style={styles.debugText}>Tx: {alert.transaction_id}</Text>}
              {alert.scan_reference && <Text style={styles.debugText}>Scan: {alert.scan_reference}</Text>}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.surfaceCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 24,
    marginBottom: 16,
  },
  titleContainer: {
    flex: 1,
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
  },
  time: {
    fontSize: 13,
    color: theme.colors.slate500,
    marginTop: 4,
  },
  closeButton: {
    padding: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.slate500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
  },
  text: {
    fontSize: 15,
    color: theme.colors.textPrimary,
    lineHeight: 22,
  },
  reasonsList: {
    gap: 8,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.blue500,
    marginTop: 8,
  },
  engineCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  engineTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  engineText: {
    fontSize: 13,
    color: theme.colors.slate400,
    lineHeight: 20,
  },
  debugSection: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    paddingTop: 16,
    marginBottom: 24,
  },
  debugText: {
    fontSize: 11,
    color: theme.colors.slate500,
    fontFamily: 'Courier',
  },
});
