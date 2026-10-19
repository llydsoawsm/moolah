// ============================================================
// MoneyGuide — Theme Definitions
// ============================================================
import type { ThemeColors, ThemeName } from './types';

export const themes: Record<ThemeName, ThemeColors> = {
  dark: {
    primary: '#FAFAFA',
    primaryLight: '#E4E4E7',
    background: '#09090B',
    surface: '#131316',
    surfaceAlt: '#1E1E24',
    text: '#FAFAFA',
    textSecondary: '#A1A1AA',
    textMuted: '#71717A',
    border: '#27272A',
    accent: '#A1A1AA',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#F43F5E',
    cardShadow: 'transparent',
    tabBar: '#09090B',
    tabBarBorder: '#1F1F23',
    tabBarInactive: '#52525B',
    inputBg: '#131316',
    statusBar: 'light',
  },
  light: {
    primary: '#18181B',
    primaryLight: '#27272A',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceAlt: '#F1F5F9',
    text: '#09090B',
    textSecondary: '#64748B',
    textMuted: '#94A3B8',
    border: '#E2E8F0',
    accent: '#52525B',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#E11D48',
    cardShadow: 'transparent',
    tabBar: '#FFFFFF',
    tabBarBorder: '#E2E8F0',
    tabBarInactive: '#94A3B8',
    inputBg: '#F1F5F9',
    statusBar: 'dark',
  },
  pink: {
    primary: '#E11D48',
    primaryLight: '#FB7185',
    background: '#FFF1F4',
    surface: '#FFFFFF',
    surfaceAlt: '#FFE4E9',
    text: '#1C1917',
    textSecondary: '#881337',
    textMuted: '#9D4A68',
    border: '#FECDD3',
    accent: '#E11D48',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#E11D48',
    cardShadow: 'transparent',
    tabBar: '#FFF5F7',
    tabBarBorder: '#FECDD3',
    tabBarInactive: '#FDA4AF',
    inputBg: '#FFE4E9',
    statusBar: 'dark',
  },
  green: {
    primary: '#059669',
    primaryLight: '#10B981',
    background: '#F0FDF4',
    surface: '#FFFFFF',
    surfaceAlt: '#DCFCE7',
    text: '#0F172A',
    textSecondary: '#047857',
    textMuted: '#3D7A68',
    border: '#BBF7D0',
    accent: '#059669',
    success: '#059669',
    warning: '#F59E0B',
    danger: '#E11D48',
    cardShadow: 'transparent',
    tabBar: '#F7FDF9',
    tabBarBorder: '#BBF7D0',
    tabBarInactive: '#86EFAC',
    inputBg: '#DCFCE7',
    statusBar: 'dark',
  },
};

/** Get theme colors by name, defaults to 'dark' */
export function getTheme(name?: ThemeName | string | null): ThemeColors {
  if (name && name in themes) {
    return themes[name as ThemeName];
  }
  return themes.dark;
}

/** Theme option definition with display properties */
export interface ThemeOption {
  key: ThemeName;
  label: string;
  tagline: string;
  icon: 'moon' | 'sunny' | 'flower' | 'leaf';
  previewBg: string;
  previewSurface: string;
  previewAccent: string;
}

/** List of available themes with rich preview data */
export const themeOptions: ThemeOption[] = [
  {
    key: 'dark',
    label: 'Dark',
    tagline: 'Midnight Onyx',
    icon: 'moon',
    previewBg: '#09090B',
    previewSurface: '#18181B',
    previewAccent: '#FAFAFA',
  },
  {
    key: 'light',
    label: 'Light',
    tagline: 'Pure Slate',
    icon: 'sunny',
    previewBg: '#F8FAFC',
    previewSurface: '#FFFFFF',
    previewAccent: '#09090B',
  },
  {
    key: 'pink',
    label: 'Rose',
    tagline: 'Blush Velvet',
    icon: 'flower',
    previewBg: '#FDF2F4',
    previewSurface: '#FFFFFF',
    previewAccent: '#E11D48',
  },
  {
    key: 'green',
    label: 'Emerald',
    tagline: 'Botanical Mint',
    icon: 'leaf',
    previewBg: '#F0FDF4',
    previewSurface: '#FFFFFF',
    previewAccent: '#059669',
  },
];
