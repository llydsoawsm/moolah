// ============================================================
// MoneyGuide — useCategories Hook
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { getDatabase } from '../db/client';
import type { Category, CategoryWithSubs, TransactionType } from '../lib/types';

/**
 * Hook for category operations
 */
export function useCategories(typeFilter: 'expense' | 'income' | 'all' = 'all') {
  const [categories, setCategories] = useState<CategoryWithSubs[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = useCallback(() => {
    try {
      const db = getDatabase();
      const rows = db.getAllSync<Category>(
        'SELECT * FROM categories ORDER BY sort_order ASC, name ASC',
      );

      setAllCategories(rows);

      // Filter rows based on typeFilter
      const filteredRows = typeFilter === 'all' ? rows : rows.filter((c) => (c.type || 'expense') === typeFilter);

      // Build parent-child structure
      const parents = filteredRows.filter((c) => !c.parent_id);
      const withSubs: CategoryWithSubs[] = parents.map((parent) => ({
        ...parent,
        subcategories: filteredRows.filter((c) => c.parent_id === parent.id),
      }));

      setCategories(withSubs);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const expenseCategories = allCategories.filter((c) => (c.type || 'expense') === 'expense' && !c.parent_id);
  const incomeCategories = allCategories.filter((c) => c.type === 'income' && !c.parent_id);

  const getCategoryById = useCallback(
    (id: string): Category | undefined => {
      return allCategories.find((c) => c.id === id);
    },
    [allCategories],
  );

  const addCategory = useCallback(
    (name: string, icon: string, color: string, parentId?: string | null, type: TransactionType = 'expense') => {
      try {
        const db = getDatabase();
        const id = 'cat-' + Date.now();
        db.runSync(
          'INSERT INTO categories (id, name, icon, color, parent_id, sort_order, is_default, type) VALUES (?, ?, ?, ?, ?, 99, 0, ?)',
          id,
          name,
          icon,
          color,
          parentId || null,
          type,
        );
        fetchCategories();
        return id;
      } catch (err) {
        console.error('Failed to add category:', err);
      }
    },
    [fetchCategories],
  );

  const deleteCategory = useCallback(
    (id: string) => {
      try {
        const db = getDatabase();
        db.runSync('DELETE FROM categories WHERE id = ? AND is_default = 0', id);
        fetchCategories();
      } catch (err) {
        console.error('Failed to delete category:', err);
      }
    },
    [fetchCategories],
  );

  return {
    categories,
    allCategories,
    expenseCategories,
    incomeCategories,
    loading,
    getCategoryById,
    addCategory,
    deleteCategory,
    refetch: fetchCategories,
  };
}

