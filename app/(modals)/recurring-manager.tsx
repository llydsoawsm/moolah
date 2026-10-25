// ============================================================
// MoneyGuide — Subscriptions & Recurring Bills Manager Modal
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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../hooks/useTheme';
import { useRecurring } from '../../hooks/useRecurring';
import { useCategories } from '../../hooks/useCategories';
import { usePaymentMethods } from '../../hooks/usePaymentMethods';
import { formatCurrency } from '../../lib/utils';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function RecurringManagerModal() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'ios' ? 52 : 24);
  const router = useRouter();
  const { subscriptions, upcoming, monthlyTotal, markAsPaid, addSubscription, deleteSubscription } = useRecurring();
  const { categories } = useCategories('expense');
  const { methods } = usePaymentMethods();

  const [showAddModal, setShowAddModal] = useState(false);
  const [subName, setSubName] = useState('');
  const [subAmount, setSubAmount] = useState('');
  const [subBillingDay, setSubBillingDay] = useState('15');
  const [selectedCatId, setSelectedCatId] = useState<string>('cat-entertainment');
  const [selectedPaymentId, setSelectedPaymentId] = useState<string>('pm-credit');
  const [frequency, setFrequency] = useState<'monthly' | 'yearly'>('monthly');

  const handleMarkPaid = (sub: any) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    markAsPaid(sub);
    Alert.alert(
      'Payment Recorded',
      `Logged ${formatCurrency(sub.amount)} for ${sub.name} into transactions and advanced next due date.`,
    );
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete Subscription', `Remove recurring bill for ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          deleteSubscription(id);
        },
      },
    ]);
  };

  const handleSaveSubscription = () => {
    if (!subName.trim()) {
      Alert.alert('Required', 'Please enter a subscription name.');
      return;
    }
    const amt = parseFloat(subAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid bill amount.');
      return;
    }
    const day = parseInt(subBillingDay, 10);
    if (isNaN(day) || day < 1 || day > 31) {
      Alert.alert('Invalid Day', 'Billing day must be between 1 and 31.');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addSubscription({
      name: subName.trim(),
      amount: amt,
      category_id: selectedCatId,
      payment_method_id: selectedPaymentId,
      billing_day: day,
      frequency,
    });

    // Reset & close
    setSubName('');
    setSubAmount('');
    setShowAddModal(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: topPadding }]}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Subscriptions & Bills</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Recurring overhead & payment reminders
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
        {/* Commitment Summary Card */}
        <Animated.View
          entering={FadeInDown.duration(350)}
          style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={styles.summaryTop}>
            <View>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
                ESTIMATED MONTHLY OVERHEAD
              </Text>
              <Text style={[styles.summaryAmount, { color: colors.text }]}>
                {formatCurrency(monthlyTotal)}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.addTopBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowAddModal(true)}
              activeOpacity={0.8}
            >
              <Ionicons
                name="add"
                size={18}
                color={colors.statusBar === 'light' ? '#09090B' : '#FFFFFF'}
              />
              <Text
                style={[
                  styles.addTopBtnText,
                  { color: colors.statusBar === 'light' ? '#09090B' : '#FFFFFF' },
                ]}
              >
                New Bill
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.summarySub, { color: colors.textSecondary }]}>
            {subscriptions.length} active recurring payment{subscriptions.length !== 1 ? 's' : ''}
          </Text>
        </Animated.View>

        {/* Subscriptions List */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>UPCOMING BILLS</Text>
          {upcoming.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="repeat-outline" size={32} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.text }]}>
                No subscriptions registered
              </Text>
              <Text style={[styles.emptySub, { color: colors.textMuted }]}>
                Track recurring bills, subscriptions, and payment schedules
              </Text>
            </View>
          ) : (
            upcoming.map((sub, index) => {
              const badgeBg =
                sub.daysLeft < 0
                  ? `${colors.danger}20`
                  : sub.daysLeft <= 3
                  ? `${colors.warning}20`
                  : `${colors.textMuted}20`;
              const badgeColor =
                sub.daysLeft < 0
                  ? colors.danger
                  : sub.daysLeft <= 3
                  ? colors.warning
                  : colors.textSecondary;

              return (
                <Animated.View
                  key={sub.id}
                  entering={FadeInDown.duration(300).delay(index * 40)}
                  style={[styles.subCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.subLeft}>
                      <View style={[styles.iconCircle, { backgroundColor: `${sub.category_color || colors.primary}20` }]}>
                        <Ionicons
                          name={(sub.category_icon as any) || 'calendar'}
                          size={18}
                          color={sub.category_color || colors.primary}
                        />
                      </View>
                      <View>
                        <Text style={[styles.subName, { color: colors.text }]}>{sub.name}</Text>
                        <Text style={[styles.subDetail, { color: colors.textMuted }]}>
                          Every month on the {sub.billing_day}th • {sub.category_name}
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.subAmount, { color: colors.text }]}>
                      {formatCurrency(sub.amount)}
                    </Text>
                  </View>

                  <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                    <View style={[styles.dueBadge, { backgroundColor: badgeBg }]}>
                      <Ionicons
                        name={sub.daysLeft <= 3 ? 'alert-circle-outline' : 'time-outline'}
                        size={12}
                        color={badgeColor}
                      />
                      <Text style={[styles.dueBadgeText, { color: badgeColor }]}>{sub.dueLabel}</Text>
                    </View>

                    <View style={styles.btnRow}>
                      <TouchableOpacity
                        style={[styles.payBtn, { backgroundColor: colors.primary }]}
                        onPress={() => handleMarkPaid(sub)}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name="checkmark"
                          size={14}
                          color={colors.statusBar === 'light' ? '#09090B' : '#FFFFFF'}
                        />
                        <Text
                          style={[
                            styles.payBtnText,
                            { color: colors.statusBar === 'light' ? '#09090B' : '#FFFFFF' },
                          ]}
                        >
                          Mark Paid
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.deleteBtn, { backgroundColor: colors.surfaceAlt }]}
                        onPress={() => handleDelete(sub.id, sub.name)}
                      >
                        <Ionicons name="trash-outline" size={14} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </Animated.View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Add Subscription Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>New Subscription</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {/* Name */}
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>SERVICE / BILL NAME</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
                placeholder="e.g. Netflix, Gym, Internet"
                placeholderTextColor={colors.textMuted}
                value={subName}
                onChangeText={setSubName}
              />

              {/* Amount & Billing Day */}
              <View style={styles.rowTwo}>
                <View style={{ flex: 1.2 }}>
                  <Text style={[styles.inputLabel, { color: colors.textMuted }]}>AMOUNT (₱)</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
                    placeholder="0.00"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={subAmount}
                    onChangeText={setSubAmount}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: colors.textMuted }]}>DAY OF MONTH</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
                    placeholder="1-31"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={subBillingDay}
                    onChangeText={setSubBillingDay}
                  />
                </View>
              </View>

              {/* Category Selection */}
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>CATEGORY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
                {categories.filter((c) => !c.parent_id).map((c) => {
                  const active = selectedCatId === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.catPill,
                        {
                          backgroundColor: active ? colors.primary : colors.surfaceAlt,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => setSelectedCatId(c.id)}
                    >
                      <Ionicons
                        name={(c.icon as any) || 'pricetag'}
                        size={14}
                        color={active ? (colors.statusBar === 'light' ? '#09090B' : '#FFFFFF') : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.catPillText,
                          {
                            color: active
                              ? (colors.statusBar === 'light' ? '#09090B' : '#FFFFFF')
                              : colors.text,
                          },
                        ]}
                      >
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </ScrollView>

            <TouchableOpacity
              style={[styles.createBtn, { backgroundColor: colors.primary }]}
              onPress={handleSaveSubscription}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.createBtnText,
                  { color: colors.statusBar === 'light' ? '#09090B' : '#FFFFFF' },
                ]}
              >
                Add Subscription
              </Text>
            </TouchableOpacity>
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
    alignItems: 'center',
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
  summarySub: {
    fontSize: 12,
    marginTop: 10,
  },
  addTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  addTopBtnText: {
    fontSize: 12,
    fontWeight: '700',
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
  subCard: {
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
  subLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subName: {
    fontSize: 15,
    fontWeight: '600',
  },
  subDetail: {
    fontSize: 12,
    marginTop: 2,
  },
  subAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  dueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  dueBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  payBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  modalBox: {
    width: '100%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    padding: 20,
    paddingBottom: 34,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 12,
  },
  textInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  rowTwo: {
    flexDirection: 'row',
    gap: 12,
  },
  catScroll: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
    gap: 6,
  },
  catPillText: {
    fontSize: 12,
    fontWeight: '500',
  },
  createBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  createBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
