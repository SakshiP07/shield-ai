import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../theme';

type BadgeVariant = 'safe' | 'danger' | 'warning' | 'spam' | 'update' | 'auto-blocked';

const BADGE_STYLES: Record<BadgeVariant, { bg: string; text: string }> = {
  safe: { bg: 'rgba(59,130,246,0.12)', text: theme.colors.blue400 },
  warning: { bg: 'rgba(59,130,246,0.12)', text: theme.colors.blue400 },
  update: { bg: 'rgba(59,130,246,0.12)', text: theme.colors.blue400 },
  danger: { bg: 'rgba(244,63,94,0.12)', text: theme.colors.rose400 },
  spam: { bg: 'rgba(244,63,94,0.12)', text: theme.colors.rose400 },
  'auto-blocked': { bg: 'rgba(244,63,94,0.12)', text: theme.colors.rose400 },
};

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
}

export function Badge({ variant, children }: BadgeProps) {
  const { bg, text } = BADGE_STYLES[variant] ?? BADGE_STYLES.warning;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: text }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 11,
  },
});
