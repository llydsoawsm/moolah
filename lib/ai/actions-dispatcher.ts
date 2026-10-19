// ============================================================
// MoneyGuide — AI System Action Dispatcher (SQLite Controller)
// ============================================================
import { getDatabase } from '../../db/client';
import { useAppStore } from '../../stores/app-store';
import { generateId, getTodayISO } from '../../lib/utils';
import type { TransactionType } from '../../lib/types';
import { startOfMonth, format } from 'date-fns';

export interface LogTransactionParams {
  type: TransactionType;
  amount: number;
  category_name?: string;
  payment_method_name?: string;
  note?: string;
  date?: string;
}

export interface CreateCategoryParams {
  name: string;
  type?: TransactionType;
  icon?: string;
  color?: string;
}

export interface SetBudgetParams {
  category_name: string;
  amount: number;
}

export interface AddSubscriptionParams {
  name: string;
  amount: number;
  billing_day: number;
  category_name?: string;
  frequency?: 'weekly' | 'monthly' | 'yearly';
}

export interface FinancialHealthResult {
  month: string;
  income: number;
  expenses: number;
  net: number;
  savingsRate: number;
  topCategories: { name: string; amount: number; percentage: number }[];
  burnRatePerDay: number;
  daysRemainingInMonth: number;
  projectedMonthEndBalance: number;
  budgetAdherence: { category: string; spent: number; limit: number; status: string }[];
}

/**
 * Execute single or batch transaction logging into SQLite
 */
