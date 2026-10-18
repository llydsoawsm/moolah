// ============================================================
// MoneyGuide — Minimalist Analytics Screen
// ============================================================
import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useAppStore } from '../../stores/app-store';
import { formatCurrency, formatCurrencyCompact } from '../../lib/utils';
import type { AnalyticsPeriod, AnalyticsMode } from '../../lib/types';
import Animated, { FadeInDown } from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 40;
const CHART_HEIGHT = 160;

export default function AnalyticsScreen() {
  const { colors } = useTheme();
  const { summary, categorySpending, spendingTrend, cashFlowTrend } = useAnalytics();
  const period = useAppStore((s) => s.analyticsPeriod);
  const setPeriod = useAppStore((s) => s.setAnalyticsPeriod);
  const mode = useAppStore((s) => s.analyticsMode);
  const setMode = useAppStore((s) => s.setAnalyticsMode);

  const modes: { key: AnalyticsMode; label: string; icon: any }[] = [
    { key: 'expense', label: 'Expenses', icon: 'arrow-up-circle-outline' },
    { key: 'income', label: 'Income', icon: 'arrow-down-circle-outline' },
    { key: 'cashflow', label: 'Cash Flow', icon: 'swap-horizontal-outline' },
  ];

  const periods: { key: AnalyticsPeriod; label: string }[] = [
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
  ];

  // Calculate chart max
  const maxTrend =
    mode === 'cashflow'
      ? Math.max(...cashFlowTrend.map((d) => Math.max(d.income, d.expense)), 1)
      : Math.max(...spendingTrend.map((d) => d.total), 1);

  const barWidth =
    mode === 'cashflow'
      ? cashFlowTrend.length > 0
        ? Math.min(10, (CHART_WIDTH - 50) / (cashFlowTrend.length * 2) - 4)
        : 10
      : spendingTrend.length > 0
      ? Math.min(22, (CHART_WIDTH - 48) / spendingTrend.length - 6)
      : 22;

  // Calculate daily average
  const currentDay = new Date().getDate();
  const dailyExpenseAvg = currentDay > 0 ? summary.expenseThisMonth / currentDay : 0;
  const dailyIncomeAvg = currentDay > 0 ? summary.incomeThisMonth / currentDay : 0;
  const savingsRate =
    summary.incomeThisMonth > 0
      ? Math.round((summary.netThisMonth / summary.incomeThisMonth) * 100)
      : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Minimalist Header */}
        <Animated.View entering={FadeInDown.duration(350)} style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Analytics</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Cash flow & spending breakdown
          </Text>
        </Animated.View>

        {/* Mode Selector (Expenses / Income / Cash Flow) */}
        <Animated.View entering={FadeInDown.duration(350).delay(40)}>
          <View style={[styles.modeSegmentContainer, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            {modes.map((m) => {
              const active = mode === m.key;
              return (
                <TouchableOpacity
                  key={m.key}
                  style={[
                    styles.modeTab,
                    active && [styles.modeTabActive, { backgroundColor: colors.surface, borderColor: colors.border }],
                  ]}
                  onPress={() => setMode(m.key)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={m.icon}
                    size={14}
                    color={
                      active
                        ? m.key === 'income'
                          ? colors.success
                          : m.key === 'expense'
                          ? colors.danger
                          : colors.text
                        : colors.textMuted
                    }
                  />
                  <Text
                    style={[
                      styles.modeText,
                      { color: active ? colors.text : colors.textMuted },
                    ]}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>

        {/* Timeframe Period Segmented Control */}
        <Animated.View entering={FadeInDown.duration(350).delay(80)}>
          <View style={[styles.segmentContainer, { backgroundColor: colors.surfaceAlt }]}>
            {periods.map((p) => {
              const active = period === p.key;
              return (
                <TouchableOpacity
                  key={p.key}
                  style={[
                    styles.segmentTab,
                    active && [styles.segmentActive, { backgroundColor: colors.surface, borderColor: colors.border }],
                  ]}
                  onPress={() => setPeriod(p.key)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: active ? colors.text : colors.textMuted },
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>

        {/* Dynamic Summary Strip */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(120)}
          style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          {mode === 'expense' && (
            <>
              <View style={styles.metricCol}>
                <Text style={[styles.metricLabel, { color: colors.textMuted }]}>SPENT THIS MONTH</Text>
                <Text style={[styles.metricValue, { color: colors.text }]}>
                  {formatCurrency(summary.expenseThisMonth)}
                </Text>
              </View>
              <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />
              <View style={styles.metricCol}>
                <Text style={[styles.metricLabel, { color: colors.textMuted }]}>DAILY AVERAGE</Text>
                <Text style={[styles.metricValue, { color: colors.text }]}>
                  {formatCurrency(dailyExpenseAvg)}
                </Text>
              </View>
            </>
          )}

          {mode === 'income' && (
            <>
              <View style={styles.metricCol}>
                <Text style={[styles.metricLabel, { color: colors.textMuted }]}>EARNED THIS MONTH</Text>
                <Text style={[styles.metricValue, { color: colors.success }]}>
                  +{formatCurrency(summary.incomeThisMonth)}
                </Text>
              </View>
              <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />
              <View style={styles.metricCol}>
                <Text style={[styles.metricLabel, { color: colors.textMuted }]}>DAILY AVERAGE</Text>
                <Text style={[styles.metricValue, { color: colors.success }]}>
                  +{formatCurrency(dailyIncomeAvg)}
                </Text>
              </View>
            </>
          )}

          {mode === 'cashflow' && (
            <>
              <View style={styles.metricCol}>
                <Text style={[styles.metricLabel, { color: colors.textMuted }]}>NET CASH FLOW</Text>
                <Text
                  style={[
                    styles.metricValue,
                    { color: summary.netThisMonth >= 0 ? colors.success : colors.danger },
                  ]}
                >
                  {summary.netThisMonth >= 0 ? '+' : ''}{formatCurrency(summary.netThisMonth)}
                </Text>
              </View>
              <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />
              <View style={styles.metricCol}>
                <Text style={[styles.metricLabel, { color: colors.textMuted }]}>SAVINGS RATE</Text>
                <Text style={[styles.metricValue, { color: colors.text }]}>
                  {savingsRate}%
                </Text>
              </View>
            </>
          )}
        </Animated.View>

        {/* Trend Chart */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(160)}
          style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={styles.chartHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>
              {mode === 'cashflow' ? 'Cash Flow Trend' : mode === 'income' ? 'Income Trend' : 'Spending Trend'}
            </Text>
            {mode === 'cashflow' && (
              <View style={styles.chartLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
                  <Text style={[styles.legendText, { color: colors.textMuted }]}>In</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.danger }]} />
                  <Text style={[styles.legendText, { color: colors.textMuted }]}>Out</Text>
                </View>
              </View>
            )}
          </View>

          {(mode === 'cashflow' ? cashFlowTrend.length === 0 : spendingTrend.length === 0) ? (
            <View style={styles.emptyChart}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No transactions for this timeframe
              </Text>
            </View>
          ) : (
            <View style={styles.chartWrapper}>
              {/* Y-Axis */}
              <View style={styles.yAxis}>
                <Text style={[styles.yLabel, { color: colors.textMuted }]}>
                  {formatCurrencyCompact(maxTrend)}
                </Text>
                <Text style={[styles.yLabel, { color: colors.textMuted }]}>
                  {formatCurrencyCompact(maxTrend / 2)}
                </Text>
                <Text style={[styles.yLabel, { color: colors.textMuted }]}>0</Text>
              </View>

              {/* Bars and Baseline */}
              <View style={styles.barsContainer}>
                <View style={styles.barsRow}>
                  {mode === 'cashflow'
                    ? cashFlowTrend.map((item, index) => {
                        const inHeight = maxTrend > 0 ? (item.income / maxTrend) * CHART_HEIGHT : 0;
                        const outHeight = maxTrend > 0 ? (item.expense / maxTrend) * CHART_HEIGHT : 0;
                        return (
                          <View key={index} style={styles.barItem}>
                            <View style={styles.dualBarContainer}>
                              <View
                                style={[
                                  styles.bar,
                                  {
                                    height: Math.max(inHeight, item.income > 0 ? 3 : 0),
                                    width: barWidth,
                                    backgroundColor: colors.success,
                                    marginRight: 2,
                                  },
                                ]}
                              />
                              <View
                                style={[
                                  styles.bar,
                                  {
                                    height: Math.max(outHeight, item.expense > 0 ? 3 : 0),
                                    width: barWidth,
                                    backgroundColor: colors.danger,
                                  },
                                ]}
                              />
                            </View>
                            <Text style={[styles.barLabel, { color: colors.textMuted }]}>
                              {formatBarLabel(item.date, period)}
                            </Text>
                          </View>
                        );
                      })
                    : spendingTrend.map((item, index) => {
                        const height = maxTrend > 0 ? (item.total / maxTrend) * CHART_HEIGHT : 0;
                        return (
                          <View key={index} style={styles.barItem}>
                            <View
                              style={[
                                styles.bar,
                                {
                                  height: Math.max(height, 3),
                                  width: barWidth,
                                  backgroundColor: mode === 'income' ? colors.success : colors.text,
                                },
                              ]}
                            />
                            <Text style={[styles.barLabel, { color: colors.textMuted }]}>
                              {formatBarLabel(item.date, period)}
                            </Text>
                          </View>
                        );
                      })}
                </View>
              </View>
            </View>
          )}
        </Animated.View>

        {/* Breakdown Section */}
        <Animated.View entering={FadeInDown.duration(400).delay(220)} style={styles.breakdownSection}>
          <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 12 }]}>
            {mode === 'income' ? 'Income Sources' : mode === 'cashflow' ? 'Top Category Breakdown' : 'Category Breakdown'}
          </Text>

          {categorySpending.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {mode === 'income' ? 'No income logged this month' : 'No expenses logged this month'}
              </Text>
            </View>
          ) : (
            <View style={[styles.groupedList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {categorySpending.map((cat, idx) => {
                const isLast = idx === categorySpending.length - 1;
                return (
                  <View
                    key={cat.category_id}
                    style={[
                      styles.breakdownRow,
                      !isLast && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
                    ]}
                  >
                    <View style={[styles.catIconCircle, { backgroundColor: cat.category_color + '18' }]}>
                      <Ionicons
                        name={(cat.category_icon as any) || (mode === 'income' ? 'wallet' : 'ellipse')}
                        size={15}
                        color={cat.category_color}
                      />
                    </View>
                    <View style={styles.breakdownMiddle}>
                      <View style={styles.nameRow}>
                        <Text style={[styles.breakdownName, { color: colors.text }]}>
                          {cat.category_name}
                        </Text>
                        <Text style={[styles.breakdownPercent, { color: colors.textMuted }]}>
                          {cat.percentage.toFixed(0)}%
                        </Text>
                      </View>
                      <View style={[styles.progressTrack, { backgroundColor: colors.surfaceAlt }]}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              backgroundColor: cat.category_color,
                              width: `${Math.min(cat.percentage, 100)}%`,
                            },
                          ]}
                        />
                      </View>
                    </View>
                    <Text style={[styles.breakdownAmount, { color: colors.text }]}>
                      {formatCurrency(cat.total)}
                    </Text>
                  </View>
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

function formatBarLabel(date: string, period: AnalyticsPeriod): string {
  if (period === 'daily') {
    const parts = date.split('-');
    return parts[2] || date;
  }
  if (period === 'weekly') {
    const parts = date.split('-W');
    return 'W' + (parts[1] || '');
  }
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const parts = date.split('-');
  const monthIndex = parseInt(parts[1], 10) - 1;
  return monthNames[monthIndex] || date;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 54,
    paddingBottom: 24,
  },
  header: {
    marginBottom: 16,
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
  modeSegmentContainer: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 3,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 3,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 11,
    gap: 5,
  },
  modeTabActive: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  modeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
    marginBottom: 18,
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 9,
  },
  segmentActive: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
  },
  summaryCard: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  metricCol: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    marginHorizontal: 14,
  },
  chartCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    marginBottom: 24,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  chartLegend: {
    flexDirection: 'row',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
    marginBottom: 16,
  },
  emptyChart: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
  },
  chartWrapper: {
    flexDirection: 'row',
    height: CHART_HEIGHT + 24,
  },
  yAxis: {
    width: 38,
    height: CHART_HEIGHT,
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  yLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  barsContainer: {
    flex: 1,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: CHART_HEIGHT,
  },
  barItem: {
    alignItems: 'center',
  },
  dualBarContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  bar: {
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    marginBottom: 6,
  },
  barLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  breakdownSection: {
    marginBottom: 20,
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    alignItems: 'center',
  },
  groupedList: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  catIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  breakdownMiddle: {
    flex: 1,
    marginRight: 12,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  breakdownName: {
    fontSize: 13,
    fontWeight: '500',
  },
  breakdownPercent: {
    fontSize: 11,
    fontWeight: '500',
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    borderRadius: 2,
  },
  breakdownAmount: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  bottomSpacer: {
    height: 20,
  },
});
