import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MobilePage, MobileCard } from '../../components/mobile/MobilePage';
import { theme } from '../../theme';

// Placeholder for the BlockedScans page referenced in AppHomePage logic 
// (even if web might not have linked it explicitly in the snippet).
export function BlockedScansPage() {
  return (
    <MobilePage style={styles.page}>
      <MobileCard padding="lg">
        <Text style={styles.title}>Blocked Scans</Text>
        <Text style={styles.subtitle}>List of automatically blocked suspicious activity.</Text>
      </MobileCard>
    </MobilePage>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: theme.colors.slate400,
    lineHeight: 22,
  },
});
