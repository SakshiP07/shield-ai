import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, FlatList, ActivityIndicator, ScrollView } from 'react-native';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react-native';
import { MobilePage } from '../../components/mobile/MobilePage';
import { api, type LedgerEntry } from '../../lib/api';
import { formatTime } from '../../lib/format';
import { theme } from '../../theme';

type StatusFilter = '' | 'succeeded' | 'failed' | 'pending';
type RiskFilter = '' | 'high' | 'medium' | 'low';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'succeeded', label: 'Success' },
  { value: 'failed', label: 'Failed' },
  { value: 'pending', label: 'Pending' },
];

const RISK_FILTERS: { value: RiskFilter; label: string }[] = [
  { value: '', label: 'All risk' },
  { value: 'high', label: 'High Risk' },
  { value: 'medium', label: 'Medium Risk' },
  { value: 'low', label: 'Low Risk' },
];

function statusToneStyle(status: string) {
  if (status === 'succeeded') return { bg: 'rgba(52,211,153,0.1)', text: theme.colors.emerald400 };
  if (status === 'failed') return { bg: 'rgba(244,63,94,0.1)', text: theme.colors.rose400 };
  return { bg: 'rgba(251,191,36,0.1)', text: theme.colors.amber400 };
}

function riskToneColor(level: string): string {
  if (level === 'high') return theme.colors.rose400;
  if (level === 'medium') return theme.colors.amber400;
  return theme.colors.blue400;
}

export function AlertsPage() {
  const [items, setItems] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  const [upi, setUpi] = useState('');
  const [status, setStatus] = useState<StatusFilter>('');
  const [riskLevel, setRiskLevel] = useState<RiskFilter>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.ledger({
        phone: phone.trim() || undefined,
        upi: upi.trim() || undefined,
        status: status || undefined,
        risk_level: riskLevel || undefined,
        page,
        page_size: pageSize,
      });
      setItems(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err) {
      console.error(err);
      setItems([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [phone, upi, status, riskLevel, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [phone, upi, status, riskLevel]);

  const renderItem = ({ item }: { item: LedgerEntry }) => {
    const sTone = statusToneStyle(item.status);
    const rTone = riskToneColor(item.risk_level);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, { backgroundColor: sTone.bg }]}>
            <Text style={[styles.statusBadgeText, { color: sTone.text }]}>{item.status}</Text>
          </View>
          <Text style={[styles.riskBadgeText, { color: rTone }]}>{item.risk_level} risk</Text>
          <Text style={styles.sourceText}>{item.scan_source}</Text>
        </View>
        
        <Text style={styles.reasonText} numberOfLines={1}>{item.reason}</Text>
        
        <Text style={styles.metaText}>
          {item.phone_number ? `Phone ${item.phone_number}` : 'No phone'}
          {item.upi_id ? ` • UPI ${item.upi_id}` : ''}
        </Text>
        
        <Text style={styles.metaText2}>
          Score {(item.fraud_score * 100).toFixed(0)}% • {item.processing_time_ms}ms • {item.model_version}
        </Text>
        
        <Text style={styles.metaText3}>
          Tx {item.transaction_id.slice(0, 8)}… • {formatTime(item.created_at)}
        </Text>
      </View>
    );
  };

  return (
    <MobilePage style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.headerSubtitle}>Transaction ledger • newest first</Text>
        
        <View style={styles.searchContainer}>
          <Search color={theme.colors.slate500} size={16} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={phone}
            onChangeText={setPhone}
            placeholder="Search by phone number"
            placeholderTextColor={theme.colors.slate500}
            keyboardType="phone-pad"
          />
        </View>
        
        <View style={styles.searchContainer}>
          <Search color={theme.colors.slate500} size={16} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={upi}
            onChangeText={setUpi}
            placeholder="Search by UPI ID"
            placeholderTextColor={theme.colors.slate500}
            autoCapitalize="none"
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
          {STATUS_FILTERS.map((f) => (
            <Pressable
              key={f.label}
              onPress={() => setStatus(f.value)}
              style={[
                styles.filterChip,
                status === f.value ? styles.filterChipActive : styles.filterChipInactive,
              ]}
            >
              <Text style={[
                styles.filterChipText,
                status === f.value ? styles.filterChipTextActive : styles.filterChipTextInactive,
              ]}>{f.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
          {RISK_FILTERS.map((f) => (
            <Pressable
              key={f.label}
              onPress={() => setRiskLevel(f.value)}
              style={[
                styles.filterChip,
                riskLevel === f.value ? styles.filterChipActive : styles.filterChipInactive,
              ]}
            >
              <Text style={[
                styles.filterChipText,
                riskLevel === f.value ? styles.filterChipTextActive : styles.filterChipTextInactive,
              ]}>{f.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.blue500} size="large" />
        </View>
      ) : items.length === 0 ? (
        <Text style={styles.emptyText}>No ledger entries yet. Run a scan to append one.</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            total > 0 ? (
              <View style={styles.pagination}>
                <Pressable
                  disabled={page <= 1 || loading}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                  style={({ pressed }) => [
                    styles.pageButton,
                    (page <= 1 || loading) && styles.pageButtonDisabled,
                    pressed && styles.pageButtonPressed,
                  ]}
                >
                  <ChevronLeft color={theme.colors.slate300} size={16} />
                  <Text style={styles.pageButtonText}>Prev</Text>
                </Pressable>
                
                <Text style={styles.pageText}>
                  Page {page} / {totalPages} • {total} total
                </Text>
                
                <Pressable
                  disabled={page >= totalPages || loading}
                  onPress={() => setPage((p) => p + 1)}
                  style={({ pressed }) => [
                    styles.pageButton,
                    (page >= totalPages || loading) && styles.pageButtonDisabled,
                    pressed && styles.pageButtonPressed,
                  ]}
                >
                  <Text style={styles.pageButtonText}>Next</Text>
                  <ChevronRight color={theme.colors.slate300} size={16} />
                </Pressable>
              </View>
            ) : null
          }
        />
      )}
    </MobilePage>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 12,
  },
  header: {
    marginBottom: 16,
    gap: 12,
  },
  headerSubtitle: {
    fontSize: 13,
    color: theme.colors.slate500,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: 16,
    height: 44,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.textPrimary,
    height: '100%',
  },
  filterScroll: {
    flexGrow: 0,
  },
  filterContent: {
    gap: 8,
    paddingBottom: 4,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  filterChipActive: {
    backgroundColor: 'rgba(59,130,246,0.2)',
  },
  filterChipInactive: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: theme.colors.blue400,
  },
  filterChipTextInactive: {
    color: theme.colors.slate400,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: theme.colors.slate500,
    lineHeight: 22,
    marginTop: 24,
  },
  listContent: {
    gap: 12,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 24,
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  riskBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  sourceText: {
    fontSize: 12,
    color: theme.colors.slate500,
  },
  reasonText: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.textPrimary,
    marginBottom: 6,
  },
  metaText: {
    fontSize: 13,
    color: theme.colors.slate400,
    marginBottom: 4,
  },
  metaText2: {
    fontSize: 12,
    color: theme.colors.slate500,
    marginBottom: 4,
  },
  metaText3: {
    fontSize: 11,
    color: theme.colors.slate600,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  pageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pageButtonDisabled: {
    opacity: 0.4,
  },
  pageButtonPressed: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  pageButtonText: {
    fontSize: 13,
    color: theme.colors.slate300,
  },
  pageText: {
    fontSize: 13,
    color: theme.colors.slate500,
  },
});
