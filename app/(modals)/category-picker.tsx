// ============================================================
// MoneyGuide — Minimalist Category Picker & Manager Modal
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../hooks/useTheme';
import { useCategories } from '../../hooks/useCategories';
import type { TransactionType } from '../../lib/types';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function CategoryPickerModal() {
  const { colors } = useTheme();
  const router = useRouter();
  const [typeTab, setTypeTab] = useState<TransactionType>('expense');
  const { categories, addCategory } = useCategories(typeTab);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // New Category Creation state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<TransactionType>('expense');
  const [newCatIcon, setNewCatIcon] = useState('pricetag-outline');
  const [newCatColor, setNewCatColor] = useState('#71717A');

  const ICON_CHOICES = [
    'pricetag-outline',
    'wallet-outline',
    'cash-outline',
    'restaurant-outline',
    'cart-outline',
    'cafe-outline',
    'car-outline',
    'bus-outline',
    'bag-handle-outline',
    'shirt-outline',
    'flash-outline',
    'water-outline',
    'wifi-outline',
    'fitness-outline',
    'medkit-outline',
    'pulse-outline',
    'barbell-outline',
    'home-outline',
    'bed-outline',
    'play-circle-outline',
    'film-outline',
    'game-controller-outline',
    'tv-outline',
    'book-outline',
    'school-outline',
    'laptop-outline',
    'sparkles-outline',
    'cut-outline',
    'airplane-outline',
    'gift-outline',
    'heart-outline',
    'repeat-outline',
    'trending-up-outline',
    'briefcase-outline',
    'storefront-outline',
    'shield-checkmark-outline',
  ];

  const COLOR_CHOICES = [
    '#71717A',
    '#10B981',
    '#3B82F6',
    '#F59E0B',
    '#8B5CF6',
    '#EC4899',
    '#EF4444',
    '#06B6D4',
  ];

  const filteredCategories = categories.filter((cat) => {
    const matchesParent = cat.name.toLowerCase().includes(search.toLowerCase());
    const matchesSub = cat.subcategories.some((sub) =>
      sub.name.toLowerCase().includes(search.toLowerCase()),
    );
    return matchesParent || matchesSub;
  });

  const handleCreateCategory = () => {
    if (!newCatName.trim()) {
      Alert.alert('Name required', 'Please enter a category name');
      return;
    }
    addCategory(newCatName.trim(), newCatIcon, newCatColor, null, newCatType);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNewCatName('');
    setShowAddForm(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.headerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={18} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Categories</Text>
        <TouchableOpacity
          onPress={() => {
            setNewCatType(typeTab);
            setShowAddForm(!showAddForm);
          }}
          style={[styles.headerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          activeOpacity={0.7}
        >
          <Ionicons
            name={showAddForm ? 'close' : 'add'}
            size={18}
            color={colors.text}
          />
        </TouchableOpacity>
      </View>

      {/* Category Type Switcher (Expense / Income) */}
      <View style={styles.typeSwitcherContainer}>
        <View style={[styles.typeSegment, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.typeTabBtn,
              typeTab === 'expense' && [styles.typeTabActive, { backgroundColor: colors.surface, borderColor: colors.border }],
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setTypeTab('expense');
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name="arrow-up-circle-outline"
              size={14}
              color={typeTab === 'expense' ? colors.danger : colors.textMuted}
            />
            <Text
              style={[
                styles.typeTabText,
                { color: typeTab === 'expense' ? colors.text : colors.textMuted },
              ]}
            >
              Expense Categories
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.typeTabBtn,
              typeTab === 'income' && [styles.typeTabActive, { backgroundColor: colors.surface, borderColor: colors.border }],
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setTypeTab('income');
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name="arrow-down-circle-outline"
              size={14}
              color={typeTab === 'income' ? colors.success : colors.textMuted}
            />
            <Text
              style={[
                styles.typeTabText,
                { color: typeTab === 'income' ? colors.text : colors.textMuted },
              ]}
            >
              Income Categories
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Add Category Inset Card */}
      {showAddForm && (
        <Animated.View entering={FadeInDown.duration(300)} style={[styles.addCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.addCardTitle, { color: colors.text }]}>New Custom Category</Text>

          {/* Type Choice for New Category */}
          <View style={styles.formTypeRow}>
            <TouchableOpacity
              style={[
                styles.formTypeBtn,
                {
                  backgroundColor: newCatType === 'expense' ? colors.text : colors.surfaceAlt,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => setNewCatType('expense')}
            >
              <Text style={[styles.formTypeText, { color: newCatType === 'expense' ? colors.background : colors.textMuted }]}>
                Expense
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.formTypeBtn,
                {
                  backgroundColor: newCatType === 'income' ? colors.text : colors.surfaceAlt,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => setNewCatType('income')}
            >
              <Text style={[styles.formTypeText, { color: newCatType === 'income' ? colors.background : colors.textMuted }]}>
                Income
              </Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceAlt, color: colors.text, borderColor: colors.border }]}
            placeholder="Category Name"
            placeholderTextColor={colors.textMuted}
            value={newCatName}
            onChangeText={setNewCatName}
          />

          <Text style={[styles.label, { color: colors.textMuted }]}>ICON</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.choiceRow}>
            {ICON_CHOICES.map((icon) => (
              <TouchableOpacity
                key={icon}
                onPress={() => setNewCatIcon(icon)}
                style={[
                  styles.choiceItem,
                  { backgroundColor: newCatIcon === icon ? colors.text : colors.surfaceAlt },
                ]}
              >
                <Ionicons
                  name={icon as any}
                  size={18}
                  color={newCatIcon === icon ? colors.background : colors.textMuted}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.label, { color: colors.textMuted }]}>COLOR</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.choiceRow}>
            {COLOR_CHOICES.map((col) => (
              <TouchableOpacity
                key={col}
                onPress={() => setNewCatColor(col)}
                style={[
                  styles.colorDot,
                  { backgroundColor: col },
                  newCatColor === col && styles.colorDotSelected,
                ]}
              />
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: colors.text }]}
            onPress={handleCreateCategory}
            activeOpacity={0.8}
          >
            <Text style={[styles.submitText, { color: colors.background }]}>Save Category</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search categories..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Categories List */}
      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.groupedList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {filteredCategories.map((cat, idx) => {
            const isExpanded = expandedId === cat.id;
            const isLast = idx === filteredCategories.length - 1 && !isExpanded;
            return (
              <View key={cat.id}>
                <TouchableOpacity
                  style={[
                    styles.catRow,
                    !isLast && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
                  ]}
                  onPress={() => {
                    if (cat.subcategories.length > 0) {
                      setExpandedId(isExpanded ? null : cat.id);
                    }
                  }}
                  activeOpacity={0.65}
                >
                  <View style={[styles.iconCircle, { backgroundColor: cat.color + '18' }]}>
                    <Ionicons name={(cat.icon as any) || 'ellipse'} size={16} color={cat.color} />
                  </View>
                  <View style={styles.catInfo}>
                    <Text style={[styles.catName, { color: colors.text }]}>{cat.name}</Text>
                    {cat.subcategories.length > 0 && (
                      <Text style={[styles.subCount, { color: colors.textMuted }]}>
                        {cat.subcategories.length} subcategories
                      </Text>
                    )}
                  </View>
                  {cat.subcategories.length > 0 && (
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={colors.textMuted}
                    />
                  )}
                </TouchableOpacity>

                {/* Subcategories */}
                {isExpanded && (
                  <View style={[styles.subsContainer, { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                    {cat.subcategories.map((sub) => (
                      <View key={sub.id} style={styles.subItem}>
                        <View style={[styles.subDot, { backgroundColor: sub.color }]} />
                        <Text style={[styles.subName, { color: colors.textSecondary }]}>
                          {sub.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeSwitcherContainer: {
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  typeSegment: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  typeTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 11,
    gap: 6,
  },
  typeTabActive: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  typeTabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  formTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  formTypeBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  formTypeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: 18,
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
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 40,
  },
  groupedList: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catInfo: {
    flex: 1,
  },
  catName: {
    fontSize: 14,
    fontWeight: '500',
  },
  subCount: {
    fontSize: 11,
    marginTop: 1,
  },
  subsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 6,
  },
  subItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 10,
  },
  subDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  subName: {
    fontSize: 13,
  },
  addCard: {
    margin: 18,
    marginBottom: 0,
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  addCardTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    height: 40,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginTop: 2,
  },
  choiceRow: {
    flexDirection: 'row',
  },
  choiceItem: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  colorDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    marginRight: 8,
  },
  colorDotSelected: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  submitButton: {
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  submitText: {
    fontWeight: '600',
    fontSize: 14,
  },
});
