import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';
import { MobilePage } from '../../components/mobile/MobilePage';
import { api, type LedgerEntry } from '../../lib/api';
import { formatTime } from '../../lib/format';

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

function statusTone(status: string): string {
  if (status === 'succeeded') return 'text-emerald-400 bg-emerald-500/10';
  if (status === 'failed') return 'text-rose-400 bg-rose-500/10';
  return 'text-amber-400 bg-amber-500/10';
}

function riskTone(level: string): string {
  if (level === 'high') return 'text-rose-400';
  if (level === 'medium') return 'text-amber-400';
  return 'text-blue-400';
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

  return (
    <MobilePage>
      <div className="mb-5 space-y-3">
        <p className="text-[13px] text-slate-500">Transaction ledger · newest first</p>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Search by phone number"
            className="w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] py-3 pl-10 pr-4 text-[14px] text-white outline-none focus:border-blue-500/40"
          />
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={upi}
            onChange={(e) => setUpi(e.target.value)}
            placeholder="Search by UPI ID"
            className="w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] py-3 pl-10 pr-4 text-[14px] text-white outline-none focus:border-blue-500/40"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.label}
              type="button"
              onClick={() => setStatus(f.value)}
              className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
                status === f.value
                  ? 'bg-blue-500/20 text-blue-300'
                  : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.06]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {RISK_FILTERS.map((f) => (
            <button
              key={f.label}
              type="button"
              onClick={() => setRiskLevel(f.value)}
              className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
                riskLevel === f.value
                  ? 'bg-blue-500/20 text-blue-300'
                  : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.06]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-[15px] leading-relaxed text-slate-500">No ledger entries yet. Run a scan to append one.</p>
      ) : (
        <div className="space-y-3">
          {items.map((entry) => (
            <article key={entry.id} className="rounded-3xl bg-white/[0.03] px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase ${statusTone(entry.status)}`}>
                      {entry.status}
                    </span>
                    <span className={`text-[12px] font-medium uppercase ${riskTone(entry.risk_level)}`}>
                      {entry.risk_level} risk
                    </span>
                    <span className="text-[12px] text-slate-500">{entry.scan_source}</span>
                  </div>
                  <p className="mt-2 truncate text-[15px] font-medium text-white">{entry.reason}</p>
                  <p className="mt-1.5 text-[13px] text-slate-400">
                    {entry.phone_number ? `Phone ${entry.phone_number}` : 'No phone'}
                    {entry.upi_id ? ` · UPI ${entry.upi_id}` : ''}
                  </p>
                  <p className="mt-1 text-[12px] text-slate-500">
                    Score {(entry.fraud_score * 100).toFixed(0)}% · {entry.processing_time_ms}ms · {entry.model_version}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-600">
                    Tx {entry.transaction_id.slice(0, 8)}… · {formatTime(entry.created_at)}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {total > 0 && (
        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex items-center gap-1 rounded-xl border border-white/[0.08] px-3 py-2 text-[13px] text-slate-300 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </button>
          <p className="text-[13px] text-slate-500">
            Page {page} / {totalPages} · {total} total
          </p>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
            className="inline-flex items-center gap-1 rounded-xl border border-white/[0.08] px-3 py-2 text-[13px] text-slate-300 disabled:opacity-40"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </MobilePage>
  );
}
