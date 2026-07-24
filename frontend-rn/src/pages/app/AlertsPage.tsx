import React, { useCallback, useEffect, useMemo, useState, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ShieldAlert, CheckCheck } from 'lucide-react-native';
import { MobilePage } from '../../components/mobile/MobilePage';
import {
  EmptyState,
  FilterChips,
  SearchField,
  Skeleton,
  SoftCard,
  StatusPill,
} from '../../components/ui/Premium';
import { api, type AlertItem } from '../../lib/api';
import {
  alertCardTitle,
  alertChannel,
  alertReason,
  alertScorePercent,
  alertStatus,
  alertSummary,
  alertThreatKind,
} from '../../lib/alertDisplay';
import { timeAgo } from '../../lib/format';
import { useToast } from '../../hooks/ToastContext';
import { theme } from '../../theme';
import type { RootStackParamList } from '../../navigation/AppNavigator';

type QuickFilter = 'all' | 'blocked' | 'review';

const QUICK_FILTERS: { id: QuickFilter; label: string }[] = [
  { id: 'all', label: 'All threats' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'review', label: 'Needs review' },
];

function statusTone(
  tone: ReturnType<typeof alertStatus>['tone'],
): 'success' | 'warning' | 'danger' | 'info' {
  if (tone === 'blocked') return 'danger';
  if (tone === 'review') return 'warning';
  return 'info';
}

const ThreatCard = memo(function ThreatCard({
  item,
  onOpen,
}: {
  item: AlertItem;
  onOpen: (item: AlertItem) => void;
}) {
  const status = alertStatus(item);
  const kind = alertThreatKind(item);
  const channel = alertChannel(item.alert_type);
  const title = alertCardTitle(item.title, item.description);
  const reason = alertReason(item.description || '');
  const evidence = alertSummary(item.description || '');
  const score = alertScorePercent(item.fraud_score);

  return (
    <SoftCard
      style={[styles.card, !item.is_read && styles.cardUnread]}
      onPress={() => onOpen(item)}
    >
      <View style={styles.cardTop}>
        <View style={[styles.iconWrap, status.tone === 'blocked' ? styles.iconDanger : styles.iconWarn]}>
          <ShieldAlert
            color={status.tone === 'blocked' ? theme.colors.rose400 : theme.colors.amber400}
            size={18}
          />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.pillRow}>
            <StatusPill label={status.label} tone={statusTone(status.tone)} />
            <StatusPill label={kind} tone="info" />
            <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
          </View>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.reason} numberOfLines={2}>
            {reason}
          </Text>
          {!!evidence && evidence !== reason ? (
            <Text style={styles.evidence} numberOfLines={1}>
              Evidence · {evidence}
            </Text>
          ) : null}
          <View style={styles.metaRow}>
            <Text style={styles.channel}>{channel}</Text>
            <Text style={styles.score}>Risk {score}%</Text>
            {!item.is_read ? <View style={styles.unreadDot} /> : null}
          </View>
        </View>
      </View>
      <Pressable style={styles.cta} onPress={() => onOpen(item)} hitSlop={4}>
        <Text style={styles.ctaText}>Inspect threat</Text>
      </Pressable>
    </SoftCard>
  );
});

