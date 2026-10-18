// ============================================================
// MoneyGuide — useAuth Hook (Authentication & Password Reset)
// ============================================================
import { useState, useCallback } from 'react';
import * as Crypto from 'expo-crypto';
import { getDatabase } from '../db/client';
import { useAppStore } from '../stores/app-store';
import type { User, PasswordResetRecord } from '../lib/types';

const SALT = '_moolah_security_salt_';
const LEGACY_SALT = '_moneyguide_security_salt_';

export function useAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentUser = useAppStore((s) => s.currentUser);
  const rememberMe = useAppStore((s) => s.rememberMe);
  const login = useAppStore((s) => s.login);
  const signOut = useAppStore((s) => s.signOut);
  const setRememberMe = useAppStore((s) => s.setRememberMe);

  /** Helper to hash password with SHA-256 */
  const hashPassword = useCallback(async (password: string): Promise<string> => {
    return await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      password + SALT,
    );
  }, []);

  /** Sign In with Email & Password */
  const signIn = useCallback(
    async (emailInput: string, passwordInput: string, remember: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const email = emailInput.trim().toLowerCase();
        if (!email || !passwordInput) {
          throw new Error('Please enter both email and password.');
        }

        const db = getDatabase();
        const hashedPassword = await hashPassword(passwordInput);

        const userRow = db.getFirstSync<User & { password_hash: string }>(
          'SELECT id, name, email, password_hash, created_at, updated_at FROM users WHERE LOWER(email) = ?',
          email,
        );

        if (!userRow) {
          throw new Error('No account found with this email. Please sign up.');
        }

        if (userRow.password_hash !== hashedPassword) {
          // Check legacy salt and auto-migrate
          const legacyHashed = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            passwordInput + LEGACY_SALT,
          );
          if (userRow.password_hash === legacyHashed) {
            db.runSync('UPDATE users SET password_hash = ? WHERE id = ?', hashedPassword, userRow.id);
          } else {
            throw new Error('Incorrect password. Please try again.');
          }
        }

        const user: User = {
          id: userRow.id,
          name: userRow.name,
          email: userRow.email,
          created_at: userRow.created_at,
          updated_at: userRow.updated_at,
        };

        login(user, remember);
        return { success: true, user };
      } catch (err: any) {
        const msg = err.message || 'Failed to sign in.';
        setError(msg);
        return { success: false, error: msg };
      } finally {
        setLoading(false);
      }
    },
    [hashPassword, login],
  );

  /** Sign Up new user */
  const signUp = useCallback(
    async (nameInput: string, emailInput: string, passwordInput: string, remember: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const name = nameInput.trim();
        const email = emailInput.trim().toLowerCase();

        if (!name) {
          throw new Error('Please enter your full name.');
        }
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          throw new Error('Please enter a valid email address (e.g. you@gmail.com).');
        }
        if (passwordInput.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }

        const db = getDatabase();

        // Check if email already registered
        const existing = db.getFirstSync<{ id: string }>(
          'SELECT id FROM users WHERE LOWER(email) = ?',
          email,
        );
        if (existing) {
          throw new Error('An account with this email already exists. Please sign in.');
        }

        const id = 'user-' + Date.now();
        const hashedPassword = await hashPassword(passwordInput);

        db.runSync(
          'INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)',
          id,
          name,
          email,
          hashedPassword,
        );

        const newUser: User = {
          id,
          name,
          email,
          created_at: new Date().toISOString(),
        };

        login(newUser, remember);
        return { success: true, user: newUser };
      } catch (err: any) {
        const msg = err.message || 'Failed to create account.';
        setError(msg);
        return { success: false, error: msg };
      } finally {
        setLoading(false);
      }
    },
    [hashPassword, login],
  );

  /** Request password reset code */
  const requestPasswordReset = useCallback(
    async (emailInput: string) => {
      setLoading(true);
      setError(null);
      try {
        const email = emailInput.trim().toLowerCase();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          throw new Error('Please enter a valid Gmail / email address.');
        }

        const db = getDatabase();
        const user = db.getFirstSync<User>(
          'SELECT id, name, email FROM users WHERE LOWER(email) = ?',
          email,
        );

        if (!user) {
          throw new Error('No account found with this email.');
        }

        // Generate 6-digit verification code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const id = 'reset-' + Date.now();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins

        // Invalidate older unused reset codes for this email
        db.runSync('UPDATE password_resets SET used = 1 WHERE LOWER(email) = ?', email);

        // Save new code
        db.runSync(
          'INSERT INTO password_resets (id, email, code, expires_at, used) VALUES (?, ?, ?, ?, 0)',
          id,
          email,
          code,
          expiresAt,
        );

        return {
          success: true,
          code,
          email,
          message: `Verification code generated for ${email}.`,
        };
      } catch (err: any) {
        const msg = err.message || 'Failed to send reset code.';
        setError(msg);
        return { success: false, error: msg };
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /** Verify code and update password */
  const resetPassword = useCallback(
    async (emailInput: string, codeInput: string, newPasswordInput: string) => {
      setLoading(true);
      setError(null);
      try {
        const email = emailInput.trim().toLowerCase();
        const code = codeInput.trim();

        if (!email || !code) {
          throw new Error('Email and verification code are required.');
        }
        if (newPasswordInput.length < 6) {
          throw new Error('New password must be at least 6 characters.');
        }

        const db = getDatabase();

        const record = db.getFirstSync<PasswordResetRecord>(
          'SELECT * FROM password_resets WHERE LOWER(email) = ? AND code = ? AND used = 0 ORDER BY created_at DESC LIMIT 1',
          email,
          code,
        );

        if (!record) {
          throw new Error('Invalid or expired verification code.');
        }

        // Check expiration
        if (new Date(record.expires_at).getTime() < Date.now()) {
          throw new Error('Verification code has expired. Please request a new one.');
        }

        // Update password in users table
        const hashedPassword = await hashPassword(newPasswordInput);
        db.runSync(
          "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE LOWER(email) = ?",
          hashedPassword,
          email,
        );

        // Mark code as used
        db.runSync('UPDATE password_resets SET used = 1 WHERE id = ?', record.id);

        return { success: true };
      } catch (err: any) {
        const msg = err.message || 'Failed to reset password.';
        setError(msg);
        return { success: false, error: msg };
      } finally {
        setLoading(false);
      }
    },
    [hashPassword],
  );

  return {
    currentUser,
    rememberMe,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    requestPasswordReset,
    resetPassword,
    setRememberMe,
  };
}
