// ============================================================
// MoneyGuide — useRecurring Hook (Subscriptions & Bills)
// ============================================================
import { useState, useEffect, useCallback, useMemo } from 'react';
import { getDatabase } from '../db/client';
import { useAppStore } from '../stores/app-store';
import { generateId, getTodayISO } from '../lib/utils';
import type { RecurringTransaction } from '../lib/types';
import { parseISO, differenceInCalendarDays, addMonths, format } from 'date-fns';

export function useRecurring() {
  const [subscriptions, setSubscriptions] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const refreshKey = useAppStore((s) => s.refreshKey);
  const triggerRefresh = useAppStore((s) => s.triggerRefresh);

  const fetchSubscriptions = useCallback(() => {
    try {
      const db = getDatabase();
      const query = `
        SELECT 
          r.*,
          c.name as category_name,
          c.icon as category_icon,
          c.color as category_color,
          pm.name as payment_method_name
        FROM recurring_transactions r
        LEFT JOIN categories c ON r.category_id = c.id
        LEFT JOIN payment_methods pm ON r.payment_method_id = pm.id
        ORDER BY r.next_due_date ASC
      `;
      const rows = db.getAllSync<RecurringTransaction>(query);
      setSubscriptions(rows);
    } catch (err) {
      console.error('Failed to fetch recurring subscriptions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions, refreshKey]);

  // Compute monthly commitment total
  const monthlyTotal = useMemo(() => {
    return subscriptions
      .filter((s) => s.is_active === 1)
      .reduce((sum, s) => {
        if (s.frequency === 'yearly') return sum + s.amount / 12;
        if (s.frequency === 'weekly') return sum + s.amount * 4.33;
        return sum + s.amount;
      }, 0);
  }, [subscriptions]);

  // Sort and annotate upcoming
  const upcoming = useMemo(() => {
    const today = new Date();
    return subscriptions
      .filter((s) => s.is_active === 1)
      .map((sub) => {
        let dueDate: Date;
        try {
          dueDate = sub.next_due_date ? parseISO(sub.next_due_date) : today;
          if (isNaN(dueDate.getTime())) dueDate = today;
        } catch {
          dueDate = today;
        }
        const daysLeft = differenceInCalendarDays(dueDate, today);
        let dueLabel = '';
        if (daysLeft < 0) {
          dueLabel = `Overdue by ${Math.abs(daysLeft)}d`;
        } else if (daysLeft === 0) {
          dueLabel = 'Due today';
        } else if (daysLeft === 1) {
          dueLabel = 'Due tomorrow';
        } else {
          dueLabel = `In ${daysLeft} days`;
        }
        return {
          ...sub,
          daysLeft,
          dueLabel,
          isDueSoon: daysLeft <= 3,
        };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [subscriptions]);

  // Mark as paid: logs transaction and increments next due date
  const markAsPaid = useCallback(
    (sub: RecurringTransaction) => {
      try {
        const db = getDatabase();
        const expenseId = generateId();
        const todayStr = getTodayISO();

        // 1. Log transaction in expenses table
        db.runSync(
          `INSERT INTO expenses (id, type, amount, category_id, payment_method_id, note, expense_date) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          expenseId,
          sub.type,
          sub.amount,
          sub.category_id,
          sub.payment_method_id || null,
          `Subscription: ${sub.name}`,
          todayStr,
        );

        // 2. Advance next due date to next month / cycle
        const currentDue = parseISO(sub.next_due_date);
        const nextDue = addMonths(currentDue, sub.frequency === 'yearly' ? 12 : 1);
        const nextDueStr = format(nextDue, 'yyyy-MM-dd');

        db.runSync(
          'UPDATE recurring_transactions SET next_due_date = ? WHERE id = ?',
          nextDueStr,
          sub.id,
        );

        triggerRefresh();
        return true;
      } catch (err) {
        console.error('Failed to mark subscription as paid:', err);
        return false;
      }
    },
    [triggerRefresh],
  );

  const addSubscription = useCallback(
    (item: {
      name: string;
      amount: number;
      category_id: string;
      payment_method_id?: string | null;
      billing_day: number;
      frequency?: 'weekly' | 'monthly' | 'yearly';
    }) => {
      try {
        const db = getDatabase();
        const id = generateId();
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(item.billing_day).padStart(2, '0');
        const nextDueDate = `${year}-${month}-${day}`;

        db.runSync(
          `INSERT INTO recurring_transactions (id, type, name, amount, category_id, payment_method_id, frequency, billing_day, next_due_date, is_active)
           VALUES (?, 'expense', ?, ?, ?, ?, ?, ?, ?, 1)`,
          id,
          item.name,
          item.amount,
          item.category_id,
          item.payment_method_id || null,
          item.frequency || 'monthly',
          item.billing_day,
          nextDueDate,
        );
        triggerRefresh();
        return true;
      } catch (err) {
        console.error('Failed to add recurring subscription:', err);
        return false;
      }
    },
    [triggerRefresh],
  );

  const deleteSubscription = useCallback(
    (id: string) => {
      try {
        const db = getDatabase();
        db.runSync('DELETE FROM recurring_transactions WHERE id = ?', id);
        triggerRefresh();
        return true;
      } catch (err) {
        console.error('Failed to delete subscription:', err);
        return false;
      }
    },
    [triggerRefresh],
  );

  return {
    subscriptions,
    upcoming,
    monthlyTotal,
    loading,
    markAsPaid,
    addSubscription,
    deleteSubscription,
    refreshSubscriptions: fetchSubscriptions,
  };
}
