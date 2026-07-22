/**
 * Formatting helpers for Shield-AI.
 *
 * Web version returned Tailwind class strings like 'text-blue-400'.
 * RN version returns hex color values or objects usable in StyleSheet.
 */

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export function riskLabel(level: string): string {
  const map: Record<string, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    critical: 'Critical',
  };
  return map[level] ?? 'Low';
}

export function badgeFromStatus(status: string): 'safe' | 'warning' | 'danger' {
  if (status === 'safe' || status === 'approve') return 'safe';
  if (status === 'blocked' || status === 'block' || status === 'danger') return 'danger';
  return 'warning';
}

export function timeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning,';
  if (hour < 17) return 'Good afternoon,';
  return 'Good evening,';
}

export function formatDateLabel(iso: string): 'today' | 'yesterday' | 'earlier' {
  const date = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const itemDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (itemDay.getTime() === today.getTime()) return 'today';
  if (itemDay.getTime() === yesterday.getTime()) return 'yesterday';
  return 'earlier';
}

export function dateGroupLabel(group: 'today' | 'yesterday' | 'earlier'): string {
  if (group === 'today') return 'Today';
  if (group === 'yesterday') return 'Yesterday';
  return 'Earlier';
}

// ─── Color helpers (replaced Tailwind class strings) ──────────────────

export const colors = {
  blue400: '#60a5fa',
  blue500: '#3b82f6',
  blue600: '#2563eb',
  rose400: '#fb7185',
  rose500: '#f43f5e',
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  white: '#ffffff',
} as const;

/** Returns [startColor, endColor] for a risk level gradient. */
export function riskBarGradientColors(level: string): [string, string] {
  if (level === 'high' || level === 'critical') return [colors.rose500, colors.rose400];
  return [colors.blue600, colors.blue400];
}

export function scoreProtectionLabel(score: number): string {
  if (score >= 80) return 'Excellent Protection';
  if (score >= 50) return 'Moderate Protection';
  return 'At Risk';
}

export function scoreProtectionColor(score: number): string {
  if (score >= 50) return colors.blue400;
  return colors.rose400;
}

export function scoreProtectionDotColor(score: number): string {
  if (score >= 50) return colors.blue400;
  return colors.rose400;
}

export function statusIconColor(status: 'safe' | 'warning' | 'danger'): string {
  if (status === 'danger') return colors.rose400;
  return colors.blue400;
}
