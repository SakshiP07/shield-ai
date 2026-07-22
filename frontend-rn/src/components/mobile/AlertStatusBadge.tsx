import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { AlertStatusTone } from '../../lib/alertDisplay';
import { theme } from '../../theme';

type AlertStatusBadgeProps = {
  label: string;
  tone: AlertStatusTone;
};

const TONE_STYLES: Record<AlertStatusTone, { bg: string; text: string; borderColor?: string }> = {
  blocked: { bg: 'rgba(244,63,94,0.15)', text: theme.colors.rose400 },
  safe: { bg: 'transparent', text: theme.colors.blue400, borderColor: 'rgba(59,130,246,0.35)' },
  review: { bg: 'rgba(59,130,246,0.15)', text: theme.colors.blue400 },
};

export function AlertStatusBadge({ label, tone }: AlertStatusBadgeProps) {
  const { bg, text, borderColor } = TONE_STYLES[tone];
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: bg },
        borderColor ? { borderWidth: 1, borderColor } : undefined,
      ]}
    >
      <Text style={[styles.text, { color: text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 11,
  },
});
