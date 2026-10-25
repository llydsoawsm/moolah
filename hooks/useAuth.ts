// ============================================================
// Moolah — useAuth Hook (Authentication & Password Reset)
// ============================================================
import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import { getDatabase } from '../db/client';
import { useAppStore } from '../stores/app-store';
import type { User, PasswordResetRecord } from '../lib/types';

const SALT = '_moolah_security_salt_';
const LEGACY_SALT = '_moneyguide_security_salt_';
const WEB_USERS_KEY = 'moolah_web_users';
const WEB_RESETS_KEY = 'moolah_web_resets';

function getWebUsers(): Array<User & { password_hash: string }> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(WEB_USERS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveWebUser(user: User & { password_hash: string }) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const users = getWebUsers().filter((u) => u.email.toLowerCase() !== user.email.toLowerCase());
    users.push(user);
    window.localStorage.setItem(WEB_USERS_KEY, JSON.stringify(users));
  } catch (e) {
    console.error('Failed to save user in web storage:', e);
  }
}

function getWebResets(): PasswordResetRecord[] {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(WEB_RESETS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveWebReset(record: PasswordResetRecord) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const list = getWebResets();
    list.push(record);
    window.localStorage.setItem(WEB_RESETS_KEY, JSON.stringify(list));
  } catch {}
}

