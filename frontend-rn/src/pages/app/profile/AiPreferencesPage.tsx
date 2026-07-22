import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { MobilePage, MobileCard } from '../../../components/mobile/MobilePage';
import { theme } from '../../../theme';

type SettingToggleProps = {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  isLast?: boolean;
};

function SettingToggle({ title, description, value, onValueChange, isLast }: SettingToggleProps) {
  return (
    <View style={[styles.toggleContainer, !isLast && styles.toggleBorder]}>
      <View style={styles.toggleText}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.toggleDesc}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.colors.surfaceInput, true: theme.colors.blue500 }}
        thumbColor="#ffffff"
        ios_backgroundColor={theme.colors.surfaceInput}
      />
    </View>
  );
}

export function AiPreferencesPage() {
  const [autoBlock, setAutoBlock] = useState(true);
  const [strictMode, setStrictMode] = useState(false);

  return (
    <MobilePage style={styles.page}>
      <Text style={styles.description}>
        Customize how ShieldAI's detection engine operates on your device.
      </Text>

      <MobileCard padding="sm">
        <SettingToggle
          title="Auto-block high risk"
          description="Automatically block links and numbers with >90% fraud probability"
          value={autoBlock}
          onValueChange={setAutoBlock}
        />
        <SettingToggle
          title="Strict Mode"
          description="Flag any unknown senders as suspicious (may increase false positives)"
          value={strictMode}
          onValueChange={setStrictMode}
          isLast
        />
      </MobileCard>
    </MobilePage>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 16,
  },
  description: {
    fontSize: 15,
    color: theme.colors.slate400,
    lineHeight: 22,
    marginBottom: 24,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  toggleBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  toggleText: {
    flex: 1,
    marginRight: 16,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  toggleDesc: {
    fontSize: 13,
    color: theme.colors.slate400,
    lineHeight: 18,
  },
});
