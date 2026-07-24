import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Alert,
  Linking,
  AppState,
} from 'react-native';
import { PermissionsAndroid } from 'react-native';
import {
  ChevronRight,
  Smartphone,
  RefreshCw,
  MessageSquare,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Badge } from '../../components/mobile/Badge';
import { MobilePage } from '../../components/mobile/MobilePage';
import { CompletePhoneGate } from '../../components/sms/CompletePhoneGate';
import {
  EmptyState,
  FilterChips,
  SearchField,
  Skeleton,
  SoftCard,
  StatusPill,
} from '../../components/ui/Premium';
import { useAuth } from '../../hooks/AuthContext';
import { useToast } from '../../hooks/ToastContext';
import { api, type AndroidSmsConnection, type AndroidSmsInboxItem } from '../../lib/api';
import { formatTime, timeAgo } from '../../lib/format';
import { SmsSyncService } from '../../sms/SmsSyncService';
import { SmsAuditEvent } from '../../sms/auditEvents';
import { theme } from '../../theme';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import Constants from 'expo-constants';

type FilterOption =
  | 'all'
  | 'otp'
  | 'banking'
  | 'upi'
  | 'promotions'
  | 'fraud'
  | 'unread'
  | 'personal';

const FILTER_OPTIONS: { id: FilterOption; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'otp', label: 'OTP' },
  { id: 'banking', label: 'Banking' },
  { id: 'upi', label: 'UPI' },
  { id: 'fraud', label: 'Fraud' },
  { id: 'unread', label: 'Unread' },
  { id: 'promotions', label: 'Promotions' },
  { id: 'personal', label: 'Personal' },
];

function senderInitial(sender: string): string {
  const clean = sender.replace(/[^A-Za-z0-9]/g, '');
  return (clean[0] ?? '?').toUpperCase();
}

function badgeVariant(badge: string | null): 'safe' | 'warning' | 'danger' {
  if (badge === 'safe') return 'safe';
  if (badge === 'danger') return 'danger';
  return 'warning';
}

const SmsRow = memo(function SmsRow({
  item,
  onOpen,
}: {
  item: AndroidSmsInboxItem;
  onOpen: (item: AndroidSmsInboxItem) => void;
}) {
  return (
    <SoftCard style={styles.msgCard} onPress={() => onOpen(item)}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{senderInitial(item.sender)}</Text>
        {item.unread ? <View style={styles.unreadDot} /> : null}
      </View>
      <View style={styles.msgBody}>
        <View style={styles.msgTop}>
          <Text style={[styles.sender, item.unread && styles.senderUnread]} numberOfLines={1}>
            {item.sender}
          </Text>
          <Text style={styles.time}>{formatTime(item.timestamp || item.received_at)}</Text>
        </View>
        <Text style={styles.preview} numberOfLines={2}>
          {item.body}
        </Text>
        <View style={styles.badges}>
          {item.is_otp ? <Badge variant="warning">OTP</Badge> : null}
          {item.badge === 'danger' || item.sms_type === 'suspicious' ? (
            <Badge variant="danger">Fraud</Badge>
          ) : null}
          {item.badge && item.badge !== 'danger' ? (
            <Badge variant={badgeVariant(item.badge)}>
              {item.badge === 'safe' ? 'Safe' : 'Review'}
            </Badge>
          ) : null}
          {item.risk_level && item.risk_level !== 'low' ? (
            <Badge variant="warning">Risk {item.risk_level}</Badge>
          ) : null}
        </View>
      </View>
      <ChevronRight color={theme.colors.slate600} size={18} />
    </SoftCard>
  );
});

