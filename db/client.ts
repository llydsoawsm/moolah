// ============================================================
// MoneyGuide — SQLite Database Client
// ============================================================
import * as SQLite from 'expo-sqlite';
import { DEFAULT_CATEGORIES, DEFAULT_INCOME_CATEGORIES, DEFAULT_PAYMENT_METHODS, DEFAULT_PREFERENCES } from '../lib/constants';

import { Platform } from 'react-native';

const WEB_STORE_KEY = 'moolah_web_storage_db_v2';

interface WebStoreData {
  categories: any[];
  payment_methods: any[];
  expenses: any[];
  budgets: any[];
  recurring_transactions: any[];
  user_preferences: Record<string, string>;
  chat_sessions: any[];
  chat_messages: any[];
  users: any[];
  password_resets: any[];
}

function getInitialWebStore(): WebStoreData {
  const categories: any[] = [];
  let sortOrder = 0;
  DEFAULT_CATEGORIES.forEach((cat) => {
    categories.push({
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      parent_id: null,
      sort_order: sortOrder++,
      is_default: 1,
      type: 'expense',
      created_at: new Date().toISOString(),
    });
    cat.subcategories.forEach((sub, subIdx) => {
      categories.push({
        id: sub.id,
        name: sub.name,
        icon: sub.icon,
        color: sub.color,
        parent_id: cat.id,
        sort_order: subIdx,
        is_default: 1,
        type: 'expense',
        created_at: new Date().toISOString(),
      });
    });
  });

  DEFAULT_INCOME_CATEGORIES.forEach((cat) => {
    categories.push({
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      parent_id: null,
      sort_order: sortOrder++,
      is_default: 1,
      type: 'income',
      created_at: new Date().toISOString(),
    });
    cat.subcategories.forEach((sub, subIdx) => {
      categories.push({
        id: sub.id,
        name: sub.name,
        icon: sub.icon,
        color: sub.color,
        parent_id: cat.id,
        sort_order: subIdx,
        is_default: 1,
        type: 'income',
        created_at: new Date().toISOString(),
      });
    });
  });

  const payment_methods = DEFAULT_PAYMENT_METHODS.map((pm) => ({
    id: pm.id,
    name: pm.name,
    icon: pm.icon,
    color: pm.color,
    is_default: pm.is_default ? 1 : 0,
    created_at: new Date().toISOString(),
  }));

  return {
    categories,
    payment_methods,
    expenses: [],
    budgets: [],
    recurring_transactions: [],
    user_preferences: { ...DEFAULT_PREFERENCES },
    chat_sessions: [],
    chat_messages: [],
    users: [],
    password_resets: [],
  };
}

function loadWebStore(): WebStoreData {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return getInitialWebStore();
  }
  try {
    const raw = window.localStorage.getItem(WEB_STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.categories && parsed.categories.length > 0) {
        return parsed;
      }
    }
  } catch {}
  const initial = getInitialWebStore();
  saveWebStore(initial);
  return initial;
}

function saveWebStore(store: WebStoreData) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WEB_STORE_KEY, JSON.stringify(store));
  } catch (e) {
    console.warn('[Moolah Web Store] Failed to persist state:', e);
  }
}

function isSharedArrayBufferAvailable(): boolean {
  if (Platform.OS !== 'web') return true;
  try {
    return (
      typeof window !== 'undefined' &&
      typeof (window as any).SharedArrayBuffer !== 'undefined' &&
      (window as any).SharedArrayBuffer !== (window as any).ArrayBuffer
    );
  } catch {
    return false;
  }
}

