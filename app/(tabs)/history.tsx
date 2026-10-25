// ============================================================
// MoneyGuide — Minimalist Transaction History Screen
// ============================================================
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { useExpenses } from '../../hooks/useExpenses';
import { formatCurrency, getDateLabel, groupBy } from '../../lib/utils';
import type { ExpenseWithDetails } from '../../lib/types';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function HistoryScreen() {
  const { colors } = useTheme();
  const { expenses, deleteExpense } = useExpenses();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all');

  const allCount = expenses.length;
  const expenseCount = useMemo(() => expenses.filter((e) => e.type !== 'income').length, [expenses]);
  const incomeCount = useMemo(() => expenses.filter((e) => e.type === 'income').length, [expenses]);

  // Filter expenses by search query and type
  const filtered = useMemo(() => {
    let list = expenses;
    if (filterType !== 'all') {
      list = list.filter((e) => (filterType === 'income' ? e.type === 'income' : e.type !== 'income'));
    }
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (e) =>
        e.category_name?.toLowerCase().includes(q) ||
        e.note?.toLowerCase().includes(q) ||
        e.payment_method_name?.toLowerCase().includes(q),
    );
  }, [expenses, search, filterType]);

  // Group by date
  const grouped = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const groups = groupBy(filtered, (e) =>
      e.expense_date && e.expense_date !== 'undefined' ? e.expense_date : todayStr,
    );
    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, items]) => {
        const net = items.reduce(
          (s, e) => s + (e.type === 'income' ? (Number(e.amount) || 0) : -(Number(e.amount) || 0)),
          0,
        );
        const totalAmount = items.reduce((s, e) => s + (Number(e.amount) || 0), 0);
        const rawLabel = getDateLabel(date);
        const label = rawLabel && rawLabel !== 'undefined' ? rawLabel : 'Recent';
        return {
          date,
          label,
          net,
          totalAmount,
          data: items,
        };
      });
  }, [filtered]);

  const handleDelete = useCallback(
    (id: string, name: string) => {
      Alert.alert('Delete Record', `Are you sure you want to delete this ${name} transaction?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteExpense(id),
        },
      ]);
    },
    [deleteExpense],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Minimalist Top Header */}
      <Animated.View entering={FadeInDown.duration(350)} style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>History</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {filtered.length} transaction{filtered.length !== 1 ? 's' : ''}
        </Text>
      </Animated.View>

      {/* Minimalist Search Bar */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search transactions..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Quick Filter Pills (All / Expenses / Income) */}
        <View style={styles.filterPillsRow}>
          <TouchableOpacity
            style={[
              styles.filterPill,
              {
                backgroundColor: filterType === 'all' ? colors.text : colors.surface,
                borderColor: colors.border,
              },
            ]}
            onPress={() => setFilterType('all')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterPillText,
                { color: filterType === 'all' ? colors.background : colors.textMuted },
              ]}
            >
              All ({allCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterPill,
              {
                backgroundColor: filterType === 'expense' ? colors.text : colors.surface,
                borderColor: colors.border,
              },
            ]}
            onPress={() => setFilterType('expense')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="arrow-up-circle-outline"
              size={13}
              color={filterType === 'expense' ? colors.background : colors.danger}
            />
            <Text
              style={[
                styles.filterPillText,
                { color: filterType === 'expense' ? colors.background : colors.textMuted },
              ]}
            >
              Expenses ({expenseCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterPill,
              {
                backgroundColor: filterType === 'income' ? colors.text : colors.surface,
                borderColor: colors.border,
              },
            ]}
            onPress={() => setFilterType('income')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="arrow-down-circle-outline"
              size={13}
              color={filterType === 'income' ? colors.background : colors.success}
            />
            <Text
              style={[
                styles.filterPillText,
                { color: filterType === 'income' ? colors.background : colors.textMuted },
              ]}
            >
              Income ({incomeCount})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* List */}
      {grouped.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="receipt-outline" size={36} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {search ? 'No matches' : 'No transactions'}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            {search ? 'Try searching another keyword' : 'Recorded transactions will appear here'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={grouped}
          keyExtractor={(item) => item.date}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: group }) => (
            <View style={styles.dateGroup}>
              {/* Date Header */}
              <View style={styles.dateHeader}>
                <Text style={[styles.dateLabel, { color: colors.textMuted }]}>
                  {group.label.toUpperCase()}
                </Text>
                <Text
                  style={[
                    styles.dateTotal,
                    {
                      color:
                        filterType === 'income'
                          ? colors.success
                          : filterType === 'expense'
                          ? colors.textSecondary
                          : group.net >= 0
                          ? colors.success
                          : colors.danger,
                    },
                  ]}
                >
                  {filterType === 'income'
                    ? `+${formatCurrency(group.totalAmount)}`
                    : filterType === 'expense'
                    ? `-${formatCurrency(group.totalAmount)}`
                    : `${group.net >= 0 ? '+' : ''}${formatCurrency(group.net)}`}
                </Text>
              </View>

              {/* Grouped Inset Card */}
              <View style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {group.data.map((expense, index) => {
                  const isLast = index === group.data.length - 1;
                  const isIncome = expense.type === 'income';
                  return (
                    <TouchableOpacity
                      key={expense.id}
                      style={[
                        styles.expenseRow,
                        !isLast && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
                      ]}
                      onPress={() =>
                        router.push({
                          pathname: '/(modals)/expense-detail',
                          params: { id: expense.id },
                        })
                      }
                      onLongPress={() => handleDelete(expense.id, expense.category_name)}
                      activeOpacity={0.65}
                    >
                      <View
                        style={[
                          styles.iconCircle,
                          { backgroundColor: isIncome ? colors.success + '18' : colors.surfaceAlt },
                        ]}
                      >
                        <Ionicons
                          name={(expense.category_icon as any) || (isIncome ? 'wallet-outline' : 'pricetag-outline')}
                          size={15}
                          color={isIncome ? colors.success : colors.textSecondary}
                        />
                      </View>
                      <View style={styles.expenseInfo}>
                        <Text style={[styles.expenseName, { color: colors.text }]}>
                          {expense.category_name || (isIncome ? 'Income' : 'General Expense')}
                        </Text>
                        <Text style={[styles.expenseMeta, { color: colors.textMuted }]}>
                          {[expense.payment_method_name, expense.note]
                            .filter(Boolean)
                            .join(' · ') || (isIncome ? 'Income' : 'Expense')}
                        </Text>
                      </View>
                      <View style={styles.expenseRight}>
                        <Text
                          style={[
                            styles.expenseAmount,
                            { color: isIncome ? colors.success : colors.text },
                          ]}
                        >
                          {isIncome ? '+' : '-'}{formatCurrency(expense.amount)}
                        </Text>
                        {expense.receipt_image_uri && (
                          <Ionicons
                            name="attach"
                            size={12}
                            color={colors.textMuted}
                            style={{ marginTop: 2 }}
                          />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 5,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 80,
  },
  dateGroup: {
    marginBottom: 20,
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  dateLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  dateTotal: {
    fontSize: 12,
    fontWeight: '500',
  },
  groupCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  expenseInfo: {
    flex: 1,
  },
  expenseName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  expenseMeta: {
    fontSize: 12,
    fontWeight: '400',
  },
  expenseRight: {
    alignItems: 'flex-end',
  },
  expenseAmount: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    marginTop: 4,
  },
});
