import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { MobilePage, MobileCard } from '../../components/mobile/MobilePage';
import { Badge } from '../../components/mobile/Badge';
import { api, type ScamAlert } from '../../lib/api';
import { formatTime, timeAgo, badgeFromStatus } from '../../lib/format';
import { theme } from '../../theme';

export function ScamAlertsPage() {
  const [alerts, setAlerts] = useState<ScamAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.scamAlerts()
      .then(setAlerts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.blue500} size="large" />
      </View>
    );
  }

  const renderItem = ({ item }: { item: ScamAlert }) => (
    <MobileCard padding="md" style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{item.title}</Text>
        <Badge variant={badgeFromStatus(item.badge === 'blocked' ? 'danger' : item.badge)}>
          {item.badge === 'blocked' || item.badge === 'danger' ? 'Danger' : 'Review'}
        </Badge>
      </View>
      <Text style={styles.time}>{formatTime(item.time)} • {timeAgo(item.time)}</Text>
    </MobileCard>
  );

  return (
    <MobilePage style={styles.page}>
      {alerts.length === 0 ? (
        <Text style={styles.emptyText}>No recent scam alerts in your area.</Text>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </MobilePage>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 8,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: theme.colors.slate400,
    textAlign: 'center',
    marginTop: 32,
  },
  list: {
    gap: 12,
    paddingBottom: 24,
  },
  card: {
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.textPrimary,
    lineHeight: 24,
  },
  time: {
    fontSize: 13,
    color: theme.colors.slate500,
  },
});
