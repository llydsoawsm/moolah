// ============================================================
// MoneyGuide — AI System Action Dispatcher (SQLite Controller)
// ============================================================
import { getDatabase } from '../../db/client';
import { useAppStore } from '../../stores/app-store';
import { generateId, getTodayISO } from '../../lib/utils';
import { syncDataToSupabase } from '../supabase-sync';
import type { TransactionType, ThemeName } from '../../lib/types';
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

export interface DeleteTransactionParams {
  id?: string;
  note?: string;
  amount?: number;
  category_name?: string;
}

export interface DeleteSubscriptionParams {
  name?: string;
  id?: string;
}

export interface DeleteBudgetParams {
  category_name: string;
}

export interface UpdateSettingsParams {
  currency?: string;
  theme?: ThemeName;
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
 * Execute deleting a transaction from SQLite ledger
 */
export function executeDeleteTransaction(params: DeleteTransactionParams) {
  const db = getDatabase();
  let targetId = params.id;

  if (!targetId) {
    let query = 'SELECT e.id, e.amount, e.note, c.name as category_name FROM expenses e JOIN categories c ON e.category_id = c.id WHERE 1=1';
    const args: any[] = [];

    if (params.amount) {
      query += ' AND ABS(e.amount - ?) < 0.01';
      args.push(Math.abs(params.amount));
    }
    if (params.note) {
      query += ' AND LOWER(e.note) LIKE ?';
      args.push(`%${params.note.toLowerCase()}%`);
    }
    if (params.category_name) {
      query += ' AND LOWER(c.name) LIKE ?';
      args.push(`%${params.category_name.toLowerCase()}%`);
    }

    query += ' ORDER BY e.created_at DESC LIMIT 1';
    const found = db.getFirstSync<any>(query, ...args);
    if (found) {
      targetId = found.id;
    } else {
      const mostRecent = db.getFirstSync<any>('SELECT e.id, e.amount, e.note, c.name as category_name FROM expenses e JOIN categories c ON e.category_id = c.id ORDER BY e.created_at DESC LIMIT 1');
      if (mostRecent) {
        targetId = mostRecent.id;
      } else {
        throw new Error('No transaction found to delete.');
      }
    }
  }

  if (!targetId) {
    throw new Error('No transaction found to delete.');
  }

  const tx = db.getFirstSync<any>('SELECT e.amount, c.name as category_name FROM expenses e JOIN categories c ON e.category_id = c.id WHERE e.id = ?', targetId);
  db.runSync('DELETE FROM expenses WHERE id = ?', targetId);
  useAppStore.getState().triggerRefresh();
  return { id: targetId, amount: tx?.amount, category_name: tx?.category_name };
}

/**
 * Execute deleting / canceling a subscription
 */
export function executeDeleteSubscription(params: DeleteSubscriptionParams) {
  const db = getDatabase();
  const q = params.name ? params.name.toLowerCase() : '';
  const sub = db.getFirstSync<any>(
    'SELECT id, name, amount FROM recurring_transactions WHERE LOWER(name) LIKE ? OR id = ? LIMIT 1',
    `%${q}%`,
    params.id || '',
  );
  if (!sub) {
    throw new Error(`Subscription matching "${params.name}" was not found.`);
  }
  db.runSync('DELETE FROM recurring_transactions WHERE id = ?', sub.id);
  useAppStore.getState().triggerRefresh();
  return { id: sub.id, name: sub.name, amount: sub.amount };
}

/**
 * Execute deleting / resetting a category budget
 */
export function executeDeleteBudget(params: DeleteBudgetParams) {
  const db = getDatabase();
  const cat = db.getFirstSync<any>(
    'SELECT id, name FROM categories WHERE LOWER(name) LIKE ?',
    `%${params.category_name.toLowerCase()}%`,
  );
  if (!cat) {
    throw new Error(`Category "${params.category_name}" was not found.`);
  }
  db.runSync('DELETE FROM budgets WHERE category_id = ?', cat.id);
  useAppStore.getState().triggerRefresh();
  return { category_name: cat.name };
}

/**
 * Execute updating user preference settings
 */
export function executeUpdateSettings(params: UpdateSettingsParams) {
  const store = useAppStore.getState();
  if (params.currency) {
    store.setCurrency(params.currency.toUpperCase());
  }
  if (params.theme) {
    store.setTheme(params.theme);
  }
  return params;
}

/**
 * Unified action execution dispatcher for the AI agent
 */
export function executeCopilotAction(action: { type: string; payload: any }): string {
  let message = 'Action completed successfully.';
  if (action.type === 'log_transactions') {
    const items = action.payload.items || [];
    const result = executeLogTransactions(items);
    message = `Recorded ${result.length} transaction(s) in SQLite ledger.`;
  } else if (action.type === 'create_category') {
    const result = executeCreateCategory(action.payload);
    message = `Created category "${result.name}".`;
  } else if (action.type === 'set_budget') {
    const result = executeSetBudget(action.payload);
    message = `Saved ₱${result.amount.toLocaleString()} budget for ${result.category_name}.`;
  } else if (action.type === 'add_subscription') {
    const result = executeAddSubscription(action.payload);
    message = `Added subscription "${result.name}" (₱${result.amount.toLocaleString()}) on day ${result.billing_day}.`;
  } else if (action.type === 'delete_transaction') {
    const result = executeDeleteTransaction(action.payload);
    message = `Deleted transaction (${result.category_name || ''} ₱${result.amount || ''}).`;
  } else if (action.type === 'delete_subscription') {
    const result = executeDeleteSubscription(action.payload);
    message = `Canceled subscription "${result.name}".`;
  } else if (action.type === 'delete_budget') {
    const result = executeDeleteBudget(action.payload);
    message = `Removed budget for ${result.category_name}.`;
  } else if (action.type === 'truncate_expenses') {
    const db = getDatabase();
    db.execSync('DELETE FROM expenses;');
    useAppStore.getState().triggerRefresh();
    message = 'Cleared all transactions from ledger.';
  } else if (action.type === 'update_settings') {
    const result = executeUpdateSettings(action.payload);
    message = `Updated app settings (${result.currency ? `Currency: ${result.currency}` : ''} ${result.theme ? `Theme: ${result.theme}` : ''}).`.trim();
  }

  try {
    syncDataToSupabase();
  } catch {}

  return message;
}

/**
 * Gather real SQLite data to compute financial health & 50/30/20 breakdown
 */
export function executeGetFinancialHealth(): FinancialHealthResult {
  const now = new Date();
  const monthStr = format(now, 'yyyy-MM');
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();
  const daysRemaining = Math.max(1, daysInMonth - currentDay);

  let income = 0;
  let expenses = 0;
  let topCategories: { name: string; amount: number; percentage: number }[] = [];
  let budgetAdherence: { category: string; spent: number; limit: number; status: 'On Track' | 'Near Limit' | 'Exceeded' }[] = [];

  try {
    const db = getDatabase();

    // Income this month
    const incRow = db.getFirstSync<{ total?: number; income?: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE type = 'income' AND strftime('%Y-%m', expense_date) = ?`,
      monthStr,
    );
    income = Number(incRow?.total ?? incRow?.income ?? 0);
    if (!Number.isFinite(income)) income = 0;

    // Expenses this month
    const expRow = db.getFirstSync<{ total?: number; expense?: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE type = 'expense' AND strftime('%Y-%m', expense_date) = ?`,
      monthStr,
    );
    expenses = Number(expRow?.total ?? expRow?.expense ?? 0);
    if (!Number.isFinite(expenses)) expenses = 0;

    // Top category spending
    const topRows = db.getAllSync<{ name?: string; category_name?: string; total?: number }>(
      `SELECT c.name, SUM(e.amount) as total 
       FROM expenses e 
       JOIN categories c ON e.category_id = c.id 
       WHERE e.type = 'expense' AND strftime('%Y-%m', e.expense_date) = ?
       GROUP BY c.id 
       ORDER BY total DESC 
       LIMIT 5`,
      monthStr,
    );
    if (Array.isArray(topRows)) {
      topCategories = topRows.map((r) => {
        const catName = r.name || r.category_name || 'General';
        const total = Number(r.total) || 0;
        return {
          name: catName,
          amount: total,
          percentage: expenses > 0 ? Math.round((total / expenses) * 100) : 0,
        };
      });
    }

    // Budgets
    const budgetRows = db.getAllSync<any>(
      `SELECT c.name as category, b.amount as lim, COALESCE(SUM(e.amount), 0) as spent
       FROM budgets b
       JOIN categories c ON b.category_id = c.id
       LEFT JOIN expenses e ON e.category_id = c.id AND e.type = 'expense' AND strftime('%Y-%m', e.expense_date) = ?
       GROUP BY b.id`,
      monthStr,
    );
    if (Array.isArray(budgetRows)) {
      budgetAdherence = budgetRows.map((b) => {
        const spent = Number(b.spent) || 0;
        const lim = Number(b.lim ?? b.amount) || 0;
        return {
          category: String(b.category || b.category_name || 'General'),
          spent,
          limit: lim,
          status: spent > lim ? 'Exceeded' : spent >= lim * 0.8 ? 'Near Limit' : 'On Track',
        };
      });
    }
  } catch (err) {
    console.warn('[executeGetFinancialHealth] Query error:', err);
  }

  const net = income - expenses;
  const savingsRate = income > 0 ? Math.max(0, Math.round((net / income) * 100)) : 0;
  const burnRatePerDay = currentDay > 0 ? Math.round(expenses / currentDay) : 0;
  const projectedMonthEndBalance = Math.round(income - (expenses + burnRatePerDay * daysRemaining));

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
