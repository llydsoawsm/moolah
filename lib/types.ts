// ============================================================
// MoneyGuide — Shared TypeScript Types
// ============================================================

export type TransactionType = 'expense' | 'income';

/** Expense/Transaction record as stored in SQLite */
export interface Expense {
  id: string;
  type: TransactionType;
  amount: number;
  category_id: string;
  payment_method_id: string | null;
  note: string | null;
  receipt_image_uri: string | null;
  expense_date: string; // ISO date string YYYY-MM-DD
  created_at: string;
  updated_at: string;
}

/** Expense/Transaction with joined category and payment method info */
export interface ExpenseWithDetails extends Expense {
  category_name: string;
  category_icon: string;
  category_color: string;
  parent_category_name: string | null;
  payment_method_name: string | null;
  payment_method_icon: string | null;
}

/** Category record */
export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  parent_id: string | null;
  sort_order: number;
  is_default: number; // 0 or 1 (SQLite boolean)
  type: TransactionType; // 'expense' or 'income'
  created_at: string;
}

/** Category with its subcategories */
export interface CategoryWithSubs extends Category {
  subcategories: Category[];
}

/** Payment method record */
export interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  color: string;
  is_default: number;
  created_at: string;
}

/** User preferences key-value pair */
export interface UserPreference {
  key: string;
  value: string;
}

/** Form data for creating/editing an expense or income */
export interface ExpenseFormData {
  type?: TransactionType;
  amount: string;
  category_id: string;
  payment_method_id: string | null;
  note: string;
  receipt_image_uri: string | null;
  expense_date: Date;
}

/** Theme names */
export type ThemeName = 'dark' | 'light' | 'pink' | 'green';

/** Theme color palette */
export interface ThemeColors {
  primary: string;
  primaryLight: string;
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  cardShadow: string;
  tabBar: string;
  tabBarBorder: string;
  tabBarInactive: string;
  inputBg: string;
  statusBar: 'light' | 'dark';
}

/** Cash flow & spending summary for dashboard */
export interface CashFlowSummary {
  // Legacy compatibility
  today: number;
  thisWeek: number;
  thisMonth: number;
  // Income figures
  incomeToday: number;
  incomeThisWeek: number;
  incomeThisMonth: number;
  // Expense figures
  expenseToday: number;
  expenseThisWeek: number;
  expenseThisMonth: number;
  // Net cash flow
  netToday: number;
  netThisWeek: number;
  netThisMonth: number;
}

export type SpendingSummary = CashFlowSummary;

/** Category breakdown for analytics */
export interface CategorySpending {
  category_id: string;
  category_name: string;
  category_icon: string;
  category_color: string;
  total: number;
  percentage: number;
  count: number;
}

/** Daily spending / income trend for charts */
export interface DailySpending {
  date: string;
  total: number;
}

/** Dual cash flow trend for comparison charts */
export interface DailyCashFlow {
  date: string;
  income: number;
  expense: number;
  net: number;
}

/** Period filter for analytics */
export type AnalyticsPeriod = 'daily' | 'weekly' | 'monthly';
export type AnalyticsMode = 'expense' | 'income' | 'cashflow';

/** User profile record */
export interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
  updated_at?: string;
}

/** Password reset verification record */
export interface PasswordResetRecord {
  id: string;
  email: string;
  code: string;
  expires_at: string;
  used: number;
}

/** Budget record */
export interface Budget {
  id: string;
  category_id: string; // Category ID or 'total'
  amount: number;
  period: 'monthly' | 'weekly';
  created_at: string;
  updated_at: string;
}

/** Budget with category details and calculated spending */
export interface BudgetWithSpending extends Budget {
  category_name: string;
  category_icon: string;
  category_color: string;
  spent: number;
  remaining: number;
  percentage: number;
}

/** Recurring Transaction / Subscription record */
export interface RecurringTransaction {
  id: string;
  type: TransactionType;
  name: string;
  amount: number;
  category_id: string;
  payment_method_id: string | null;
  frequency: 'weekly' | 'monthly' | 'yearly';
  billing_day: number;
  next_due_date: string; // YYYY-MM-DD
  is_active: number; // 0 or 1
  created_at: string;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
  payment_method_name?: string;
}

/** Currency configuration */
export interface CurrencyConfig {
  code: string;
  symbol: string;
  name: string;
  locale: string;
}

