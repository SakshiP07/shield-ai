import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { CheckCircle2, QrCode, CreditCard, Phone, AlertTriangle, XCircle } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { ScoreRing } from '../../components/mobile/ScoreRing';
import { Badge } from '../../components/mobile/Badge';
import { MobileCard, MobilePage, SectionHeader } from '../../components/mobile/MobilePage';
import { useAuth } from '../../hooks/AuthContext';
import { api, type ActivityItem, type DashboardStats, type ScamAlert } from '../../lib/api';
import {
  badgeFromStatus,
  riskBarGradientColors,
  riskLabel,
  scoreProtectionColor,
  scoreProtectionDotColor,
  scoreProtectionLabel,
  statusIconColor,
  timeAgo,
  timeGreeting,
} from '../../lib/format';
import { theme } from '../../theme';
import type { TabParamList } from '../../navigation/AppNavigator';

const QUICK_ACTIONS: Array<{
  icon: typeof QrCode;
  label: string;
  tab?: string;
  target: 'Scan' | 'Alerts';
  danger?: boolean;
}> = [
  { icon: QrCode, label: 'Scan QR', tab: 'qr', target: 'Scan' },
  { icon: CreditCard, label: 'Check UPI', tab: 'upi', target: 'Scan' },
  { icon: Phone, label: 'Phone', tab: 'phone', target: 'Scan' },
  { icon: AlertTriangle, label: 'Report', danger: true, target: 'Alerts' },
];

function riskBarWidth(level: string): `${number}%` {
  const map: Record<string, `${number}%`> = { low: '22%', medium: '55%', high: '85%', critical: '95%' };
  return map[level] ?? '22%';
}

const PREVIEW_LIMIT = 3;

