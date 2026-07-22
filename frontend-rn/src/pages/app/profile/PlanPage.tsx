import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Check } from 'lucide-react-native';
import { MobilePage, MobileCard } from '../../../components/mobile/MobilePage';
import { theme } from '../../../theme';

export function PlanPage() {
  return (
    <MobilePage style={styles.page}>
      <View style={styles.planHeader}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>CURRENT PLAN</Text>
        </View>
        <Text style={styles.planTitle}>ShieldAI Pro</Text>
        <Text style={styles.planDesc}>You have access to all premium security features.</Text>
      </View>

      <MobileCard padding="lg" style={styles.featuresCard}>
        <Text style={styles.featuresTitle}>Included in Pro</Text>
        
        <View style={styles.featureItem}>
          <View style={styles.checkIcon}>
            <Check color={theme.colors.emerald400} size={16} />
          </View>
          <Text style={styles.featureText}>Real-time SMS & Call scanning</Text>
        </View>

        <View style={styles.featureItem}>
          <View style={styles.checkIcon}>
            <Check color={theme.colors.emerald400} size={16} />
          </View>
          <Text style={styles.featureText}>Advanced ML threat detection</Text>
        </View>

        <View style={styles.featureItem}>
          <View style={styles.checkIcon}>
            <Check color={theme.colors.emerald400} size={16} />
          </View>
          <Text style={styles.featureText}>Unlimited manual scans</Text>
        </View>

        <View style={styles.featureItem}>
          <View style={styles.checkIcon}>
            <Check color={theme.colors.emerald400} size={16} />
          </View>
          <Text style={styles.featureText}>Priority threat intelligence updates</Text>
        </View>
      </MobileCard>

      <Pressable style={({ pressed }) => [styles.manageButton, pressed && styles.manageButtonPressed]}>
        <Text style={styles.manageButtonText}>Manage Subscription</Text>
      </Pressable>
    </MobilePage>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 24,
  },
  planHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  badge: {
    backgroundColor: 'rgba(59,130,246,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 16,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: theme.colors.blue400,
    letterSpacing: 1,
  },
  planTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  planDesc: {
    fontSize: 15,
    color: theme.colors.slate400,
    textAlign: 'center',
  },
  featuresCard: {
    marginBottom: 24,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(52,211,153,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  featureText: {
    fontSize: 15,
    color: theme.colors.slate300,
  },
  manageButton: {
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: 16,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageButtonPressed: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  manageButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
});