function createWebFallbackDatabase() {
  const store = loadWebStore();

  return {
    execSync: (sql: string) => {
      // no-op for table creation/indexes
    },
    runSync: (sql: string, ...params: any[]) => {
      const s = sql.trim();
      const upper = s.toUpperCase();

      if (upper.startsWith('INSERT') && upper.includes('CATEGORIES')) {
        const [id, name, icon, color, parent_id, sort_order, is_default, type] = params;
        store.categories.push({
          id,
          name,
          icon: icon || 'pricetag-outline',
          color: color || '#71717A',
          parent_id: parent_id || null,
          sort_order: Number(sort_order || 99),
          is_default: Number(is_default ?? 0),
          type: type || 'expense',
          created_at: new Date().toISOString(),
        });
        saveWebStore(store);
      } else if (upper.startsWith('DELETE') && upper.includes('CATEGORIES')) {
        const id = params[0];
        store.categories = store.categories.filter((c) => c.id !== id);
        saveWebStore(store);
      } else if (upper.startsWith('INSERT') && upper.includes('USER_PREFERENCES')) {
        const key = params[0];
        const val = String(params[1] ?? '');
        store.user_preferences[key] = val;
        saveWebStore(store);
      } else if (upper.startsWith('DELETE') && upper.includes('USER_PREFERENCES')) {
        const key = params[0];
        delete store.user_preferences[key];
        saveWebStore(store);
      } else if (upper.startsWith('INSERT') && upper.includes('CHAT_SESSIONS')) {
        const [id, user_id, title] = params;
        const now = new Date().toISOString();
        store.chat_sessions.unshift({ id, user_id, title, created_at: now, updated_at: now });
        saveWebStore(store);
      } else if (upper.startsWith('UPDATE') && upper.includes('CHAT_SESSIONS')) {
        const id = params[params.length - 1];
        const sess = store.chat_sessions.find((cs) => cs.id === id);
        if (sess) {
          sess.updated_at = new Date().toISOString();
          saveWebStore(store);
        }
      } else if (upper.startsWith('DELETE') && upper.includes('CHAT_SESSIONS')) {
        const id = params[0];
        store.chat_sessions = store.chat_sessions.filter((cs) => cs.id !== id);
        store.chat_messages = store.chat_messages.filter((cm) => cm.session_id !== id);
        saveWebStore(store);
      } else if (upper.startsWith('INSERT') && upper.includes('CHAT_MESSAGES')) {
        const [id, session_id, user_id, sender, text, engine, action_json, citations_json, created_at] = params;
        store.chat_messages.push({
          id,
          session_id,
          user_id,
          sender,
          text,
          engine,
          action_json,
          citations_json,
          created_at: Number(created_at || Date.now()),
        });
        const sess = store.chat_sessions.find((cs) => cs.id === session_id);
        if (sess) {
          sess.updated_at = new Date().toISOString();
        }
        saveWebStore(store);
      } else if (upper.startsWith('DELETE') && upper.includes('CHAT_MESSAGES')) {
        const session_id = params[0];
        store.chat_messages = store.chat_messages.filter((cm) => cm.session_id !== session_id);
        saveWebStore(store);
      } else if (upper.startsWith('INSERT') && upper.includes('USERS')) {
        const [id, name, email, password_hash] = params;
        const now = new Date().toISOString();
        store.users = store.users.filter((u) => u.email.toLowerCase() !== String(email).toLowerCase());
        store.users.push({ id, name, email, password_hash, created_at: now, updated_at: now });
        saveWebStore(store);
      } else if (upper.startsWith('UPDATE') && upper.includes('USERS')) {
        const [password_hash, email] = params;
        const u = store.users.find((user) => user.email.toLowerCase() === String(email).toLowerCase());
        if (u) {
          u.password_hash = password_hash;
          u.updated_at = new Date().toISOString();
          saveWebStore(store);
        }
      } else if (upper.startsWith('INSERT') && upper.includes('EXPENSES')) {
        const [id, type, amount, category_id, payment_method_id, note, receipt_image_uri, expense_date] = params;
        const now = new Date().toISOString();
        store.expenses.unshift({
          id,
          type: type || 'expense',
          amount: Number(amount),
          category_id,
          payment_method_id,
          note: note || '',
          receipt_image_uri: receipt_image_uri || null,
          expense_date: expense_date || now.split('T')[0],
          created_at: now,
          updated_at: now,
        });
        saveWebStore(store);
      } else if (upper.startsWith('DELETE') && upper.includes('EXPENSES')) {
        const id = params[0];
        store.expenses = store.expenses.filter((e) => e.id !== id);
        saveWebStore(store);
      } else if (upper.startsWith('INSERT') && upper.includes('BUDGETS')) {
        const [id, category_id, amount, period] = params;
        const now = new Date().toISOString();
        store.budgets = store.budgets.filter((b) => b.category_id !== category_id);
        store.budgets.push({ id, category_id, amount: Number(amount), period: period || 'monthly', created_at: now, updated_at: now });
        saveWebStore(store);
      } else if (upper.startsWith('UPDATE') && upper.includes('BUDGETS')) {
        const [amount, id] = params;
        const b = store.budgets.find((bg) => bg.id === id);
        if (b) {
          b.amount = Number(amount);
          b.updated_at = new Date().toISOString();
          saveWebStore(store);
        }
      } else if (upper.startsWith('DELETE') && upper.includes('BUDGETS')) {
        const target = params[0];
        store.budgets = store.budgets.filter((b) => b.id !== target && b.category_id !== target);
        saveWebStore(store);
      } else if (upper.startsWith('INSERT') && upper.includes('RECURRING_TRANSACTIONS')) {
        const [id, type, name, amount, category_id, payment_method_id, frequency, billing_day, next_due_date] = params;
        store.recurring_transactions.push({
          id,
          type: type || 'expense',
          name,
          amount: Number(amount),
          category_id,
          payment_method_id,
          frequency: frequency || 'monthly',
          billing_day: Number(billing_day || 1),
          next_due_date,
          is_active: 1,
          created_at: new Date().toISOString(),
        });
        saveWebStore(store);
      } else if (upper.startsWith('DELETE') && upper.includes('RECURRING_TRANSACTIONS')) {
        const id = params[0];
        store.recurring_transactions = store.recurring_transactions.filter((r) => r.id !== id);
        saveWebStore(store);
      } else if (upper.startsWith('INSERT') && upper.includes('PASSWORD_RESETS')) {
        const [id, email, code, expires_at] = params;
        store.password_resets.push({ id, email, code, expires_at, used: 0, created_at: new Date().toISOString() });
        saveWebStore(store);
      } else if (upper.startsWith('UPDATE') && upper.includes('PASSWORD_RESETS')) {
        const email = params[0];
        store.password_resets.forEach((pr) => {
          if (pr.email.toLowerCase() === String(email).toLowerCase()) pr.used = 1;
        });
        saveWebStore(store);
      }
      return { lastInsertRowId: 1, changes: 1 };
    },
    getFirstSync: <T>(sql: string, ...params: any[]): T | null => {
      const s = sql.trim();
      const upper = s.toUpperCase();

      if (upper.includes('USERS')) {
        const val = String(params[0] || '').toLowerCase();
        const found = store.users.find((u) => u.email.toLowerCase() === val || u.id === val);
        return (found as unknown as T) || null;
      }
      if (upper.includes('CHAT_SESSIONS')) {
        const userId = params[0];
        const found = store.chat_sessions.find((cs) => cs.user_id === userId);
        return (found as unknown as T) || null;
      }
      if (upper.includes('CATEGORIES') && upper.includes('COUNT(*)')) {
        if (upper.includes("TYPE = 'INCOME'")) {
          const count = store.categories.filter((c) => c.type === 'income').length;
          return ({ count } as unknown as T);
        }
        return ({ count: store.categories.length } as unknown as T);
      }
      if (upper.includes('BUDGETS')) {
        const catId = params[0];
        const found = store.budgets.find((b) => b.category_id === catId || b.id === catId);
        return (found as unknown as T) || null;
      }
      if (upper.includes('RECURRING_TRANSACTIONS')) {
        const id = params[0];
        const found = store.recurring_transactions.find((r) => r.id === id);
        return (found as unknown as T) || null;
      }
      if (upper.includes('EXPENSES') && upper.includes('SUM(AMOUNT)')) {
        const type = upper.includes("'INCOME'") ? 'income' : 'expense';
        const total = store.expenses
          .filter((e) => e.type === type)
          .reduce((sum, e) => sum + (e.amount || 0), 0);
        return ({ total } as unknown as T);
      }
      if (upper.includes('EXPENSES')) {
        const id = params[0];
        const found = store.expenses.find((e) => e.id === id);
        if (found) {
          const cat = store.categories.find((c) => c.id === found.category_id);
          const pm = store.payment_methods.find((p) => p.id === found.payment_method_id);
          return ({
            ...found,
            category_name: cat?.name || 'Uncategorized',
            category_icon: cat?.icon || 'folder',
            category_color: cat?.color || '#999',
            payment_method_name: pm?.name || 'Cash',
          } as unknown as T);
        }
        return null;
      }
      if (upper.includes('PASSWORD_RESETS')) {
        const [email, code] = params;
        const found = store.password_resets.find(
          (pr) => pr.email.toLowerCase() === String(email).toLowerCase() && pr.code === String(code) && !pr.used
        );
        return (found as unknown as T) || null;
      }
      return null;
    },
    getAllSync: <T>(sql: string, ...params: any[]): T[] => {
      const s = sql.trim();
      const upper = s.toUpperCase();

      if (upper.includes('USER_PREFERENCES')) {
        return Object.entries(store.user_preferences).map(([key, value]) => ({ key, value })) as unknown as T[];
      }
      if (upper.includes('CATEGORIES')) {
        if (upper.includes("TYPE = 'EXPENSE'")) {
          return store.categories.filter((c) => c.type === 'expense') as unknown as T[];
        }
        if (upper.includes("TYPE = 'INCOME'")) {
          return store.categories.filter((c) => c.type === 'income') as unknown as T[];
        }
        return store.categories as unknown as T[];
      }
      if (upper.includes('PAYMENT_METHODS')) {
        return store.payment_methods as unknown as T[];
      }
      if (upper.includes('CHAT_MESSAGES')) {
        const sessionId = params[0];
        const list = store.chat_messages.filter((m) => m.session_id === sessionId);
        return list.map((m) => ({
          id: m.id,
          sender: m.sender,
          text: m.text,
          engine: m.engine,
          action_json: m.action_json,
          citations_json: m.citations_json,
          timestamp: m.created_at,
        })) as unknown as T[];
      }
      if (upper.includes('CHAT_SESSIONS')) {
        const userId = params[0];
        const list = store.chat_sessions.filter((cs) => !userId || cs.user_id === userId);
        return list.map((cs) => {
          const msgs = store.chat_messages.filter((cm) => cm.session_id === cs.id);
          const last = msgs[msgs.length - 1];
          return {
            id: cs.id,
            user_id: cs.user_id,
            title: cs.title,
            created_at: cs.created_at,
            updated_at: cs.updated_at,
            message_count: msgs.length,
            last_message: last ? last.text : undefined,
          };
        }) as unknown as T[];
      }
      if (upper.includes('EXPENSES')) {
        return store.expenses.map((e) => {
          const cat = store.categories.find((c) => c.id === e.category_id);
          const pm = store.payment_methods.find((p) => p.id === e.payment_method_id);
          return {
            ...e,
            category_name: cat?.name || 'Uncategorized',
            category_icon: cat?.icon || 'folder',
            category_color: cat?.color || '#999',
            payment_method_name: pm?.name || 'Cash',
          };
        }) as unknown as T[];
      }
      if (upper.includes('BUDGETS')) {
        return store.budgets.map((b) => {
          const cat = store.categories.find((c) => c.id === b.category_id);
          return {
            ...b,
            category_name: cat?.name || 'Category',
            category_icon: cat?.icon || 'folder',
            category_color: cat?.color || '#999',
          };
        }) as unknown as T[];
      }
      if (upper.includes('RECURRING_TRANSACTIONS')) {
        return store.recurring_transactions.map((r) => {
          const cat = store.categories.find((c) => c.id === r.category_id);
          const pm = store.payment_methods.find((p) => p.id === r.payment_method_id);
          return {
            ...r,
            category_name: cat?.name || 'Category',
            category_icon: cat?.icon || 'folder',
            category_color: cat?.color || '#999',
            payment_method_name: pm?.name || 'Cash',
          };
        }) as unknown as T[];
      }
      if (upper.includes('PRAGMA TABLE_INFO')) {
        return [{ name: 'type' }, { name: 'id' }] as unknown as T[];
      }
      return [] as T[];
    },
    prepareSync: (sql: string) => {
      const runner = createWebFallbackDatabase();
      return {
        executeSync: (...params: any[]) => runner.runSync(sql, ...params),
        finalizeSync: () => {},
      };
    },
  };
}


