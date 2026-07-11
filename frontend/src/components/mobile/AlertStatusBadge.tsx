import type { AlertStatusTone } from '../../lib/alertDisplay';

type AlertStatusBadgeProps = {
  label: string;
  tone: AlertStatusTone;
};

export function AlertStatusBadge({ label, tone }: AlertStatusBadgeProps) {
  if (tone === 'blocked') {
    return (
      <span className="inline-flex shrink-0 items-center rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-rose-400">
        {label}
      </span>
    );
  }
  if (tone === 'safe') {
    return (
      <span className="inline-flex shrink-0 items-center rounded-md border border-blue-500/35 bg-transparent px-1.5 py-0.5 text-[11px] font-semibold leading-none text-blue-400">
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center rounded-md bg-blue-500/15 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-blue-400">
      {label}
    </span>
  );
}
