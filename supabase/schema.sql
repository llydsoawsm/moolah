-- ============================================================
-- Moolah Personal Finance — Complete Supabase PostgreSQL Schema
-- ============================================================
-- How to apply this migration:
-- 1. Open your Supabase Dashboard:
--    https://supabase.com/dashboard/project/gfycsyztywteacfwohlv
-- 2. Click "SQL Editor" on the left menu -> Click "New query"
-- 3. Paste this entire script and click "Run" (or Ctrl + Enter)
-- ============================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Payment Methods Table
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  is_default INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Default Payment Methods
INSERT INTO public.payment_methods (id, name, icon, color, is_default)
VALUES 
  ('pm-cash', 'Cash', 'cash-outline', '#22C55E', 1),
  ('pm-credit', 'Credit Card', 'card-outline', '#3B82F6', 0),
  ('pm-debit', 'Debit Card', 'card-outline', '#6366F1', 0),
  ('pm-gcash', 'GCash', 'phone-portrait-outline', '#2563EB', 0),
  ('pm-maya', 'Maya', 'phone-portrait-outline', '#16A34A', 0),
  ('pm-bank', 'Bank Transfer', 'business-outline', '#0EA5E9', 0)
ON CONFLICT (id) DO NOTHING;

-- 3. Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'pricetag-outline',
  color TEXT NOT NULL DEFAULT '#71717A',
  parent_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  is_default INTEGER DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'expense' CHECK (type IN ('expense', 'income')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Default Expense Categories (Global, user_id is NULL)
INSERT INTO public.categories (id, user_id, name, icon, color, parent_id, sort_order, is_default, type)
VALUES
  ('cat-food', NULL, 'Food & Drinks', 'restaurant-outline', '#F97316', NULL, 0, 1, 'expense'),
  ('cat-food-groceries', NULL, 'Groceries', 'cart-outline', '#FB923C', 'cat-food', 0, 1, 'expense'),
  ('cat-food-dining', NULL, 'Dining Out', 'restaurant-outline', '#F97316', 'cat-food', 1, 1, 'expense'),
  ('cat-food-coffee', NULL, 'Coffee & Snacks', 'cafe-outline', '#EA580C', 'cat-food', 2, 1, 'expense'),
  ('cat-transport', NULL, 'Transportation', 'car-outline', '#3B82F6', NULL, 1, 1, 'expense'),
  ('cat-transport-gas', NULL, 'Gas & Fuel', 'speedometer-outline', '#60A5FA', 'cat-transport', 0, 1, 'expense'),
  ('cat-transport-fare', NULL, 'Public Transit', 'bus-outline', '#3B82F6', 'cat-transport', 1, 1, 'expense'),
  ('cat-shopping', NULL, 'Shopping', 'bag-handle-outline', '#EC4899', NULL, 2, 1, 'expense'),
  ('cat-shopping-clothes', NULL, 'Clothes & Apparel', 'shirt-outline', '#F472B6', 'cat-shopping', 0, 1, 'expense'),
  ('cat-shopping-online', NULL, 'Online Shopping', 'globe-outline', '#DB2777', 'cat-shopping', 1, 1, 'expense'),
  ('cat-bills', NULL, 'Bills & Utilities', 'flash-outline', '#EAB308', NULL, 3, 1, 'expense'),
  ('cat-bills-electric', NULL, 'Electricity', 'flash-outline', '#FACC15', 'cat-bills', 0, 1, 'expense'),
  ('cat-bills-water', NULL, 'Water', 'water-outline', '#EAB308', 'cat-bills', 1, 1, 'expense'),
  ('cat-bills-internet', NULL, 'Internet / WiFi', 'wifi-outline', '#CA8A04', 'cat-bills', 2, 1, 'expense'),
  ('cat-home', NULL, 'Housing & Living', 'home-outline', '#10B981', NULL, 4, 1, 'expense'),
  ('cat-home-rent', NULL, 'Rent / Mortgage', 'home-outline', '#34D399', 'cat-home', 0, 1, 'expense'),
  ('cat-health', NULL, 'Health & Medical', 'medkit-outline', '#EF4444', NULL, 5, 1, 'expense'),
  ('cat-education', NULL, 'Education', 'school-outline', '#6366F1', NULL, 6, 1, 'expense'),
  ('cat-entertainment', NULL, 'Entertainment', 'game-controller-outline', '#8B5CF6', NULL, 7, 1, 'expense'),
  ('cat-personal', NULL, 'Personal Care', 'sparkles-outline', '#F43F5E', NULL, 8, 1, 'expense'),
  ('cat-travel', NULL, 'Travel & Vacation', 'airplane-outline', '#06B6D4', NULL, 9, 1, 'expense'),
  ('cat-gifts', NULL, 'Gifts & Charity', 'gift-outline', '#A855F7', NULL, 10, 1, 'expense'),
  ('cat-financial', NULL, 'Financial & Insurance', 'trending-up-outline', '#6366F1', NULL, 11, 1, 'expense'),
  ('cat-other', NULL, 'Other Expense', 'pricetag-outline', '#71717A', NULL, 99, 1, 'expense'),
  -- Income Categories
  ('cat-inc-salary', NULL, 'Salary & Wages', 'wallet-outline', '#10B981', NULL, 0, 1, 'income'),
  ('cat-inc-salary-base', NULL, 'Base Pay', 'cash-outline', '#34D399', 'cat-inc-salary', 0, 1, 'income'),
  ('cat-inc-salary-bonus', NULL, 'Bonus', 'sparkles-outline', '#10B981', 'cat-inc-salary', 1, 1, 'income'),
  ('cat-inc-freelance', NULL, 'Freelance & Side Hustle', 'briefcase-outline', '#3B82F6', NULL, 1, 1, 'income'),
  ('cat-inc-business', NULL, 'Business & Sales', 'storefront-outline', '#F59E0B', NULL, 2, 1, 'income'),
  ('cat-inc-investments', NULL, 'Investments & Dividends', 'trending-up-outline', '#8B5CF6', NULL, 3, 1, 'income'),
  ('cat-inc-other', NULL, 'Other Income', 'cash-outline', '#06B6D4', NULL, 99, 1, 'income')
ON CONFLICT (id) DO NOTHING;

-- 4. Expenses & Incomes Table
CREATE TABLE IF NOT EXISTS public.expenses (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL DEFAULT 'expense' CHECK (type IN ('expense', 'income')),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  category_id TEXT,
  payment_method_id TEXT,
  note TEXT,
  receipt_image_uri TEXT,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Budgets Table
CREATE TABLE IF NOT EXISTS public.budgets (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category_id TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  period TEXT DEFAULT 'monthly',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Subscriptions & Recurring Bills Table
CREATE TABLE IF NOT EXISTS public.recurring_transactions (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL DEFAULT 'expense' CHECK (type IN ('expense', 'income')),
  name TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  category_id TEXT,
  payment_method_id TEXT,
  frequency TEXT DEFAULT 'monthly',
  billing_day INTEGER DEFAULT 1 CHECK (billing_day >= 1 AND billing_day <= 31),
  next_due_date DATE,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. User Preferences Table
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, key)
);

-- ============================================================
-- Indexes for High Performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON public.expenses(user_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_user_type ON public.expenses(user_id, type);
CREATE INDEX IF NOT EXISTS idx_budgets_user ON public.budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_user ON public.recurring_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user ON public.categories(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON public.user_preferences(user_id);

-- ============================================================
-- Row Level Security (RLS) Policies
-- Ensures each authenticated user can only access their own records
-- ============================================================
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Payment Methods Policies (Readable by all authenticated users)
DROP POLICY IF EXISTS "Payment methods are viewable by everyone" ON public.payment_methods;
CREATE POLICY "Payment methods are viewable by everyone"
  ON public.payment_methods FOR SELECT
  TO authenticated
  USING (true);

-- Categories Policies (Users see default categories and their own custom categories)
DROP POLICY IF EXISTS "Users can view default and their own categories" ON public.categories;
CREATE POLICY "Users can view default and their own categories"
  ON public.categories FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can manage their own categories" ON public.categories;
CREATE POLICY "Users can manage their own categories"
  ON public.categories FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Expenses Policies
DROP POLICY IF EXISTS "Users can manage their own expenses" ON public.expenses;
CREATE POLICY "Users can manage their own expenses"
  ON public.expenses FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Budgets Policies
DROP POLICY IF EXISTS "Users can manage their own budgets" ON public.budgets;
CREATE POLICY "Users can manage their own budgets"
  ON public.budgets FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Recurring Transactions Policies
DROP POLICY IF EXISTS "Users can manage their own recurring transactions" ON public.recurring_transactions;
CREATE POLICY "Users can manage their own recurring transactions"
  ON public.recurring_transactions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- User Preferences Policies
DROP POLICY IF EXISTS "Users can manage their own preferences" ON public.user_preferences;
CREATE POLICY "Users can manage their own preferences"
  ON public.user_preferences FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Grant Permissions to anon & authenticated roles
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
