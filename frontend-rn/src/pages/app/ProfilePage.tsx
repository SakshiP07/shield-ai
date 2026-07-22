import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Shield, Bell, Lock, Bot, CreditCard, ChevronRight, LogOut, Settings } from 'lucide-react-native';
import { MobileCard, MobilePage } from '../../components/mobile/MobilePage';
import { UserAvatar } from '../../components/mobile/UserAvatar';
import { useAuth } from '../../hooks/AuthContext';
import { theme } from '../../theme';
import type { RootStackParamList } from '../../navigation/AppNavigator';

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
  const [loggingOut, setLoggingOut] = React.useState(false);

  if (!user) return null;

  const handleSignOut = async () => {
    setLoggingOut(true);
    try {
      await signOut();
    } catch {
      // Ignored
    } finally {
      if (loggingOut) setLoggingOut(false);
    }
  };

  return (
    <MobilePage>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <UserAvatar avatarUrl={user.avatar_url} name={user.name} size="lg" />
          <View style={styles.headerText}>
            <Text style={styles.name}>{user.name}</Text>
            <Text style={styles.email}>{user.email ?? user.phone}</Text>
            <View style={styles.badgeRow}>
              <View style={styles.planBadge}>
                <Text style={styles.planBadgeText}>PRO</Text>
              </View>
            </View>
          </View>
          <Pressable onPress={() => navigation.navigate('EditProfile')} hitSlop={12} style={styles.settingsBtn}>
            <Settings color={theme.colors.slate400} size={24} />
          </Pressable>
        </View>

        <MobileCard padding="sm" style={styles.menuCard}>
          {MENU_ITEMS.map((item, index) => {
            const Icon = item.icon;
            return (
              <Pressable
                key={item.label}
                onPress={() => navigation.navigate(item.target as any)}
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
        </MobileCard>

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
              <Text style={styles.signOutText}>Sign Out</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </MobilePage>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  headerText: {
    flex: 1,
    marginLeft: 16,
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
  },
  email: {
    fontSize: 14,
    color: theme.colors.slate400,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  planBadge: {
    backgroundColor: 'rgba(59,130,246,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  planBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: theme.colors.blue400,
    letterSpacing: 0.5,
  },
  settingsBtn: {
    padding: 8,
  },
  menuCard: {
    marginBottom: 24,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  menuItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  menuItemPressed: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(244,63,94,0.1)',
    height: 56,
    borderRadius: 16,
    marginBottom: 40,
  },
  signOutBtnPressed: {
    backgroundColor: 'rgba(244,63,94,0.15)',
  },
  signOutBtnDisabled: {
    opacity: 0.7,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.rose400,
  },
});