export function useAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentUser = useAppStore((s) => s.currentUser);
  const rememberMe = useAppStore((s) => s.rememberMe);
  const login = useAppStore((s) => s.login);
  const signOut = useAppStore((s) => s.signOut);
  const setRememberMe = useAppStore((s) => s.setRememberMe);

  /** Helper to hash password with SHA-256 (with graceful fallback if WebCrypto unavailable) */
  const hashPassword = useCallback(async (password: string): Promise<string> => {
    try {
      return await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        password + SALT,
      );
    } catch {
      // Deterministic fallback hash
      let hash = 0;
      const str = password + SALT;
      for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
      }
      return 'moolah_hash_' + Math.abs(hash).toString(16);
    }
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

        const hashedPassword = await hashPassword(passwordInput);
        let userRow: (User & { password_hash: string }) | null = null;

        // Try SQLite first
        try {
          const db = getDatabase();
          userRow = db.getFirstSync<User & { password_hash: string }>(
            'SELECT id, name, email, password_hash, created_at, updated_at FROM users WHERE LOWER(email) = ?',
            email,
          );
        } catch (sqliteErr) {
          console.warn('SQLite signIn query failed, checking web storage fallback:', sqliteErr);
        }

        // Check web fallback if not found in SQLite
        if (!userRow && Platform.OS === 'web') {
          const webUsers = getWebUsers();
          const found = webUsers.find((u) => u.email.toLowerCase() === email);
          if (found) {
            userRow = found;
          }
        }

        if (!userRow) {
          throw new Error('No account found with this email. Please sign up.');
        }

        if (userRow.password_hash !== hashedPassword) {
          // Check legacy salt and auto-migrate
          let legacyHashed = '';
          try {
            legacyHashed = await Crypto.digestStringAsync(
              Crypto.CryptoDigestAlgorithm.SHA256,
              passwordInput + LEGACY_SALT,
            );
          } catch {}

          if (legacyHashed && userRow.password_hash === legacyHashed) {
            try {
              const db = getDatabase();
              db.runSync('UPDATE users SET password_hash = ? WHERE id = ?', hashedPassword, userRow.id);
            } catch {}
            if (Platform.OS === 'web') {
              saveWebUser({ ...userRow, password_hash: hashedPassword });
            }
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
        if (!email || !/^[^s@]+@[^s@]+.[^s@]+$/.test(email)) {
          throw new Error('Please enter a valid email address (e.g. you@gmail.com).');
        }
        if (passwordInput.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }

        const id = 'user-' + Date.now();
        const hashedPassword = await hashPassword(passwordInput);

        // Try SQLite first
        let sqliteSuccess = false;
        try {
          const db = getDatabase();
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
          if (existing) {
            throw new Error('An account with this email already exists. Please sign in.');
          }

          db.runSync(
            'INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)',
            id,
            name,
            email,
            hashedPassword,
          );
          sqliteSuccess = true;
        } catch (sqliteErr: any) {
          if (sqliteErr.message?.includes('already exists')) {
            throw sqliteErr;
          }
          console.warn('SQLite signUp warning, relying on web storage fallback:', sqliteErr);
          if (Platform.OS === 'web') {
            const webUsers = getWebUsers();
            if (webUsers.some((u) => u.email.toLowerCase() === email)) {
              throw new Error('An account with this email already exists. Please sign in.');
            }
          } else {
            throw sqliteErr;
          }
        }

        // Always mirror to web storage if running on web
        if (Platform.OS === 'web') {
          saveWebUser({
            id,
            name,
            email,
            password_hash: hashedPassword,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
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

  /** Request password reset code */
  const requestPasswordReset = useCallback(
    async (emailInput: string) => {
      setLoading(true);
      setError(null);
      try {
        const email = emailInput.trim().toLowerCase();
        if (!email || !/^[^s@]+@[^s@]+.[^s@]+$/.test(email)) {
          throw new Error('Please enter a valid Gmail / email address.');
        }

        let userFound = false;
        try {
          const db = getDatabase();
          const user = db.getFirstSync<User>(
            'SELECT id, name, email FROM users WHERE LOWER(email) = ?',
            email,
          );
          if (user) userFound = true;
        } catch {}

        if (!userFound && Platform.OS === 'web') {
          const webUsers = getWebUsers();
          if (webUsers.some((u) => u.email.toLowerCase() === email)) {
            userFound = true;
          }
        }

        if (!userFound) {
          throw new Error('No account found with this email.');
        }

        // Generate 6-digit verification code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const id = 'reset-' + Date.now();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins

        try {
          const db = getDatabase();
          db.runSync('UPDATE password_resets SET used = 1 WHERE LOWER(email) = ?', email);
          db.runSync(
            'INSERT INTO password_resets (id, email, code, expires_at, used) VALUES (?, ?, ?, ?, 0)',
            id,
            email,
            code,
            expiresAt,
          );
        } catch {}

        if (Platform.OS === 'web') {
          saveWebReset({ id, email, code, expires_at: expiresAt, used: 0, created_at: new Date().toISOString() });
        }

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

        if (!email || !code) {
          throw new Error('Email and verification code are required.');
        }
        if (newPasswordInput.length < 6) {
          throw new Error('New password must be at least 6 characters.');
        }

        let record: PasswordResetRecord | null = null;
        try {
          const db = getDatabase();
          record = db.getFirstSync<PasswordResetRecord>(
            'SELECT * FROM password_resets WHERE LOWER(email) = ? AND code = ? AND used = 0 ORDER BY created_at DESC LIMIT 1',
            email,
            code,
          );
        } catch {}

        if (!record && Platform.OS === 'web') {
          const webResets = getWebResets();
          record = webResets.filter((r) => r.email.toLowerCase() === email && r.code === code && r.used === 0).pop() || null;
        }

        if (!record) {
          throw new Error('Invalid or expired verification code.');
        }

        // Check expiration
        if (new Date(record.expires_at).getTime() < Date.now()) {
          throw new Error('Verification code has expired. Please request a new one.');
        }

        const hashedPassword = await hashPassword(newPasswordInput);
        try {
          const db = getDatabase();
          db.runSync(
            "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE LOWER(email) = ?",
            hashedPassword,
            email,
          );
          db.runSync('UPDATE password_resets SET used = 1 WHERE id = ?', record.id);
        } catch {}

        if (Platform.OS === 'web') {
          const webUsers = getWebUsers();
          const target = webUsers.find((u) => u.email.toLowerCase() === email);
          if (target) {
            target.password_hash = hashedPassword;
            saveWebUser(target);
          }
        }

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
