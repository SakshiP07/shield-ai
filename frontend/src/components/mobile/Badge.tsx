type BadgeVariant = 'safe' | 'danger' | 'warning' | 'spam' | 'update' | 'auto-blocked';

const styles: Record<BadgeVariant, string> = {
  safe: 'bg-blue-500/12 text-blue-400',
  warning: 'bg-blue-500/12 text-blue-400',
  update: 'bg-blue-500/12 text-blue-400',
  danger: 'bg-rose-500/12 text-rose-400',
  spam: 'bg-rose-500/12 text-rose-400',
  'auto-blocked': 'bg-rose-500/12 text-rose-400',
};

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
}

export function Badge({ variant, children }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold leading-none ${styles[variant]}`}>
      {children}
    </span>
  );
}
