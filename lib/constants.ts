// ============================================================
// Moolah — Minimalist Constants & Seed Data
// ============================================================
import type { ThemeName } from './types';

/** Default expense categories with minimalist outline icons */
export const DEFAULT_CATEGORIES = [
  {
    id: 'cat-food',
    name: 'Food & Drinks',
    icon: 'restaurant-outline',
    color: '#F97316',
    subcategories: [
      { id: 'cat-food-groceries', name: 'Groceries', icon: 'cart-outline', color: '#FB923C' },
      { id: 'cat-food-dining', name: 'Dining Out', icon: 'restaurant-outline', color: '#F97316' },
      { id: 'cat-food-coffee', name: 'Coffee & Snacks', icon: 'cafe-outline', color: '#EA580C' },
      { id: 'cat-food-fastfood', name: 'Fast Food', icon: 'fast-food-outline', color: '#F97316' },
    ],
  },
  {
    id: 'cat-transport',
    name: 'Transportation',
    icon: 'car-outline',
    color: '#3B82F6',
    subcategories: [
      { id: 'cat-transport-gas', name: 'Gas & Fuel', icon: 'speedometer-outline', color: '#60A5FA' },
      { id: 'cat-transport-fare', name: 'Public Transit', icon: 'bus-outline', color: '#3B82F6' },
      { id: 'cat-transport-parking', name: 'Parking & Tolls', icon: 'navigate-outline', color: '#2563EB' },
    ],
  },
  {
    id: 'cat-shopping',
    name: 'Shopping',
    icon: 'bag-handle-outline',
    color: '#EC4899',
    subcategories: [
      { id: 'cat-shopping-clothes', name: 'Clothes & Apparel', icon: 'shirt-outline', color: '#F472B6' },
      { id: 'cat-shopping-electronics', name: 'Electronics', icon: 'phone-portrait-outline', color: '#EC4899' },
      { id: 'cat-shopping-online', name: 'Online Shopping', icon: 'globe-outline', color: '#DB2777' },
    ],
  },
  {
    id: 'cat-bills',
    name: 'Bills & Utilities',
    icon: 'flash-outline',
    color: '#EAB308',
    subcategories: [
      { id: 'cat-bills-electric', name: 'Electricity', icon: 'flash-outline', color: '#FACC15' },
      { id: 'cat-bills-water', name: 'Water', icon: 'water-outline', color: '#EAB308' },
      { id: 'cat-bills-internet', name: 'Internet / WiFi', icon: 'wifi-outline', color: '#CA8A04' },
      { id: 'cat-bills-phone', name: 'Phone Plan', icon: 'call-outline', color: '#A16207' },
    ],
  },
  {
    id: 'cat-home',
    name: 'Housing & Living',
    icon: 'home-outline',
    color: '#10B981',
    subcategories: [
      { id: 'cat-home-rent', name: 'Rent / Mortgage', icon: 'home-outline', color: '#34D399' },
      { id: 'cat-home-maintenance', name: 'Maintenance & Repairs', icon: 'construct-outline', color: '#10B981' },
      { id: 'cat-home-furniture', name: 'Furniture & Decor', icon: 'bed-outline', color: '#059669' },
    ],
  },
  {
    id: 'cat-health',
    name: 'Health & Wellness',
    icon: 'fitness-outline',
    color: '#EF4444',
    subcategories: [
      { id: 'cat-health-medicine', name: 'Medicine & Pharmacy', icon: 'medkit-outline', color: '#F87171' },
      { id: 'cat-health-doctor', name: 'Doctor & Checkup', icon: 'pulse-outline', color: '#EF4444' },
      { id: 'cat-health-gym', name: 'Gym & Fitness', icon: 'barbell-outline', color: '#DC2626' },
    ],
  },
  {
    id: 'cat-entertainment',
    name: 'Entertainment',
    icon: 'play-circle-outline',
    color: '#8B5CF6',
    subcategories: [
      { id: 'cat-entertainment-movies', name: 'Cinema & Shows', icon: 'film-outline', color: '#A78BFA' },
      { id: 'cat-entertainment-games', name: 'Gaming', icon: 'game-controller-outline', color: '#8B5CF6' },
      { id: 'cat-entertainment-streaming', name: 'Streaming', icon: 'tv-outline', color: '#7C3AED' },
    ],
  },
  {
    id: 'cat-education',
    name: 'Education',
    icon: 'book-outline',
    color: '#06B6D4',
    subcategories: [
      { id: 'cat-education-tuition', name: 'Tuition', icon: 'school-outline', color: '#22D3EE' },
      { id: 'cat-education-books', name: 'Books', icon: 'book-outline', color: '#06B6D4' },
      { id: 'cat-education-courses', name: 'Courses & Workshops', icon: 'laptop-outline', color: '#0891B2' },
    ],
  },
  {
    id: 'cat-personal',
    name: 'Personal Care',
    icon: 'sparkles-outline',
    color: '#F472B6',
    subcategories: [
      { id: 'cat-personal-haircut', name: 'Hair & Grooming', icon: 'cut-outline', color: '#F9A8D4' },
      { id: 'cat-personal-skincare', name: 'Skincare', icon: 'heart-outline', color: '#F472B6' },
    ],
  },
  {
    id: 'cat-travel',
    name: 'Travel & Trips',
    icon: 'airplane-outline',
    color: '#0EA5E9',
    subcategories: [
      { id: 'cat-travel-flight', name: 'Flights', icon: 'airplane-outline', color: '#38BDF8' },
      { id: 'cat-travel-hotel', name: 'Hotels & Stay', icon: 'bed-outline', color: '#0EA5E9' },
    ],
  },
  {
    id: 'cat-gifts',
    name: 'Gifts & Charity',
    icon: 'gift-outline',
    color: '#A855F7',
    subcategories: [],
  },
  {
    id: 'cat-financial',
    name: 'Financial & Insurance',
    icon: 'trending-up-outline',
    color: '#6366F1',
    subcategories: [
      { id: 'cat-fin-insurance', name: 'Insurance', icon: 'shield-checkmark-outline', color: '#818CF8' },
      { id: 'cat-fin-fees', name: 'Bank & Transaction Fees', icon: 'receipt-outline', color: '#6366F1' },
    ],
  },
];

