// ============================================================
// MoneyGuide — useAnalytics Hook
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { format, subDays, startOfWeek, startOfMonth, subMonths } from 'date-fns';
import { getDatabase } from '../db/client';
import { useAppStore } from '../stores/app-store';
import type { CashFlowSummary, CategorySpending, DailySpending, DailyCashFlow } from '../lib/types';

/**
 * Hook for analytics queries and aggregations
 */
export function useAnalytics() {
  const [summary, setSummary] = useState<CashFlowSummary>({
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
    incomeToday: 0,
    incomeThisWeek: 0,
    incomeThisMonth: 0,
    expenseToday: 0,
    expenseThisWeek: 0,
    expenseThisMonth: 0,
    netToday: 0,
    netThisWeek: 0,
    netThisMonth: 0,
  });
  const [categorySpending, setCategorySpending] = useState<CategorySpending[]>([]);
  const [spendingTrend, setSpendingTrend] = useState<DailySpending[]>([]);
  const [cashFlowTrend, setCashFlowTrend] = useState<DailyCashFlow[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshKey = useAppStore((s) => s.refreshKey);
  const period = useAppStore((s) => s.analyticsPeriod);
  const mode = useAppStore((s) => s.analyticsMode);

  const fetchSummary = useCallback(() => {
    try {
      const db = getDatabase();
      const today = format(new Date(), 'yyyy-MM-dd');
      const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');

      const todayResult = db.getFirstSync<{ income: number; expense: number }>(
        `SELECT 
          COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
          COALESCE(SUM(CASE WHEN type != 'income' THEN amount ELSE 0 END), 0) as expense
        FROM expenses WHERE expense_date = ?`,
        today,
      );

      const weekResult = db.getFirstSync<{ income: number; expense: number }>(
        `SELECT 
          COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
          COALESCE(SUM(CASE WHEN type != 'income' THEN amount ELSE 0 END), 0) as expense
        FROM expenses WHERE expense_date >= ?`,
        weekStart,
      );

      const monthResult = db.getFirstSync<{ income: number; expense: number }>(
        `SELECT 
          COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
          COALESCE(SUM(CASE WHEN type != 'income' THEN amount ELSE 0 END), 0) as expense
        FROM expenses WHERE expense_date >= ?`,
        monthStart,
      );

      const incomeToday = todayResult?.income || 0;
      const expenseToday = todayResult?.expense || 0;
      const incomeThisWeek = weekResult?.income || 0;
      const expenseThisWeek = weekResult?.expense || 0;
      const incomeThisMonth = monthResult?.income || 0;
      const expenseThisMonth = monthResult?.expense || 0;

      setSummary({
        today: expenseToday,
        thisWeek: expenseThisWeek,
        thisMonth: expenseThisMonth,
        incomeToday,
        incomeThisWeek,
        incomeThisMonth,
        expenseToday,
        expenseThisWeek,
        expenseThisMonth,
        netToday: incomeToday - expenseToday,
        netThisWeek: incomeThisWeek - expenseThisWeek,
        netThisMonth: incomeThisMonth - expenseThisMonth,
      });
    } catch (err) {
      console.error('Failed to fetch summary:', err);
    }
  }, []);

  const fetchCategoryBreakdown = useCallback(() => {
    try {
      const db = getDatabase();
      const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const targetType = mode === 'income' ? 'income' : 'expense';

      const rows = db.getAllSync<{
        category_id: string;
        category_name: string;
        category_icon: string;
        category_color: string;
        total: number;
        count: number;
      }>(
        `SELECT 
          COALESCE(pc.id, c.id) as category_id,
          COALESCE(pc.name, c.name) as category_name,
          COALESCE(pc.icon, c.icon) as category_icon,
          COALESCE(pc.color, c.color) as category_color,
          SUM(e.amount) as total,
          COUNT(*) as count
        FROM expenses e
        LEFT JOIN categories c ON e.category_id = c.id
        LEFT JOIN categories pc ON c.parent_id = pc.id
        WHERE e.expense_date >= ? AND ${targetType === 'income' ? "e.type = 'income'" : "e.type != 'income'"}
        GROUP BY COALESCE(pc.id, c.id)
        ORDER BY total DESC`,
        monthStart,
      );

      const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);

      const items: CategorySpending[] = rows.map((r) => ({
        ...r,
        percentage: grandTotal > 0 ? (r.total / grandTotal) * 100 : 0,
      }));

      setCategorySpending(items);
    } catch (err) {
      console.error('Failed to fetch category breakdown:', err);
    }
  }, [mode]);

  const fetchTrends = useCallback(() => {
    try {
      const db = getDatabase();
      let startDate: string;
      let groupFormat: string;

      if (period === 'daily') {
        startDate = format(subDays(new Date(), 13), 'yyyy-MM-dd');
        groupFormat = 'expense_date';
      } else if (period === 'weekly') {
        startDate = format(subDays(new Date(), 55), 'yyyy-MM-dd');
        groupFormat = "strftime('%Y-W%W', expense_date)";
      } else {
        startDate = format(subMonths(new Date(), 5), 'yyyy-MM-01');
        groupFormat = "strftime('%Y-%m', expense_date)";
      }

      if (mode === 'cashflow') {
        const rows = db.getAllSync<DailyCashFlow>(
          `SELECT 
            ${groupFormat} as date,
            COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
            COALESCE(SUM(CASE WHEN type != 'income' THEN amount ELSE 0 END), 0) as expense,
            COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as net
           FROM expenses
           WHERE expense_date >= ?
           GROUP BY ${groupFormat}
           ORDER BY date ASC`,
          startDate,
        );
        setCashFlowTrend(rows);
        setSpendingTrend(rows.map((r) => ({ date: r.date, total: r.expense })));
      } else {
        const typeCondition = mode === 'income' ? "type = 'income'" : "type != 'income'";
        const rows = db.getAllSync<DailySpending>(
          `SELECT ${groupFormat} as date, COALESCE(SUM(amount), 0) as total
           FROM expenses
           WHERE expense_date >= ? AND ${typeCondition}
           GROUP BY ${groupFormat}
           ORDER BY date ASC`,
          startDate,
        );
        setSpendingTrend(rows);
      }
    } catch (err) {
      console.error('Failed to fetch trends:', err);
    }
  }, [period, mode]);

  useEffect(() => {
    setLoading(true);
    fetchSummary();
    fetchCategoryBreakdown();
    fetchTrends();
    setLoading(false);
  }, [fetchSummary, fetchCategoryBreakdown, fetchTrends, refreshKey]);

  return { summary, categorySpending, spendingTrend, cashFlowTrend, loading, mode, period };
}