export function AppHomePage() {
  const { user } = useAuth();
  const navigation = useNavigation<BottomTabNavigationProp<TabParamList>>();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [scamAlerts, setScamAlerts] = useState<ScamAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.dashboardStats(), api.dashboardActivity(), api.scamAlerts()])
      .then(([s, a, alerts]) => {
        if (cancelled) return;
        setStats(s);
        setActivities(a);
        setScamAlerts(alerts);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('Failed to fetch') || msg.includes('Network request failed')) return;
        console.error(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.blue500} size="large" />
      </View>
    );
  }

  const score = stats?.security_score ?? 0;
  const recentActivities = activities.slice(0, PREVIEW_LIMIT);
  const recentScamAlerts = scamAlerts.slice(0, PREVIEW_LIMIT);
  const firstName = user?.name?.split(' ')[0] ?? 'User';
  const breakdown = stats?.score_breakdown ?? [];
  const riskLevel = stats?.risk_level ?? 'low';

  const [riskStartColor, riskEndColor] = riskBarGradientColors(riskLevel);

  return (
    <MobilePage style={styles.page}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.greeting}>
          <Text style={styles.greetingTime}>{timeGreeting()}</Text>
          <Text style={styles.greetingName}>{firstName}</Text>
        </View>

        <MobileCard padding="lg">
          <Text style={styles.cardHeader}>AI SECURITY SCORE</Text>
          <View style={styles.scoreRow}>
            <View style={styles.scoreTextCol}>
              <View style={styles.scoreValueRow}>
                <Text style={styles.scoreValue}>{score}</Text>
                <Text style={styles.scoreMax}>/100</Text>
              </View>
              <View style={styles.protectionRow}>
                <View style={[styles.protectionDot, { backgroundColor: scoreProtectionDotColor(score) }]} />
                <Text style={[styles.protectionText, { color: scoreProtectionColor(score) }]} numberOfLines={1}>
                  {scoreProtectionLabel(score)}
                </Text>
              </View>
              <Text style={styles.lastScanText} numberOfLines={1}>
                {stats?.last_scan_at ? `Last scan: ${timeAgo(stats.last_scan_at)}` : 'No scans yet'}
              </Text>
            </View>
            <ScoreRing score={score} />
          </View>

          {breakdown.length > 0 && (
            <View style={styles.breakdownSection}>
              <Text style={styles.breakdownTitle}>Reason</Text>
              {breakdown.map((reason) => (
                <View key={reason} style={styles.breakdownItem}>
                  <View style={styles.breakdownBullet} />
                  <Text style={styles.breakdownText}>{reason}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.colors.rose400 }]}>{stats?.blocked_count ?? 0}</Text>
              <Text style={styles.statLabel}>Blocked</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.colors.blue400 }]}>{stats?.warning_count ?? 0}</Text>
              <Text style={styles.statLabel}>Warnings</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.colors.blue400 }]}>{stats?.safe_count ?? 0}</Text>
              <Text style={styles.statLabel}>Safe</Text>
            </View>
          </View>
        </MobileCard>

        <View style={styles.quickActions}>
          {QUICK_ACTIONS.map(({ icon: Icon, label, target, tab, danger }) => (
            <Pressable
              key={label}
              onPress={() => {
                if (target === 'Scan') {
                  navigation.navigate('Scan', { tab });
                } else if (target === 'Alerts') {
                  navigation.navigate('Alerts');
                }
              }}
              style={({ pressed }) => [
                styles.actionCard,
                pressed && styles.actionCardPressed
              ]}
            >
              <Icon color={danger ? theme.colors.rose400 : theme.colors.blue400} size={20} />
              <Text style={[styles.actionLabel, { color: danger ? theme.colors.rose400 : theme.colors.blue400 }]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        <MobileCard style={styles.riskCard}>
          <View style={styles.riskHeader}>
            <Text style={styles.riskTitle}>Today's Risk Level</Text>
            <Badge variant={badgeFromStatus(riskLevel)}>{riskLabel(riskLevel)}</Badge>
          </View>
          <View style={styles.riskTrack}>
            <View
              style={[
                styles.riskFill,
                { width: riskBarWidth(riskLevel), backgroundColor: riskStartColor } // Simplified gradient for RN view
              ]}
            />
          </View>
          <View style={styles.riskLabels}>
            <Text style={styles.riskLabelText}>Low</Text>
            <Text style={styles.riskLabelText}>Medium</Text>
            <Text style={styles.riskLabelText}>High</Text>
          </View>
        </MobileCard>

        <View style={styles.section}>
          <SectionHeader title="Recent Activity" actionLabel="View All" actionScreen="Activity" />
          {recentActivities.length === 0 ? (
            <Text style={styles.emptyText}>No activity yet. Run a scan to get started.</Text>
          ) : (
            <View style={styles.list}>
              {recentActivities.map((item) => {
                const badge = badgeFromStatus(item.badge);
                const Icon = badge === 'safe' ? CheckCircle2 : badge === 'danger' ? XCircle : AlertTriangle;
                return (
                  <MobileCard key={item.id} padding="sm" style={styles.listItem}>
                    <Icon color={statusIconColor(badge)} size={20} style={styles.listIcon} />
                    <View style={styles.listContent}>
                      <Text style={styles.listTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.listTime}>{timeAgo(item.time)}</Text>
                    </View>
                    <View style={styles.listRight}>
                      {item.amount && <Text style={styles.listAmount}>₹{item.amount}</Text>}
                      <Badge variant={badge}>{badge === 'safe' ? 'Safe' : badge === 'danger' ? 'Danger' : 'Review'}</Badge>
                    </View>
                  </MobileCard>
                );
              })}
            </View>
          )}
        </View>

        <View style={[styles.section, styles.lastSection]}>
          <SectionHeader title="Scam Alerts Near You" actionLabel="View All" actionScreen="ScamAlerts" />
          {recentScamAlerts.length === 0 ? (
            <Text style={styles.emptyText}>No scam alerts in your area.</Text>
          ) : (
            <View style={styles.list}>
              {recentScamAlerts.map((alert) => (
                <MobileCard key={alert.id} padding="sm">
                  <View style={styles.scamHeader}>
                    <Text style={styles.scamTitle} numberOfLines={2}>{alert.title}</Text>
                    <View style={styles.scamBadge}>
                      <Badge variant={badgeFromStatus(alert.badge === 'blocked' ? 'danger' : alert.badge)}>
                        {alert.badge === 'blocked' || alert.badge === 'danger' ? 'Danger' : 'Review'}
                      </Badge>
                    </View>
                  </View>
                  <Text style={styles.scamTime}>{timeAgo(alert.time)}</Text>
                </MobileCard>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </MobilePage>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingBottom: 0,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    marginBottom: 24,
  },
  greetingTime: {
    fontSize: 15,
    color: theme.colors.slate400,
    marginBottom: 4,
  },
  greetingName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
  },
  cardHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.blue400,
    letterSpacing: 0.5,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 20,
  },
  scoreTextCol: {
    flex: 1,
  },
  scoreValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
  },
  scoreMax: {
    fontSize: 18,
    fontWeight: '500',
    color: theme.colors.slate500,
    marginLeft: 4,
  },
  protectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  protectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  protectionText: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  lastScanText: {
    fontSize: 13,
    color: theme.colors.slate500,
    marginTop: 8,
  },
  breakdownSection: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    paddingTop: 20,
  },
  breakdownTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.slate400,
    marginBottom: 12,
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  breakdownBullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.slate500,
    marginTop: 10,
  },
  breakdownText: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.slate300,
    lineHeight: 22,
  },
  statsGrid: {
    flexDirection: 'row',
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    paddingTop: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 13,
    color: theme.colors.slate500,
    marginTop: 4,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  actionCard: {
    flex: 1,
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    minHeight: 80,
    gap: 10,
  },
  actionCardPressed: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '500',
    paddingHorizontal: 4,
  },
  riskCard: {
    marginTop: 24,
  },
  riskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  riskTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  riskTrack: {
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 5,
    overflow: 'hidden',
  },
  riskFill: {
    height: '100%',
    borderRadius: 5,
  },
  riskLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  riskLabelText: {
    fontSize: 13,
    color: theme.colors.slate500,
  },
  section: {
    marginTop: 28,
  },
  lastSection: {
    marginBottom: 32,
  },
  emptyText: {
    fontSize: 15,
    color: theme.colors.slate500,
    lineHeight: 22,
  },
  list: {
    gap: 12,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listIcon: {
    marginRight: 16,
  },
  listContent: {
    flex: 1,
    marginRight: 12,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.textPrimary,
  },
  listTime: {
    fontSize: 13,
    color: theme.colors.slate500,
    marginTop: 4,
  },
  listRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  listAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  scamHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  scamTitle: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.textPrimary,
    lineHeight: 20,
  },
  scamBadge: {
    marginTop: 2,
  },
  scamTime: {
    fontSize: 13,
    color: theme.colors.slate500,
    marginTop: 8,
  },
});
