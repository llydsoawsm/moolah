// ============================================================
// MoneyGuide — Utility Functions
// ============================================================
import { format, isToday, isYesterday, startOfWeek, startOfMonth, parseISO } from 'date-fns';
import { CURRENCY, SUPPORTED_CURRENCIES, DATE_FORMATS } from './constants';
import { useAppStore } from '../stores/app-store';

/**
 * Get active currency configuration
 */
export function getCurrencyConfig(code?: string) {
  const activeCode = code || (typeof useAppStore?.getState === 'function' ? useAppStore.getState().currency : 'PHP') || 'PHP';
  return SUPPORTED_CURRENCIES[activeCode] || CURRENCY;
}

/**
 * Format a number as currency using active or specified currency
 */
export function formatCurrency(amount: number, currencyCode?: string): string {
  const curr = getCurrencyConfig(currencyCode);
  const isNegative = amount < 0;
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString(curr.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${isNegative ? '-' : ''}${curr.symbol}${formatted}`;
}

/**
 * Format a number as compact currency (e.g., ₱1.2K or $1.2K)
 */
export function formatCurrencyCompact(amount: number, currencyCode?: string): string {
  const curr = getCurrencyConfig(currencyCode);
  const isNegative = amount < 0;
  const abs = Math.abs(amount);
  if (abs >= 1000000) {
    return `${isNegative ? '-' : ''}${curr.symbol}${(abs / 1000000).toFixed(1)}M`;
  }
  if (abs >= 1000) {
    return `${isNegative ? '-' : ''}${curr.symbol}${(abs / 1000).toFixed(1)}K`;
  }
  return formatCurrency(amount, currencyCode);
}

/**
 * Format a date string for display
 */
export function formatDate(dateStr: string, fmt?: string): string {
  const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
  return format(date, fmt || DATE_FORMATS.display);
}

/**
 * Get a friendly date label (Today, Yesterday, or the formatted date)
 */
export function getDateLabel(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, DATE_FORMATS.display);
}

/**
 * Get the start of the current week (Monday)
 */
export function getWeekStart(): Date {
  return startOfWeek(new Date(), { weekStartsOn: 1 });
}

/**
 * Get the start of the current month
 */
export function getMonthStart(): Date {
  return startOfMonth(new Date());
}

/**
 * Get today's date as ISO string (YYYY-MM-DD)
 */
export function getTodayISO(): string {
  return format(new Date(), DATE_FORMATS.iso);
}

/**
 * Generate a UUID using expo-crypto
 */
export function generateId(): string {
  // Fallback for environments where expo-crypto isn't available
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Group an array of items by a key function
 */
export function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return items.reduce(
    (groups, item) => {
      const key = keyFn(item);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
      return groups;
    },
    {} as Record<string, T[]>,
  );
}

/**
 * Clamp a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Parse a currency string input to a number (handles commas, spaces, currency symbols)
 */
export function parseCurrencyInput(input: string): number {
  const cleaned = input.replace(/[^\d.]/g, '');
  const value = parseFloat(cleaned);
  return isNaN(value) ? 0 : value;
}
