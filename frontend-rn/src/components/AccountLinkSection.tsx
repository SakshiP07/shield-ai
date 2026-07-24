import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Mail, Phone } from 'lucide-react-native';
import { MobileCard } from './mobile/MobilePage';
import type { User } from '../lib/api';
import { theme } from '../theme';

export function AccountLinkSection({ user }: { user: User }) {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>LINKED ACCOUNTS</Text>

      <MobileCard padding="sm" style={styles.card}>
        {/* Phone Section */}
        <View style={styles.row}>
          <Phone color={theme.colors.slate400} size={20} />
          <View style={styles.content}>
            <Text style={styles.label}>Phone Number</Text>
            {user.phone ? (
              <Text style={styles.value}>{user.phone}</Text>
            ) : (
              <Pressable onPress={() => navigation.navigate('ProfileSetup')} hitSlop={8}>
                <Text style={styles.linkText}>Link phone</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Google Section */}
        <View style={styles.row}>
          <Mail color={theme.colors.slate400} size={20} />
          <View style={styles.content}>
            <Text style={styles.label}>Google Account</Text>
            {user.google_id ? (
              <Text style={styles.value}>{user.email ?? 'Linked'}</Text>
            ) : (
              <Pressable
                onPress={() => {
                  /* Google Link logic goes here or pass from parent */
                  // Often simpler to keep link logic in the Profile page 
                  // or just show instructions since Google OAuth link needs a flow
                }}
                hitSlop={8}
              >
                <Text style={styles.linkText}>Link Google</Text>
              </Pressable>
            )}
          </View>
        </View>
      </MobileCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.slate500,
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  card: {
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginHorizontal: 16,
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.textPrimary,
  },
  value: {
    marginTop: 2,
    fontSize: 13,
    color: theme.colors.slate400,
  },
  linkText: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.blue500,
  },
});
