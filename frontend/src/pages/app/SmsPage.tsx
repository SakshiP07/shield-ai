import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronRight, Filter, Loader2, Search, Smartphone, X } from 'lucide-react';
import { Badge } from '../../components/mobile/Badge';
import { MobileCard, MobilePage } from '../../components/mobile/MobilePage';
import { CompletePhoneGate } from '../../components/sms/CompletePhoneGate';
import { useAuth } from '../../hooks/AuthContext';
import {
  api,
  type AndroidSmsInboxItem,
  type SmsScanDetail,
  type SmsScanItem,
} from '../../lib/api';
import { formatTime } from '../../lib/format';

type FilterOption = 'all' | 'safe' | 'warning' | 'danger' | 'otp' | 'unread';

const FILTER_OPTIONS: { id: FilterOption; label: string }[] = [
  { id: 'all', label: 'All messages' },
  { id: 'unread', label: 'Unread' },
  { id: 'otp', label: 'OTP only' },
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

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      <p className="mb-2.5 text-[13px] font-semibold uppercase tracking-wider text-slate-500">{title}</p>
      {children}
    </div>
  );
}

function SmsDetailPanel({ detail, onClose }: { detail: SmsScanDetail; onClose: () => void }) {
  const ruleResults = (detail.rules?.results as Array<Record<string, unknown>> | undefined) ?? [];
  const triggeredRules = ruleResults.filter((r) => r.triggered);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 md:items-center">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-surface-card p-6">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[15px] font-semibold text-slate-300">
              {senderInitial(detail.sender)}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-[17px] font-semibold text-white">{detail.sender}</h3>
              <p className="mt-0.5 text-[13px] text-slate-500">{formatTime(detail.time)}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn-touch rounded-full text-slate-400 hover:text-white" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <Badge variant={badgeVariant(detail.badge)}>{badgeLabel(detail.badge)}</Badge>

        <DetailSection title="Full Message">
          <MobileCard padding="sm">
            <p className="text-[15px] leading-relaxed text-slate-200">{detail.text}</p>
          </MobileCard>
        </DetailSection>

        {detail.flagged_reasons.length > 0 && (
          <DetailSection title="Why It Was Flagged">
            <ul className="space-y-2">
              {detail.flagged_reasons.map((reason) => (
                <li key={reason} className="rounded-2xl bg-white/[0.03] px-4 py-3 text-[15px] leading-relaxed text-slate-300">
                  {reason}
                </li>
              ))}
            </ul>
          </DetailSection>
        )}

        {detail.ml_prediction && (
          <DetailSection title="ML Prediction">
            <MobileCard padding="sm" className="space-y-1.5 text-[15px] text-slate-300">
              <p>Fraud probability: {Math.round(Number(detail.ml_prediction.fraud_score ?? 0) * 100)}%</p>
              <p>Risk score: {Math.round(Number(detail.ml_prediction.risk_score ?? 0) * 100)}%</p>
              <p className="capitalize">Risk level: {String(detail.ml_prediction.risk_level ?? detail.risk_level)}</p>
            </MobileCard>
          </DetailSection>
        )}

        {detail.behaviour && (
          <DetailSection title="Behaviour Engine">
            <MobileCard padding="sm" className="space-y-1.5 text-[15px] text-slate-300">
              <p className="capitalize">Risk level: {String(detail.behaviour.risk_level ?? '—')}</p>
              <p>Deviation score: {String(detail.behaviour.deviation_score ?? '—')}</p>
              {Array.isArray(detail.behaviour.flags) && detail.behaviour.flags.length > 0 && (
                <p>Flags: {(detail.behaviour.flags as string[]).join(', ')}</p>
              )}
            </MobileCard>
          </DetailSection>
        )}

        {triggeredRules.length > 0 && (
          <DetailSection title="Rule Engine">
            <ul className="space-y-2">
              {triggeredRules.map((rule) => (
                <li key={String(rule.rule_id)} className="rounded-2xl bg-white/[0.03] px-4 py-3 text-[15px] leading-relaxed text-slate-300">
                  {String(rule.name)} — {String(rule.detail)}
                </li>
              ))}
            </ul>
          </DetailSection>
        )}

        <DetailSection title="Decision">
          <div className="grid grid-cols-2 gap-3">
            <MobileCard padding="sm">
              <p className="text-[13px] text-slate-500">Decision</p>
              <p className="mt-1 text-[15px] font-semibold capitalize text-white">{detail.decision}</p>
            </MobileCard>
            <MobileCard padding="sm">
              <p className="text-[13px] text-slate-500">Status</p>
              <p className="mt-1 text-[15px] font-semibold capitalize text-white">{detail.status}</p>
            </MobileCard>
          </div>
        </DetailSection>
      </div>
    </div>
  );
}