export function SmsPage() {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const needsPhone = !user?.phone?.trim();

  const [connection, setConnection] = useState<AndroidSmsConnection | null>({
    connected: false,
    platform: 'android',
    ios_supported: false,
    total_messages: 0,
    last_sync_at: null,
  });
  const [inbox, setInbox] = useState<AndroidSmsInboxItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filter, setFilter] = useState<FilterOption>('all');
  const [initialLoading, setInitialLoading] = useState(true);
  const [filtering, setFiltering] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const hasLoadedOnce = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [permissionDenied, setPermissionDenied] = useState(false);
  const watchRef = useRef<{ remove: () => void } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  const loadConnection = useCallback(async () => {
    const conn = await api.smsConnection();
    setConnection(conn);
    return conn;
  }, []);

  const loadInbox = useCallback(
    async (nextPage: number, replace: boolean) => {
      const data = await api.smsInbox({
        search: debouncedQuery || undefined,
        page: nextPage,
        page_size: 20,
        unread_only: filter === 'unread' ? true : undefined,
        otp_only: filter === 'otp' ? true : undefined,
        sms_type:
          filter === 'banking' || filter === 'upi'
            ? filter
            : filter === 'promotions'
              ? 'other'
              : undefined,
        badge: filter === 'fraud' ? 'danger' : undefined,
      });
      let items = data.items;
      if (filter === 'personal') {
        items = items.filter(
          (m) => !m.is_otp && m.sms_type !== 'banking' && m.sms_type !== 'upi' && m.sms_type !== 'other',
        );
      }
      setTotal(data.total);
      setTotalPages(data.total_pages);
      setPage(data.page);
      setConnection((prev) =>
        prev
          ? { ...prev, connected: data.connected, total_messages: data.total }
          : {
              connected: data.connected,
              platform: 'android',
              ios_supported: false,
              total_messages: data.total,
              last_sync_at: null,
            },
      );
      setInbox((prev) => (replace ? items : [...prev, ...items]));
    },
    [filter, debouncedQuery],
  );

  const refreshAll = useCallback(async () => {
    setError('');
    // Never block the inbox UI on offline queue upload.
    void SmsSyncService.flushQueue().catch(() => undefined);
    try {
      await Promise.all([loadConnection(), loadInbox(1, true)]);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Could not reach the SMS service. Check that the backend is running.';
      setError(message);
      throw err;
    }
  }, [loadConnection, loadInbox]);

  useEffect(() => {
    if (needsPhone) {
      setInitialLoading(false);
      setFiltering(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const firstLoad = !hasLoadedOnce.current;
      if (firstLoad) setInitialLoading(true);
      else setFiltering(true);
      try {
        await refreshAll();
        if (!cancelled) hasLoadedOnce.current = true;
      } catch {
        // error already stored
      } finally {
        if (!cancelled) {
          setInitialLoading(false);
          setFiltering(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [needsPhone, filter, debouncedQuery, refreshAll]);

  useEffect(() => {
    if (needsPhone || !connection?.connected) return;
    pollRef.current = setInterval(() => {
      void loadInbox(1, true).catch(() => undefined);
      void SmsSyncService.flushQueue().catch(() => undefined);
    }, 15000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [connection?.connected, needsPhone, loadInbox]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && connection?.connected) void refreshAll();
    });
    return () => sub.remove();
  }, [connection?.connected, refreshAll]);

  useEffect(() => () => watchRef.current?.remove(), []);

  const requestSmsPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      Alert.alert('Android only', 'SMS works on Android devices only.');
      return false;
    }
    try {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_SMS,
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
      ]);
      const granted =
        result[PermissionsAndroid.PERMISSIONS.READ_SMS] === PermissionsAndroid.RESULTS.GRANTED;
      if (granted) {
        setPermissionDenied(false);
        await SmsSyncService.audit(SmsAuditEvent.PERMISSION_GRANTED, 'READ_SMS granted');
        return true;
      }
      setPermissionDenied(true);
      await SmsSyncService.audit(
        SmsAuditEvent.PERMISSION_DENIED,
        'READ_SMS denied',
        undefined,
        undefined,
        'failure',
      );
      return false;
    } catch {
      setPermissionDenied(true);
      return false;
    }
  };

  const onConnect = async () => {
    setBusy(true);
    setError('');
    try {
      const ok = await requestSmsPermission();
      if (!ok) {
        setError('SMS access was denied. Open Settings to allow SMS, then try again.');
        setBusy(false);
        return;
      }
      if (!SmsSyncService.isNativeAvailable()) {
        setError('SMS module is unavailable. Rebuild the Android app with expo run:android.');
        setBusy(false);
        return;
      }

      const conn = await SmsSyncService.connectBackend();
      // Flip UI immediately — do not wait for full inbox upload.
      setConnection({
        connected: true,
        platform: conn.platform ?? 'android',
        ios_supported: Boolean(conn.ios_supported),
        total_messages: conn.total_messages ?? 0,
        last_sync_at: conn.last_sync_at ?? new Date().toISOString(),
      });
      showToast('SMS connected — syncing inbox…', 'success');
      setBusy(false);

      watchRef.current?.remove();
      watchRef.current = SmsSyncService.startWatching(() => {
        void loadInbox(1, true).catch(() => undefined);
      });

      setSyncing(true);
      void (async () => {
        try {
          // Fast path: store messages without heavy fraud pipeline.
          await SmsSyncService.syncInboxPage(60, 0, { autoScan: false });
          await loadInbox(1, true).catch(() => undefined);
          await loadConnection().catch(() => undefined);
          showToast('Inbox synced', 'success');
        } catch (syncErr) {
          setError(
            syncErr instanceof Error
              ? syncErr.message
              : 'Connected — upload will retry in the background.',
          );
          void SmsSyncService.flushQueue().then(() => loadInbox(1, true).catch(() => undefined));
        } finally {
          setSyncing(false);
        }
      })();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect SMS');
      await SmsSyncService.audit(SmsAuditEvent.BACKEND_ERROR, String(err), undefined, undefined, 'failure');
      await loadConnection().catch(() => undefined);
      setBusy(false);
    }
  };

  const onDisconnect = async () => {
    setBusy(true);
    setError('');
    // Optimistic UI — disconnect feels instant.
    setConnection((prev) =>
      prev
        ? { ...prev, connected: false }
        : {
            connected: false,
            platform: 'android',
            ios_supported: false,
            total_messages: 0,
            last_sync_at: null,
          },
    );
    setInbox([]);
    try {
      watchRef.current?.remove();
      watchRef.current = null;
      const conn = await SmsSyncService.disconnectBackend();
      setConnection({
        connected: false,
        platform: conn.platform ?? 'android',
        ios_supported: Boolean(conn.ios_supported),
        total_messages: 0,
        last_sync_at: conn.last_sync_at ?? null,
      });
      showToast('SMS disconnected', 'info');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
      await loadConnection().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (connection?.connected && SmsSyncService.hasPermission()) {
        await SmsSyncService.syncInboxPage(40, 0, { autoScan: false }).catch(() => undefined);
      }
      await refreshAll();
    } finally {
      setRefreshing(false);
    }
  };

  const onEndReached = async () => {
    if (loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    try {
      await loadInbox(page + 1, false);
    } finally {
      setLoadingMore(false);
    }
  };

  const deviceName = useMemo(
    () => Constants.deviceName || Platform.OS || 'This device',
    [],
  );

  const openMessage = useCallback(
    (item: AndroidSmsInboxItem) => {
      const parent = navigation.getParent();
      if (parent) {
        parent.navigate('SmsDetail', { message: item });
      } else {
        navigation.navigate('SmsDetail', { message: item });
      }
    },
    [navigation],
  );

  if (needsPhone) {
    return (
      <CompletePhoneGate
        onCompleted={async () => {
          await refreshUser();
        }}
      />
    );
  }

  if (initialLoading) {
    return (
      <MobilePage style={styles.page}>
        <Skeleton height={28} width="40%" style={{ marginBottom: 8 }} />
        <Skeleton height={16} width="55%" style={{ marginBottom: 16 }} />
        <Skeleton height={140} radius={24} style={{ marginBottom: 12 }} />
        <Skeleton height={48} radius={20} style={{ marginBottom: 12 }} />
        <Skeleton height={96} radius={20} style={{ marginBottom: 10 }} />
        <Skeleton height={96} radius={20} />
      </MobilePage>
    );
  }

  const connected = Boolean(connection?.connected);

  const listHeader = (
    <>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>SMS</Text>
          <Text style={styles.subtitle}>
            {connected
              ? `${connection?.total_messages ?? total} analyzed · last sync ${
                  connection?.last_sync_at ? timeAgo(connection.last_sync_at) : 'just now'
                }`
              : 'Connect to sync real Android SMS'}
          </Text>
        </View>
        <Pressable style={styles.refreshBtn} onPress={() => void onRefresh()} hitSlop={8}>
          <RefreshCw color={theme.colors.blue400} size={18} />
        </Pressable>
      </View>

      <SoftCard style={styles.connCard}>
        {!connected ? (
          <View style={styles.disconnectState}>
            <View style={styles.heroIcon}>
              <MessageSquare color={theme.colors.blue400} size={28} />
            </View>
            <Text style={styles.disconnectTitle}>Protect your inbox</Text>
            <Text style={styles.disconnectBody}>
              Connect SMS to scan bank, UPI, and OTP messages for fraud in real time.
            </Text>
            <Pressable
              style={[styles.connBtnPrimary, busy && styles.btnDisabled]}
              disabled={busy || Platform.OS !== 'android'}
              onPress={onConnect}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.connBtnText}>Connect SMS</Text>
              )}
            </Pressable>
            <Text style={styles.permHint}>
              Permission: {permissionDenied ? 'Denied — open Settings' : 'Will request READ_SMS'}
            </Text>
            {permissionDenied ? (
              <Pressable onPress={() => Linking.openSettings()}>
                <Text style={styles.settingsLink}>Open Settings</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            <View style={styles.connRow}>
              <View style={[styles.connIcon, styles.connIconOn]}>
                <Smartphone color={theme.colors.emerald400} size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <StatusPill label="Connected" tone="success" />
                <Text style={[styles.connTitle, { marginTop: 8 }]}>{deviceName}</Text>
                <Text style={styles.connBody}>
                  {syncing
                    ? 'Syncing inbox…'
                    : `Last sync · ${
                        connection?.last_sync_at ? timeAgo(connection.last_sync_at) : 'just now'
                      }`}
                </Text>
              </View>
            </View>
            <Pressable
              style={[styles.connBtn, busy && styles.btnDisabled]}
              disabled={busy}
              onPress={onDisconnect}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.connBtnTextMuted}>Disconnect</Text>
              )}
            </Pressable>
          </View>
        )}
      </SoftCard>

      {!!error && (
        <SoftCard style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={onConnect}>
            <Text style={styles.retry}>Retry</Text>
          </Pressable>
        </SoftCard>
      )}

      <View style={styles.searchWrap}>
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Search sender, phone, or message…"
          onSubmit={() => void refreshAll()}
        />
      </View>

      <View style={styles.chipsWrap}>
        <FilterChips options={FILTER_OPTIONS} value={filter} onChange={setFilter} />
      </View>
      {filtering ? (
        <View style={styles.filterBusy}>
          <ActivityIndicator size="small" color={theme.colors.blue500} />
          <Text style={styles.filterBusyText}>Updating list…</Text>
        </View>
      ) : null}
    </>
  );

  return (
    <MobilePage style={styles.page}>
      <FlatList
        data={inbox}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <SmsRow item={item} onOpen={openMessage} />}
        ListHeaderComponent={listHeader}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={8}
        removeClippedSubviews
        style={filtering ? { opacity: 0.55 } : undefined}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.blue500} />
        }
        ListEmptyComponent={
          filtering ? (
            <View style={styles.filterSkel}>
              <Skeleton height={88} radius={18} />
              <Skeleton height={88} radius={18} />
            </View>
          ) : (
            <EmptyState
              title={!connected ? 'Connect to start' : 'No messages'}
              subtitle={
                !connected
                  ? 'Connect SMS to sync messages from this Android device.'
                  : 'Pull to refresh after connecting.'
              }
            />
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator color={theme.colors.blue500} style={{ marginVertical: 16 }} />
          ) : null
        }
        contentContainerStyle={styles.listInner}
        showsVerticalScrollIndicator={false}
      />
    </MobilePage>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingBottom: 0 },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, gap: 12 },
  title: { color: theme.colors.textPrimary, fontSize: 28, fontWeight: '700', letterSpacing: -0.4 },
  subtitle: { color: theme.colors.slate400, fontSize: 13, marginTop: 4, lineHeight: 18 },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  connCard: { marginBottom: 12 },
  connRow: { flexDirection: 'row', gap: 12 },
  connIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: theme.colors.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connIconOn: { backgroundColor: theme.colors.emeraldSoft },
  connTitle: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
  connBody: {
    color: theme.colors.slate400,
    fontSize: 13,
    lineHeight: 19,
  },
  disconnectState: { alignItems: 'center', gap: 12, paddingVertical: 8 },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: theme.colors.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  disconnectTitle: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
  },
  disconnectBody: {
    color: theme.colors.slate400,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  connBtn: {
    height: 48,
    borderRadius: theme.radii.lg,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connBtnPrimary: {
    height: 52,
    borderRadius: theme.radii.xl,
    backgroundColor: theme.colors.blue600,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 4,
  },
  connBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  connBtnTextMuted: { color: theme.colors.slate300, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
  permHint: { color: theme.colors.slate500, fontSize: 12 },
  settingsLink: { color: theme.colors.blue400, fontSize: 13, fontWeight: '600' },
  errorCard: { marginBottom: 12, gap: 8 },
  errorText: { color: theme.colors.rose400, fontSize: 13 },
  retry: { color: theme.colors.blue400, fontWeight: '600' },
  searchWrap: { marginBottom: 12 },
  chipsWrap: { marginBottom: 14 },
  filterBusy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  filterBusyText: { color: theme.colors.slate500, fontSize: 13 },
  filterSkel: { gap: 10, marginTop: 4 },
  listInner: { paddingBottom: 32, flexGrow: 1, gap: 10 },
  msgCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: theme.colors.slate200, fontWeight: '700', fontSize: 16 },
  unreadDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.blue500,
  },
  msgBody: { flex: 1, gap: 4 },
  msgTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  sender: { flex: 1, color: theme.colors.textPrimary, fontWeight: '600', fontSize: 15 },
  senderUnread: { fontWeight: '700' },
  time: { color: theme.colors.slate500, fontSize: 12 },
  preview: { color: theme.colors.slate400, fontSize: 14, lineHeight: 20 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
});
