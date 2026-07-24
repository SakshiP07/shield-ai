import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable } from 'react-native';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react-native';
import { MobilePage, MobileCard } from '../../components/mobile/MobilePage';
import { Badge } from '../../components/mobile/Badge';
import { api, type ActivityItem } from '../../lib/api';
import { formatTime, timeAgo, badgeFromStatus, statusIconColor } from '../../lib/format';
import { theme } from '../../theme';

export function ActivityPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.dashboardActivity()
      .then(setActivities)
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

  const renderItem = ({ item }: { item: ActivityItem }) => {
    const badge = badgeFromStatus(item.badge);
    const Icon = badge === 'safe' ? CheckCircle2 : badge === 'danger' ? XCircle : AlertTriangle;
    
    return (
      <MobileCard padding="sm" style={styles.card}>
        <Icon color={statusIconColor(badge)} size={24} style={styles.icon} />
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.time}>{formatTime(item.time)} • {timeAgo(item.time)}</Text>
        </View>
        <View style={styles.rightCol}>
          {item.amount && <Text style={styles.amount}>₹{item.amount}</Text>}
          <Badge variant={badge}>{badge === 'safe' ? 'Safe' : badge === 'danger' ? 'Danger' : 'Review'}</Badge>
        </View>
      </MobileCard>
    );
  };

  return (
    <MobilePage style={styles.page}>
      {activities.length === 0 ? (
        <Text style={styles.emptyText}>No recent activity.</Text>
      ) : (
        <FlatList
          data={activities}
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 16,
  },
  content: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.textPrimary,
  },
  time: {
    fontSize: 13,
    color: theme.colors.slate500,
    marginTop: 4,
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: 8,
  },
  amount: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
});