const DB_NAME = 'moolah.db';
const LEGACY_DB_NAME = 'moneyguide.db';

let db: SQLite.SQLiteDatabase | null = null;

/**
 * Get the database instance (singleton)
 */
export function getDatabase(): SQLite.SQLiteDatabase {
  if (!db) {
    if (Platform.OS === 'web' && !isSharedArrayBufferAvailable()) {
      console.warn('[Moolah] SharedArrayBuffer is unavailable on web. Using resilient Web Database Fallback.');
      db = createWebFallbackDatabase() as unknown as SQLite.SQLiteDatabase;
      return db;
    }

    try {
      db = SQLite.openDatabaseSync(DB_NAME);
      try { db.execSync('PRAGMA journal_mode = WAL;'); } catch (e) {}
      try { db.execSync('PRAGMA foreign_keys = ON;'); } catch (e) {}
    } catch (e) {
      console.warn('[Moolah] SQLite.openDatabaseSync failed on web, using Web Database Fallback:', e);
      db = createWebFallbackDatabase() as unknown as SQLite.SQLiteDatabase;
    }
  }
  return db;
}

/**
 * Initialize the database: create tables, run migrations, and seed default data
 */
export function initializeDatabase(): void {
  const database = getDatabase();

  // Create tables
  database.execSync(`
    CREATE TABLE IF NOT EXISTS categories (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      icon        TEXT NOT NULL,
      color       TEXT NOT NULL,
      parent_id   TEXT,
      sort_order  INTEGER DEFAULT 0,
      is_default  INTEGER DEFAULT 1,
      type        TEXT NOT NULL DEFAULT 'expense',
      created_at  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payment_methods (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      icon        TEXT NOT NULL,
      color       TEXT NOT NULL,
      is_default  INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id                TEXT PRIMARY KEY,
      type              TEXT NOT NULL DEFAULT 'expense',
      amount            REAL NOT NULL,
      category_id       TEXT NOT NULL,
      payment_method_id TEXT,
      note              TEXT,
      receipt_image_uri TEXT,
      expense_date      TEXT NOT NULL,
      created_at        TEXT DEFAULT (datetime('now')),
      updated_at        TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id)
    );

    CREATE TABLE IF NOT EXISTS user_preferences (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      email           TEXT UNIQUE NOT NULL,
      password_hash   TEXT NOT NULL,
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id          TEXT PRIMARY KEY,
      email       TEXT NOT NULL,
      code        TEXT NOT NULL,
      expires_at  TEXT NOT NULL,
      used        INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id          TEXT PRIMARY KEY,
      category_id TEXT NOT NULL,
      amount      REAL NOT NULL,
      period      TEXT DEFAULT 'monthly',
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS recurring_transactions (
      id                TEXT PRIMARY KEY,
      type              TEXT NOT NULL DEFAULT 'expense',
      name              TEXT NOT NULL,
      amount            REAL NOT NULL,
      category_id       TEXT NOT NULL,
      payment_method_id TEXT,
      frequency         TEXT NOT NULL DEFAULT 'monthly',
      billing_day       INTEGER NOT NULL DEFAULT 1,
      next_due_date     TEXT NOT NULL,
      is_active         INTEGER DEFAULT 1,
      created_at        TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id)
    );

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      title      TEXT NOT NULL DEFAULT 'Financial Chat',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id              TEXT PRIMARY KEY,
      session_id      TEXT NOT NULL,
      user_id         TEXT NOT NULL,
      sender          TEXT NOT NULL,
      text            TEXT NOT NULL,
      engine          TEXT,
      action_json     TEXT,
      citations_json  TEXT,
      created_at      INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
    CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
    CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_resets_email ON password_resets(email);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_category ON budgets(category_id);
    CREATE INDEX IF NOT EXISTS idx_recurring_due ON recurring_transactions(next_due_date);
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
  `);

  // Migrate legacy moneyguide.db if moolah.db is empty
  try {
    const userCount = database.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM users');
    if (!userCount || userCount.count === 0) {
      database.execSync(`ATTACH DATABASE '${LEGACY_DB_NAME}' AS legacy;`);
      database.execSync(`
        INSERT OR IGNORE INTO users SELECT * FROM legacy.users;
        INSERT OR IGNORE INTO user_preferences SELECT * FROM legacy.user_preferences;
        INSERT OR IGNORE INTO payment_methods SELECT * FROM legacy.payment_methods;
        INSERT OR IGNORE INTO categories SELECT * FROM legacy.categories;
        INSERT OR IGNORE INTO expenses SELECT * FROM legacy.expenses;
        INSERT OR IGNORE INTO password_resets SELECT * FROM legacy.password_resets;
      `);
      database.execSync(`DETACH DATABASE legacy;`);
    }
  } catch {
    // No legacy database found or already migrated
  }

  // Safe migrations for existing databases (add type column if missing)
  try {
    const expenseColumns = database.getAllSync<{ name: string }>('PRAGMA table_info(expenses)');
    const hasExpenseType = expenseColumns.some((c) => c.name === 'type');
    if (!hasExpenseType) {
      database.execSync("ALTER TABLE expenses ADD COLUMN type TEXT NOT NULL DEFAULT 'expense';");
    }
  } catch (e) {
    console.error('Migration failed for expenses:', e);
  }

  try {
    const catColumns = database.getAllSync<{ name: string }>('PRAGMA table_info(categories)');
    const hasCatType = catColumns.some((c) => c.name === 'type');
    if (!hasCatType) {
      database.execSync("ALTER TABLE categories ADD COLUMN type TEXT NOT NULL DEFAULT 'expense';");
    }
  } catch (e) {
    console.error('Migration failed for categories:', e);
  }

  // Create indexes on type now that the column is guaranteed to exist
  try {
    database.execSync(`
      CREATE INDEX IF NOT EXISTS idx_expenses_type ON expenses(type);
      CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(type);
    `);
  } catch {}

  // Seed default data if categories table is empty
  const categoryCount = database.getFirstSync<{ count: number }>(
    'SELECT COUNT(*) as count FROM categories',
  );

  if (!categoryCount || categoryCount.count === 0) {
    seedDefaultData(database);
  } else {
    // If expense categories exist, check and seed income categories
    const incomeCatCount = database.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) as count FROM categories WHERE type = 'income'",
    );
    if (!incomeCatCount || incomeCatCount.count === 0) {
      seedIncomeCategories(database);
    }
  }

  // Clean up any previously created mock data
  try {
    database.execSync("DELETE FROM budgets WHERE id LIKE 'b-%';");
    database.execSync("DELETE FROM recurring_transactions WHERE id LIKE 'rec-%';");
  } catch {}
}

