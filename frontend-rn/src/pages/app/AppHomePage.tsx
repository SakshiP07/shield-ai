import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Animated,
  Image,
  Easing,
} from 'react-native';
import {
  Bell,
  QrCode,
  CreditCard,
  Phone,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MessageSquare,
  ScanLine,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScoreRing } from '../../components/mobile/ScoreRing';
import { MobilePage } from '../../components/mobile/MobilePage';
import { EmptyState, SectionLabel, Skeleton, SoftCard, StatusPill } from '../../components/ui/Premium';
import { useAuth } from '../../hooks/AuthContext';
import { useAlertsSocket } from '../../hooks/AlertsSocketContext';
import { api, type ActivityItem, type DashboardStats, type ScamAlert } from '../../lib/api';
import {
  badgeFromStatus,
  clampProtectionScore,
  scoreProtectionColor,
  scoreProtectionDotColor,
  scoreProtectionLabel,
  statusIconColor,
  timeAgo,
  timeGreeting,
} from '../../lib/format';
import { theme } from '../../theme';
import type { RootStackParamList, TabParamList } from '../../navigation/AppNavigator';

const QUICK_ACTIONS = [
  { icon: QrCode, label: 'Scan QR', tab: 'qr', target: 'Scan' as const },
  { icon: CreditCard, label: 'Check UPI', tab: 'upi', target: 'Scan' as const },
  { icon: Phone, label: 'Check phone', tab: 'phone', target: 'Scan' as const },
  { icon: MessageSquare, label: 'Open SMS', target: 'SMS' as const },
];

const ACTIVITY_LIMIT = 3;
const ALERT_LIMIT = 2;

function safetyBlurb(score: number, threats: number): string | null {
  if (score >= 80) {
    return threats > 0
      ? `${threats} threat${threats === 1 ? '' : 's'} blocked`
      : null;
  }
  if (score >= 50) return 'Review open threats before you pay';
  return 'Open Threats to clear risks';
}

