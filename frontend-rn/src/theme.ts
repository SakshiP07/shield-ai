/**
 * Global design tokens — 2 accent colors max (blue + rose) + neutrals.
 */

export const theme = {
  colors: {
    bg: '#0A0B0D',
    surface: '#111318',
    surfaceCard: '#161A22',
    surfaceElevated: '#1B2030',
    surfaceInput: '#141821',
    textPrimary: '#F4F6FA',
    textSecondary: '#A8B0C0',
    textMuted: '#6B7385',
    border: 'rgba(255, 255, 255, 0.06)',
    borderLight: 'rgba(255, 255, 255, 0.10)',
    // Primary accent
    blue400: '#5B9CFF',
    blue500: '#3B82F6',
    blue600: '#2563EB',
    blueSoft: 'rgba(59, 130, 246, 0.14)',
    // Danger accent
    rose400: '#FB7185',
    rose500: '#F43F5E',
    roseSoft: 'rgba(244, 63, 94, 0.12)',
    // Neutrals (aliases kept for existing screens)
    slate200: '#E2E8F0',
    slate300: '#CBD5E1',
    slate400: '#94A3B8',
    slate500: '#64748B',
    slate600: '#475569',
    // Mapped into the 2-color system (no extra hues)
    amber400: '#5B9CFF',
    amberSoft: 'rgba(59, 130, 246, 0.12)',
    emerald400: '#5B9CFF',
    emeraldSoft: 'rgba(59, 130, 246, 0.12)',
  },
  fonts: {
    regular: 'System',
    medium: 'System',
    semibold: 'System',
    bold: 'System',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    '2xl': 40,
  },
  radii: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    full: 9999,
  },
  icon: {
    sm: 16,
    md: 20,
    lg: 24,
  },
} as const;