/** Default income categories with minimalist outline icons */
export const DEFAULT_INCOME_CATEGORIES = [
  {
    id: 'cat-inc-salary',
    name: 'Salary & Wages',
    icon: 'wallet-outline',
    color: '#10B981',
    subcategories: [
      { id: 'cat-inc-salary-base', name: 'Base Pay', icon: 'cash-outline', color: '#34D399' },
      { id: 'cat-inc-salary-bonus', name: 'Bonus', icon: 'sparkles-outline', color: '#10B981' },
      { id: 'cat-inc-salary-13th', name: '13th Month Pay', icon: 'gift-outline', color: '#059669' },
      { id: 'cat-inc-salary-ot', name: 'Overtime', icon: 'time-outline', color: '#047857' },
    ],
  },
  {
    id: 'cat-inc-freelance',
    name: 'Freelance & Side Hustle',
    icon: 'briefcase-outline',
    color: '#3B82F6',
    subcategories: [
      { id: 'cat-inc-freelance-proj', name: 'Client Projects', icon: 'briefcase-outline', color: '#60A5FA' },
      { id: 'cat-inc-freelance-consult', name: 'Consulting', icon: 'chatbubbles-outline', color: '#3B82F6' },
      { id: 'cat-inc-freelance-gig', name: 'Gigs', icon: 'flash-outline', color: '#2563EB' },
    ],
  },
  {
    id: 'cat-inc-business',
    name: 'Business & Sales',
    icon: 'storefront-outline',
    color: '#F59E0B',
    subcategories: [
      { id: 'cat-inc-biz-sales', name: 'Product Sales', icon: 'cart-outline', color: '#FBBF24' },
      { id: 'cat-inc-biz-services', name: 'Services', icon: 'construct-outline', color: '#F59E0B' },
    ],
  },
  {
    id: 'cat-inc-investments',
    name: 'Investments & Dividends',
    icon: 'trending-up-outline',
    color: '#8B5CF6',
    subcategories: [
      { id: 'cat-inc-inv-dividends', name: 'Dividends', icon: 'pie-chart-outline', color: '#A78BFA' },
      { id: 'cat-inc-inv-interest', name: 'Interest', icon: 'receipt-outline', color: '#8B5CF6' },
      { id: 'cat-inc-inv-capital', name: 'Capital Gains', icon: 'stats-chart-outline', color: '#7C3AED' },
    ],
  },
  {
    id: 'cat-inc-gifts',
    name: 'Allowance & Gifts',
    icon: 'heart-outline',
    color: '#EC4899',
    subcategories: [
      { id: 'cat-inc-gifts-allowance', name: 'Allowance', icon: 'card-outline', color: '#F472B6' },
      { id: 'cat-inc-gifts-bday', name: 'Gifts & Bonus', icon: 'gift-outline', color: '#EC4899' },
    ],
  },
  {
    id: 'cat-inc-other',
    name: 'Other Income',
    icon: 'cash-outline',
    color: '#06B6D4',
    subcategories: [
      { id: 'cat-inc-other-refund', name: 'Refunds / Reimbursements', icon: 'refresh-outline', color: '#22D3EE' },
      { id: 'cat-inc-other-misc', name: 'Miscellaneous', icon: 'cube-outline', color: '#06B6D4' },
    ],
  },
];