export function executeLogTransactions(items: LogTransactionParams[]) {
  const db = getDatabase();
  const created: any[] = [];

  // Fetch all categories and payment methods for best matching
  const categories = db.getAllSync<any>('SELECT id, name, type FROM categories');
  const paymentMethods = db.getAllSync<any>('SELECT id, name FROM payment_methods');

  const insertStmt = db.prepareSync(
    'INSERT INTO expenses (id, type, amount, category_id, payment_method_id, note, expense_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );

  for (const item of items) {
    const id = generateId();
    const type = item.type || 'expense';
    const amount = Math.abs(Number(item.amount) || 0);
    const date = item.date || getTodayISO();

    // Match category
    let categoryId = '';
    if (item.category_name) {
      const q = item.category_name.toLowerCase();
      const matched = categories.find(
        (c) => c.type === type && (c.name.toLowerCase().includes(q) || q.includes(c.name.toLowerCase())),
      );
      if (matched) categoryId = matched.id;
    }
    if (!categoryId) {
      // Default fallback category
      const fallback = categories.find((c) => c.type === type);
      categoryId = fallback ? fallback.id : (type === 'income' ? 'cat-inc-salary' : 'cat-food');
    }

    // Match payment method
    let paymentMethodId: string | null = null;
    if (item.payment_method_name) {
      const q = item.payment_method_name.toLowerCase();
      const matched = paymentMethods.find((p) => p.name.toLowerCase().includes(q) || q.includes(p.name.toLowerCase()));
      if (matched) paymentMethodId = matched.id;
    }
    if (!paymentMethodId) {
      paymentMethodId = 'pm-cash';
    }

    insertStmt.executeSync(
      id,
      type,
      amount,
      categoryId,
      paymentMethodId,
      item.note || null,
      date,
    );

    const catName = categories.find((c) => c.id === categoryId)?.name || 'General';
    const pmName = paymentMethods.find((p) => p.id === paymentMethodId)?.name || 'Cash';

    created.push({
      id,
      type,
      amount,
      category_name: catName,
      payment_method_name: pmName,
      note: item.note,
      date,
    });
  }

  insertStmt.finalizeSync();
  useAppStore.getState().triggerRefresh();

  return created;
}

/**
 * Execute category creation in SQLite
 */
export function executeCreateCategory(params: CreateCategoryParams) {
  const db = getDatabase();
  const id = `cat-${generateId()}`;
  const type = params.type || 'expense';
  const name = params.name.trim();
  const icon = params.icon || (type === 'income' ? 'wallet' : 'pricetag');
  const color = params.color || '#3B82F6';

  db.runSync(
    'INSERT INTO categories (id, name, icon, color, parent_id, sort_order, is_default, type) VALUES (?, ?, ?, ?, NULL, 99, 0, ?)',
    id,
    name,
    icon,
    color,
    type,
  );

  useAppStore.getState().triggerRefresh();
  return { id, name, icon, color, type };
}

/**
 * Execute setting a category budget limit
 */
export function executeSetBudget(params: SetBudgetParams) {
  const db = getDatabase();
  const categories = db.getAllSync<any>('SELECT id, name FROM categories WHERE type = "expense"');
  const q = params.category_name.toLowerCase();
  const matched = categories.find((c) => c.name.toLowerCase().includes(q) || q.includes(c.name.toLowerCase()));

  if (!matched) {
    throw new Error(`Expense category matching "${params.category_name}" was not found.`);
  }

  const existing = db.getFirstSync<{ id: string }>(
    'SELECT id FROM budgets WHERE category_id = ?',
    matched.id,
  );

  const amount = Math.abs(Number(params.amount) || 0);

  if (existing) {
    db.runSync("UPDATE budgets SET amount = ?, updated_at = datetime('now') WHERE id = ?", amount, existing.id);
  } else {
    const id = `b-${generateId()}`;
    db.runSync('INSERT INTO budgets (id, category_id, amount, period) VALUES (?, ?, ?, "monthly")', id, matched.id, amount);
  }

  useAppStore.getState().triggerRefresh();
  return { category_id: matched.id, category_name: matched.name, amount };
}

/**
 * Execute adding a recurring subscription / bill
 */
export function executeAddSubscription(params: AddSubscriptionParams) {
  const db = getDatabase();
  const id = `rec-${generateId()}`;
  const categories = db.getAllSync<any>('SELECT id, name FROM categories WHERE type = "expense"');
  
  let catId = 'cat-bills';
  if (params.category_name) {
    const q = params.category_name.toLowerCase();
    const matched = categories.find((c) => c.name.toLowerCase().includes(q));
    if (matched) catId = matched.id;
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(Math.min(31, Math.max(1, params.billing_day || 1))).padStart(2, '0');
  const nextDueDate = `${year}-${month}-${day}`;

  db.runSync(
    `INSERT INTO recurring_transactions (id, type, name, amount, category_id, payment_method_id, frequency, billing_day, next_due_date, is_active)
     VALUES (?, 'expense', ?, ?, ?, 'pm-cash', ?, ?, ?, 1)`,
    id,
    params.name,
    Math.abs(params.amount),
    catId,
    params.frequency || 'monthly',
    params.billing_day,
    nextDueDate,
  );

  useAppStore.getState().triggerRefresh();
  return {
    id,
    name: params.name,
    amount: params.amount,
    billing_day: params.billing_day,
    next_due_date: nextDueDate,
  };
}

/**
 * Gather real SQLite data to compute financial health & 50/30/20 breakdown
 */
export function executeGetFinancialHealth(): FinancialHealthResult {
  const db = getDatabase();
  const now = new Date();
  const monthStr = format(now, 'yyyy-MM');
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();
  const daysRemaining = Math.max(1, daysInMonth - currentDay);

  // Income this month
  const incRow = db.getFirstSync<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE type = 'income' AND strftime('%Y-%m', expense_date) = ?`,
    monthStr,
  );
  const income = incRow ? incRow.total : 0;

  // Expenses this month
  const expRow = db.getFirstSync<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE type = 'expense' AND strftime('%Y-%m', expense_date) = ?`,
    monthStr,
  );
  const expenses = expRow ? expRow.total : 0;
  const net = income - expenses;
  const savingsRate = income > 0 ? Math.round((net / income) * 100) : 0;

  // Top category spending
  const topRows = db.getAllSync<{ name: string; total: number }>(
    `SELECT c.name, SUM(e.amount) as total 
     FROM expenses e 
     JOIN categories c ON e.category_id = c.id 
     WHERE e.type = 'expense' AND strftime('%Y-%m', e.expense_date) = ?
     GROUP BY c.id 
     ORDER BY total DESC 
     LIMIT 5`,
    monthStr,
  );
  const topCategories = topRows.map((r) => ({
    name: r.name,
    amount: r.total,
    percentage: expenses > 0 ? Math.round((r.total / expenses) * 100) : 0,
  }));

  // Burn rate
  const burnRatePerDay = currentDay > 0 ? Math.round(expenses / currentDay) : 0;
  const projectedMonthEndBalance = Math.round(income - (expenses + burnRatePerDay * daysRemaining));

  // Budgets
  const budgetRows = db.getAllSync<any>(
    `SELECT c.name as category, b.amount as lim, COALESCE(SUM(e.amount), 0) as spent
     FROM budgets b
     JOIN categories c ON b.category_id = c.id
     LEFT JOIN expenses e ON e.category_id = c.id AND e.type = 'expense' AND strftime('%Y-%m', e.expense_date) = ?
     GROUP BY b.id`,
    monthStr,
  );
  const budgetAdherence = budgetRows.map((b) => ({
    category: b.category,
    spent: b.spent,
    limit: b.lim,
    status: b.spent > b.lim ? 'Exceeded' : b.spent >= b.lim * 0.8 ? 'Near Limit' : 'On Track',
  }));

  return {
    month: monthStr,
    income,
    expenses,
    net,
    savingsRate,
    topCategories,
    burnRatePerDay,
    daysRemainingInMonth: daysRemaining,
    projectedMonthEndBalance,
    budgetAdherence,
  };
}
