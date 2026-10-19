// ============================================================
// MoneyGuide — Minimalist Dashboard / Home Screen
// ============================================================
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useExpenses } from '../../hooks/useExpenses';
import { useBudgets } from '../../hooks/useBudgets';
import { useRecurring } from '../../hooks/useRecurring';
import * as Haptics from 'expo-haptics';
import { formatCurrency, getDateLabel } from '../../lib/utils';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function DashboardScreen() {
  const { colors } = useTheme();
  const { summary, categorySpending, loading: analyticsLoading } = useAnalytics();
  const { expenses, loading: expensesLoading } = useExpenses(10);
  const { totals: budgetTotals, budgets } = useBudgets();
  const { upcoming, markAsPaid } = useRecurring();
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  const todayDateString = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.textSecondary}
          />
        }
      >
        {/* Minimalist Top Bar */}
        <Animated.View entering={FadeInDown.duration(350)} style={styles.header}>
          <View>
            <Text style={[styles.dateLabel, { color: colors.textMuted }]}>
              {todayDateString.toUpperCase()}
            </Text>
            <Text style={[styles.appTitle, { color: colors.text }]}>Overview</Text>
          </View>
          <TouchableOpacity
            style={[styles.profileButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/(tabs)/settings')}
            activeOpacity={0.7}
          >
            <Ionicons name="person-outline" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </Animated.View>

        {/* Minimalist Hero Net Balance & Cash Flow Card */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(80)}
          style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={styles.heroTop}>
            <Text style={[styles.heroLabel, { color: colors.textMuted }]}>
              NET BALANCE THIS MONTH
            </Text>
            <Text
              style={[
                styles.heroAmount,
                { color: summary.netThisMonth >= 0 ? colors.text : colors.danger },
              ]}
            >
              {summary.netThisMonth >= 0 ? '+' : ''}{formatCurrency(summary.netThisMonth)}
            </Text>

            {/* Income & Expense Side-by-Side Pill Badges */}
            <View style={styles.flowPillsRow}>
              <View style={[styles.flowPill, { backgroundColor: colors.surfaceAlt }]}>
                <Ionicons name="arrow-down-circle" size={14} color={colors.success} />
                <Text style={[styles.flowPillLabel, { color: colors.textMuted }]}>Income</Text>
                <Text style={[styles.flowPillValue, { color: colors.success }]}>
                  +{formatCurrency(summary.incomeThisMonth)}
                </Text>
              </View>

              <View style={[styles.flowPill, { backgroundColor: colors.surfaceAlt }]}>
                <Ionicons name="arrow-up-circle" size={14} color={colors.danger} />
                <Text style={[styles.flowPillLabel, { color: colors.textMuted }]}>Expenses</Text>
                <Text style={[styles.flowPillValue, { color: colors.danger }]}>
                  -{formatCurrency(summary.expenseThisMonth)}
                </Text>
              </View>
            </View>
          </View>

          {/* Subdued Divider */}
          <View style={[styles.cardDivider, { backgroundColor: colors.border }]} />

          {/* Subdued Stat Row */}
          <View style={styles.statRow}>
            <View style={styles.statColumn}>
              <Text style={[styles.subStatLabel, { color: colors.textMuted }]}>NET TODAY</Text>
              <Text
                style={[
                  styles.subStatAmount,
                  { color: summary.netToday >= 0 ? colors.text : colors.danger },
                ]}
              >
                {summary.netToday >= 0 ? '+' : ''}{formatCurrency(summary.netToday)}
              </Text>
            </View>

            <View style={[styles.verticalDivider, { backgroundColor: colors.border }]} />

            <View style={styles.statColumn}>
              <Text style={[styles.subStatLabel, { color: colors.textMuted }]}>NET THIS WEEK</Text>
              <Text
                style={[
                  styles.subStatAmount,
                  { color: summary.netThisWeek >= 0 ? colors.text : colors.danger },
                ]}
              >
                {summary.netThisWeek >= 0 ? '+' : ''}{formatCurrency(summary.netThisWeek)}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Monthly Budget Tracker Card */}
        {budgetTotals.totalBudget > 0 && (
          <Animated.View
            entering={FadeInDown.duration(400).delay(120)}
            style={[styles.budgetWidgetCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={styles.budgetWidgetHeader}>
              <View>
                <Text style={[styles.budgetWidgetLabel, { color: colors.textMuted }]}>
                  MONTHLY BUDGET
                </Text>
                <Text style={[styles.budgetWidgetAmount, { color: colors.text }]}>
                  {formatCurrency(budgetTotals.totalSpent)}
                  <Text style={[styles.budgetWidgetTotal, { color: colors.textMuted }]}>
                    {' '}/ {formatCurrency(budgetTotals.totalBudget)}
                  </Text>
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.budgetManageBtn, { backgroundColor: colors.surfaceAlt }]}
                onPress={() => router.push('/(modals)/budget-manager')}
                activeOpacity={0.7}
              >
                <Text style={[styles.budgetManageText, { color: colors.textSecondary }]}>
                  Manage
                </Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Progress track */}
            <View style={[styles.progressTrack, { backgroundColor: colors.surfaceAlt }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(budgetTotals.overallPercentage, 100)}%`,
                    backgroundColor:
                      budgetTotals.overallPercentage >= 100
                        ? colors.danger
                        : budgetTotals.overallPercentage >= 80
                        ? colors.warning
                        : colors.primary,
                  },
                ]}
              />
            </View>

            <View style={styles.budgetFooterRow}>
              <Text style={[styles.budgetFooterText, { color: colors.textMuted }]}>
                {budgetTotals.overallPercentage}% of monthly limit
              </Text>
              <Text
                style={[
                  styles.budgetFooterText,
                  {
                    color: budgetTotals.totalRemaining > 0 ? colors.success : colors.danger,
                    fontWeight: '600',
                  },
                ]}
              >
                {budgetTotals.totalRemaining > 0
                  ? `${formatCurrency(budgetTotals.totalRemaining)} remaining`
                  : 'Over budget'}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Upcoming Subscriptions & Bills Widget */}
        {upcoming.length > 0 && (
          <Animated.View entering={FadeInDown.duration(400).delay(140)} style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <View style={styles.rowAlign}>
                <Ionicons name="repeat" size={15} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Upcoming Bills</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/(modals)/recurring-manager')}>
                <Text style={[styles.seeAllText, { color: colors.textMuted }]}>Manage</Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.billsScroll}>
              {upcoming.slice(0, 4).map((bill) => {
                const isUrgent = bill.daysLeft <= 3;
                return (
                  <View
                    key={bill.id}
                    style={[
                      styles.billChip,
                      {
                        backgroundColor: colors.surface,
                        borderColor: isUrgent ? `${colors.warning}80` : colors.border,
                      },
                    ]}
                  >
                    <View style={styles.billChipTop}>
                      <View
                        style={[
                          styles.billIconCircle,
                          { backgroundColor: `${bill.category_color || colors.primary}20` },
                        ]}
                      >
                        <Ionicons
                          name={(bill.category_icon as any) || 'calendar'}
                          size={14}
                          color={bill.category_color || colors.primary}
                        />
                      </View>
                      <View
                        style={[
                          styles.chipDueBadge,
                          {
                            backgroundColor: isUrgent
                              ? `${colors.warning}20`
                              : colors.surfaceAlt,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipDueText,
                            {
                              color: isUrgent ? colors.warning : colors.textMuted,
                            },
                          ]}
                        >
                          {bill.dueLabel}
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.billName, { color: colors.text }]} numberOfLines={1}>
                      {bill.name}
                    </Text>
                    <Text style={[styles.billAmount, { color: colors.text }]}>
                      {formatCurrency(bill.amount)}
                    </Text>

                    <TouchableOpacity
                      style={[styles.quickPayBtn, { backgroundColor: colors.surfaceAlt }]}
                      onPress={() => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        markAsPaid(bill);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="checkmark-circle-outline" size={13} color={colors.success} />
                      <Text style={[styles.quickPayText, { color: colors.text }]}>Mark Paid</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          </Animated.View>
        )}

        {/* Top Categories */}
        {categorySpending.length > 0 && (
          <Animated.View entering={FadeInDown.duration(400).delay(150)} style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Top Categories</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/analytics')}>
                <Text style={[styles.seeAllText, { color: colors.textMuted }]}>See details</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.groupedList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {categorySpending.slice(0, 3).map((cat, index) => {
                const isLast = index === Math.min(categorySpending.length, 3) - 1;
                return (
                  <View
                    key={cat.category_id}
                    style={[
                      styles.categoryRow,
                      !isLast && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
                    ]}
                  >
                    <View style={[styles.catIconCircle, { backgroundColor: cat.category_color + '18' }]}>
                      <Ionicons
                        name={(cat.category_icon as any) || 'ellipse'}
                        size={16}
                        color={cat.category_color}
                      />
                    </View>
                    <View style={styles.catDetails}>
                      <View style={styles.catNameRow}>
                        <Text style={[styles.catName, { color: colors.text }]}>
                          {cat.category_name}
                        </Text>
                        <Text style={[styles.catAmount, { color: colors.text }]}>
                          {formatCurrency(cat.total)}
                        </Text>
                      </View>
                      <View style={[styles.progressBarTrack, { backgroundColor: colors.surfaceAlt }]}>
                        <View
                          style={[
                            styles.progressBarFill,
                            {
                              backgroundColor: cat.category_color,
                              width: `${Math.min(cat.percentage, 100)}%`,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* Recent Transactions */}
        <Animated.View entering={FadeInDown.duration(400).delay(220)} style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Activity</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/history')}>
              <Text style={[styles.seeAllText, { color: colors.textMuted }]}>View all</Text>
            </TouchableOpacity>
          </View>

          {expenses.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="receipt-outline" size={32} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No activity yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                Add income or expenses to track your balance
              </Text>
            </View>
          ) : (
            <View style={[styles.groupedList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {expenses.slice(0, 5).map((expense, idx) => {
                const isLast = idx === Math.min(expenses.length, 5) - 1;
                const isIncome = expense.type === 'income';
                return (
                  <TouchableOpacity
                    key={expense.id}
                    style={[
                      styles.transactionRow,
                      !isLast && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
                    ]}
                    onPress={() =>
                      router.push({
                        pathname: '/(modals)/expense-detail',
                        params: { id: expense.id },
                      })
                    }
                    activeOpacity={0.65}
                  >
                    <View
                      style={[
                        styles.txIconCircle,
                        { backgroundColor: isIncome ? colors.success + '18' : colors.surfaceAlt },
                      ]}
                    >
                      <Ionicons
                        name={(expense.category_icon as any) || (isIncome ? 'wallet-outline' : 'pricetag-outline')}
                        size={16}
                        color={isIncome ? colors.success : colors.textSecondary}
                      />
                    </View>
                    <View style={styles.txInfo}>
                      <Text style={[styles.txName, { color: colors.text }]}>
                        {expense.category_name}
                      </Text>
                      <Text style={[styles.txDate, { color: colors.textMuted }]}>
                        {expense.note || getDateLabel(expense.expense_date)}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.txAmount,
                        { color: isIncome ? colors.success : colors.text },
                      ]}
                    >
                      {isIncome ? '+' : '-'}{formatCurrency(expense.amount)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </Animated.View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 54,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  dateLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  appTitle: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  profileButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    marginBottom: 26,
  },
  heroTop: {
    marginBottom: 16,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  heroAmount: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -1,
  },
  flowPillsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  flowPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  flowPillLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  flowPillValue: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 'auto',
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
    marginBottom: 14,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statColumn: {
    flex: 1,
  },
  subStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  subStatAmount: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  verticalDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    marginHorizontal: 16,
  },
  sectionBlock: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '500',
  },
  groupedList: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  catIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  catDetails: {
    flex: 1,
  },
  catNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  catName: {
    fontSize: 13,
    fontWeight: '500',
  },
  catAmount: {
    fontSize: 13,
    fontWeight: '600',
  },
  progressBarTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 4,
    borderRadius: 2,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  txIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  txInfo: {
    flex: 1,
  },
  txName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  txDate: {
    fontSize: 12,
    fontWeight: '400',
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 2,
  },
  emptySubtitle: {
    fontSize: 12,
  },
  bottomSpacer: {
    height: 24,
  },
  rowAlign: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  budgetWidgetCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  budgetWidgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  budgetWidgetLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  budgetWidgetAmount: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  budgetWidgetTotal: {
    fontSize: 14,
    fontWeight: '500',
  },
  budgetManageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 2,
  },
  budgetManageText: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  budgetFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  budgetFooterText: {
    fontSize: 11,
  },
  billsScroll: {
    flexDirection: 'row',
    marginHorizontal: -4,
  },
  billChip: {
    width: 154,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    marginHorizontal: 4,
    justifyContent: 'space-between',
  },
  billChipTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  billIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipDueBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  chipDueText: {
    fontSize: 9,
    fontWeight: '700',
  },
  billName: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  billAmount: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  quickPayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  quickPayText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
