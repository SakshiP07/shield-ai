type UserAvatarSize = 'sm' | 'md' | 'lg';

const SIZE: Record<UserAvatarSize, { box: string; text: string }> = {
  sm: { box: 'h-10 w-10', text: 'text-sm' },
  md: { box: 'h-16 w-16', text: 'text-lg' },
  lg: { box: 'h-20 w-20', text: 'text-xl' },
};

function initialsFromName(name?: string | null): string {
  if (!name?.trim()) return 'U';
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

type UserAvatarProps = {
  avatarUrl?: string | null;
  name?: string | null;
  size?: UserAvatarSize;
  className?: string;
};

/** Stable avatar: uses `avatar_url` when set, otherwise a fixed initials fallback. */
export function UserAvatar({ avatarUrl, name, size = 'md', className = '' }: UserAvatarProps) {
  const { box, text } = SIZE[size];

  if (avatarUrl?.trim()) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className={`${box} shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`${box} ${text} flex shrink-0 items-center justify-center rounded-full bg-blue-600 font-semibold text-white ${className}`}
      aria-hidden
    >
      {initialsFromName(name)}
    </div>
  );
}
