import { type ReactNode } from 'react';
import { X, Loader2 } from 'lucide-react';
import type { AlertDetail } from '../../lib/api';
import { alertStatus } from '../../lib/alertDisplay';
import { formatTime } from '../../lib/format';
import { AlertStatusBadge } from './AlertStatusBadge';
import { MobileCard } from './MobilePage';

function DetailBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">{title}</p>
      {children}
    </div>
  );
}

type AlertDetailSheetProps = {
  detail: AlertDetail | null;
  loading: boolean;
  onClose: () => void;
};

export function AlertDetailSheet({ detail, loading, onClose }: AlertDetailSheetProps) {
  if (!detail && !loading) return null;

  const ruleResults = (detail?.rules?.results as Array<Record<string, unknown>> | undefined) ?? [];
  const triggeredRules = ruleResults.filter((r) => r.triggered);
  const status = detail ? alertStatus(detail) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-[2px] transition-opacity duration-200"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface-card px-6 pb-8 pt-4 transition-transform duration-300 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                Loading details…
              </div>
            ) : detail ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold leading-snug text-white">{detail.title}</h2>
                  {status && <AlertStatusBadge label={status.label} tone={status.tone} />}
                </div>
                <p className="mt-1 text-xs text-slate-500">{formatTime(detail.created_at)}</p>
              </>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-touch flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {detail && !loading && (
          <div className="space-y-1">
            <DetailBlock title="Full Message">
              <MobileCard padding="sm" className="border-white/[0.05] bg-white/[0.02]">
                <p className="text-sm leading-relaxed text-slate-300">{detail.full_message}</p>
              </MobileCard>
            </DetailBlock>

            <div className="mb-4 grid grid-cols-2 gap-2">
              <MobileCard padding="sm" className="border-white/[0.05] bg-white/[0.02]">
                <p className="text-[11px] text-slate-500">Risk score</p>
                <p className="mt-0.5 text-sm font-semibold text-white">{Math.round(detail.risk_score * 100)}%</p>
              </MobileCard>
              <MobileCard padding="sm" className="border-white/[0.05] bg-white/[0.02]">
                <p className="text-[11px] text-slate-500">Fraud score</p>
                <p className="mt-0.5 text-sm font-semibold text-white">{Math.round((detail.fraud_score ?? 0) * 100)}%</p>
              </MobileCard>
            </div>

            {detail.recommendation && (
              <DetailBlock title="Recommendation">
                <p className="text-sm leading-relaxed text-slate-300">{detail.recommendation}</p>
              </DetailBlock>
            )}

            {detail.flagged_reasons.length > 0 && (
              <DetailBlock title="Why It Was Flagged">
                <ul className="space-y-1.5">
                  {detail.flagged_reasons.map((reason) => (
                    <li key={reason} className="rounded-xl bg-white/[0.03] px-3 py-2 text-sm text-slate-400">
                      {reason}
                    </li>
                  ))}
                </ul>
              </DetailBlock>
            )}

            {detail.ml_prediction && (
              <DetailBlock title="ML Prediction">
                <MobileCard padding="sm" className="space-y-1 border-white/[0.05] bg-white/[0.02] text-sm text-slate-300">
                  <p>Fraud: {Math.round(Number(detail.ml_prediction.fraud_score ?? 0) * 100)}%</p>
                  <p>Risk: {Math.round(Number(detail.ml_prediction.risk_score ?? 0) * 100)}%</p>
                  <p className="capitalize">Level: {String(detail.ml_prediction.risk_level ?? detail.risk_level)}</p>
                </MobileCard>
              </DetailBlock>
            )}

            {detail.behaviour && (
              <DetailBlock title="Behaviour Engine">
                <MobileCard padding="sm" className="space-y-1 border-white/[0.05] bg-white/[0.02] text-sm text-slate-300">
                  <p className="capitalize">Risk level: {String(detail.behaviour.risk_level ?? '—')}</p>
                  <p>Deviation: {String(detail.behaviour.deviation_score ?? '—')}</p>
                  {Array.isArray(detail.behaviour.flags) && detail.behaviour.flags.length > 0 && (
                    <p>Flags: {(detail.behaviour.flags as string[]).join(', ')}</p>
                  )}
                </MobileCard>
              </DetailBlock>
            )}

            {triggeredRules.length > 0 && (
              <DetailBlock title="Rule Engine">
                <ul className="space-y-1.5">
                  {triggeredRules.map((rule) => (
                    <li
                      key={String(rule.rule_id)}
                      className="rounded-xl bg-white/[0.03] px-3 py-2 text-sm text-slate-400"
                    >
                      {String(rule.name)} — {String(rule.detail)}
                    </li>
                  ))}
                </ul>
              </DetailBlock>
            )}

            <DetailBlock title="Details">
              <MobileCard padding="sm" className="space-y-1.5 border-white/[0.05] bg-white/[0.02] text-xs text-slate-400">
                <p>
                  <span className="text-slate-500">Timestamp:</span> {formatTime(detail.created_at)}
                </p>
                {detail.scan_reference && (
                  <p>
                    <span className="text-slate-500">Scan reference:</span> {detail.scan_reference}
                  </p>
                )}
                {detail.transaction_id && (
                  <p className="break-all">
                    <span className="text-slate-500">Transaction:</span> {detail.transaction_id}
                  </p>
                )}
              </MobileCard>
            </DetailBlock>
          </div>
        )}
      </div>
    </div>
  );
}