export function AlertsPage() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { showToast } = useToast();
  const [items, setItems] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filter, setFilter] = useState<QuickFilter>('all');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await api.alerts();
      // Client-side safety net: never show OTP / safe noise as "threats".
      const threats = (Array.isArray(res) ? res : []).filter((item) => {
        const status = alertStatus(item);
        const action = (item.description || '').match(/^\[([A-Z]+)\]/)?.[1]?.toLowerCase();
        if (action === 'otp' || action === 'approve') return false;
        return status.tone === 'blocked' || status.tone === 'review' || status.label === 'Review';
      });
      setItems(threats);
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : 'Could not load threats');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await load();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const markAllRead = async () => {
    setMarking(true);
    try {
      await api.markAllAlertsRead();
      setItems((prev) => prev.map((a) => ({ ...a, is_read: true })));
      showToast('All threats marked read', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update', 'error');
    } finally {
      setMarking(false);
    }
  };

  const stats = useMemo(() => {
    const blocked = items.filter((i) => alertStatus(i).tone === 'blocked').length;
    const review = items.filter((i) => alertStatus(i).tone === 'review').length;
    const unread = items.filter((i) => !i.is_read).length;
    return { blocked, review, unread, total: items.length };
  }, [items]);

  const visible = useMemo(() => {
    return items.filter((item) => {
      const status = alertStatus(item);
      if (filter === 'blocked' && status.tone !== 'blocked') return false;
      if (filter === 'review' && status.tone !== 'review') return false;

      if (!debounced) return true;
      const hay = [
        item.title,
        item.description,
        item.alert_type,
        alertThreatKind(item),
        alertChannel(item.alert_type),
        alertSummary(item.description || ''),
        alertReason(item.description || ''),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(debounced);
    });
  }, [items, filter, debounced]);

  const openAlert = useCallback(
    (item: AlertItem) => {
      void api.markAlertRead(item.id).catch(() => undefined);
      setItems((prev) => prev.map((a) => (a.id === item.id ? { ...a, is_read: true } : a)));
      const parent = navigation.getParent();
      if (parent) parent.navigate('AlertDetail', { alertId: item.id });
      else navigation.navigate('AlertDetail', { alertId: item.id });
    },
    [navigation],
  );

  return (
    <MobilePage style={styles.page}>
      <View style={styles.sticky}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heading}>Threat Center</Text>
            <Text style={styles.sub}>
              Pro protection · blocked & high-risk only — not your full SMS inbox
            </Text>
          </View>
          {stats.unread > 0 ? (
            <Pressable style={styles.markBtn} onPress={() => void markAllRead()} disabled={marking}>
              {marking ? (
                <ActivityIndicator color={theme.colors.blue400} size="small" />
              ) : (
                <CheckCheck color={theme.colors.blue400} size={18} />
              )}
            </Pressable>
          ) : null}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{stats.blocked}</Text>
            <Text style={styles.statLabel}>Blocked</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: theme.colors.amber400 }]}>{stats.review}</Text>
            <Text style={styles.statLabel}>Review</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: theme.colors.blue400 }]}>{stats.unread}</Text>
            <Text style={styles.statLabel}>Unread</Text>
          </View>
        </View>

        <SearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Search threats, senders, reasons…"
          autoCapitalize="none"
        />
        <View style={styles.chips}>
          <FilterChips options={QUICK_FILTERS} value={filter} onChange={setFilter} />
        </View>
        {!!error && (
          <Pressable onPress={() => void load()}>
            <Text style={styles.error}>{error} · Tap to retry</Text>
          </Pressable>
        )}
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.skel}>
          <Skeleton height={130} radius={20} />
          <Skeleton height={130} radius={20} />
          <Skeleton height={130} radius={20} />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ThreatCard item={item} onOpen={openAlert} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.blue500} />
          }
          ListEmptyComponent={
            <EmptyState
              title={error ? 'Could not load threats' : 'No active threats'}
              subtitle={
                error
                  ? 'Pull to refresh'
                  : 'You’re clear. SMS stays in the SMS tab — only real fraud risks appear here.'
              }
            />
          }
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </MobilePage>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingBottom: 0 },
  sticky: {
    gap: 12,
    paddingBottom: 8,
    backgroundColor: theme.colors.bg,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  heading: {
    color: theme.colors.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  sub: {
    color: theme.colors.slate400,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  markBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: theme.colors.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: { flexDirection: 'row', gap: 10 },
  stat: {
    flex: 1,
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  statNum: {
    color: theme.colors.rose400,
    fontSize: 22,
    fontWeight: '800',
  },
  statLabel: { color: theme.colors.slate500, fontSize: 12, marginTop: 2, fontWeight: '600' },
  chips: { marginTop: 2 },
  error: { color: theme.colors.rose400, fontSize: 13, fontWeight: '600' },
  skel: { gap: 12, marginTop: 8 },
  list: { paddingBottom: 32, gap: 10, flexGrow: 1, paddingTop: 4 },
  card: { gap: 12, paddingVertical: 14 },
  cardUnread: { borderColor: 'rgba(59,130,246,0.35)' },
  cardTop: { flexDirection: 'row', gap: 12 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDanger: { backgroundColor: 'rgba(251,113,133,0.12)' },
  iconWarn: { backgroundColor: 'rgba(251,191,36,0.12)' },
  pillRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  time: { marginLeft: 'auto', color: theme.colors.slate500, fontSize: 12 },
  title: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: '700', lineHeight: 22 },
  reason: { color: theme.colors.slate300, fontSize: 13, lineHeight: 18 },
  evidence: { color: theme.colors.slate500, fontSize: 12, lineHeight: 16 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  channel: { color: theme.colors.slate500, fontSize: 12, fontWeight: '600' },
  score: { color: theme.colors.amber400, fontSize: 12, fontWeight: '700' },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.blue500,
    marginLeft: 'auto',
  },
  cta: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: theme.colors.blueSoft,
  },
  ctaText: {
    color: theme.colors.blue400,
    fontSize: 13,
    fontWeight: '700',
  },
});
