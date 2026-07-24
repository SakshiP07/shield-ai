import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Shield,
  Bell,
  Lock,
  Bot,
  CreditCard,
  ChevronRight,
  LogOut,
  Smartphone,
  Clock,
} from 'lucide-react-native';
import { SoftCard, StatusPill } from '../../components/ui/Premium';
import { UserAvatar } from '../../components/mobile/UserAvatar';
import { MobilePage } from '../../components/mobile/MobilePage';
import { useAuth } from '../../hooks/AuthContext';
import { api, type AndroidSmsConnection, type DashboardStats } from '../../lib/api';
import { scoreProtectionLabel, timeAgo } from '../../lib/format';
import { theme } from '../../theme';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const MENU_ITEMS = [
  { icon: Shield, label: 'Edit Profile', target: 'EditProfile' },
  { icon: Bell, label: 'Notifications', target: 'NotificationSettings' },
  { icon: Lock, label: 'Privacy & Security', target: 'PrivacySettings' },
  { icon: Bot, label: 'AI Preferences', target: 'AiPreferences' },
  { icon: CreditCard, label: 'Current Plan', target: 'Plan' },
] as const;

export function ProfilePage() {
  const { user, signOut } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [loggingOut, setLoggingOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [connection, setConnection] = useState<AndroidSmsConnection | null>(null);

  const load = async () => {
    try {
      const [s, c] = await Promise.all([
        api.dashboardStats().catch(() => null),
        api.smsConnection().catch(() => null),
      ]);
      if (s) setStats(s);
      if (c) setConnection(c);
    } catch {
      // keep existing
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (!user) return null;

  const handleSignOut = async () => {
    setLoggingOut(true);
    try {
      await signOut();
    } catch {
      // Ignored
    } finally {
      setLoggingOut(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const score = stats?.security_score ?? 0;
  const protection = scoreProtectionLabel(score);
  const protectionTone = score >= 80 ? 'success' : score >= 50 ? 'warning' : 'danger';
  const deviceName = Constants.deviceName || Platform.OS;
  const lastLogin = stats?.last_scan_at ? timeAgo(stats.last_scan_at) : '—';

  // Never block the whole Profile menu on slow stats — show user + settings immediately.

  return (
    <MobilePage style={styles.page}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.blue500} />
        }
        contentContainerStyle={styles.scroll}
      >
        <SoftCard style={styles.hero}>
          <UserAvatar avatarUrl={user.avatar_url} name={user.name} size="lg" />
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.email}>{user.email || 'No email linked'}</Text>
          <Text style={styles.phone}>{user.phone || 'No phone linked'}</Text>
          <View style={styles.badgeRow}>
            <StatusPill label={user.plan || 'Free Shield'} tone="info" />
            <StatusPill label={protection} tone={protectionTone} />
          </View>
        </SoftCard>

        <SoftCard style={styles.infoCard}>
          <InfoRow
            icon={<Shield color={theme.colors.blue400} size={18} />}
            label="Security status"
            value={protection}
          />
          <InfoRow
            icon={<Smartphone color={theme.colors.emerald400} size={18} />}
            label="Connected device"
            value={
              connection?.connected
                ? `${deviceName} · SMS on`
                : `${deviceName} · SMS off`
            }
          />
          <InfoRow
            icon={<Clock color={theme.colors.slate400} size={18} />}
            label="Last activity"
            value={lastLogin}
            last
          />
        </SoftCard>

        <SoftCard style={styles.menuCard}>
          {MENU_ITEMS.map((item, index) => {
            const Icon = item.icon;
            return (
              <Pressable
                key={item.label}
                onPress={() => navigation.navigate(item.target)}
                style={({ pressed }) => [
                  styles.menuItem,
                  index < MENU_ITEMS.length - 1 && styles.menuItemBorder,
                  pressed && styles.menuItemPressed,
                ]}
              >
                <View style={styles.menuIconBox}>
                  <Icon color={theme.colors.slate300} size={20} />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <ChevronRight color={theme.colors.slate600} size={20} />
              </Pressable>
            );
          })}
        </SoftCard>

        <Pressable
          onPress={handleSignOut}
          disabled={loggingOut}
          style={({ pressed }) => [
            styles.signOutBtn,
            pressed && styles.signOutBtnPressed,
            loggingOut && styles.signOutBtnDisabled,
          ]}
        >
          {loggingOut ? (
            <ActivityIndicator color={theme.colors.rose400} size="small" />
          ) : (
            <>
              <LogOut color={theme.colors.rose400} size={20} />
              <Text style={styles.signOutText}>Log out</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </MobilePage>
  );
}

function InfoRow({
  icon,
  label,
  value,
  last,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !last && styles.infoBorder]}>
      <View style={styles.infoIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 0 },
  scroll: { paddingBottom: 40 },
  hero: { alignItems: 'center', gap: 6, marginBottom: 16, paddingVertical: 24 },
  name: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  email: { fontSize: 14, color: theme.colors.slate400 },
  phone: { fontSize: 14, color: theme.colors.slate400 },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  infoCard: { marginBottom: 16, paddingVertical: 4 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  infoBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: { color: theme.colors.slate500, fontSize: 12, marginBottom: 2 },
  infoValue: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: '600' },
  menuCard: { marginBottom: 20, padding: 0, overflow: 'hidden' },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  menuItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  menuItemPressed: { opacity: 0.85 },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 52,
    borderRadius: theme.radii.xl,
    backgroundColor: theme.colors.roseSoft,
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.25)',
  },
  signOutBtnPressed: { opacity: 0.85 },
  signOutBtnDisabled: { opacity: 0.5 },
  signOutText: {
    color: theme.colors.rose400,
    fontSize: 15,
    fontWeight: '700',
  },
});