/**
 * Seed default categories, payment methods, and preferences
 */
function seedDefaultData(database: SQLite.SQLiteDatabase): void {
  // Insert expense categories and subcategories
  const catStmt = database.prepareSync(
    'INSERT OR IGNORE INTO categories (id, name, icon, color, parent_id, sort_order, is_default, type) VALUES (?, ?, ?, ?, ?, ?, 1, ?)',
  );

  DEFAULT_CATEGORIES.forEach((cat, index) => {
    catStmt.executeSync(cat.id, cat.name, cat.icon, cat.color, null, index, 'expense');

    cat.subcategories.forEach((sub, subIndex) => {
      catStmt.executeSync(sub.id, sub.name, sub.icon, sub.color, cat.id, subIndex, 'expense');
    });
  });

  catStmt.finalizeSync();

  // Insert income categories and subcategories
  seedIncomeCategories(database);

  // Insert payment methods
  const pmStmt = database.prepareSync(
    'INSERT OR IGNORE INTO payment_methods (id, name, icon, color, is_default) VALUES (?, ?, ?, ?, ?)',
  );

  DEFAULT_PAYMENT_METHODS.forEach((pm) => {
    pmStmt.executeSync(pm.id, pm.name, pm.icon, pm.color, pm.is_default);
  });

  pmStmt.finalizeSync();

  // Insert default preferences
  const prefStmt = database.prepareSync(
    'INSERT OR IGNORE INTO user_preferences (key, value) VALUES (?, ?)',
  );

  Object.entries(DEFAULT_PREFERENCES).forEach(([key, value]) => {
    prefStmt.executeSync(key, value);
  });

  prefStmt.finalizeSync();
}

