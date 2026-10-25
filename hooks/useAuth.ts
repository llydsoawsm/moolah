// ============================================================
// Moolah — useAuth Hook (Supabase & Persistent Auth)
// ============================================================
import { useState, useCallback } from 'react';
import * as Crypto from 'expo-crypto';
import { getDatabase } from '../db/client';
import { useAppStore } from '../stores/app-store';
import { supabase } from '../lib/supabase';
import type { User, PasswordResetRecord } from '../lib/types';

const SALT = '_moolah_security_salt_';

export function useAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentUser = useAppStore((s) => s.currentUser);
  const rememberMe = useAppStore((s) => s.rememberMe);
  const login = useAppStore((s) => s.login);
  const signOutStore = useAppStore((s) => s.signOut);
  const setRememberMe = useAppStore((s) => s.setRememberMe);

  /** Helper to hash password with SHA-256 */
  const hashPassword = useCallback(async (password: string): Promise<string> => {
    try {
      return await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        password + SALT,
      );
    } catch {
      let hash = 0;
      const str = password + SALT;
      for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
      }
      return 'moolah_hash_' + Math.abs(hash).toString(16);
    }
  }, []);

  /** Sign In with Supabase & Local Database */
  const signIn = useCallback(
    async (emailInput: string, passwordInput: string, remember: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const email = emailInput.trim().toLowerCase();
        if (!email || !passwordInput) {
          throw new Error('Please enter both email and password.');
        }

        let authenticatedUser: User | null = null;

        // 1. Attempt Supabase Auth
        try {
          const { data: supaData, error: supaErr } = await supabase.auth.signInWithPassword({
            email,
            password: passwordInput,
          });

          if (!supaErr && supaData?.user) {
            authenticatedUser = {
              id: supaData.user.id,
              name: supaData.user.user_metadata?.name || email.split('@')[0],
              email: supaData.user.email || email,
              created_at: supaData.user.created_at,
            };
          }
        } catch (supaErr) {
          console.warn('Supabase signIn notice:', supaErr);
        }

        // 2. Check Database if not authenticated via Supabase
        if (!authenticatedUser) {
          const hashedPassword = await hashPassword(passwordInput);
          const db = getDatabase();
          const userRow = db.getFirstSync<User & { password_hash: string }>(
            'SELECT id, name, email, password_hash, created_at, updated_at FROM users WHERE LOWER(email) = ?',
            email,
          );

          if (userRow) {
            if (userRow.password_hash === hashedPassword) {
              authenticatedUser = {
                id: userRow.id,
                name: userRow.name,
                email: userRow.email,
                created_at: userRow.created_at,
                updated_at: userRow.updated_at,
              };
            } else {
              throw new Error('Incorrect password. Please try again.');
            }
          }
        }

        if (!authenticatedUser) {
          throw new Error('No account found with this email. Please sign up.');
        }

        login(authenticatedUser, remember);
        return { success: true, user: authenticatedUser };
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

  /** Sign Up new user with Supabase & Local Database */
  const signUp = useCallback(
    async (nameInput: string, emailInput: string, passwordInput: string, remember: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const name = nameInput.trim();
        const email = emailInput.trim().toLowerCase();

        if (!name) throw new Error('Please enter your full name.');
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          throw new Error('Please enter a valid email address.');
        }
        if (passwordInput.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }

        // 1. Supabase Auth registration
        let supaUserId: string | null = null;
        try {
          const { data: supaData, error: supaErr } = await supabase.auth.signUp({
            email,
            password: passwordInput,
            options: {
              data: { name },
            },
          });

          if (supaErr) {
            if (supaErr.message.toLowerCase().includes('already registered')) {
              throw new Error('An account with this email already exists. Please sign in.');
            }
            console.warn('Supabase Auth notice:', supaErr.message);
          } else if (supaData?.user) {
            supaUserId = supaData.user.id;
          }
        } catch (err: any) {
          if (err.message?.includes('already exists')) throw err;
          console.warn('Supabase signup notice:', err.message);
        }

        // 2. Persist user into database
        const id = supaUserId || 'user-' + Date.now();
        const hashedPassword = await hashPassword(passwordInput);
        const db = getDatabase();

        try {
          db.execSync(`
            CREATE TABLE IF NOT EXISTS users (
              id              TEXT PRIMARY KEY,
              name            TEXT NOT NULL,
              email           TEXT UNIQUE NOT NULL,
              password_hash   TEXT NOT NULL,
              created_at      TEXT DEFAULT (datetime('now')),
              updated_at      TEXT DEFAULT (datetime('now'))
            );
          `);

          const existing = db.getFirstSync<{ id: string }>(
            'SELECT id FROM users WHERE LOWER(email) = ?',
            email,
          );
          if (existing && !supaUserId) {
            throw new Error('An account with this email already exists. Please sign in.');
          }

          db.runSync(
            'INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)',
            id,
            name,
            email,
            hashedPassword,
          );
        } catch (sqliteErr: any) {
          if (sqliteErr.message?.includes('already exists')) throw sqliteErr;
        }

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

  /** Sign Out */
  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    signOutStore();
  }, [signOutStore]);

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

        // Try Supabase password reset email
        try {
          await supabase.auth.resetPasswordForEmail(email);
        } catch {}

        const db = getDatabase();
        const user = db.getFirstSync<User>(
          'SELECT id, name, email FROM users WHERE LOWER(email) = ?',
          email,
        );

        // Generate 6-digit verification code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const id = 'reset-' + Date.now();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

        try {
          db.runSync('UPDATE password_resets SET used = 1 WHERE LOWER(email) = ?', email);
          db.runSync(
            'INSERT INTO password_resets (id, email, code, expires_at, used) VALUES (?, ?, ?, ?, 0)',
            id,
            email,
            code,
            expiresAt,
          );
        } catch {}

        return {
          success: true,
          code,
          email,
          message: 'Verification code generated for ' + email + '.',
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

        if (!email || !code) throw new Error('Email and verification code are required.');
        if (newPasswordInput.length < 6) throw new Error('New password must be at least 6 characters.');

        const db = getDatabase();
        const record = db.getFirstSync<PasswordResetRecord>(
          'SELECT * FROM password_resets WHERE LOWER(email) = ? AND code = ? AND used = 0 ORDER BY created_at DESC LIMIT 1',
          email,
          code,
        );

        if (!record) throw new Error('Invalid or expired verification code.');
        if (new Date(record.expires_at).getTime() < Date.now()) {
          throw new Error('Verification code has expired. Please request a new one.');
        }

        const hashedPassword = await hashPassword(newPasswordInput);
        try {
          db.runSync(
            "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE LOWER(email) = ?",
            hashedPassword,
            email,
          );
          db.runSync('UPDATE password_resets SET used = 1 WHERE id = ?', record.id);
        } catch {}

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