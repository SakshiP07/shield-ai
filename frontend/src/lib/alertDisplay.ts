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
  if (action === 'otp') {
    return { label: 'OTP', tone: 'review' };
  }
  if (action === 'hold' || alert.severity === 'warning') {
    return { label: 'Review', tone: 'review' };
  }
  return { label: 'Safe', tone: 'safe' };
}

/** One-line summary for list cards — derived from backend description. */
export function alertSummary(description: string): string {
  const withoutTag = description.replace(/^\[[A-Z]+\]\s*/, '').trim();
  const parts = withoutTag.split(' — ').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return parts[parts.length - 1];
  }
  return withoutTag;
}

export function alertCardTitle(title: string): string {
  return title.trim();
}
