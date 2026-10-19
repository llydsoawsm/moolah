// ============================================================
// MoneyGuide — Minimalist Settings Screen
// ============================================================
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Switch,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../hooks/useTheme';
import { useAppStore } from '../../stores/app-store';
import { themes, themeOptions } from '../../lib/theme';
import { resetDatabase, exportExpensesToCSV, exportAllDataJSON } from '../../db/client';
import { SUPPORTED_CURRENCIES } from '../../lib/constants';
import type { ThemeName } from '../../lib/types';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function SettingsScreen() {
  const { colors, theme, setTheme } = useTheme();
  const router = useRouter();

  // Auth & Session
  const currentUser = useAppStore((s) => s.currentUser);
  const signOut = useAppStore((s) => s.signOut);
  const rememberMe = useAppStore((s) => s.rememberMe);
  const setRememberMe = useAppStore((s) => s.setRememberMe);

  // Currency
  const currentCurrency = useAppStore((s) => s.currency);
  const setCurrency = useAppStore((s) => s.setCurrency);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);

  // App Lock
  const pinHash = useAppStore((s) => s.pinHash);
  const setPinHash = useAppStore((s) => s.setPinHash);
  const biometricEnabled = useAppStore((s) => s.biometricEnabled);
  const setBiometricEnabled = useAppStore((s) => s.setBiometricEnabled);

  // PIN Form
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinStep, setPinStep] = useState<'enter' | 'confirm'>('enter');

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of Moolah?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          signOut();
        },
      },
    ]);
  };

  const handleSetPin = () => {
    if (pinStep === 'enter') {
      if (pinInput.length < 4) {
        Alert.alert('Invalid PIN', 'PIN must be at least 4 digits.');
        return;
      }
      setPinStep('confirm');
      setPinConfirm('');
    } else {
      if (pinInput !== pinConfirm) {
        Alert.alert('Mismatch', 'PINs do not match. Please try again.');
        setPinStep('enter');
        setPinInput('');
        setPinConfirm('');
        return;
      }
      setPinHash(pinInput);
      setShowPinSetup(false);
      setPinInput('');
      setPinConfirm('');
      setPinStep('enter');
      Alert.alert('PIN Set', 'Your app is protected with a PIN.');
    }
  };

  const handleRemovePin = () => {
    Alert.alert('Remove PIN', 'Are you sure you want to remove PIN protection?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setPinHash('');
          setBiometricEnabled(false);
        },
      },
    ]);
  };

  const handleToggleBiometric = async (value: boolean) => {
    if (value) {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        Alert.alert('Not Available', 'Biometric authentication is not supported.');
        return;
      }
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!isEnrolled) {
        Alert.alert('Not Enrolled', 'Please set up biometrics in your device settings.');
        return;
      }
    }
    setBiometricEnabled(value);
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently erase all your expenses. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase Everything',
          style: 'destructive',
          onPress: () => {
            resetDatabase();
            useAppStore.getState().triggerRefresh();
            Alert.alert('Reset Complete', 'All data has been cleared.');
          },
        },
      ],
    );
  };

  const handleExportCSV = async () => {
    try {
      const csvData = exportExpensesToCSV();
      if (!csvData || csvData.split('\n').length <= 1) {
        Alert.alert('No Data', 'There are no expenses to export.');
        return;
      }

      const dateStr = new Date().toISOString().split('T')[0];
      const fileName = `moolah-expenses-${dateStr}.csv`;

      if (Platform.OS === 'web') {
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Export Complete', 'Expenses CSV downloaded successfully.');
        return;
      }

      const filePath = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(filePath, csvData, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await Sharing.shareAsync(filePath, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Moolah Transactions',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('Exported', `File saved to ${filePath}`);
      }
    } catch (err) {
      console.error('Export error:', err);
      Alert.alert('Error', 'Failed to export CSV file.');
    }
  };

  const handleBackupJSON = async () => {
    try {
      const jsonData = exportAllDataJSON();
      const dateStr = new Date().toISOString().split('T')[0];
      const fileName = `moolah-backup-${dateStr}.json`;

      if (Platform.OS === 'web') {
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Backup Complete', 'Backup file downloaded successfully.');
        return;
      }

      const filePath = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(filePath, jsonData, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await Sharing.shareAsync(filePath, {
          mimeType: 'application/json',
          dialogTitle: 'Moolah Full Backup',
        });
      } else {
        Alert.alert('Backup Saved', `Saved to ${filePath}`);
      }
    } catch (err) {
      console.error('Backup error:', err);
      Alert.alert('Error', 'Failed to create backup.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Minimalist Top Header */}
        <Animated.View entering={FadeInDown.duration(350)} style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
        </Animated.View>

        {/* User Account / Profile Card */}
        {currentUser && (
          <Animated.View
            entering={FadeInDown.duration(400).delay(50)}
            style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={[styles.avatarCircle, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="person" size={18} color={colors.text} />
            </View>
            <View style={styles.profileDetails}>
              <Text style={[styles.profileName, { color: colors.text }]}>{currentUser.name}</Text>
              <Text style={[styles.profileEmail, { color: colors.textMuted }]}>{currentUser.email}</Text>
            </View>
            <TouchableOpacity
              style={[styles.signOutBtn, { borderColor: colors.border }]}
              onPress={handleSignOut}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={18} color={colors.danger} />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Appearance Section */}
        {/* Appearance Section */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>APPEARANCE</Text>
            <Text style={[styles.activeThemeBadge, { color: colors.primary }]}>
              {themeOptions.find((t) => t.key === theme)?.label || 'Theme'} Active
            </Text>
          </View>
          <View style={styles.themeGrid}>
            {themeOptions.map((t) => {
              const isActive = theme === t.key;
              const tc = themes[t.key];
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[
                    styles.themeCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: isActive ? tc.primary : colors.border,
                      borderWidth: isActive ? 2 : 1,
                    },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setTheme(t.key);
                  }}
                  activeOpacity={0.75}
                >
                  {/* Miniature Device Screen Preview */}
                  <View
                    style={[
                      styles.miniPhoneFrame,
                      {
                        backgroundColor: t.previewBg,
                        borderColor: isActive ? `${tc.primary}60` : tc.border,
                      },
                    ]}
                  >
                    {/* Mock Status Bar */}
                    <View style={styles.miniStatusBar}>
                      <View style={[styles.miniStatusDot, { backgroundColor: t.previewAccent }]} />
                      <View style={[styles.miniStatusLine, { backgroundColor: `${tc.textMuted}50` }]} />
                    </View>

                    {/* Mock Hero Card */}
                    <View
                      style={[
                        styles.miniHeroCard,
                        {
                          backgroundColor: t.previewSurface,
                          borderColor: tc.border,
                        },
                      ]}
                    >
                      <View style={[styles.miniHeroPill, { backgroundColor: t.previewAccent }]} />
                      <View style={[styles.miniHeroLine, { backgroundColor: `${tc.textSecondary}35` }]} />
                    </View>

                    {/* Mock Sparkline / Activity Bars */}
                    <View style={styles.miniBarRow}>
                      <View style={[styles.miniBar, { height: 7, backgroundColor: tc.primary }]} />
                      <View style={[styles.miniBar, { height: 14, backgroundColor: tc.success }]} />
                      <View style={[styles.miniBar, { height: 5, backgroundColor: tc.danger }]} />
                      <View style={[styles.miniBar, { height: 11, backgroundColor: tc.warning }]} />
                      <View style={[styles.miniBar, { height: 9, backgroundColor: tc.primary }]} />
                    </View>

                    {/* Mock Bottom Tab Bar */}
                    <View
                      style={[
                        styles.miniTabBar,
                        {
                          backgroundColor: t.previewSurface,
                          borderColor: tc.tabBarBorder,
                        },
                      ]}
                    >
                      <View style={[styles.miniTabDot, { backgroundColor: tc.primary }]} />
                      <View style={[styles.miniTabDot, { backgroundColor: `${tc.tabBarInactive}70` }]} />
                      <View style={[styles.miniTabDot, { backgroundColor: `${tc.tabBarInactive}70` }]} />
                    </View>
                  </View>

                  {/* Theme Info & Selection Checkmark */}
                  <View style={styles.themeInfoRow}>
                    <View style={styles.themeMetaText}>
                      <Text
                        style={[
                          styles.themeLabel,
                          {
                            color: colors.text,
                            fontWeight: isActive ? '700' : '600',
                          },
                        ]}
                      >
                        {t.label}
                      </Text>
                      <Text style={[styles.themeTagline, { color: colors.textMuted }]} numberOfLines={1}>
                        {t.tagline}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.checkCircle,
                        {
                          borderColor: isActive ? tc.primary : colors.border,
                          backgroundColor: isActive ? tc.primary : 'transparent',
                        },
                      ]}
                    >
                      {isActive && (
                        <Ionicons
                          name="checkmark"
                          size={11}
                          color={tc.statusBar === 'light' ? '#09090B' : '#FFFFFF'}
                        />
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>

        {/* Account & Security Section */}
        <Animated.View entering={FadeInDown.duration(400).delay(150)}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>ACCOUNT & SECURITY</Text>
          <View style={[styles.settingsGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Remember Me Toggle */}
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: colors.surfaceAlt }]}>
                  <Ionicons name="shield-checkmark-outline" size={16} color={colors.textSecondary} />
                </View>
                <View>
                  <Text style={[styles.settingTitle, { color: colors.text }]}>Remember Me</Text>
                  <Text style={[styles.settingSubtitle, { color: colors.textMuted }]}>
                    Stay signed in across restarts
                  </Text>
                </View>
              </View>
              <Switch
                value={rememberMe}
                onValueChange={(val) => setRememberMe(val)}
                trackColor={{ false: colors.border, true: colors.text }}
                thumbColor={colors.surface}
              />
            </View>

            {/* PIN Lock */}
            {!showPinSetup ? (
              <TouchableOpacity
                style={[styles.settingRow, styles.settingRowBorder, { borderColor: colors.border }]}
                onPress={pinHash ? handleRemovePin : () => setShowPinSetup(true)}
                activeOpacity={0.7}
              >
                <View style={styles.settingLeft}>
                  <View style={[styles.settingIcon, { backgroundColor: colors.surfaceAlt }]}>
                    <Ionicons name="lock-closed-outline" size={16} color={colors.textSecondary} />
                  </View>
                  <View>
                    <Text style={[styles.settingTitle, { color: colors.text }]}>App PIN Lock</Text>
                    <Text style={[styles.settingSubtitle, { color: colors.textMuted }]}>
                      {pinHash ? 'Configured' : 'Off'}
                    </Text>
                  </View>
                </View>
                <Ionicons
                  name={pinHash ? 'checkmark-circle' : 'chevron-forward'}
                  size={18}
                  color={pinHash ? colors.success : colors.textMuted}
                />
              </TouchableOpacity>
            ) : (
              <View style={[styles.pinSetup, styles.settingRowBorder, { borderColor: colors.border }]}>
                <Text style={[styles.pinTitle, { color: colors.text }]}>
                  {pinStep === 'enter' ? 'Enter 4-digit PIN' : 'Confirm PIN'}
                </Text>
                <TextInput
                  style={[
                    styles.pinInput,
                    { backgroundColor: colors.surfaceAlt, color: colors.text, borderColor: colors.border },
                  ]}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={6}
                  placeholder="••••"
                  placeholderTextColor={colors.textMuted}
                  value={pinStep === 'enter' ? pinInput : pinConfirm}
                  onChangeText={pinStep === 'enter' ? setPinInput : setPinConfirm}
                  autoFocus
                />
                <View style={styles.pinActions}>
                  <TouchableOpacity
                    onPress={() => {
                      setShowPinSetup(false);
                      setPinInput('');
                      setPinConfirm('');
                      setPinStep('enter');
                    }}
                  >
                    <Text style={[styles.pinCancel, { color: colors.textMuted }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.pinSave, { backgroundColor: colors.text }]}
                    onPress={handleSetPin}
                  >
                    <Text style={[styles.pinSaveText, { color: colors.background }]}>
                      {pinStep === 'enter' ? 'Next' : 'Save PIN'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Biometric */}
            {pinHash ? (
              <View style={[styles.settingRow, styles.settingRowBorder, { borderColor: colors.border }]}>
                <View style={styles.settingLeft}>
                  <View style={[styles.settingIcon, { backgroundColor: colors.surfaceAlt }]}>
                    <Ionicons name="finger-print-outline" size={16} color={colors.textSecondary} />
                  </View>
                  <View>
                    <Text style={[styles.settingTitle, { color: colors.text }]}>Biometrics</Text>
                    <Text style={[styles.settingSubtitle, { color: colors.textMuted }]}>
                      Fingerprint / Face unlock
                    </Text>
                  </View>
                </View>
                <Switch
                  value={biometricEnabled}
                  onValueChange={handleToggleBiometric}
                  trackColor={{ false: colors.border, true: colors.text }}
                  thumbColor={colors.surface}
                />
              </View>
            ) : null}
          </View>
        </Animated.View>

        {/* Preferences & Customization */}
        <Animated.View entering={FadeInDown.duration(400).delay(220)}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>PREFERENCES & FEATURES</Text>
          <View style={[styles.settingsGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Currency Selector */}
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => setShowCurrencyModal(true)}
              activeOpacity={0.7}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: colors.surfaceAlt }]}>
                  <Ionicons name="cash-outline" size={16} color={colors.textSecondary} />
                </View>
                <View>
                  <Text style={[styles.settingTitle, { color: colors.text }]}>Currency</Text>
                  <Text style={[styles.settingSubtitle, { color: colors.textMuted }]}>
                    {SUPPORTED_CURRENCIES[currentCurrency]?.name || currentCurrency} ({SUPPORTED_CURRENCIES[currentCurrency]?.symbol || '₱'})
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Monthly Budgets */}
            <TouchableOpacity
              style={[styles.settingRow, styles.settingRowBorder, { borderColor: colors.border }]}
              onPress={() => router.push('/(modals)/budget-manager')}
              activeOpacity={0.7}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: colors.surfaceAlt }]}>
                  <Ionicons name="pie-chart-outline" size={16} color={colors.textSecondary} />
                </View>
                <View>
                  <Text style={[styles.settingTitle, { color: colors.text }]}>Monthly Budgets</Text>
                  <Text style={[styles.settingSubtitle, { color: colors.textMuted }]}>
                    Spending limits & category targets
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Subscriptions & Bills */}
            <TouchableOpacity
              style={[styles.settingRow, styles.settingRowBorder, { borderColor: colors.border }]}
              onPress={() => router.push('/(modals)/recurring-manager')}
              activeOpacity={0.7}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: colors.surfaceAlt }]}>
                  <Ionicons name="repeat-outline" size={16} color={colors.textSecondary} />
                </View>
                <View>
                  <Text style={[styles.settingTitle, { color: colors.text }]}>Subscriptions & Bills</Text>
                  <Text style={[styles.settingSubtitle, { color: colors.textMuted }]}>
                    Recurring overhead & reminders
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Categories */}
            <TouchableOpacity
              style={[styles.settingRow, styles.settingRowBorder, { borderColor: colors.border }]}
              onPress={() => router.push('/(modals)/category-picker')}
              activeOpacity={0.7}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: colors.surfaceAlt }]}>
                  <Ionicons name="grid-outline" size={16} color={colors.textSecondary} />
                </View>
                <View>
                  <Text style={[styles.settingTitle, { color: colors.text }]}>Categories</Text>
                  <Text style={[styles.settingSubtitle, { color: colors.textMuted }]}>
                    Manage & add categories
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Data Management */}
        <Animated.View entering={FadeInDown.duration(400).delay(280)}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>DATA & BACKUP</Text>
          <View style={[styles.settingsGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* CSV Export */}
            <TouchableOpacity style={styles.settingRow} onPress={handleExportCSV} activeOpacity={0.7}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: colors.surfaceAlt }]}>
                  <Ionicons name="document-text-outline" size={16} color={colors.textSecondary} />
                </View>
                <View>
                  <Text style={[styles.settingTitle, { color: colors.text }]}>Export CSV File</Text>
                  <Text style={[styles.settingSubtitle, { color: colors.textMuted }]}>
                    Download all expenses spreadsheet
                  </Text>
                </View>
              </View>
              <Ionicons name="share-outline" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            {/* JSON Backup */}
            <TouchableOpacity
              style={[styles.settingRow, styles.settingRowBorder, { borderColor: colors.border }]}
              onPress={handleBackupJSON}
              activeOpacity={0.7}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: colors.surfaceAlt }]}>
                  <Ionicons name="cloud-download-outline" size={16} color={colors.textSecondary} />
                </View>
                <View>
                  <Text style={[styles.settingTitle, { color: colors.text }]}>Full JSON Backup</Text>
                  <Text style={[styles.settingSubtitle, { color: colors.textMuted }]}>
                    Export full app database snapshot
                  </Text>
                </View>
              </View>
              <Ionicons name="share-outline" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Clear All Data */}
            <TouchableOpacity
              style={[styles.settingRow, styles.settingRowBorder, { borderColor: colors.border }]}
              onPress={handleClearData}
              activeOpacity={0.7}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: colors.surfaceAlt }]}>
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                </View>
                <View>
                  <Text style={[styles.settingTitle, { color: colors.danger }]}>Clear All Data</Text>
                  <Text style={[styles.settingSubtitle, { color: colors.textMuted }]}>
                    Reset database
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* About App */}
        <View style={styles.about}>
          <Text style={[styles.aboutApp, { color: colors.textMuted }]}>Moolah 1.0.0</Text>
          <Text style={[styles.aboutTag, { color: colors.textMuted }]}>
            Offline-first · Local SQLite
          </Text>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Currency Selector Modal */}
      <Modal visible={showCurrencyModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Currency</Text>
              <TouchableOpacity onPress={() => setShowCurrencyModal(false)}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
              {Object.entries(SUPPORTED_CURRENCIES).map(([code, cur]) => {
                const isSelected = currentCurrency === code;
                return (
                  <TouchableOpacity
                    key={code}
                    style={[
                      styles.currencyItem,
                      {
                        backgroundColor: isSelected ? colors.surfaceAlt : 'transparent',
                        borderColor: isSelected ? colors.primary : 'transparent',
                      },
                    ]}
                    onPress={() => {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      setCurrency(code);
                      setShowCurrencyModal(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.currencyLeft}>
                      <View style={[styles.currencySymbolCircle, { backgroundColor: colors.surfaceAlt }]}>
                        <Text style={[styles.currencySymbol, { color: colors.text }]}>{cur.symbol}</Text>
                      </View>
                      <View>
                        <Text style={[styles.currencyName, { color: colors.text }]}>{cur.name}</Text>
                        <Text style={[styles.currencyCode, { color: colors.textMuted }]}>{code}</Text>
                      </View>
                    </View>

                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
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
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 54,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 20,
    gap: 12,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileDetails: {
    flex: 1,
  },
  profileName: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  profileEmail: {
    fontSize: 12,
    marginTop: 1,
  },
  signOutBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 6,
    paddingHorizontal: 2,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  activeThemeBadge: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 22,
  },
  themeCard: {
    width: '48.3%',
    borderRadius: 16,
    padding: 10,
    justifyContent: 'space-between',
  },
  miniPhoneFrame: {
    width: '100%',
    height: 90,
    borderRadius: 11,
    borderWidth: 1,
    padding: 7,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  miniStatusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  miniStatusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  miniStatusLine: {
    width: 22,
    height: 3,
    borderRadius: 1.5,
  },
  miniHeroCard: {
    borderRadius: 6,
    borderWidth: 1,
    padding: 6,
    gap: 4,
  },
  miniHeroPill: {
    width: 28,
    height: 4,
    borderRadius: 2,
  },
  miniHeroLine: {
    width: '65%',
    height: 3,
    borderRadius: 1.5,
  },
  miniBarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    height: 16,
  },
  miniBar: {
    width: 6,
    borderRadius: 2,
  },
  miniTabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 12,
    borderRadius: 5,
    borderWidth: 0.5,
  },
  miniTabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  themeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingHorizontal: 2,
  },
  themeMetaText: {
    flex: 1,
  },
  themeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  themeLabel: {
    fontSize: 13,
    letterSpacing: -0.2,
  },
  themeTagline: {
    fontSize: 10,
    marginTop: 1,
  },
  checkCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  settingsGroup: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 20,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  settingRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 1,
  },
  settingSubtitle: {
    fontSize: 12,
  },
  pinSetup: {
    padding: 16,
    gap: 12,
  },
  pinTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  pinInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    textAlign: 'center',
    fontSize: 20,
    letterSpacing: 8,
  },
  pinActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 14,
    marginTop: 4,
  },
  pinCancel: {
    fontSize: 13,
    fontWeight: '500',
  },
  pinSave: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  pinSaveText: {
    fontSize: 13,
    fontWeight: '600',
  },
  about: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
    gap: 3,
  },
  aboutApp: {
    fontSize: 12,
    fontWeight: '500',
  },
  aboutTag: {
    fontSize: 11,
  },
  bottomSpacer: {
    height: 30,
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
    paddingBottom: 36,
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
  currencyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  currencyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  currencySymbolCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '700',
  },
  currencyName: {
    fontSize: 14,
    fontWeight: '600',
  },
  currencyCode: {
    fontSize: 12,
    marginTop: 1,
  },
});
