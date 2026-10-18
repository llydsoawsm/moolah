// ============================================================
// MoneyGuide — useTheme Hook
// ============================================================
import { useAppStore } from '../stores/app-store';
import { getTheme } from '../lib/theme';
import type { ThemeColors, ThemeName } from '../lib/types';

/**
 * Hook that returns the current theme colors and setter
 */
export function useTheme(): {
  theme: ThemeName;
  colors: ThemeColors;
  setTheme: (theme: ThemeName) => void;
} {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  return {
    theme,
    colors: getTheme(theme),
    setTheme,
  };
}
