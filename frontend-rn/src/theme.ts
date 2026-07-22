/**
 * Global design tokens used across all components.
 * Replaces the Tailwind theme + CSS custom properties from the web version.
 */

export const theme = {
  colors: {
    bg: '#0b0b0b',
    surface: '#111111',
    surfaceCard: '#161616',
    surfaceInput: '#141414',
    textPrimary: '#ffffff',
    textSecondary: '#a3a3a3',
    textMuted: '#737373',
    border: 'rgba(255, 255, 255, 0.06)',
    borderLight: 'rgba(255, 255, 255, 0.08)',
    blue400: '#60a5fa',
    blue500: '#3b82f6',
    blue600: '#2563eb',
    rose400: '#fb7185',
    rose500: '#f43f5e',
    slate200: '#e2e8f0',
    slate300: '#cbd5e1',
    slate400: '#94a3b8',
    slate500: '#64748b',
    slate600: '#475569',
    amber400: '#fbbf24',
    emerald400: '#34d399',
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
  },
  radii: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    '2xl': 28,
    full: 9999,
  },
} as const;