/**
 * Seed default income categories
 */
function seedIncomeCategories(database: SQLite.SQLiteDatabase): void {
  const catStmt = database.prepareSync(
    'INSERT OR IGNORE INTO categories (id, name, icon, color, parent_id, sort_order, is_default, type) VALUES (?, ?, ?, ?, ?, ?, 1, ?)',
  );

  DEFAULT_INCOME_CATEGORIES.forEach((cat, index) => {
    catStmt.executeSync(cat.id, cat.name, cat.icon, cat.color, null, index, 'income');

    cat.subcategories.forEach((sub, subIndex) => {
      catStmt.executeSync(sub.id, sub.name, sub.icon, sub.color, cat.id, subIndex, 'income');
    });
  });

  catStmt.finalizeSync();
}

/**
 * Export all expenses as formatted CSV string
 */
export function exportExpensesToCSV(): string {
  const database = getDatabase();
  const rows = database.getAllSync<any>(`
    SELECT 
      e.expense_date as date,
      e.type as type,
      e.amount as amount,
      c.name as category,
      COALESCE(p.name, 'None') as parent_category,
      COALESCE(pm.name, 'Unspecified') as payment_method,
      COALESCE(REPLACE(REPLACE(e.note, '\n', ' '), ',', ';'), '') as note
    FROM expenses e
    LEFT JOIN categories c ON e.category_id = c.id
    LEFT JOIN categories p ON c.parent_id = p.id
    LEFT JOIN payment_methods pm ON e.payment_method_id = pm.id
    ORDER BY e.expense_date DESC
  `);

  const headers = ['Date', 'Type', 'Amount', 'Category', 'Parent Category', 'Payment Method', 'Note'];
  const csvLines = [headers.join(',')];

  rows.forEach((row) => {
    csvLines.push([
      `"${row.date}"`,
      `"${row.type}"`,
      row.amount,
      `"${row.category || ''}"`,
      `"${row.parent_category || ''}"`,
      `"${row.payment_method || ''}"`,
      `"${row.note || ''}"`,
    ].join(','));
  });

  return csvLines.join('\n');
}

