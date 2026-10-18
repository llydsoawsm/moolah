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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../hooks/useTheme';
import { useAppStore } from '../../stores/app-store';
import { themes, themeOptions } from '../../lib/theme';
import { resetDatabase, getDatabase } from '../../db/client';
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

  const handleExportCSV = () => {
    try {
      const db = getDatabase();
      const rows = db.getAllSync<any>(
        `SELECT e.expense_date, e.amount, c.name as category, pm.name as payment_method, e.note
         FROM expenses e
         LEFT JOIN categories c ON e.category_id = c.id
         LEFT JOIN payment_methods pm ON e.payment_method_id = pm.id
         ORDER BY e.expense_date DESC`,
      );

      if (rows.length === 0) {
        Alert.alert('No Data', 'There are no expenses to export.');
        return;
      }

      const total = rows.reduce((s: number, r: any) => s + r.amount, 0);
      Alert.alert(
        'Export Summary',
        `${rows.length} expenses recorded totaling ₱${total.toFixed(2)}.`,
      );
    } catch (err) {
      Alert.alert('Error', 'Failed to export data.');
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
        <Animated.View entering={FadeInDown.duration(400).delay(100)}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>APPEARANCE</Text>
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
                      borderWidth: isActive ? 2 : StyleSheet.hairlineWidth,
                    },
                  ]}
                  onPress={() => setTheme(t.key)}
                  activeOpacity={0.7}
                >
                  <View style={styles.themeCardTop}>
                    {/* Clean Simple Vector Icon - No Emojis */}
                    <View
                      style={[
                        styles.themeIconWrapper,
                        {
                          backgroundColor: isActive ? tc.primary : tc.surfaceAlt,
                        },
                      ]}
                    >
                      <Ionicons
                        name={t.icon as any}
                        size={17}
                        color={isActive ? (tc.statusBar === 'light' ? '#09090B' : '#FFFFFF') : tc.primary}
                      />
                    </View>

                    {/* Highly visible color preview swatches */}
                    <View style={styles.themePreviewRow}>
                      <View style={[styles.themeColorDot, { backgroundColor: tc.primary }]} />
                      <View
                        style={[
                          styles.themeColorDot,
                          {
                            backgroundColor: tc.background,
                            borderColor: tc.border,
                            borderWidth: 1,
                          },
                        ]}
                      />
                    </View>
                  </View>

                  <View style={styles.themeBottom}>
                    <Text
                      style={[
                        styles.themeLabel,
                        {
                          color: colors.text,
                          fontWeight: isActive ? '700' : '500',
                        },
                      ]}
                    >
                      {t.label}
                    </Text>
                    {isActive ? (
                      <Ionicons name="checkmark-circle" size={16} color={tc.primary} />
                    ) : (
                      <Ionicons name="ellipse-outline" size={16} color={colors.textMuted} />
                    )}
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

        {/* Customization */}
        <Animated.View entering={FadeInDown.duration(400).delay(220)}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>CUSTOMIZATION</Text>
          <View style={[styles.settingsGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TouchableOpacity
              style={styles.settingRow}
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
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>DATA</Text>
          <View style={[styles.settingsGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TouchableOpacity style={styles.settingRow} onPress={handleExportCSV} activeOpacity={0.7}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: colors.surfaceAlt }]}>
                  <Ionicons name="download-outline" size={16} color={colors.textSecondary} />
                </View>
                <View>
                  <Text style={[styles.settingTitle, { color: colors.text }]}>Export Records</Text>
                  <Text style={[styles.settingSubtitle, { color: colors.textMuted }]}>
                    View CSV summary
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>

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
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 6,
    paddingHorizontal: 2,
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  themeCard: {
    width: '48.5%',
    borderRadius: 16,
    padding: 12,
    minHeight: 88,
    justifyContent: 'space-between',
  },
  themeCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  themeIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
  },
  themeColorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  themeBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  themeLabel: {
    fontSize: 13,
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
});
