import type { AlertItem } from './api';

export type AlertStatusTone = 'blocked' | 'review' | 'safe';

export function parseAlertAction(description: string): string | null {
  const match = description.match(/^\[([A-Z]+)\]/);
  return match?.[1]?.toLowerCase() ?? null;
}

export function alertStatus(alert: AlertItem): { label: string; tone: AlertStatusTone } {
  const action = parseAlertAction(alert.description);
  if (alert.severity === 'blocked' || alert.severity === 'danger' || action === 'block') {
    return { label: 'Blocked', tone: 'blocked' };
  }
  if (action === 'hold' || alert.severity === 'warning') {
    return { label: 'Review', tone: 'review' };
  }
  if (action === 'otp') {
    return { label: 'Verify', tone: 'review' };
  }
  return { label: 'Info', tone: 'safe' };
}

/** Source channel — shown as secondary context, not the main identity of the alert. */
export function alertChannel(alertType: string | undefined | null): string {
  const raw = (alertType || '')
    .replace(/_scan$/i, '')
    .replace(/_threat$/i, '')
    .trim()
    .toLowerCase();
  if (!raw) return 'Scan';
  if (raw === 'sms') return 'via SMS';
  if (raw === 'upi') return 'via UPI';
  if (raw === 'qr') return 'via QR';
  if (raw === 'phone') return 'via Phone';
  if (raw === 'link') return 'via Link';
  return `via ${raw.toUpperCase()}`;
}

export function alertThreatKind(alert: AlertItem): string {
  const status = alertStatus(alert);
  if (status.tone === 'blocked') return 'Fraud threat';
  if (status.label === 'Review') return 'Suspicious activity';
  return 'Security notice';
}

/** One-line summary for list cards — prefers the transaction snippet after " — ". */
export function alertSummary(description: string): string {
  const withoutTag = description.replace(/^\[[A-Z]+\]\s*/, '').trim();
  const parts = withoutTag
    .split(' — ')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return parts[parts.length - 1];
  }
  return withoutTag;
}

export function alertReason(description: string): string {
  const withoutTag = description.replace(/^\[[A-Z]+\]\s*/, '').trim();
  const parts = withoutTag
    .split(' — ')
    .map((p) => p.trim())
    .filter(Boolean);
  return parts[0] || withoutTag;
}

export function alertCardTitle(title: string, description?: string): string {
  const t = title.trim();
  const generic =
    /^(transaction blocked|transaction held for review|step-up verification required|fraud alert)$/i;
  if (t && !generic.test(t)) {
    // Prefer clean titles like "Threat blocked · HDFC"
    return t.replace(/^(Blocked|Review needed|Threat blocked|Verify)\s*[·:]\s*/i, '').trim() || t;
  }
  if (description) {
    const summary = alertSummary(description);
    if (summary) return summary;
  }
  return t || 'Security threat';
}

/** Normalize fraud/risk scores that may be 0–1 or 0–100. */
export function alertScorePercent(score: number | null | undefined): number {
  if (score == null || Number.isNaN(Number(score))) return 0;
  const n = Number(score);
  if (n <= 1) return Math.round(n * 100);
  return Math.round(Math.min(100, Math.max(0, n)));
}
