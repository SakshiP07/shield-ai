import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Check } from 'lucide-react-native';
import { MobilePage, MobileCard } from '../../../components/mobile/MobilePage';
import { useAuth } from '../../../hooks/AuthContext';
import { useToast } from '../../../hooks/ToastContext';
import { theme } from '../../../theme';

const PLANS = [
  {
    id: 'Free Shield',
    title: 'Free Shield',
    price: '₹0',
    blurb: 'Core SMS protection and manual scans.',
    features: ['SMS inbox sync', 'Basic fraud alerts', 'Manual QR / text scan'],
  },
  {
    id: 'Premium Shield',
    title: 'Premium Shield',
    price: 'Included',
    blurb: 'Full ShieldAI protection for your account.',
    features: [
      'Real-time SMS scanning',
      'Advanced ML threat detection',
      'Unlimited manual scans',
      'Priority threat updates',
    ],
  },
] as const;

export function PlanPage() {
  const { user, updateProfile, refreshUser } = useAuth();
  const { showToast } = useToast();
  const [managing, setManaging] = useState(false);
  const [saving, setSaving] = useState(false);

  const currentPlan = useMemo(() => {
    const raw = (user?.plan || 'Free Shield').trim();
    if (/premium|pro/i.test(raw)) return 'Premium Shield';
    if (/free/i.test(raw)) return 'Free Shield';
    return raw || 'Free Shield';
  }, [user?.plan]);

  const current = PLANS.find((p) => p.id === currentPlan) ?? PLANS[0];

  const selectPlan = async (planId: (typeof PLANS)[number]['id']) => {
    if (planId === currentPlan) {
      setManaging(false);
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ plan: planId });
      await refreshUser();
      showToast(`Switched to ${planId}`, 'success');
      setManaging(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update plan', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobilePage style={styles.page}>
      <View style={styles.planHeader}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>CURRENT PLAN</Text>
        </View>
        <Text style={styles.planTitle}>{current.title}</Text>
        <Text style={styles.planDesc}>{current.blurb}</Text>
        <Text style={styles.price}>{current.price}</Text>
      </View>

      <MobileCard padding="lg" style={styles.featuresCard}>
        <Text style={styles.featuresTitle}>Included</Text>
        {current.features.map((feature) => (
          <View key={feature} style={styles.featureItem}>
            <View style={styles.checkIcon}>
              <Check color={theme.colors.emerald400} size={16} />
            </View>
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </MobileCard>

      {!managing ? (
        <Pressable
          style={({ pressed }) => [styles.manageButton, pressed && styles.manageButtonPressed]}
          onPress={() => setManaging(true)}
        >
          <Text style={styles.manageButtonText}>Manage Subscription</Text>
        </Pressable>
      ) : (
        <View style={styles.managePanel}>
          <Text style={styles.manageTitle}>Choose a plan</Text>
          {PLANS.map((plan) => {
            const selected = plan.id === currentPlan;
            return (
              <Pressable
                key={plan.id}
                disabled={saving}
                onPress={() => void selectPlan(plan.id)}
                style={[styles.planOption, selected && styles.planOptionOn]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.planOptionTitle}>{plan.title}</Text>
                  <Text style={styles.planOptionDesc}>{plan.blurb}</Text>
                </View>
                {saving && !selected ? null : selected ? (
                  <View style={styles.selectedPill}>
                    <Text style={styles.selectedPillText}>Active</Text>
                  </View>
                ) : (
                  <Text style={styles.switchText}>Switch</Text>
                )}
              </Pressable>
            );
          })}
          {saving ? (
            <ActivityIndicator color={theme.colors.blue500} style={{ marginTop: 12 }} />
          ) : (
            <Pressable onPress={() => setManaging(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Close</Text>
            </Pressable>
          )}
        </View>
      )}
    </MobilePage>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: 24 },
  planHeader: { alignItems: 'center', marginBottom: 32 },
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
    lineHeight: 22,
  },
  price: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.blue400,
  },
  featuresCard: { marginBottom: 24 },
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
  featureText: { fontSize: 15, color: theme.colors.slate300 },
  manageButton: {
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: 16,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageButtonPressed: { backgroundColor: 'rgba(255,255,255,0.05)' },
  manageButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  managePanel: { gap: 10 },
  manageTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  planOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceCard,
  },
  planOptionOn: {
    borderColor: theme.colors.blue500,
    backgroundColor: theme.colors.blueSoft,
  },
  planOptionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  planOptionDesc: {
    fontSize: 13,
    color: theme.colors.slate400,
    marginTop: 4,
    lineHeight: 18,
  },
  selectedPill: {
    backgroundColor: theme.colors.blue600,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  selectedPillText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  switchText: { color: theme.colors.blue400, fontWeight: '700', fontSize: 13 },
  cancelBtn: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { color: theme.colors.slate400, fontWeight: '600' },
});