/** Default payment methods with minimalist outline icons */
export const DEFAULT_PAYMENT_METHODS = [
  { id: 'pm-cash', name: 'Cash', icon: 'cash-outline', color: '#22C55E', is_default: 1 },
  { id: 'pm-credit', name: 'Credit Card', icon: 'card-outline', color: '#3B82F6', is_default: 0 },
  { id: 'pm-debit', name: 'Debit Card', icon: 'card-outline', color: '#6366F1', is_default: 0 },
  { id: 'pm-gcash', name: 'GCash', icon: 'phone-portrait-outline', color: '#2563EB', is_default: 0 },
  { id: 'pm-maya', name: 'Maya', icon: 'phone-portrait-outline', color: '#16A34A', is_default: 0 },
  { id: 'pm-bank', name: 'Bank Transfer', icon: 'business-outline', color: '#0EA5E9', is_default: 0 },
];

/** Default user preferences */
export const DEFAULT_PREFERENCES: Record<string, string> = {
  theme: 'dark',
  currency: 'PHP',
  pin_hash: '',
  biometric_enabled: 'false',
  remember_me: 'true',
  first_launch: 'true',
};

/** Supported currencies */
export const SUPPORTED_CURRENCIES: Record<string, { symbol: string; name: string }> = {
  PHP: { symbol: '₱', name: 'Philippine Peso' },
  USD: { symbol: '$', name: 'US Dollar' },
  EUR: { symbol: '€', name: 'Euro' },
  GBP: { symbol: '£', name: 'British Pound' },
  JPY: { symbol: '¥', name: 'Japanese Yen' },
  CAD: { symbol: 'CA$', name: 'Canadian Dollar' },
  AUD: { symbol: 'AU$', name: 'Australian Dollar' },
  SGD: { symbol: 'S$', name: 'Singapore Dollar' },
  MYR: { symbol: 'RM', name: 'Malaysian Ringgit' },
  THB: { symbol: '฿', name: 'Thai Baht' },
  IDR: { symbol: 'Rp', name: 'Indonesian Rupiah' },
  VND: { symbol: '₫', name: 'Vietnamese Dong' },
  KRW: { symbol: '₩', name: 'South Korean Won' },
  INR: { symbol: '₹', name: 'Indian Rupee' },
  AED: { symbol: 'AED', name: 'UAE Dirham' },
  SAR: { symbol: 'SAR', name: 'Saudi Riyal' },
  HKD: { symbol: 'HK$', name: 'Hong Kong Dollar' },
  NZD: { symbol: 'NZ$', name: 'New Zealand Dollar' },
};