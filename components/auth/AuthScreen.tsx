// ============================================================
// MoneyGuide — Minimalist Auth Screen (Sign In, Sign Up & Forgot Password)
// ============================================================
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

type AuthMode = 'sign_in' | 'sign_up' | 'forgot_password';

export default function AuthScreen() {
  const { colors } = useTheme();
  const { signIn, signUp, requestPasswordReset, resetPassword, loading } = useAuth();

  const [mode, setMode] = useState<AuthMode>('sign_in');

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Forgot Password Step
  const [resetStep, setResetStep] = useState<1 | 2>(1);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Required', 'Please enter your email and password.');
      return;
    }
    const res = await signIn(email, password, rememberMe);
    if (res.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Sign In Failed', res.error || 'Invalid credentials.');
    }
  };

  const handleSignUp = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter your name.');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Required', 'Please enter your Gmail / email address.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Invalid Password', 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }

    const res = await signUp(name, email, password, rememberMe);
    if (res.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Registration Failed', res.error || 'Failed to create account.');
    }
  };

  const handleSendResetCode = async () => {
    if (!email.trim()) {
      Alert.alert('Email Required', 'Please enter your registered Gmail address.');
      return;
    }
    const res = await requestPasswordReset(email);
    if (res.success && res.code) {
      setGeneratedCode(res.code);
      setResetStep(2);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Reset Failed', res.error || 'Failed to send reset code.');
    }
  };

  const handleCompleteReset = async () => {
    if (!resetCode.trim()) {
      Alert.alert('Code Required', 'Please enter the 6-digit verification code.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Invalid Password', 'New password must be at least 6 characters.');
      return;
    }

    const res = await resetPassword(email, resetCode, newPassword);
    if (res.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Password Updated', 'You can now sign in with your new password.');
      setMode('sign_in');
      setPassword('');
      setResetStep(1);
      setGeneratedCode(null);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Reset Failed', res.error || 'Could not reset password.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand / Logo */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.brandContainer}>
          <View style={[styles.logoCircle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="wallet-outline" size={26} color={colors.text} />
          </View>
          <Text style={[styles.brandName, { color: colors.text }]}>Moolah</Text>
          <Text style={[styles.brandSubtitle, { color: colors.textMuted }]}>
            {mode === 'sign_in' && 'Welcome back. Sign in to your account.'}
            {mode === 'sign_up' && 'Create your account to track finances.'}
            {mode === 'forgot_password' && 'Account recovery & password reset.'}
          </Text>
        </Animated.View>

        {/* ===================== SIGN IN MODE ===================== */}
        {mode === 'sign_in' && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.formCard}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>EMAIL (GMAIL)</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="yourname@gmail.com"
                  placeholderTextColor={colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>PASSWORD</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Remember Me Row */}
            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={styles.rememberMeRow}
                onPress={() => setRememberMe(!rememberMe)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      backgroundColor: rememberMe ? colors.text : 'transparent',
                      borderColor: rememberMe ? colors.text : colors.border,
                    },
                  ]}
                >
                  {rememberMe && <Ionicons name="checkmark" size={12} color={colors.background} />}
                </View>
                <Text style={[styles.rememberMeText, { color: colors.textSecondary }]}>
                  Remember me
                </Text>
              </TouchableOpacity>
            </View>

            {/* Action Button */}
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.text }]}
              onPress={handleSignIn}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={colors.background} size="small" />
              ) : (
                <Text style={[styles.primaryButtonText, { color: colors.background }]}>
                  Sign In
                </Text>
              )}
            </TouchableOpacity>

            {/* Switch Mode */}
            <View style={styles.footerRow}>
              <Text style={[styles.footerText, { color: colors.textMuted }]}>
                Don't have an account?{' '}
              </Text>
              <TouchableOpacity onPress={() => setMode('sign_up')}>
                <Text style={[styles.footerLink, { color: colors.text }]}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* ===================== SIGN UP MODE ===================== */}
        {mode === 'sign_up' && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.formCard}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>FULL NAME</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="person-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Jane Doe"
                  placeholderTextColor={colors.textMuted}
                  value={name}
                  onChangeText={setName}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>GMAIL / EMAIL</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="yourname@gmail.com"
                  placeholderTextColor={colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>PASSWORD</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Min. 6 characters"
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>CONFIRM PASSWORD</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="checkmark-circle-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Repeat password"
                  placeholderTextColor={colors.textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* Remember Me */}
            <TouchableOpacity
              style={[styles.rememberMeRow, { marginBottom: 18 }]}
              onPress={() => setRememberMe(!rememberMe)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    backgroundColor: rememberMe ? colors.text : 'transparent',
                    borderColor: rememberMe ? colors.text : colors.border,
                  },
                ]}
              >
                {rememberMe && <Ionicons name="checkmark" size={12} color={colors.background} />}
              </View>
              <Text style={[styles.rememberMeText, { color: colors.textSecondary }]}>
                Remember me on this device
              </Text>
            </TouchableOpacity>

            {/* Action Button */}
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.text }]}
              onPress={handleSignUp}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={colors.background} size="small" />
              ) : (
                <Text style={[styles.primaryButtonText, { color: colors.background }]}>
                  Create Account
                </Text>
              )}
            </TouchableOpacity>

            {/* Switch Mode */}
            <View style={styles.footerRow}>
              <Text style={[styles.footerText, { color: colors.textMuted }]}>
                Already have an account?{' '}
              </Text>
              <TouchableOpacity onPress={() => setMode('sign_in')}>
                <Text style={[styles.footerLink, { color: colors.text }]}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* ===================== FORGOT PASSWORD MODE ===================== */}
        {mode === 'forgot_password' && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.formCard}>
            {resetStep === 1 ? (
              <>
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>REGISTERED GMAIL</Text>
                  <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: colors.text }]}
                      placeholder="yourname@gmail.com"
                      placeholderTextColor={colors.textMuted}
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: colors.text }]}
                  onPress={handleSendResetCode}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.background} size="small" />
                  ) : (
                    <Text style={[styles.primaryButtonText, { color: colors.background }]}>
                      Send Verification Code
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Notification Banner showing generated code */}
                {generatedCode && (
                  <View style={[styles.codeBanner, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                    <Ionicons name="information-circle-outline" size={18} color={colors.text} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.bannerTitle, { color: colors.text }]}>Reset Code Sent</Text>
                      <Text style={[styles.bannerText, { color: colors.textMuted }]}>
                        Code for {email}:{' '}
                        <Text style={{ fontWeight: '700', color: colors.text }}>{generatedCode}</Text>
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setResetCode(generatedCode);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      style={[styles.fillBtn, { backgroundColor: colors.text }]}
                    >
                      <Text style={[styles.fillBtnText, { color: colors.background }]}>Autofill</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>6-DIGIT CODE</Text>
                  <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Ionicons name="key-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: colors.text, letterSpacing: 4, fontWeight: '600' }]}
                      placeholder="123456"
                      placeholderTextColor={colors.textMuted}
                      value={resetCode}
                      onChangeText={setResetCode}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>NEW PASSWORD</Text>
                  <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: colors.text }]}
                      placeholder="New password (min 6 chars)"
                      placeholderTextColor={colors.textMuted}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: colors.text }]}
                  onPress={handleCompleteReset}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.background} size="small" />
                  ) : (
                    <Text style={[styles.primaryButtonText, { color: colors.background }]}>
                      Update Password
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* Back to Sign In */}
            <View style={styles.footerRow}>
              <TouchableOpacity onPress={() => setMode('sign_in')}>
                <Text style={[styles.footerLink, { color: colors.text }]}>← Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  brandName: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  brandSubtitle: {
    fontSize: 13,
    textAlign: 'center',
  },
  formCard: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    height: 48,
    ...(Platform.OS === 'web'
      ? ({
          outlineStyle: 'none',
          outlineWidth: 0,
          outlineColor: 'transparent',
        } as any)
      : {}),
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: '100%',
    ...(Platform.OS === 'web'
      ? ({
          outlineStyle: 'none',
          outlineWidth: 0,
          outlineColor: 'transparent',
          boxShadow: 'none',
        } as any)
      : {}),
  },
  eyeBtn: {
    padding: 6,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 2,
  },
  rememberMeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rememberMeText: {
    fontSize: 13,
    fontWeight: '400',
  },
  forgotText: {
    fontSize: 12,
    fontWeight: '500',
  },
  primaryButton: {
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '600',
  },
  codeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
    gap: 10,
  },
  bannerTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  bannerText: {
    fontSize: 11,
    marginTop: 2,
  },
  fillBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  fillBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
