import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, FlatList, ActivityIndicator, ScrollView } from 'react-native';
import { ChevronRight, Search } from 'lucide-react-native';
import { Badge } from '../../components/mobile/Badge';
import { MobileCard, MobilePage } from '../../components/mobile/MobilePage';
import { AlertDetailSheet } from '../../components/mobile/AlertDetailSheet';
import { api, type SmsScanDetail, type SmsScanItem } from '../../lib/api';
import { formatTime } from '../../lib/format';
import { theme } from '../../theme';

type FilterOption = 'all' | 'safe' | 'warning' | 'danger';

const FILTER_OPTIONS: { id: FilterOption; label: string }[] = [
  { id: 'all', label: 'All messages' },
  { id: 'safe', label: 'Safe only' },
  { id: 'warning', label: 'Suspicious' },
  { id: 'danger', label: 'Danger' },
];

function senderInitial(sender: string): string {
  const clean = sender.replace(/[^A-Za-z0-9]/g, '');
  return (clean[0] ?? '?').toUpperCase();
}

function badgeVariant(badge: string): 'safe' | 'warning' | 'danger' {
  if (badge === 'safe') return 'safe';
  if (badge === 'danger') return 'danger';
  return 'warning';
}

function badgeLabel(badge: string): string {
  if (badge === 'safe') return 'Safe';
  if (badge === 'danger') return 'Danger';
  return 'Review';
}

export function SmsPage() {
  const [messages, setMessages] = useState<SmsScanItem[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterOption>('all');
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<SmsScanDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    api.smsScans()
      .then(setMessages)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const data = await api.smsScanDetail(id);
      setDetail(data);
    } catch {
      console.error('Failed to load SMS detail');
    } finally {
      setDetailLoading(false);
    }
  };

  const filtered = messages.filter((m) => {
    const matchesQuery =
      m.sender.toLowerCase().includes(query.toLowerCase()) ||
      m.text.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === 'all' || m.badge === filter;
    return matchesQuery && matchesFilter;
  });

  const renderItem = ({ item, index }: { item: SmsScanItem; index: number }) => (
    <Pressable
      onPress={() => openDetail(item.id)}
      style={({ pressed }) => [
        styles.listItem,
        index < filtered.length - 1 && styles.listItemBorder,
        pressed && styles.listItemSelected,
      ]}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{senderInitial(item.sender)}</Text>
      </View>
      <View style={styles.listContent}>
        <View style={styles.listHeaderRow}>
          <Text style={styles.senderName} numberOfLines={1}>{item.sender}</Text>
          <Text style={styles.timeText}>{formatTime(item.time)}</Text>
        </View>
        <Text style={styles.messagePreview} numberOfLines={1}>{item.text}</Text>
      </View>
      <View style={styles.listRight}>
        <Badge variant={badgeVariant(item.badge)}>{badgeLabel(item.badge)}</Badge>
        <ChevronRight color={theme.colors.slate600} size={20} />
      </View>
    </Pressable>
  );

  return (
    <MobilePage style={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.title}>Secure Inbox</Text>
          <Text style={styles.subtitle}>
            {messages.length} message{messages.length !== 1 ? 's' : ''} analyzed
          </Text>
        </View>
      </View>

      <MobileCard padding="sm" style={styles.searchCard}>
        <Search color={theme.colors.slate500} size={20} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search sender or message..."
          placeholderTextColor={theme.colors.slate600}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />
      </MobileCard>

      {/* Simplified filter as a horizontal scroll instead of dropdown for mobile */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        {FILTER_OPTIONS.map((option) => (
          <Pressable
            key={option.id}
            onPress={() => setFilter(option.id)}
            style={[
              styles.filterChip,
              filter === option.id ? styles.filterChipActive : styles.filterChipInactive,
            ]}
          >
            <Text style={[
              styles.filterChipText,
              filter === option.id ? styles.filterChipTextActive : styles.filterChipTextInactive,
            ]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.blue500} size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {messages.length === 0
              ? 'No SMS scans yet. Analyze SMS from the Scanner tab.'
              : 'No messages match your search or filter.'}
          </Text>
        </View>
      ) : (
        <View style={styles.listContainer}>
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listInner}
          />
        </View>
      )}

      {detailLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={theme.colors.blue500} size="large" />
        </View>
      )}
      
      {/* Reusing AlertDetailSheet since SmsScanDetail maps well to it visually */}
      {detail && (
        <AlertDetailSheet 
          alert={detail as any} // Cast safely - the shared modal handles extra properties gracefully if mapped correctly
          onClose={() => setDetail(null)} 
        />
      )}
    </MobilePage>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingBottom: 0,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontSize: 15,
    color: theme.colors.slate400,
    marginTop: 4,
  },
  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.textPrimary,
    height: 24,
  },
  filterScroll: {
    flexGrow: 0,
    marginBottom: 20,
  },
  filterContent: {
    gap: 8,
    paddingBottom: 4,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterChipActive: {
    backgroundColor: 'rgba(59,130,246,0.2)',
  },
  filterChipInactive: {
    backgroundColor: theme.colors.surfaceCard,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: theme.colors.blue400,
  },
  filterChipTextInactive: {
    color: theme.colors.slate400,
  },
  emptyContainer: {
    marginTop: 32,
  },
  emptyText: {
    fontSize: 15,
    color: theme.colors.slate500,
    lineHeight: 22,
  },
  listContainer: {
    flex: 1,
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 24,
    overflow: 'hidden',
  },
  listInner: {
    flexGrow: 1,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  listItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  listItemSelected: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.slate300,
  },
  listContent: {
    flex: 1,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  senderName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginRight: 8,
  },
  timeText: {
    fontSize: 13,
    color: theme.colors.slate500,
    fontVariant: ['tabular-nums'],
  },
  messagePreview: {
    fontSize: 15,
    color: theme.colors.slate400,
    marginTop: 4,
  },
  listRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});
