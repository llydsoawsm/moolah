// ============================================================
// MoneyGuide — Minimalist Monthly Budget Manager Modal
// ============================================================
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../hooks/useTheme';
import { useBudgets } from '../../hooks/useBudgets';
import { useCategories } from '../../hooks/useCategories';
import { formatCurrency } from '../../lib/utils';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function BudgetManagerModal() {
  const { colors } = useTheme();
  const router = useRouter();
  const { budgets, totals, saveBudget, deleteBudget } = useBudgets();
  const { categories } = useCategories('expense');

  // Edit / Add modal state
  const [editingCategory, setEditingCategory] = useState<{
    id: string;
    name: string;
    currentAmount: number;
  } | null>(null);
  const [amountInput, setAmountInput] = useState('');

  const openSetBudget = (categoryId: string, categoryName: string, currentAmount = 0) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingCategory({ id: categoryId, name: categoryName, currentAmount });
    setAmountInput(currentAmount > 0 ? String(currentAmount) : '');
  };

  const handleSave = () => {
    if (!editingCategory) return;
    const num = parseFloat(amountInput);
    if (isNaN(num) || num <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid monthly budget limit greater than 0.');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    saveBudget(editingCategory.id, num);
    setEditingCategory(null);
    setAmountInput('');
  };

  const handleDelete = (budgetId: string, name: string) => {
    Alert.alert('Remove Budget', `Remove monthly spending limit for ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          deleteBudget(budgetId);
        },
      },
    ]);
  };

  // Categories not yet budgeted
  const unbudgetedCategories = categories.filter(
    (c) => !c.parent_id && !budgets.some((b) => b.category_id === c.id),
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Monthly Budgets</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Set spending targets per category
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.closeBtn, { backgroundColor: colors.surfaceAlt }]}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Overall Budget Card */}
        {/* Overall Budget Card (shown only if limits are configured) */}
        {totals.totalBudget > 0 && (
          <Animated.View
            entering={FadeInDown.duration(350)}
            style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={styles.summaryTop}>
              <View>
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
                  TOTAL MONTHLY BUDGET
                </Text>
                <Text style={[styles.summaryAmount, { color: colors.text }]}>
                  {formatCurrency(totals.totalBudget)}
                </Text>
              </View>
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor:
                      totals.overallPercentage >= 100
                        ? `${colors.danger}20`
                        : totals.overallPercentage >= 80
                        ? `${colors.warning}20`
                        : `${colors.success}20`,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    {
                      color:
                        totals.overallPercentage >= 100
                          ? colors.danger
                          : totals.overallPercentage >= 80
                          ? colors.warning
                          : colors.success,
                    },
                  ]}
                >
                  {totals.overallPercentage}% Used
                </Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View style={[styles.progressTrack, { backgroundColor: colors.surfaceAlt }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(totals.overallPercentage, 100)}%`,
                    backgroundColor:
                      totals.overallPercentage >= 100
                        ? colors.danger
                        : totals.overallPercentage >= 80
                        ? colors.warning
                        : colors.primary,
                  },
                ]}
              />
            </View>

            <View style={styles.summaryFooter}>
              <Text style={[styles.footerText, { color: colors.textSecondary }]}>
                Spent: <Text style={{ color: colors.text, fontWeight: '600' }}>{formatCurrency(totals.totalSpent)}</Text>
              </Text>
              <Text style={[styles.footerText, { color: colors.textSecondary }]}>
                Remaining: <Text style={{ color: totals.totalRemaining > 0 ? colors.success : colors.danger, fontWeight: '600' }}>{formatCurrency(totals.totalRemaining)}</Text>
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Active Budgets List */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>ACTIVE CATEGORY BUDGETS</Text>
          {budgets.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="pie-chart-outline" size={32} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.text }]}>
                No category spending limits set
              </Text>
              <Text style={[styles.emptySub, { color: colors.textMuted }]}>
                Tap any category below to set a monthly target
              </Text>
            </View>
          ) : (
            budgets.map((b, index) => {
              const isOver = b.percentage >= 100;
              const isWarning = b.percentage >= 80 && !isOver;
              const barColor = isOver ? colors.danger : isWarning ? colors.warning : b.category_color || colors.primary;

              return (
                <Animated.View
                  key={b.id}
                  entering={FadeInDown.duration(300).delay(index * 40)}
                  style={[styles.budgetCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.categoryInfo}>
                      <View style={[styles.iconCircle, { backgroundColor: `${b.category_color}25` }]}>
                        <Ionicons name={(b.category_icon as any) || 'pricetag'} size={18} color={b.category_color} />
                      </View>
                      <View>
                        <Text style={[styles.categoryName, { color: colors.text }]}>{b.category_name}</Text>
                        <Text style={[styles.spentSub, { color: colors.textMuted }]}>
                          {formatCurrency(b.spent)} of {formatCurrency(b.amount)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={[styles.miniBtn, { backgroundColor: colors.surfaceAlt }]}
                        onPress={() => openSetBudget(b.category_id, b.category_name, b.amount)}
                      >
                        <Ionicons name="pencil" size={14} color={colors.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.miniBtn, { backgroundColor: colors.surfaceAlt }]}
                        onPress={() => handleDelete(b.id, b.category_name)}
                      >
                        <Ionicons name="trash-outline" size={14} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Progress bar */}
                  <View style={[styles.progressTrack, { backgroundColor: colors.surfaceAlt, marginTop: 10 }]}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.min(b.percentage, 100)}%`,
                          backgroundColor: barColor,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.cardFooter}>
                    <Text
                      style={[
                        styles.percentageText,
                        { color: isOver ? colors.danger : isWarning ? colors.warning : colors.textSecondary },
                      ]}
                    >
                      {b.percentage}% used
                    </Text>
                    <Text style={[styles.remainingText, { color: b.remaining > 0 ? colors.textMuted : colors.danger }]}>
                      {b.remaining > 0 ? `${formatCurrency(b.remaining)} left` : `Over budget by ${formatCurrency(b.spent - b.amount)}`}
                    </Text>
                  </View>
                </Animated.View>
              );
            })
          )}
        </View>

        {/* Add Budget to other categories */}
        {unbudgetedCategories.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>ADD BUDGET FOR CATEGORY</Text>
            <View style={styles.unbudgetedGrid}>
              {unbudgetedCategories.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.unbudgetedChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => openSetBudget(c.id, c.name, 0)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.chipDot, { backgroundColor: c.color }]} />
                  <Text style={[styles.chipText, { color: colors.text }]}>{c.name}</Text>
                  <Ionicons name="add" size={14} color={colors.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Edit Amount Modal Dialog */}
      <Modal visible={!!editingCategory} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingCategory?.currentAmount ? 'Edit Budget' : 'Set Budget'}
            </Text>
            <Text style={[styles.modalSub, { color: colors.textMuted }]}>
              Monthly limit for {editingCategory?.name}
            </Text>

            <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <Text style={[styles.currencyPrefix, { color: colors.textSecondary }]}>₱</Text>
              <TextInput
                style={[styles.amountInput, { color: colors.text }]}
                keyboardType="numeric"
                autoFocus
                value={amountInput}
                onChangeText={setAmountInput}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.surfaceAlt }]}
                onPress={() => setEditingCategory(null)}
              >
                <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                onPress={handleSave}
              >
                <Text
                  style={[
                    styles.modalBtnText,
                    { color: colors.statusBar === 'light' ? '#09090B' : '#FFFFFF', fontWeight: '700' },
                  ]}
                >
                  Save Limit
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  summaryCard: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    marginBottom: 24,
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  summaryAmount: {
    fontSize: 26,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: -0.5,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  summaryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  footerText: {
    fontSize: 12,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  emptyBox: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
  },
  budgetCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '600',
  },
  spentSub: {
    fontSize: 12,
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  miniBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  percentageText: {
    fontSize: 11,
    fontWeight: '600',
  },
  remainingText: {
    fontSize: 11,
  },
  unbudgetedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  unbudgetedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalSub: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 20,
  },
  currencyPrefix: {
    fontSize: 18,
    fontWeight: '600',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