export function AppHomePage() {
  const { user } = useAuth();
  const { unreadCount } = useAlertsSocket();
  const tabNav = useNavigation<BottomTabNavigationProp<TabParamList>>();
  const stackNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [scamAlerts, setScamAlerts] = useState<ScamAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(12)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  const load = useCallback(async () => {
    try {
      const [s, a, alerts] = await Promise.all([
        api.dashboardStats(),
        api.dashboardActivity(),
        api.scamAlerts(),
      ]);
      setStats(s);
      setActivities(a);
      setScamAlerts(alerts);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('Failed to fetch') && !msg.includes('Network request failed')) {
        console.error(err);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await load();
      if (!cancelled) {
        setLoading(false);
        Animated.parallel([
          Animated.timing(fade, { toValue: 1, duration: 340, useNativeDriver: true }),
          Animated.timing(slide, {
            toValue: 0,
            duration: 340,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, fade, slide]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.3, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const score = clampProtectionScore(stats?.security_score ?? 0);
  const threats = stats?.threats_blocked ?? stats?.warning_count ?? 0;
  const recentActivities = activities.slice(0, ACTIVITY_LIMIT);
  const recentThreats = scamAlerts.slice(0, ALERT_LIMIT);
  const lastScan = stats?.last_scan_at ? timeAgo(stats.last_scan_at) : 'Not yet';
  const protection = scoreProtectionLabel(score);
  const protectionTone = score >= 80 ? 'success' : score >= 50 ? 'info' : 'danger';
  const blurb = safetyBlurb(score, threats);
  void tick;

  if (loading) {
    return (
      <MobilePage style={styles.page}>
        <Skeleton height={24} width="40%" style={{ marginBottom: 8 }} />
        <Skeleton height={32} width="55%" style={{ marginBottom: 20 }} />
        <Skeleton height={180} radius={24} style={{ marginBottom: 16 }} />
        <Skeleton height={88} radius={20} />
      </MobilePage>
    );
  }

  return (
    <MobilePage style={styles.page}>
      <Animated.View style={{ flex: 1, opacity: fade, transform: [{ translateY: slide }] }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.blue500} />
          }
          contentContainerStyle={styles.scroll}
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.greeting}>{timeGreeting()}</Text>
              <Text style={styles.name}>{firstName}</Text>
            </View>
            <View style={styles.headerRight}>
              <Pressable style={styles.iconBtn} onPress={() => tabNav.navigate('Alerts')} hitSlop={8}>
                <Bell color={theme.colors.textPrimary} size={20} />
                {unreadCount > 0 ? <View style={styles.notifDot} /> : null}
              </Pressable>
              <Pressable style={styles.avatar} onPress={() => tabNav.navigate('Profile')}>
                {user?.avatar_url ? (
                  <Image source={{ uri: user.avatar_url }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarText}>{(firstName[0] ?? 'U').toUpperCase()}</Text>
                )}
              </Pressable>
            </View>
          </View>

          <SoftCard style={styles.scoreCard}>
            <View style={styles.scoreTop}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <View style={styles.badgeRow}>
                  <Animated.View
                    style={[
                      styles.liveDot,
                      {
                        backgroundColor: scoreProtectionDotColor(score),
                        transform: [{ scale: pulse }],
                      },
                    ]}
                  />
                  <StatusPill label={protection} tone={protectionTone} />
                </View>
                <Text style={styles.meta}>Last scan · {lastScan}</Text>
              </View>
              <ScoreRing score={score} size={118} color={scoreProtectionColor(score)} />
            </View>
            {!!blurb && <Text style={styles.explain}>{blurb}</Text>}
          </SoftCard>

          <View style={styles.statRow}>
            <SoftCard style={styles.statCard}>
              <Text style={styles.statValue}>{stats?.items_scanned ?? 0}</Text>
              <Text style={styles.statLabel}>Scanned</Text>
            </SoftCard>
            <SoftCard style={styles.statCard}>
              <Text style={[styles.statValue, { color: theme.colors.rose400 }]}>
                {stats?.warning_count ?? 0}
              </Text>
              <Text style={styles.statLabel}>Flags</Text>
            </SoftCard>
            <SoftCard style={styles.statCard}>
              <Text style={styles.statValue}>{stats?.safe_count ?? 0}</Text>
              <Text style={styles.statLabel}>Safe</Text>
            </SoftCard>
          </View>

          <Text style={styles.section}>Quick actions</Text>
          <View style={styles.quickGrid}>
            {QUICK_ACTIONS.map(({ icon: Icon, label, target, tab }) => (
              <Pressable
                key={label}
                style={({ pressed }) => [styles.quickBtn, pressed && styles.pressed]}
                onPress={() => {
                  if (target === 'Scan') tabNav.navigate('Scan', { tab });
                  else if (target === 'SMS') tabNav.navigate('SMS');
                  else tabNav.navigate('Alerts');
                }}
              >
                <View style={styles.quickIcon}>
                  <Icon color={theme.colors.blue400} size={18} />
                </View>
                <Text style={styles.quickLabel}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {recentThreats.length > 0 ? (
            <>
              <SectionLabel title="Needs attention" action="Alerts" onAction={() => tabNav.navigate('Alerts')} />
              <View style={styles.listGap}>
                {recentThreats.map((alert) => (
                  <SoftCard key={alert.id} style={styles.scamCard} onPress={() => tabNav.navigate('Alerts')}>
                    <AlertTriangle color={theme.colors.rose400} size={16} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activityTitle} numberOfLines={1}>
                        {alert.title}
                      </Text>
                      <Text style={styles.activityTime}>{timeAgo(alert.time)}</Text>
                    </View>
                  </SoftCard>
                ))}
              </View>
            </>
          ) : null}

          <View style={{ marginTop: recentThreats.length ? 8 : 0 }}>
            <SectionLabel
              title="Recent activity"
              action="View all"
              onAction={() => stackNav.navigate('Activity')}
            />
          </View>
          {recentActivities.length === 0 ? (
            <EmptyState
              title="No activity yet"
              subtitle="Scan a QR or UPI to get started."
              icon={<ScanLine color={theme.colors.blue400} size={22} />}
            />
          ) : (
            <View style={styles.listGap}>
              {recentActivities.map((item) => {
                const badge = badgeFromStatus(item.badge);
                const Icon =
                  badge === 'safe' ? CheckCircle2 : badge === 'danger' ? XCircle : AlertTriangle;
                return (
                  <SoftCard key={item.id} style={styles.activityRow} onPress={() => tabNav.navigate('Alerts')}>
                    <View style={[styles.activityIcon, { backgroundColor: `${statusIconColor(badge)}22` }]}>
                      <Icon color={statusIconColor(badge)} size={16} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activityTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.activityTime}>{timeAgo(item.time)}</Text>
                    </View>
                  </SoftCard>
                );
              })}
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </MobilePage>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 0 },
  scroll: { paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  headerLeft: { flex: 1, paddingRight: 12 },
  greeting: { color: theme.colors.slate400, fontSize: 14, marginBottom: 4 },
  name: {
    color: theme.colors.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  notifDot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.rose500,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: theme.colors.blue600,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 40, height: 40 },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  scoreCard: { marginBottom: 14, padding: 18, gap: 10 },
  scoreTop: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  meta: { color: theme.colors.slate500, fontSize: 13, marginTop: 10 },
  explain: {
    color: theme.colors.slate400,
    fontSize: 13,
    lineHeight: 18,
  },
  section: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  statCard: { flex: 1, gap: 4, paddingVertical: 14, alignItems: 'center' },
  statValue: { color: theme.colors.textPrimary, fontSize: 20, fontWeight: '700' },
  statLabel: { color: theme.colors.slate400, fontSize: 12 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
  quickBtn: {
    width: '47%',
    flexGrow: 1,
    minWidth: '45%',
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pressed: { opacity: 0.88 },
  quickIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: theme.colors.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: '600', flex: 1 },
  listGap: { gap: 8, marginBottom: 8 },
  scamCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  activityIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTitle: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: '600' },
  activityTime: { color: theme.colors.slate500, fontSize: 12, marginTop: 2 },
});
