// ============================================================
// MoneyGuide — useExpenses Hook
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { getDatabase } from '../db/client';
import { useAppStore } from '../stores/app-store';
import { generateId, getTodayISO } from '../lib/utils';
import { syncDataToSupabase } from '../lib/supabase-sync';
import type { ExpenseWithDetails, ExpenseFormData } from '../lib/types';

/**
 * Hook for expense / income CRUD operations
 */
export function useExpenses(limit?: number, typeFilter: 'all' | 'expense' | 'income' = 'all') {
  const [expenses, setExpenses] = useState<ExpenseWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const refreshKey = useAppStore((s) => s.refreshKey);
  const triggerRefresh = useAppStore((s) => s.triggerRefresh);

  const fetchExpenses = useCallback(() => {
    try {
      const db = getDatabase();
      const whereClause = typeFilter !== 'all' ? `WHERE e.type = '${typeFilter}'` : '';
      const query = `
        SELECT 
          e.*,
          c.name as category_name,
          c.icon as category_icon,
          c.color as category_color,
          pc.name as parent_category_name,
          pm.name as payment_method_name,
          pm.icon as payment_method_icon
        FROM expenses e
        LEFT JOIN categories c ON e.category_id = c.id
        LEFT JOIN categories pc ON c.parent_id = pc.id
        LEFT JOIN payment_methods pm ON e.payment_method_id = pm.id
        ${whereClause}
        ORDER BY e.expense_date DESC, e.created_at DESC
        ${limit ? `LIMIT ${limit}` : ''}
      `;
      const rows = db.getAllSync<ExpenseWithDetails>(query);
      setExpenses(rows);
    } catch (err) {
      console.error('Failed to fetch expenses:', err);
    } finally {
      setLoading(false);
    }
  }, [limit, typeFilter]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses, refreshKey]);

  const addExpense = useCallback(
    (data: ExpenseFormData) => {
      try {
        const db = getDatabase();
        const id = generateId();
        const dateStr =
          data.expense_date instanceof Date
            ? data.expense_date.toISOString().split('T')[0]
            : (typeof data.expense_date === 'string' && data.expense_date ? data.expense_date.split('T')[0] : getTodayISO());
        const type = data.type || 'expense';

        db.runSync(
          `INSERT INTO expenses (id, type, amount, category_id, payment_method_id, note, receipt_image_uri, expense_date) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          id,
          type,
          parseFloat(data.amount) || 0,
          data.category_id,
          data.payment_method_id,
          data.note || null,
          data.receipt_image_uri || null,
          dateStr,
        );

        triggerRefresh();
        syncDataToSupabase();
        return id;
      } catch (err) {
        console.error('Failed to add transaction:', err);
        return null;
      }
    },
    [triggerRefresh],
  );

  const updateExpense = useCallback(
    (id: string, data: Partial<ExpenseFormData>) => {
      try {
        const db = getDatabase();
        const sets: string[] = [];
        const values: any[] = [];

        if (data.type !== undefined) {
          sets.push('type = ?');
          values.push(data.type);
        }
        if (data.amount !== undefined) {
          sets.push('amount = ?');
          values.push(parseFloat(data.amount) || 0);
        }
        if (data.category_id !== undefined) {
          sets.push('category_id = ?');
          values.push(data.category_id);
        }
        if (data.payment_method_id !== undefined) {
          sets.push('payment_method_id = ?');
          values.push(data.payment_method_id);
        }
        if (data.note !== undefined) {
          sets.push('note = ?');
          values.push(data.note || null);
        }
        if (data.receipt_image_uri !== undefined) {
          sets.push('receipt_image_uri = ?');
          values.push(data.receipt_image_uri || null);
        }
        if (data.expense_date !== undefined) {
          sets.push('expense_date = ?');
          values.push(
            data.expense_date instanceof Date
              ? data.expense_date.toISOString().split('T')[0]
              : (typeof data.expense_date === 'string' && data.expense_date ? data.expense_date.split('T')[0] : getTodayISO()),
          );
        }

        if (sets.length > 0) {
          sets.push("updated_at = datetime('now')");
          values.push(id);
          db.runSync(`UPDATE expenses SET ${sets.join(', ')} WHERE id = ?`, ...values);
          triggerRefresh();
          syncDataToSupabase();
        }
      } catch (err) {
        console.error('Failed to update transaction:', err);
      }
    },
    [triggerRefresh],
  );

  const deleteExpense = useCallback(
    (id: string) => {
      try {
        const db = getDatabase();
        db.runSync('DELETE FROM expenses WHERE id = ?', id);
        triggerRefresh();
        syncDataToSupabase();
      } catch (err) {
        console.error('Failed to delete transaction:', err);
      }
    },
    [triggerRefresh],
  );

  const truncateExpenses = useCallback(() => {
    try {
      const db = getDatabase();
      db.execSync('DELETE FROM expenses;');
      triggerRefresh();
      syncDataToSupabase();
    } catch (err) {
      console.error('Failed to truncate transactions:', err);
    }
  }, [triggerRefresh]);

  return { expenses, loading, addExpense, updateExpense, deleteExpense, truncateExpenses, refetch: fetchExpenses };
}
