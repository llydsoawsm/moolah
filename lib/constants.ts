// ============================================================
// MoneyGuide — Constants & Seed Data
// ============================================================
import type { ThemeName } from './types';

/** Default expense categories with subcategories */
export const DEFAULT_CATEGORIES = [
  {
    id: 'cat-food',
    name: 'Food & Drinks',
    icon: 'fast-food',
    color: '#F97316',
    subcategories: [
      { id: 'cat-food-groceries', name: 'Groceries', icon: 'cart', color: '#FB923C' },
      { id: 'cat-food-dining', name: 'Dining Out', icon: 'restaurant', color: '#F97316' },
      { id: 'cat-food-coffee', name: 'Coffee', icon: 'cafe', color: '#EA580C' },
    ],
  },
  {
    id: 'cat-transport',
    name: 'Transportation',
    icon: 'car',
    color: '#3B82F6',
    subcategories: [
      { id: 'cat-transport-gas', name: 'Gas', icon: 'speedometer', color: '#60A5FA' },
      { id: 'cat-transport-fare', name: 'Fare', icon: 'bus', color: '#3B82F6' },
      { id: 'cat-transport-parking', name: 'Parking', icon: 'navigate', color: '#2563EB' },
    ],
  },
  {
    id: 'cat-shopping',
    name: 'Shopping',
    icon: 'bag-handle',
    color: '#EC4899',
    subcategories: [
      { id: 'cat-shopping-clothes', name: 'Clothes', icon: 'shirt', color: '#F472B6' },
      { id: 'cat-shopping-electronics', name: 'Electronics', icon: 'phone-portrait', color: '#EC4899' },
      { id: 'cat-shopping-online', name: 'Online', icon: 'globe', color: '#DB2777' },
    ],
  },
  {
    id: 'cat-bills',
    name: 'Bills & Utilities',
    icon: 'flash',
    color: '#EAB308',
    subcategories: [
      { id: 'cat-bills-electric', name: 'Electric', icon: 'flash', color: '#FACC15' },
      { id: 'cat-bills-water', name: 'Water', icon: 'water', color: '#EAB308' },
      { id: 'cat-bills-internet', name: 'Internet', icon: 'wifi', color: '#CA8A04' },
      { id: 'cat-bills-phone', name: 'Phone', icon: 'call', color: '#A16207' },
    ],
  },
  {
    id: 'cat-health',
    name: 'Health',
    icon: 'medkit',
    color: '#EF4444',
    subcategories: [
      { id: 'cat-health-medicine', name: 'Medicine', icon: 'medkit', color: '#F87171' },
      { id: 'cat-health-doctor', name: 'Doctor', icon: 'pulse', color: '#EF4444' },
      { id: 'cat-health-gym', name: 'Gym', icon: 'barbell', color: '#DC2626' },
    ],
  },
  {
    id: 'cat-entertainment',
    name: 'Entertainment',
    icon: 'game-controller',
    color: '#8B5CF6',
    subcategories: [
      { id: 'cat-entertainment-movies', name: 'Movies', icon: 'film', color: '#A78BFA' },
      { id: 'cat-entertainment-games', name: 'Games', icon: 'game-controller', color: '#8B5CF6' },
      { id: 'cat-entertainment-streaming', name: 'Streaming', icon: 'play-circle', color: '#7C3AED' },
    ],
  },
  {
    id: 'cat-education',
    name: 'Education',
    icon: 'book',
    color: '#06B6D4',
    subcategories: [
      { id: 'cat-education-tuition', name: 'Tuition', icon: 'school', color: '#22D3EE' },
      { id: 'cat-education-books', name: 'Books', icon: 'book', color: '#06B6D4' },
      { id: 'cat-education-courses', name: 'Courses', icon: 'laptop', color: '#0891B2' },
    ],
  },
  {
    id: 'cat-personal',
    name: 'Personal Care',
    icon: 'sparkles',
    color: '#F472B6',
    subcategories: [
      { id: 'cat-personal-haircut', name: 'Haircut', icon: 'cut', color: '#F9A8D4' },
      { id: 'cat-personal-skincare', name: 'Skincare', icon: 'sparkles', color: '#F472B6' },
    ],
  },
  {
    id: 'cat-home',
    name: 'Home',
    icon: 'home',
    color: '#10B981',
    subcategories: [
      { id: 'cat-home-rent', name: 'Rent', icon: 'home', color: '#34D399' },
      { id: 'cat-home-maintenance', name: 'Maintenance', icon: 'construct', color: '#10B981' },
      { id: 'cat-home-furniture', name: 'Furniture', icon: 'bed', color: '#059669' },
    ],
  },
  {
    id: 'cat-gifts',
    name: 'Gifts & Donations',
    icon: 'gift',
    color: '#A855F7',
    subcategories: [],
  },
];

