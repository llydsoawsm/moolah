// ============================================================
// MoneyGuide — Minimalist Expense Detail Modal
// ============================================================
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { getDatabase } from '../../db/client';
import { useExpenses } from '../../hooks/useExpenses';
import { formatCurrency, getDateLabel, formatDate } from '../../lib/utils';
import type { ExpenseWithDetails } from '../../lib/types';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function ExpenseDetailModal() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { deleteExpense } = useExpenses();
  const [expense, setExpense] = useState<ExpenseWithDetails | null>(null);

  useEffect(() => {
    if (!id) return;
    try {
      const db = getDatabase();
      const row = db.getFirstSync<ExpenseWithDetails>(
        `SELECT 
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
        WHERE e.id = ?`,
        id,
      );
      setExpense(row || null);
    } catch (err) {
      console.error('Failed to load expense detail:', err);
    }
  }, [id]);

  const handleDelete = () => {
    if (!expense) return;
    Alert.alert('Delete Expense', 'Are you sure you want to delete this expense record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteExpense(expense.id);
          router.back();
        },
      },
    ]);
  };

  if (!expense) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Navigation Bar */}
        <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
          <TouchableOpacity
            style={[styles.navButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={18} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.navButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleDelete}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </TouchableOpacity>
        </Animated.View>

        {/* Minimalist Amount Hero */}
        <Animated.View entering={FadeInDown.duration(350).delay(80)} style={styles.hero}>
          <View
            style={[
              styles.typeBadge,
              { backgroundColor: expense.type === 'income' ? colors.success + '18' : colors.surfaceAlt },
            ]}
          >
            <Ionicons
              name={expense.type === 'income' ? 'arrow-down-circle' : 'arrow-up-circle'}
              size={13}
              color={expense.type === 'income' ? colors.success : colors.danger}
            />
            <Text
              style={[
                styles.typeBadgeText,
                { color: expense.type === 'income' ? colors.success : colors.textMuted },
              ]}
            >
              {expense.type === 'income' ? 'INCOME' : 'EXPENSE'}
            </Text>
          </View>

          <View
            style={[
              styles.heroIcon,
              { backgroundColor: expense.type === 'income' ? colors.success + '18' : colors.surfaceAlt },
            ]}
          >
            <Ionicons
              name={(expense.category_icon as any) || (expense.type === 'income' ? 'wallet' : 'ellipse')}
              size={24}
              color={expense.type === 'income' ? colors.success : colors.text}
            />
          </View>
          <Text
            style={[
              styles.heroAmount,
              { color: expense.type === 'income' ? colors.success : colors.text },
            ]}
          >
            {expense.type === 'income' ? '+' : '-'}{formatCurrency(expense.amount || 0)}
          </Text>
          <Text style={[styles.heroCategory, { color: colors.textSecondary }]}>
            {expense.parent_category_name
              ? `${expense.parent_category_name} → ${expense.category_name || 'Category'}`
              : (expense.category_name || (expense.type === 'income' ? 'Income' : 'General Expense'))}
          </Text>
        </Animated.View>

        {/* Inset Grouped Detail Card */}
        <Animated.View entering={FadeInDown.duration(350).delay(150)}>
          <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <DetailRow
              icon="calendar-outline"
              label="Date"
              value={formatDate(expense.expense_date, 'EEEE, MMM d, yyyy')}
              colors={colors}
            />
            <DetailRow
              icon="time-outline"
              label="Timeline"
              value={getDateLabel(expense.expense_date)}
              colors={colors}
              hasBorder
            />
            {expense.payment_method_name && (
              <DetailRow
                icon={(expense.payment_method_icon as any) || 'wallet-outline'}
                label={expense.type === 'income' ? 'Received via' : 'Payment'}
                value={expense.payment_method_name}
                colors={colors}
                hasBorder
              />
            )}
            {expense.note ? (
              <DetailRow
                icon="document-text-outline"
                label="Note"
                value={expense.note}
                colors={colors}
                hasBorder
              />
            ) : null}
          </View>
        </Animated.View>

        {/* Receipt Attachment */}
        {expense.receipt_image_uri && (
          <Animated.View entering={FadeInDown.duration(350).delay(220)} style={styles.receiptSection}>
            <Text style={[styles.receiptLabel, { color: colors.textMuted }]}>RECEIPT</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() =>
                router.push({
                  pathname: '/(modals)/receipt-viewer',
                  params: { uri: expense.receipt_image_uri },
                })
              }
              style={[styles.receiptContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Image
                source={{ uri: expense.receipt_image_uri }}
                style={styles.receiptImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          </Animated.View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

function DetailRow({
  icon,
  label,
  value,
  colors,
  hasBorder,
}: {
  icon: string;
  label: string;
  value: string;
  colors: any;
  hasBorder?: boolean;
}) {
  return (
    <View
      style={[
        styles.detailRow,
        hasBorder && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
      ]}
    >
      <View style={styles.detailLeft}>
        <Ionicons name={icon as any} size={16} color={colors.textMuted} />
        <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{label}</Text>
      </View>
      <Text style={[styles.detailValue, { color: colors.text }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    marginBottom: 28,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    marginBottom: 12,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroAmount: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -1,
  },
  heroCategory: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
  detailCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '400',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    maxWidth: '60%',
    textAlign: 'right',
  },
  receiptSection: {
    marginBottom: 20,
  },
  receiptLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  receiptContainer: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  receiptImage: {
    width: '100%',
    height: 260,
  },
  bottomSpacer: {
    height: 30,
  },
});