export function SmsPage() {
  const { user, refreshUser } = useAuth();
  const needsPhone = !user?.phone?.trim();

  const [scanMessages, setScanMessages] = useState<SmsScanItem[]>([]);
  const [inbox, setInbox] = useState<AndroidSmsInboxItem[]>([]);
  const [connected, setConnected] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterOption>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<SmsScanDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  const loadInbox = useCallback(
    async (nextPage: number, replace: boolean) => {
      const data = await api.smsInbox({
        search: query || undefined,
        page: nextPage,
        page_size: 20,
        unread_only: filter === 'unread' ? true : undefined,
        otp_only: filter === 'otp' ? true : undefined,
      });
      setConnected(data.connected);
      setTotal(data.total);
      setTotalPages(data.total_pages);
      setPage(data.page);
      setInbox((prev) => (replace ? data.items : [...prev, ...data.items]));
    },
    [filter, query],
  );

  useEffect(() => {
    if (needsPhone) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [scans, connection] = await Promise.all([
          api.smsScans().catch(() => [] as SmsScanItem[]),
          api.smsConnection().catch(() => ({ connected: false, platform: 'android', ios_supported: false })),
        ]);
        if (cancelled) return;
        setScanMessages(scans);
        setConnected(connection.connected);
        await loadInbox(1, true);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadInbox, needsPhone]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const openDetail = async (transactionId: string | null | undefined, fallbackScanId?: string) => {
    const id = transactionId || fallbackScanId;
    if (!id) return;
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

  const onDisconnectToggle = async () => {
    setBusy(true);
    try {
      const res = await api.smsDisconnect();
      setConnected(res.connected);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const filteredScans = scanMessages.filter((m) => {
    if (filter === 'otp' || filter === 'unread') return false;
    const matchesQuery =
      m.sender.toLowerCase().includes(query.toLowerCase()) ||
      m.text.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === 'all' || m.badge === filter;
    return matchesQuery && matchesFilter;
  });

  const filteredInbox = inbox.filter((m) => {
    if (filter === 'safe' || filter === 'warning' || filter === 'danger') {
      return (m.badge || '') === filter;
    }
    return true;
  });

  const activeFilterLabel = FILTER_OPTIONS.find((o) => o.id === filter)?.label ?? 'All messages';
  const showInbox = connected || inbox.length > 0;

  if (needsPhone) {
    return (
      <CompletePhoneGate
        onCompleted={async () => {
          await refreshUser();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <MobilePage>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-bold tracking-tight text-white">Secure Inbox</h2>
          <p className="mt-1 text-[15px] leading-relaxed text-slate-400">
            {showInbox ? `${total} synced message${total !== 1 ? 's' : ''}` : `${scanMessages.length} analyzed`}
          </p>
        </div>
        <div className="relative" ref={filterRef}>
          <button
            type="button"
            onClick={() => setFilterOpen((open) => !open)}
            className={`btn-touch rounded-full transition ${filter !== 'all' ? 'text-blue-400' : 'text-slate-400 hover:text-white'}`}
            aria-label="Filter messages"
            aria-expanded={filterOpen}
          >
            <Filter className="h-5 w-5" />
          </button>
          {filterOpen && (
            <div className="absolute right-0 top-full z-20 mt-2 min-w-[180px] overflow-hidden rounded-2xl bg-surface-card py-1">
              {FILTER_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setFilter(option.id);
                    setFilterOpen(false);
                  }}
                  className={`block w-full px-4 py-3.5 text-left text-[15px] transition hover:bg-white/[0.04] ${
                    filter === option.id ? 'text-blue-400' : 'text-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <MobileCard padding="sm" className="mb-5">
        <div className="flex items-start gap-3">
          <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-white">Android SMS</p>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-400">
              Connect from the Shield AI Android app (Content Provider). iOS is not supported. No Twilio.
            </p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-[13px] text-slate-500">{connected ? 'Connected' : 'Not connected'}</span>
              {connected ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={onDisconnectToggle}
                  className="rounded-full bg-white/[0.06] px-3 py-1.5 text-[13px] text-slate-200 disabled:opacity-50"
                >
                  Disconnect
                </button>
              ) : (
                <span className="text-[13px] text-slate-500">Use Android app → Connect SMS</span>
              )}
            </div>
          </div>
        </div>
      </MobileCard>

      <MobileCard padding="sm" className="mb-5 flex items-center gap-3">
        <Search className="h-5 w-5 shrink-0 text-slate-500" />
        <input
          type="search"
          placeholder="Search sender, phone, or message..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-slate-600"
        />
      </MobileCard>

      <p className="mb-3 text-[13px] text-slate-500">{activeFilterLabel}</p>

      {showInbox ? (
        filteredInbox.length === 0 ? (
          <p className="text-[15px] leading-relaxed text-slate-500">
            {inbox.length === 0
              ? 'No Android SMS synced yet. Connect SMS in the Android app.'
              : 'No messages match your search or filter.'}
          </p>
        ) : (
          <div className="overflow-hidden rounded-3xl bg-surface-card">
            {filteredInbox.map((msg, index) => (
              <button
                key={msg.id}
                type="button"
                onClick={() => openDetail(msg.transaction_id)}
                className={`flex w-full items-center gap-3.5 px-5 py-4 text-left transition hover:bg-white/[0.02] active:bg-white/[0.03] ${
                  index < filteredInbox.length - 1 ? 'border-b border-white/[0.05]' : ''
                }`}
              >
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[15px] font-semibold text-slate-300">
                  {senderInitial(msg.sender)}
                  {msg.unread && (
                    <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-blue-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`truncate text-[15px] ${msg.unread ? 'font-bold text-white' : 'font-semibold text-white'}`}>
                      {msg.sender}
                    </span>
                    <span className="shrink-0 text-[13px] tabular-nums text-slate-500">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-slate-500">{msg.phone_number}</p>
                  <p className="mt-1 truncate text-[15px] leading-relaxed text-slate-400">{msg.body}</p>
                  {msg.is_otp && (
                    <p className="mt-1 text-[12px] font-medium text-amber-400">
                      OTP{msg.otp_code ? `: ${msg.otp_code}` : ' detected'}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {msg.badge && <Badge variant={badgeVariant(msg.badge)}>{badgeLabel(msg.badge)}</Badge>}
                  <ChevronRight className="h-5 w-5 text-slate-600" />
                </div>
              </button>
            ))}
          </div>
        )
      ) : filteredScans.length === 0 ? (
        <p className="text-[15px] leading-relaxed text-slate-500">
          {scanMessages.length === 0
            ? 'No SMS scans yet. Use the Android app to Connect SMS, or analyze SMS from the Scanner tab.'
            : 'No messages match your search or filter.'}
        </p>
      ) : (
        <div className="overflow-hidden rounded-3xl bg-surface-card">
          {filteredScans.map((msg, index) => (
            <button
              key={msg.id}
              type="button"
              onClick={() => openDetail(msg.id)}
              className={`flex w-full items-center gap-3.5 px-5 py-4 text-left transition hover:bg-white/[0.02] active:bg-white/[0.03] ${
                index < filteredScans.length - 1 ? 'border-b border-white/[0.05]' : ''
              }`}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[15px] font-semibold text-slate-300">
                {senderInitial(msg.sender)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-[15px] font-semibold text-white">{msg.sender}</span>
                  <span className="shrink-0 text-[13px] tabular-nums text-slate-500">{formatTime(msg.time)}</span>
                </div>
                <p className="mt-1 truncate text-[15px] leading-relaxed text-slate-400">{msg.text}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={badgeVariant(msg.badge)}>{badgeLabel(msg.badge)}</Badge>
                <ChevronRight className="h-5 w-5 text-slate-600" />
              </div>
            </button>
          ))}
        </div>
      )}

      {showInbox && page < totalPages && (
        <button
          type="button"
          disabled={loadingMore}
          onClick={async () => {
            setLoadingMore(true);
            try {
              await loadInbox(page + 1, false);
            } finally {
              setLoadingMore(false);
            }
          }}
          className="btn-primary mt-5"
        >
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}

      {detailLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      )}
      {detail && <SmsDetailPanel detail={detail} onClose={() => setDetail(null)} />}
    </MobilePage>
  );
}
