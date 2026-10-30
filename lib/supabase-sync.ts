// ============================================================
// Moolah — Supabase Cloud Data Sync & Persistence Engine
// ============================================================
import { supabase } from './supabase';
import { getDatabase } from '../db/client';
import { useAppStore } from '../stores/app-store';

export interface CloudDataPayload {
  version: number;
  updated_at: string;
  expenses: any[];
  budgets: any[];
  recurring_transactions: any[];
  categories: any[];
  preferences: Record<string, string>;
}

/**
 * Uploads local transactions, budgets, categories, and settings to Supabase.
 * Uses dual-layer sync:
 * Layer 1: Supabase auth.user_metadata.moolah_cloud_data (Always works instantly without SQL migration)
 * Layer 2: Supabase PostgREST tables (public.expenses, budgets, etc. when migration is run)
 */
export async function syncDataToSupabase(userId?: string): Promise<boolean> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const activeUserId = userId || sessionData?.session?.user?.id;
    if (!activeUserId) return false;

    const db = getDatabase();

    // 1. Gather all current local records
    let expenses: any[] = [];
    let budgets: any[] = [];
    let recurring: any[] = [];
    let categories: any[] = [];
    let prefs: any[] = [];

    try {
      expenses = db.getAllSync('SELECT * FROM expenses WHERE (amount > 0 OR amount IS NOT NULL)');
      budgets = db.getAllSync('SELECT * FROM budgets');
      recurring = db.getAllSync('SELECT * FROM recurring_transactions');
      categories = db.getAllSync("SELECT * FROM categories WHERE is_default = 0 OR is_default = '0'");
      prefs = db.getAllSync('SELECT key, value FROM user_preferences');
    } catch (e) {
      console.warn('[SupabaseSync] Local read notice:', e);
    }

    const prefMap: Record<string, string> = {};
    prefs.forEach((p: any) => {
      if (p.key && p.value) prefMap[p.key] = p.value;
    });

    const payload: CloudDataPayload = {
      version: 2,
      updated_at: new Date().toISOString(),
      expenses,
      budgets,
      recurring_transactions: recurring,
      categories,
      preferences: prefMap,
    };

    // Layer 1: Sync to user_metadata (Instant guaranteed cloud storage)
    const metaDataToUpdate: any = { moolah_cloud_data: payload };
    const { error: metaErr } = await supabase.auth.updateUser({
      data: metaDataToUpdate,
    });
    if (metaErr) {
      console.warn('[SupabaseSync] Metadata update warning:', metaErr.message);
    }

    // Layer 2: Attempt PostgREST table sync if tables exist
    (async () => {
      try {
        if (expenses.length > 0) {
          const mappedExpenses = expenses.map((e) => ({
            id: e.id,
            user_id: activeUserId,
            type: e.type || 'expense',
            amount: Number(e.amount) || 0,
            category_id: e.category_id || null,
            payment_method_id: e.payment_method_id || null,
            note: e.note || null,
            receipt_image_uri: e.receipt_image_uri || null,
            expense_date: e.expense_date,
            created_at: e.created_at || new Date().toISOString(),
            updated_at: e.updated_at || new Date().toISOString(),
          }));
          await supabase.from('expenses').upsert(mappedExpenses);
        }

        if (budgets.length > 0) {
          const mappedBudgets = budgets.map((b) => ({
            id: b.id,
            user_id: activeUserId,
            category_id: b.category_id,
            amount: Number(b.amount) || 0,
            period: b.period || 'monthly',
            created_at: b.created_at || new Date().toISOString(),
          }));
          await supabase.from('budgets').upsert(mappedBudgets);
        }

        if (recurring.length > 0) {
          const mappedRec = recurring.map((r) => ({
            id: r.id,
            user_id: activeUserId,
            type: r.type || 'expense',
            name: r.name,
            amount: Number(r.amount) || 0,
            category_id: r.category_id || null,
            payment_method_id: r.payment_method_id || null,
            frequency: r.frequency || 'monthly',
            billing_day: Number(r.billing_day || 1),
            next_due_date: r.next_due_date || null,
            is_active: r.is_active ? 1 : 0,
            created_at: r.created_at || new Date().toISOString(),
          }));
          await supabase.from('recurring_transactions').upsert(mappedRec);
        }
      } catch {}
    })();

    return true;
  } catch (err) {
    console.warn('[SupabaseSync] Sync error:', err);
    return false;
  }
}