/**
 * Export complete database as JSON string for backup
 */
export function exportAllDataJSON(): string {
  const database = getDatabase();
  const expenses = database.getAllSync('SELECT * FROM expenses');
  const categories = database.getAllSync('SELECT * FROM categories');
  const paymentMethods = database.getAllSync('SELECT * FROM payment_methods');
  const budgets = database.getAllSync('SELECT * FROM budgets');
  const recurring = database.getAllSync('SELECT * FROM recurring_transactions');
  const preferences = database.getAllSync('SELECT * FROM user_preferences');

  return JSON.stringify(
    {
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      expenses,
      categories,
      paymentMethods,
      budgets,
      recurring,
      preferences,
    },
    null,
    2,
  );
}

/**
 * Import database from JSON string
 */
export function importAllDataJSON(jsonStr: string): boolean {
  try {
    const data = JSON.parse(jsonStr);
    const database = getDatabase();

    if (data.expenses && Array.isArray(data.expenses)) {
      database.execSync('DELETE FROM expenses;');
      const expStmt = database.prepareSync(
        'INSERT OR REPLACE INTO expenses (id, type, amount, category_id, payment_method_id, note, receipt_image_uri, expense_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      );
      data.expenses.forEach((e: any) => {
        expStmt.executeSync(
          e.id,
          e.type || 'expense',
          e.amount,
          e.category_id,
          e.payment_method_id || null,
          e.note || null,
          e.receipt_image_uri || null,
          e.expense_date,
          e.created_at || new Date().toISOString(),
          e.updated_at || new Date().toISOString(),
        );
      });
      expStmt.finalizeSync();
    }

    if (data.budgets && Array.isArray(data.budgets)) {
      database.execSync('DELETE FROM budgets;');
      const bStmt = database.prepareSync(
        'INSERT OR REPLACE INTO budgets (id, category_id, amount, period) VALUES (?, ?, ?, ?)',
      );
      data.budgets.forEach((b: any) => {
        bStmt.executeSync(b.id, b.category_id, b.amount, b.period || 'monthly');
      });
      bStmt.finalizeSync();
    }

    if (data.recurring && Array.isArray(data.recurring)) {
      database.execSync('DELETE FROM recurring_transactions;');
      const rStmt = database.prepareSync(
        'INSERT OR REPLACE INTO recurring_transactions (id, type, name, amount, category_id, payment_method_id, frequency, billing_day, next_due_date, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      );
      data.recurring.forEach((r: any) => {
        rStmt.executeSync(
          r.id,
          r.type || 'expense',
          r.name,
          r.amount,
          r.category_id,
          r.payment_method_id || null,
          r.frequency || 'monthly',
          r.billing_day || 1,
          r.next_due_date,
          r.is_active ?? 1,
        );
      });
      rStmt.finalizeSync();
    }

    return true;
  } catch (err) {
    console.error('Import failed:', err);
    return false;
  }
}

/**
 * Reset the database (for development/settings)
 */
export function resetDatabase(): void {
  const database = getDatabase();
  database.execSync(`
    PRAGMA foreign_keys = OFF;
    DELETE FROM chat_messages;
    DELETE FROM chat_sessions;
    DELETE FROM recurring_transactions;
    DELETE FROM budgets;
    DELETE FROM expenses;
    DELETE FROM categories;
    DELETE FROM payment_methods;
    DELETE FROM user_preferences;
    PRAGMA foreign_keys = ON;
  `);
  seedDefaultData(database);
}
