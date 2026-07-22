import React from 'react';
import { View, Text, StyleSheet, Pressable, type ViewStyle } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../../theme';

// ─── MobilePage ───────────────────────────────────────────────

type MobilePageProps = {
  children: React.ReactNode;
  style?: ViewStyle;
};

/** Consistent page padding for scrollable app content. */
export function MobilePage({ children, style }: MobilePageProps) {
  return <View style={[styles.page, style]}>{children}</View>;
}

// ─── MobileCard ───────────────────────────────────────────────

type MobileCardProps = {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: 'sm' | 'md' | 'lg';
  bordered?: boolean;
};

export function MobileCard({ children, style, padding = 'md', bordered = false }: MobileCardProps) {
  const padValue = padding === 'sm' ? 16 : padding === 'lg' ? 24 : 20;
  return (
    <View
      style={[
        styles.card,
        { padding: padValue },
        bordered && styles.cardBordered,
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ─── SectionHeader ────────────────────────────────────────────

type SectionHeaderProps = {
  title: string;
  actionLabel?: string;
  actionScreen?: string;
};

export function SectionHeader({ title, actionLabel, actionScreen }: SectionHeaderProps) {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderTitle}>{title}</Text>
      {actionLabel && actionScreen ? (
        <Pressable
          onPress={() => navigation.navigate(actionScreen)}
          hitSlop={12}
          style={styles.sectionAction}
        >
          <Text style={styles.sectionActionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  card: {
    width: '100%',
    borderRadius: 24,
    backgroundColor: theme.colors.surfaceCard,
  },
  cardBordered: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: theme.colors.textPrimary,
  },
  sectionAction: {
    minHeight: 44,
    justifyContent: 'center',
  },
  sectionActionText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.blue500,
  },
});
