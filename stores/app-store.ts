// ============================================================
// MoneyGuide — Zustand App Store
// ============================================================
import { create } from 'zustand';
import type { ThemeName, AnalyticsPeriod, AnalyticsMode, User } from '../lib/types';
import { getDatabase } from '../db/client';
import { DEFAULT_GEMINI_API_KEY, DEFAULT_GEMINI_MODEL } from '../lib/ai/config';

interface AppState {
  // User Authentication
  currentUser: User | null;
  rememberMe: boolean;
  login: (user: User, rememberMe: boolean) => void;
  signOut: () => void;
  setRememberMe: (remember: boolean) => void;

  // Theme
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;

  // Currency
  currency: string;
  setCurrency: (code: string) => void;

  // App Lock (PIN & Biometrics)
  isUnlocked: boolean;
  pinHash: string;
  biometricEnabled: boolean;
  setUnlocked: (unlocked: boolean) => void;
  setPinHash: (hash: string) => void;
  setBiometricEnabled: (enabled: boolean) => void;

  // Analytics period & mode
  analyticsPeriod: AnalyticsPeriod;
  setAnalyticsPeriod: (period: AnalyticsPeriod) => void;
  analyticsMode: AnalyticsMode;
  setAnalyticsMode: (mode: AnalyticsMode) => void;

  // Database initialized
  dbReady: boolean;
  setDbReady: (ready: boolean) => void;

  // Refresh trigger (increment to trigger re-fetch in hooks)
  refreshKey: number;
  triggerRefresh: () => void;

  // AI Copilot
  geminiApiKey: string;
  setGeminiApiKey: (key: string) => void;
  geminiModel: string;
  setGeminiModel: (model: string) => void;

  // Load preferences from database
  loadPreferences: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // User Authentication
  currentUser: null,
  rememberMe: true,

  login: (user, rememberMe) => {
    set({ currentUser: user, rememberMe });
    try {
      const db = getDatabase();
      db.runSync(
        "INSERT OR REPLACE INTO user_preferences (key, value) VALUES ('current_user_id', ?)",
        user.id,
      );
      db.runSync(
        "INSERT OR REPLACE INTO user_preferences (key, value) VALUES ('remember_me', ?)",
        String(rememberMe),
      );
    } catch (e) {
      console.error('Error saving login state:', e);
    }
  },

  signOut: () => {
    set({ currentUser: null, isUnlocked: true });
    try {
      const db = getDatabase();
      db.runSync("DELETE FROM user_preferences WHERE key = 'current_user_id'");
    } catch (e) {
      console.error('Error signing out:', e);
    }
  },

  setRememberMe: (remember) => {
    set({ rememberMe: remember });
    try {
      const db = getDatabase();
      db.runSync(
        "INSERT OR REPLACE INTO user_preferences (key, value) VALUES ('remember_me', ?)",
        String(remember),
      );
    } catch {}
  },

  // Theme
  theme: 'dark',
  setTheme: (theme) => {
    set({ theme });
    try {
      const db = getDatabase();
      db.runSync("INSERT OR REPLACE INTO user_preferences (key, value) VALUES ('theme', ?)", theme);
    } catch {}
  },

  // Currency
  currency: 'PHP',
  setCurrency: (currency) => {
    set({ currency });
    try {
      const db = getDatabase();
      db.runSync("INSERT OR REPLACE INTO user_preferences (key, value) VALUES ('currency', ?)", currency);
      get().triggerRefresh();
    } catch {}
  },

  // Auth / App Lock
  isUnlocked: true,
  pinHash: '',
  biometricEnabled: false,
  setUnlocked: (unlocked) => set({ isUnlocked: unlocked }),
  setPinHash: (hash) => {
    set({ pinHash: hash });
    try {
      const db = getDatabase();
      db.runSync("INSERT OR REPLACE INTO user_preferences (key, value) VALUES ('pin_hash', ?)", hash);
    } catch {}
  },
  setBiometricEnabled: (enabled) => {
    set({ biometricEnabled: enabled });
    try {
      const db = getDatabase();
      db.runSync(
        "INSERT OR REPLACE INTO user_preferences (key, value) VALUES ('biometric_enabled', ?)",
        String(enabled),
      );
    } catch {}
  },

  // Analytics
  analyticsPeriod: 'monthly',
  setAnalyticsPeriod: (period) => set({ analyticsPeriod: period }),
  analyticsMode: 'expense',
  setAnalyticsMode: (mode) => set({ analyticsMode: mode }),

  // Database
  dbReady: false,
  setDbReady: (ready) => set({ dbReady: ready }),

  // AI Copilot
  geminiApiKey: DEFAULT_GEMINI_API_KEY,
  setGeminiApiKey: (key) => {
    set({ geminiApiKey: key });
    try {
      const db = getDatabase();
      db.runSync("INSERT OR REPLACE INTO user_preferences (key, value) VALUES ('gemini_api_key', ?)", key);
    } catch {}
  },
  geminiModel: DEFAULT_GEMINI_MODEL,
  setGeminiModel: (model) => {
    set({ geminiModel: model });
    try {
      const db = getDatabase();
      db.runSync("INSERT OR REPLACE INTO user_preferences (key, value) VALUES ('gemini_model', ?)", model);
    } catch {}
  },

  // Refresh
  refreshKey: 0,
  triggerRefresh: () => set((s) => ({ refreshKey: s.refreshKey + 1 })),

  // Load preferences from DB
  loadPreferences: () => {
    try {
      const db = getDatabase();
      const rows = db.getAllSync<{ key: string; value: string }>(
        'SELECT key, value FROM user_preferences',
      );
      const prefs: Record<string, string> = {};
      rows.forEach((r) => {
        prefs[r.key] = r.value;
      });

      const rememberMe = prefs.remember_me !== 'false'; // default true
      let currentUser: User | null = null;

      // Only restore user session if remember_me is true
      if (rememberMe && prefs.current_user_id) {
        const userRow = db.getFirstSync<User>(
          'SELECT id, name, email, created_at, updated_at FROM users WHERE id = ?',
          prefs.current_user_id,
        );
        if (userRow) {
          currentUser = userRow;
        }
      }

      set({
        theme: (prefs.theme as ThemeName) || 'dark',
        currency: prefs.currency || 'PHP',
        pinHash: prefs.pin_hash || '',
        biometricEnabled: prefs.biometric_enabled === 'true',
        rememberMe: rememberMe,
        currentUser: currentUser,
        geminiApiKey: prefs.gemini_api_key?.trim() || DEFAULT_GEMINI_API_KEY,
        geminiModel: prefs.gemini_model?.trim() || DEFAULT_GEMINI_MODEL,
      });

      // If user is authenticated and has a PIN configured, lock the app until PIN/Biometric is verified
      if (prefs.pin_hash && currentUser) {
        set({ isUnlocked: false });
      }
    } catch (e) {
      console.error('Failed to load user preferences:', e);
    }
  },
}));
