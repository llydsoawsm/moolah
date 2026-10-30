// ============================================================
// MoneyGuide — Minimalist Lock Screen (PIN & Biometric Unlock)
// ============================================================
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../hooks/useTheme';
import { useAppStore } from '../../stores/app-store';
import { supabase } from '../../lib/supabase';
import { getDatabase } from '../../db/client';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  FadeIn,
} from 'react-native-reanimated';

export default function LockScreen() {
  const { colors } = useTheme();
  const pinHash = useAppStore((s) => s.pinHash);
  const biometricEnabled = useAppStore((s) => s.biometricEnabled);
  const setUnlocked = useAppStore((s) => s.setUnlocked);
  const verifyPin = useAppStore((s) => s.verifyPin);
  const setPinHash = useAppStore((s) => s.setPinHash);
  const setBiometricEnabled = useAppStore((s) => s.setBiometricEnabled);
  const currentUser = useAppStore((s) => s.currentUser);
  const signOut = useAppStore((s) => s.signOut);

  const [enteredPin, setEnteredPin] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Secure Password Modal for PIN Reset
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [verifyPasswordInput, setVerifyPasswordInput] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Shake animation on error
  const shakeOffset = useSharedValue(0);

  const animatedShakeStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: shakeOffset.value }],
    };
  });

  const triggerShake = () => {
    shakeOffset.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-6, { duration: 50 }),
      withTiming(6, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  };

  useEffect(() => {
    if (biometricEnabled) {
      handleBiometricAuth();
    }
  }, [biometricEnabled]);

  const handleBiometricAuth = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && isEnrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Unlock Moolah',
          fallbackLabel: 'Use PIN',
          cancelLabel: 'Cancel',
        });

        if (result.success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setUnlocked(true);
        }
      }
    } catch (err) {
      console.log('Biometric auth error:', err);
    }
  };

  const handlePressDigit = async (digit: string) => {
    if (verifying) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextPin = enteredPin + digit;
    setEnteredPin(nextPin);

    // Minimum standard PIN length is 4
    if (nextPin.length >= 4) {
      setVerifying(true);
      const isValid = await verifyPin(nextPin);
      if (isValid) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setUnlocked(true);
      } else {
        // If wrong and reached expected length or 6 digits, reject
        if (nextPin.length >= 6 || (pinHash.length === 4 && nextPin.length === 4)) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          triggerShake();
          setTimeout(() => {
            setEnteredPin('');
            setVerifying(false);
          }, 300);
          return;
        }
      }
      setVerifying(false);
    }
  };

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEnteredPin((prev) => prev.slice(0, -1));
  };

  const handleForgotPin = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // 1. If biometric is enrolled, attempt biometric verification first
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (hasHardware && isEnrolled) {
        const bioRes = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Verify Identity to Reset PIN',
          fallbackLabel: 'Use Password',
          cancelLabel: 'Cancel',
        });
        if (bioRes.success) {
          Alert.alert(
            'Biometric Verified',
            'Your identity has been verified. Would you like to remove your PIN protection?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Remove PIN',
                style: 'destructive',
                onPress: () => {
                  setPinHash('');
                  setBiometricEnabled(false);
                  setUnlocked(true);
                },
              },
            ],
          );
          return;
        }
      }
    } catch {}

    // 2. Fallback: prompt for user account password verification
    setPasswordError('');
    setVerifyPasswordInput('');
    setShowPasswordModal(true);
  };

  const handleVerifyAccountPassword = async () => {
    if (!verifyPasswordInput.trim()) {
      setPasswordError('Please enter your account password.');
      return;
    }
    setVerifyingPassword(true);
    setPasswordError('');

    try {
      let isVerified = false;

      // Online Supabase check
      if (currentUser?.email) {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: currentUser.email,
            password: verifyPasswordInput,
          });
          if (!error && data?.user) {
            isVerified = true;
          }
        } catch {}
      }

      // Offline fallback: check local user database
      if (!isVerified && currentUser?.email) {
        try {
          const db = getDatabase();
          const userRow = db.getFirstSync<{ password_hash: string }>(
            'SELECT password_hash FROM users WHERE LOWER(email) = ?',
            currentUser.email.toLowerCase(),
          );
          if (userRow?.password_hash) {
            // Check if password hash matches
            const { digestStringAsync, CryptoDigestAlgorithm } = await import('expo-crypto');
            const hashed = await digestStringAsync(
              CryptoDigestAlgorithm.SHA256,
              verifyPasswordInput + '_moolah_security_salt_',
            );
            if (hashed === userRow.password_hash) {
              isVerified = true;
            }
          }
        } catch {}
      }

      if (isVerified) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setPinHash('');
        setBiometricEnabled(false);
        setShowPasswordModal(false);
        setUnlocked(true);
        Alert.alert('PIN Removed', 'PIN protection has been reset. You may configure a new PIN in Settings.');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setPasswordError('Incorrect account password. Please try again.');
      }
    } catch (err: any) {
      setPasswordError(err.message || 'Verification failed.');
    } finally {
      setVerifyingPassword(false);
    }
  };

  const handleSignOutFromLock = () => {
    Alert.alert(
      'Sign Out',
      'Signing out will lock access and return to the login screen.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            signOut();
          },
        },
      ],
    );
  };

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.iconCircle, { backgroundColor: colors.surfaceAlt }]}>
          <Ionicons name="lock-closed-outline" size={22} color={colors.textSecondary} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Enter PIN</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Unlock your finance tracker
        </Text>
      </View>

      {/* PIN Dots */}
      <Animated.View style={[styles.dotsContainer, animatedShakeStyle]}>
        {Array.from({ length: pinHash.length || 4 }).map((_, index) => {
          const filled = index < enteredPin.length;
          return (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor: filled ? colors.text : 'transparent',
                  borderColor: filled ? colors.text : colors.border,
                },
              ]}
            />
          );
        })}
      </Animated.View>

      {/* Keypad */}
      <View style={styles.keypad}>
        {[
          ['1', '2', '3'],
          ['4', '5', '6'],
          ['7', '8', '9'],
        ].map((row, rIdx) => (
          <View key={rIdx} style={styles.keypadRow}>
            {row.map((digit) => (
              <TouchableOpacity
                key={digit}
                style={[styles.keyButton, { backgroundColor: colors.surface }]}
                onPress={() => handlePressDigit(digit)}
                activeOpacity={0.6}
              >
                <Text style={[styles.keyText, { color: colors.text }]}>{digit}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {/* Bottom Keypad Row */}
        <View style={styles.keypadRow}>
          {biometricEnabled ? (
            <TouchableOpacity
              style={[styles.keyButton, styles.specialKey]}
              onPress={handleBiometricAuth}
              activeOpacity={0.6}
            >
              <Ionicons name="finger-print-outline" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : (
            <View style={[styles.keyButton, styles.specialKey]} />
          )}

          <TouchableOpacity
            style={[styles.keyButton, { backgroundColor: colors.surface }]}
            onPress={() => handlePressDigit('0')}
            activeOpacity={0.6}
          >
            <Text style={[styles.keyText, { color: colors.text }]}>0</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.keyButton, styles.specialKey]}
            onPress={handleDelete}
            activeOpacity={0.6}
          >
            <Ionicons name="backspace-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Action Footer */}
      <View style={styles.footerActionRow}>
        <TouchableOpacity
          style={styles.forgotButton}
          onPress={handleForgotPin}
          activeOpacity={0.7}
        >
          <Text style={[styles.forgotText, { color: colors.textMuted }]}>Forgot PIN?</Text>
        </TouchableOpacity>

        <Text style={{ color: colors.border, marginHorizontal: 8 }}>•</Text>

        <TouchableOpacity
          style={styles.forgotButton}
          onPress={handleSignOutFromLock}
          activeOpacity={0.7}
        >
          <Text style={[styles.forgotText, { color: colors.textMuted }]}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Password Verification Modal for Resetting PIN */}
      <Modal
        visible={showPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconWrap, { backgroundColor: colors.surfaceAlt }]}>
                <Ionicons name="shield-checkmark-outline" size={24} color={colors.text} />
              </View>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Verify Identity</Text>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                Enter the password for {currentUser?.email || 'your account'} to reset PIN protection.
              </Text>
            </View>

            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: colors.background,
                  borderColor: passwordError ? '#EF4444' : colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="Account Password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              value={verifyPasswordInput}
              onChangeText={(t) => {
                setVerifyPasswordInput(t);
                setPasswordError('');
              }}
              autoCapitalize="none"
              autoFocus
            />

            {passwordError ? (
              <Text style={styles.errorText}>{passwordError}</Text>
            ) : null}

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.surfaceAlt }]}
                onPress={() => {
                  setShowPasswordModal(false);
                  setVerifyPasswordInput('');
                  setPasswordError('');
                }}
              >
                <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.text }]}
                onPress={handleVerifyAccountPassword}
                disabled={verifyingPassword}
              >
                {verifyingPassword ? (
                  <ActivityIndicator color={colors.background} size="small" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: colors.background, fontWeight: '600' }]}>
                    Verify & Reset
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 40,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
  },
  keypad: {
    width: '100%',
    maxWidth: 290,
    gap: 14,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  keyButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  specialKey: {
    backgroundColor: 'transparent',
  },
  keyText: {
    fontSize: 24,
    fontWeight: '400',
  },
  forgotButton: {
    padding: 8,
  },
  forgotText: {
    fontSize: 12,
    fontWeight: '500',
  },
  footerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  modalInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 15,
    marginBottom: 10,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
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
  },
});
