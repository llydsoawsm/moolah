// ============================================================
// MoneyGuide — Minimalist Add Expense Screen
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
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../hooks/useTheme';
import { useExpenses } from '../../hooks/useExpenses';
import { useCategories } from '../../hooks/useCategories';
import { usePaymentMethods } from '../../hooks/usePaymentMethods';
import { CURRENCY } from '../../lib/constants';
import { formatCurrency } from '../../lib/utils';
import type { TransactionType } from '../../lib/types';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';

export default function AddExpenseScreen() {
  const { colors } = useTheme();
  const { addExpense } = useExpenses();
  const [txType, setTxType] = useState<TransactionType>('expense');
  const { categories } = useCategories(txType);
  const { methods } = usePaymentMethods();
  const router = useRouter();

  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<string | null>('pm-cash');
  const [note, setNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleAmountInput = (digit: string) => {
    if (digit === 'backspace') {
      setAmount((prev) => prev.slice(0, -1));
      return;
    }
    if (digit === '.' && amount.includes('.')) return;
    if (amount.includes('.') && amount.split('.')[1]?.length >= 2) return;
    if (amount.length >= 9) return;
    setAmount((prev) => prev + digit);
  };

  const activeCategory = categories.find((c) => c.id === selectedCategory);

  const handleCategorySelect = (catId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (selectedCategory === catId) {
      setSelectedCategory(null);
      setSelectedSubcategory(null);
    } else {
      setSelectedCategory(catId);
      setSelectedSubcategory(null);
    }
  };

  const handleReceiptOptions = () => {
    Alert.alert('Attach Receipt', 'Choose source', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Take Photo',
        onPress: async () => {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (!permission.granted) {
            Alert.alert('Permission needed', 'Camera permission required.');
            return;
          }
          const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
          if (!res.canceled && res.assets[0]) {
            setReceiptUri(res.assets[0].uri);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        },
      },
      {
        text: 'Choose from Gallery',
        onPress: async () => {
          const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.7,
          });
          if (!res.canceled && res.assets[0]) {
            setReceiptUri(res.assets[0].uri);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        },
      },
      ...(receiptUri
        ? [
            {
              text: 'Remove Receipt',
              style: 'destructive' as const,
              onPress: () => setReceiptUri(null),
            },
          ]
        : []),
    ]);
  };

  const handleSave = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      Alert.alert('Amount required', 'Please enter an amount.');
      return;
    }
    if (!selectedCategory) {
      Alert.alert('Category required', 'Please select a category.');
      return;
    }

    setSaving(true);
    try {
      const categoryId = selectedSubcategory || selectedCategory;
      addExpense({
        type: txType,
        amount: amount,
        category_id: categoryId,
        payment_method_id: selectedPayment,
        note: note.trim(),
        receipt_image_uri: receiptUri,
        expense_date: new Date(),
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Reset
      setAmount('');
      setSelectedCategory(null);
      setSelectedSubcategory(null);
      setNote('');
      setShowNoteInput(false);
      setReceiptUri(null);

      router.replace('/(tabs)');
    } catch (err) {
      Alert.alert('Error', `Failed to save ${txType}.`);
    } finally {
      setSaving(false);
    }
  };

  const canSave = parseFloat(amount) > 0 && selectedCategory !== null;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top Header with Segmented Type Switch */}
        <View style={styles.header}>
          <View style={[styles.typeSegment, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[
                styles.typeTab,
                txType === 'expense' && [styles.typeTabActive, { backgroundColor: colors.surface, borderColor: colors.border }],
              ]}
              onPress={() => {
                if (txType !== 'expense') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setTxType('expense');
                  setSelectedCategory(null);
                  setSelectedSubcategory(null);
                }
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name="arrow-up-circle"
                size={15}
                color={txType === 'expense' ? colors.danger : colors.textMuted}
              />
              <Text
                style={[
                  styles.typeTabText,
                  { color: txType === 'expense' ? colors.text : colors.textMuted },
                ]}
              >
                Expense
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeTab,
                txType === 'income' && [styles.typeTabActive, { backgroundColor: colors.surface, borderColor: colors.border }],
              ]}
              onPress={() => {
                if (txType !== 'income') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setTxType('income');
                  setSelectedCategory(null);
                  setSelectedSubcategory(null);
                }
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name="arrow-down-circle"
                size={15}
                color={txType === 'income' ? colors.success : colors.textMuted}
              />
              <Text
                style={[
                  styles.typeTabText,
                  { color: txType === 'income' ? colors.text : colors.textMuted },
                ]}
              >
                Income
              </Text>
            </TouchableOpacity>
          </View>

          {amount.length > 0 && (
            <TouchableOpacity onPress={() => setAmount('')}>
              <Text style={[styles.clearBtn, { color: colors.textMuted }]}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Minimalist Hero Amount Display */}
        <Animated.View entering={FadeInDown.duration(350)} style={styles.amountContainer}>
          <Text style={[styles.currencyPrefix, { color: amount ? colors.text : colors.textMuted }]}>
            {CURRENCY.symbol}
          </Text>
          <Text
            style={[
              styles.amountText,
              { color: amount ? colors.text : colors.textMuted },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {amount || '0'}
          </Text>
        </Animated.View>

        {/* Category Horizontal Pill Chips */}
        <View style={styles.categoriesSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: isSelected ? colors.text : colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => handleCategorySelect(cat.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={(cat.icon as any) || 'ellipse'}
                    size={14}
                    color={isSelected ? colors.background : cat.color}
                  />
                  <Text
                    style={[
                      styles.categoryChipText,
                      { color: isSelected ? colors.background : colors.text },
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Subcategories Row if selected category has subs */}
          {activeCategory && activeCategory.subcategories.length > 0 && (
            <Animated.View entering={FadeIn.duration(200)}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[styles.chipsRow, styles.subchipsRow]}
              >
                {activeCategory.subcategories.map((sub) => {
                  const isSubSelected = selectedSubcategory === sub.id;
                  return (
                    <TouchableOpacity
                      key={sub.id}
                      style={[
                        styles.subCategoryChip,
                        {
                          backgroundColor: isSubSelected ? colors.text : colors.surfaceAlt,
                          borderColor: colors.border,
                        },
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedSubcategory(isSubSelected ? null : sub.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.subChipText,
                          { color: isSubSelected ? colors.background : colors.textSecondary },
                        ]}
                      >
                        {sub.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </Animated.View>
          )}
        </View>

        {/* Minimalist Details & Payment Action Bar */}
        <View style={styles.metaRow}>
          {/* Payment Method Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metaChipsRow}>
            {methods.map((pm) => {
              const isSelected = selectedPayment === pm.id;
              return (
                <TouchableOpacity
                  key={pm.id}
                  style={[
                    styles.metaChip,
                    {
                      backgroundColor: isSelected ? colors.surfaceAlt : colors.surface,
                      borderColor: isSelected ? colors.textSecondary : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedPayment(pm.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={(pm.icon as any) || 'wallet-outline'}
                    size={13}
                    color={isSelected ? colors.text : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.metaChipText,
                      { color: isSelected ? colors.text : colors.textMuted },
                    ]}
                  >
                    {pm.name}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* Note Button */}
            <TouchableOpacity
              style={[
                styles.metaChip,
                {
                  backgroundColor: note ? colors.surfaceAlt : colors.surface,
                  borderColor: note ? colors.textSecondary : colors.border,
                },
              ]}
              onPress={() => setShowNoteInput(!showNoteInput)}
              activeOpacity={0.7}
            >
              <Ionicons
                name="document-text-outline"
                size={13}
                color={note ? colors.text : colors.textMuted}
              />
              <Text style={[styles.metaChipText, { color: note ? colors.text : colors.textMuted }]}>
                {note ? 'Note added' : 'Note'}
              </Text>
            </TouchableOpacity>

            {/* Receipt Button */}
            <TouchableOpacity
              style={[
                styles.metaChip,
                {
                  backgroundColor: receiptUri ? colors.surfaceAlt : colors.surface,
                  borderColor: receiptUri ? colors.textSecondary : colors.border,
                },
              ]}
              onPress={handleReceiptOptions}
              activeOpacity={0.7}
            >
              <Ionicons
                name={receiptUri ? 'checkmark-circle' : 'attach-outline'}
                size={13}
                color={receiptUri ? colors.success : colors.textMuted}
              />
              <Text
                style={[
                  styles.metaChipText,
                  { color: receiptUri ? colors.text : colors.textMuted },
                ]}
              >
                {receiptUri ? 'Receipt' : 'Attach'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Inline Note Input if toggled */}
        {showNoteInput && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.noteContainer}>
            <TextInput
              style={[styles.noteInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="Add a note (e.g. Lunch with team)"
              placeholderTextColor={colors.textMuted}
              value={note}
              onChangeText={setNote}
              autoFocus
            />
          </Animated.View>
        )}

        {/* Minimalist Apple-style Calculator Numpad */}
        <View style={styles.keypad}>
          {[
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
            ['.', '0', 'backspace'],
          ].map((row, rIdx) => (
            <View key={rIdx} style={styles.keypadRow}>
              {row.map((btn) => (
                <TouchableOpacity
                  key={btn}
                  style={[styles.keyButton, { backgroundColor: colors.surface }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    handleAmountInput(btn);
                  }}
                  activeOpacity={0.6}
                >
                  {btn === 'backspace' ? (
                    <Ionicons name="backspace-outline" size={22} color={colors.text} />
                  ) : (
                    <Text style={[styles.keyText, { color: colors.text }]}>{btn}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>

        {/* Minimalist Save Button */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            {
              backgroundColor: canSave ? colors.primary : colors.surface,
              borderColor: colors.border,
              borderWidth: StyleSheet.hairlineWidth,
            },
          ]}
          onPress={handleSave}
          disabled={!canSave || saving}
          activeOpacity={0.8}
        >
            <Text
              style={[
                styles.saveButtonText,
                { color: canSave ? (colors.statusBar === 'light' ? '#09090B' : '#FFFFFF') : colors.textMuted },
              ]}
            >
              {saving ? 'Saving...' : txType === 'income' ? 'Save Income' : 'Save Expense'}
            </Text>
          </TouchableOpacity>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 54,
      paddingBottom: 20,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    typeSegment: {
      flexDirection: 'row',
      padding: 3,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      gap: 3,
    },
    typeTab: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 11,
      gap: 5,
    },
    typeTabActive: {
      borderWidth: StyleSheet.hairlineWidth,
    },
    typeTabText: {
      fontSize: 13,
      fontWeight: '600',
    },
  title: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  clearBtn: {
    fontSize: 13,
    fontWeight: '500',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    marginBottom: 16,
  },
  currencyPrefix: {
    fontSize: 28,
    fontWeight: '600',
    marginRight: 6,
    marginTop: 4,
  },
  amountText: {
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: -1.5,
  },
  categoriesSection: {
    marginBottom: 16,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  subchipsRow: {
    paddingTop: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  subCategoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  subChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  metaRow: {
    marginBottom: 14,
  },
  metaChipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 5,
  },
  metaChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  noteContainer: {
    marginBottom: 16,
  },
  noteInput: {
    height: 42,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  keypad: {
    width: '100%',
    gap: 10,
    marginBottom: 20,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 10,
  },
  keyButton: {
    flex: 1,
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: 22,
    fontWeight: '400',
  },
  saveButton: {
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  bottomSpacer: {
    height: 20,
  },
});
