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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../hooks/useTheme';
import { useAppStore } from '../../stores/app-store';
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

  const [enteredPin, setEnteredPin] = useState('');

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

  const handlePressDigit = (digit: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextPin = enteredPin + digit;
    setEnteredPin(nextPin);

    if (nextPin.length === pinHash.length) {
      if (nextPin === pinHash) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setUnlocked(true);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        triggerShake();
        setTimeout(() => setEnteredPin(''), 300);
      }
    }
  };

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEnteredPin((prev) => prev.slice(0, -1));
  };

  const handleForgotPin = () => {
    Alert.alert(
      'Reset PIN',
      'Resetting your PIN will unlock the app while preserving all your stored data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset PIN',
          style: 'destructive',
          onPress: () => {
            useAppStore.getState().setPinHash('');
            useAppStore.getState().setBiometricEnabled(false);
            setUnlocked(true);
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

      {/* Forgot PIN */}
      <TouchableOpacity
        style={styles.forgotButton}
        onPress={handleForgotPin}
        activeOpacity={0.7}
      >
        <Text style={[styles.forgotText, { color: colors.textMuted }]}>Forgot PIN?</Text>
      </TouchableOpacity>
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
    marginTop: 32,
    padding: 8,
  },
  forgotText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
