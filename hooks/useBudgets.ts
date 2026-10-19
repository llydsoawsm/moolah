// ============================================================
// MoneyGuide — useBudgets Hook
// ============================================================
import { useState, useEffect, useCallback, useMemo } from 'react';
import { getDatabase } from '../db/client';
import { useAppStore } from '../stores/app-store';
import { generateId } from '../lib/utils';
import type { BudgetWithSpending } from '../lib/types';

export function useBudgets() {
  const [budgets, setBudgets] = useState<BudgetWithSpending[]>([]);
  const [loading, setLoading] = useState(true);
  const refreshKey = useAppStore((s) => s.refreshKey);
  const triggerRefresh = useAppStore((s) => s.triggerRefresh);

  const fetchBudgets = useCallback(() => {
    try {
      const db = getDatabase();
      const query = `
        SELECT 
          b.id,
          b.category_id,
          b.amount,
          b.period,
          b.created_at,
          b.updated_at,
          c.name as category_name,
          c.icon as category_icon,
          c.color as category_color,
          COALESCE(
            (
              SELECT SUM(e.amount) 
              FROM expenses e 
              WHERE (e.category_id = b.category_id OR e.category_id IN (SELECT id FROM categories WHERE parent_id = b.category_id))
                AND e.type = 'expense'
                AND strftime('%Y-%m', e.expense_date) = strftime('%Y-%m', 'now')
            ), 0
          ) as spent
        FROM budgets b
        JOIN categories c ON b.category_id = c.id
        ORDER BY b.amount DESC
      `;
      const rows = db.getAllSync<any>(query);

      const mapped: BudgetWithSpending[] = rows.map((r) => {
        const spent = Number(r.spent) || 0;
        const amount = Number(r.amount) || 0;
        const remaining = Math.max(0, amount - spent);
        const percentage = amount > 0 ? Math.round((spent / amount) * 100) : 0;
        return {
          id: r.id,
          category_id: r.category_id,
          amount,
          period: r.period || 'monthly',
          created_at: r.created_at,
          updated_at: r.updated_at,
          category_name: r.category_name,
          category_icon: r.category_icon,
          category_color: r.category_color,
          spent,
          remaining,
          percentage,
        };
      });

      setBudgets(mapped);
    } catch (err) {
      console.error('Failed to fetch budgets:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets, refreshKey]);

  const saveBudget = useCallback(
    (categoryId: string, amount: number) => {
      try {
        const db = getDatabase();
        const existing = db.getFirstSync<{ id: string }>(
          'SELECT id FROM budgets WHERE category_id = ?',
          categoryId,
        );

        if (existing) {
          db.runSync(
            "UPDATE budgets SET amount = ?, updated_at = datetime('now') WHERE id = ?",
            amount,
            existing.id,
          );
        } else {
          const id = generateId();
          db.runSync(
            'INSERT INTO budgets (id, category_id, amount, period) VALUES (?, ?, ?, ?)',
            id,
            categoryId,
            amount,
            'monthly',
          );
        }
        triggerRefresh();
        return true;
      } catch (err) {
        console.error('Failed to save budget:', err);
        return false;
      }
    },
    [triggerRefresh],
  );

  const deleteBudget = useCallback(
    (id: string) => {
      try {
        const db = getDatabase();
        db.runSync('DELETE FROM budgets WHERE id = ?', id);
        triggerRefresh();
        return true;
      } catch (err) {
        console.error('Failed to delete budget:', err);
        return false;
      }
    },
    [triggerRefresh],
  );

  const totals = useMemo(() => {
    const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
    const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
    const totalRemaining = Math.max(0, totalBudget - totalSpent);
    const overallPercentage = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
    return {
      totalBudget,
      totalSpent,
      totalRemaining,
      overallPercentage,
    };
  }, [budgets]);

  return {
    budgets,
    totals,
    loading,
    saveBudget,
    deleteBudget,
    refreshBudgets: fetchBudgets,
  };
}
