// ============================================================
// MoneyGuide — usePaymentMethods Hook
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { getDatabase } from '../db/client';
import type { PaymentMethod } from '../lib/types';

/**
 * Hook for payment method operations
 */
export function usePaymentMethods() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMethods = useCallback(() => {
    try {
      const db = getDatabase();
      const rows = db.getAllSync<PaymentMethod>(
        'SELECT * FROM payment_methods ORDER BY is_default DESC, name ASC',
      );
      setMethods(rows);
    } catch (err) {
      console.error('Failed to fetch payment methods:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMethods();
  }, [fetchMethods]);

  return { methods, loading, refetch: fetchMethods };
}
