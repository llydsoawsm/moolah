// ============================================================
// MoneyGuide — SQLite Database Client
// ============================================================
import * as SQLite from 'expo-sqlite';
import { DEFAULT_CATEGORIES, DEFAULT_INCOME_CATEGORIES, DEFAULT_PAYMENT_METHODS, DEFAULT_PREFERENCES } from '../lib/constants';

const DB_NAME = 'moolah.db';
const LEGACY_DB_NAME = 'moneyguide.db';

let db: SQLite.SQLiteDatabase | null = null;

/**
 * Get the database instance (singleton)
 */
export function getDatabase(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync(DB_NAME);
    db.execSync('PRAGMA journal_mode = WAL;');
    db.execSync('PRAGMA foreign_keys = ON;');
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

    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
    CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
    CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_resets_email ON password_resets(email);
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
 * Reset the database (for development/settings)
 */
export function resetDatabase(): void {
  const database = getDatabase();
  database.execSync(`
    DELETE FROM expenses;
    DELETE FROM categories;
    DELETE FROM payment_methods;
    DELETE FROM user_preferences;
  `);
  seedDefaultData(database);
}
