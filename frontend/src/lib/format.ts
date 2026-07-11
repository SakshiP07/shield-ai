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

export function riskBarGradient(level: string): string {
  if (level === 'high' || level === 'critical') return 'from-rose-500 to-rose-400';
  return 'from-blue-600 to-blue-400';
}

export function scoreProtectionLabel(score: number): string {
  if (score >= 80) return 'Excellent Protection';
  if (score >= 50) return 'Moderate Protection';
  return 'At Risk';
}

export function scoreProtectionColor(score: number): string {
  if (score >= 50) return 'text-blue-400';
  return 'text-rose-400';
}

export function scoreProtectionDot(score: number): string {
  if (score >= 50) return 'bg-blue-400';
  return 'bg-rose-400';
}

export function statusIconColor(status: 'safe' | 'warning' | 'danger'): string {
  if (status === 'danger') return 'text-rose-400';
  return 'text-blue-400';
}