/**
 * Restores user data from Supabase cloud into local database and web storage.
 */
export async function restoreDataFromSupabase(userId?: string, cachedCloudData?: any): Promise<boolean> {
  try {
    let cloudData = cachedCloudData;

    // Fetch fresh user metadata if not passed
    if (!cloudData) {
      const { data: userData } = await supabase.auth.getUser();
      cloudData = userData?.user?.user_metadata?.moolah_cloud_data;
    }

    const db = getDatabase();

    // 1. Try restoring from PostgREST tables if available
    let postgrestExpenses: any[] | null = null;
    try {
      const { data: expRows, error } = await supabase.from('expenses').select('*');
      if (!error && Array.isArray(expRows) && expRows.length > 0) {
        postgrestExpenses = expRows;
      }
    } catch {}

    const expensesToRestore = postgrestExpenses || cloudData?.expenses || [];

    // Ensure clean state before restoring so no previous user records linger
    db.execSync('DELETE FROM expenses;');

    if (Array.isArray(expensesToRestore) && expensesToRestore.length > 0) {
      for (const e of expensesToRestore) {
        if (!e.amount || Number(e.amount) <= 0) continue;
        if (e.id && String(e.id).startsWith('mock-')) continue;
        if ((!e.category_id || e.category_id === 'cat-other') && (!e.note || String(e.note).trim() === '')) continue;
        try {
          db.runSync(
            `INSERT OR REPLACE INTO expenses (id, type, amount, category_id, payment_method_id, note, receipt_image_uri, expense_date, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            e.id || 'exp-' + Math.random().toString(36).slice(2),
            e.type || 'expense',
            Number(e.amount) || 0,
            e.category_id || null,
            e.payment_method_id || null,
            e.note || null,
            e.receipt_image_uri || null,
            e.expense_date,
            e.created_at || new Date().toISOString(),
            e.updated_at || new Date().toISOString(),
          );
        } catch {}
      }
    }

    // Restore budgets
    if (cloudData?.budgets && Array.isArray(cloudData.budgets) && cloudData.budgets.length > 0) {
      for (const b of cloudData.budgets) {
        try {
          db.runSync(
            'INSERT OR REPLACE INTO budgets (id, category_id, amount, period) VALUES (?, ?, ?, ?)',
            b.id || 'b-' + Math.random().toString(36).slice(2),
            b.category_id,
            Number(b.amount) || 0,
            b.period || 'monthly',
          );
        } catch {}
      }
    }

    // Restore recurring transactions
    if (cloudData?.recurring_transactions && Array.isArray(cloudData.recurring_transactions) && cloudData.recurring_transactions.length > 0) {
      for (const r of cloudData.recurring_transactions) {
        try {
          db.runSync(
            `INSERT OR REPLACE INTO recurring_transactions (id, type, name, amount, category_id, payment_method_id, frequency, billing_day, next_due_date, is_active) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            r.id || 'rec-' + Math.random().toString(36).slice(2),
            r.type || 'expense',
            r.name,
            Number(r.amount) || 0,
            r.category_id || null,
            r.payment_method_id || null,
            r.frequency || 'monthly',
            Number(r.billing_day || 1),
            r.next_due_date || null,
            r.is_active ? 1 : 0,
          );
        } catch {}
      }
    }

    // Restore custom categories
    if (cloudData?.categories && Array.isArray(cloudData.categories) && cloudData.categories.length > 0) {
      for (const c of cloudData.categories) {
        try {
          db.runSync(
            `INSERT OR REPLACE INTO categories (id, name, icon, color, parent_id, sort_order, is_default, type) 
             VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
            c.id,
            c.name,
            c.icon,
            c.color,
            c.parent_id || null,
            c.sort_order || 99,
            c.type || 'expense',
          );
        } catch {}
      }
    }

    // Trigger UI refresh across the app
    useAppStore.getState().triggerRefresh();
    return true;
  } catch (err) {
    console.warn('[SupabaseSync] Restore error:', err);
    return false;
  }
}