/** Default income categories with subcategories */
export const DEFAULT_INCOME_CATEGORIES = [
  {
    id: 'cat-inc-salary',
    name: 'Salary & Wages',
    icon: 'wallet',
    color: '#10B981',
    subcategories: [
      { id: 'cat-inc-salary-base', name: 'Base Pay', icon: 'cash', color: '#34D399' },
      { id: 'cat-inc-salary-bonus', name: 'Bonus', icon: 'sparkles', color: '#10B981' },
      { id: 'cat-inc-salary-13th', name: '13th Month Pay', icon: 'gift', color: '#059669' },
      { id: 'cat-inc-salary-ot', name: 'Overtime', icon: 'time', color: '#047857' },
    ],
  },
  {
    id: 'cat-inc-freelance',
    name: 'Freelance & Side Hustle',
    icon: 'laptop',
    color: '#3B82F6',
    subcategories: [
      { id: 'cat-inc-freelance-proj', name: 'Client Projects', icon: 'briefcase', color: '#60A5FA' },
      { id: 'cat-inc-freelance-consult', name: 'Consulting', icon: 'chatbubbles', color: '#3B82F6' },
      { id: 'cat-inc-freelance-gig', name: 'Gigs', icon: 'flash', color: '#2563EB' },
    ],
  },
  {
    id: 'cat-inc-business',
    name: 'Business & Sales',
    icon: 'storefront',
    color: '#F59E0B',
    subcategories: [
      { id: 'cat-inc-biz-sales', name: 'Product Sales', icon: 'cart', color: '#FBBF24' },
      { id: 'cat-inc-biz-services', name: 'Services', icon: 'construct', color: '#F59E0B' },
    ],
  },
  {
    id: 'cat-inc-investments',
    name: 'Investments & Dividends',
    icon: 'trending-up',
    color: '#8B5CF6',
    subcategories: [
      { id: 'cat-inc-inv-dividends', name: 'Dividends', icon: 'pie-chart', color: '#A78BFA' },
      { id: 'cat-inc-inv-interest', name: 'Interest', icon: 'receipt', color: '#8B5CF6' },
      { id: 'cat-inc-inv-capital', name: 'Capital Gains', icon: 'stats-chart', color: '#7C3AED' },
    ],
  },
  {
    id: 'cat-inc-gifts',
    name: 'Allowance & Gifts',
    icon: 'heart',
    color: '#EC4899',
    subcategories: [
      { id: 'cat-inc-gifts-allowance', name: 'Allowance', icon: 'card', color: '#F472B6' },
      { id: 'cat-inc-gifts-bday', name: 'Gifts & Bonus', icon: 'gift', color: '#EC4899' },
    ],
  },
  {
    id: 'cat-inc-other',
    name: 'Other Income',
    icon: 'ellipsis-horizontal-circle',
    color: '#06B6D4',
    subcategories: [
      { id: 'cat-inc-other-refund', name: 'Refunds / Reimbursements', icon: 'refresh', color: '#22D3EE' },
      { id: 'cat-inc-other-misc', name: 'Miscellaneous', icon: 'cube', color: '#06B6D4' },
    ],
  },
];

/** Default payment methods */
export const DEFAULT_PAYMENT_METHODS = [
  { id: 'pm-cash', name: 'Cash', icon: 'cash', color: '#22C55E', is_default: 1 },
  { id: 'pm-credit', name: 'Credit Card', icon: 'card', color: '#3B82F6', is_default: 0 },
  { id: 'pm-debit', name: 'Debit Card', icon: 'card-outline', color: '#6366F1', is_default: 0 },
  { id: 'pm-gcash', name: 'GCash', icon: 'phone-portrait', color: '#2563EB', is_default: 0 },
  { id: 'pm-maya', name: 'Maya', icon: 'phone-portrait', color: '#16A34A', is_default: 0 },
];

/** App system name */
export const APP_NAME = 'Moolah';

/** Currency settings */
export const CURRENCY = {
  symbol: '₱',
  code: 'PHP',
  name: 'Philippine Peso',
  locale: 'en-PH',
};

/** List of supported currencies in Moolah */
export const SUPPORTED_CURRENCIES: Record<string, { symbol: string; code: string; name: string; locale: string }> = {
  PHP: { symbol: '₱', code: 'PHP', name: 'Philippine Peso', locale: 'en-PH' },
  USD: { symbol: '$', code: 'USD', name: 'US Dollar', locale: 'en-US' },
  EUR: { symbol: '€', code: 'EUR', name: 'Euro', locale: 'de-DE' },
  GBP: { symbol: '£', code: 'GBP', name: 'British Pound', locale: 'en-GB' },
  JPY: { symbol: '¥', code: 'JPY', name: 'Japanese Yen', locale: 'ja-JP' },
  CAD: { symbol: 'CA$', code: 'CAD', name: 'Canadian Dollar', locale: 'en-CA' },
  AUD: { symbol: 'AU$', code: 'AUD', name: 'Australian Dollar', locale: 'en-AU' },
  SGD: { symbol: 'S$', code: 'SGD', name: 'Singapore Dollar', locale: 'en-SG' },
};

/** Default user preferences */
export const DEFAULT_PREFERENCES: Record<string, string> = {
  theme: 'dark' as ThemeName,
  pin_hash: '',
  biometric_enabled: 'false',
  currency: 'PHP',
  onboarding_complete: 'false',
};

/** Date format strings (for date-fns) */
export const DATE_FORMATS = {
  display: 'MMM d, yyyy',
  displayShort: 'MMM d',
  displayFull: 'EEEE, MMMM d, yyyy',
  iso: 'yyyy-MM-dd',
  time: 'h:mm a',
  monthYear: 'MMMM yyyy',
  dayMonth: 'MMM d',
};
