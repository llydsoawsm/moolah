// ============================================================
// MoneyGuide — AI Guardrails & Philippine Emergency Hotline System
// ============================================================

export interface GuardrailCheckResult {
  allowed: boolean;
  type: 'financial' | 'health_emergency' | 'unrelated';
  message?: string;
  hotlines?: EmergencyHotline[];
}

export interface EmergencyHotline {
  name: string;
  number: string;
  description: string;
  region: string;
}

/** Verified Philippine Emergency & Mental Health Hotlines */
export const EMERGENCY_HOTLINES: EmergencyHotline[] = [
  {
    name: 'NCMH Mental Health Crisis Hotline',
    number: '1553',
    description: '24/7 Nationwide toll-free crisis support & psychiatric counseling',
    region: 'Philippines (Landline)',
  },
  {
    name: 'NCMH Mobile Crisis Hotline (Globe/TM)',
    number: '0917-899-8727',
    description: '24/7 Mobile / SMS crisis support (Globe & TM subscribers)',
    region: 'Philippines (Mobile)',
  },
  {
    name: 'NCMH Mobile Crisis Hotline (Smart/Sun)',
    number: '0919-057-1553',
    description: '24/7 Mobile / SMS crisis support (Smart & Sun subscribers)',
    region: 'Philippines (Mobile)',
  },
  {
    name: 'Hopeline Philippines (Crisis Support)',
    number: '0917-558-4673',
    description: '24/7 Suicide prevention & emotional crisis support (or dial 2919 toll-free)',
    region: 'Philippines',
  },
  {
    name: 'In Touch Community Services',
    number: '0917-800-1123',
    description: '24/7 Free confidential emotional counseling & crisis line',
    region: 'Philippines',
  },
  {
    name: 'Philippine National Emergency Hotline',
    number: '911',
    description: 'National police, ambulance, medical emergency & rescue dispatch',
    region: 'Philippines',
  },
  {
    name: 'Philippine Red Cross Emergency Hotline',
    number: '143',
    description: '24/7 Medical ambulance, disaster rescue, and emergency assistance',
    region: 'Philippines',
  },
  {
    name: 'DOH Health Line (Department of Health)',
    number: '1555',
    description: 'Government medical guidance & health emergency referral',
    region: 'Philippines',
  },
];

/** Health & mental health distress keywords (English & Filipino / Tagalog) */
const HEALTH_PATTERNS = [
  /\b(mental\s*health|depression|depressed|anxiety|anxious|panic\s*attack|suicid|kill\s*myself|end\s*my\s*life|want\s*to\s*die|self\s*harm|harm\s*myself|hurt\s*myself)\b/i,
  /\b(health|medical|medicine|doctor|hospital|clinic|nurse|therapy|therapist|psychologist|psychiatrist|counseling|counselor)\b/i,
  /\b(sick|ill|illness|disease|infection|fever|headache|pain|chest\s*pain|heart\s*attack|stroke|cannot\s*breathe|shortness\s*of\s*breath|seizure|ambulance|emergency\s*room)\b/i,
  /\b(hopeless|unhappy|crying|overwhelmed|stressed|burnout|lonely|trauma|ptsd|mental)\b/i,
  /\b(malungkot|nalulungkot|depresyon|magpakamatay|nagpapakamatay|ayaw\s*ko\s*na|pagod\s*na\s*ako|may\s*sakit|masama\s*pakiramdam|doktor|gamot|ospital|saklolo)\b/i,
];

/**
 * Financial & Money Keywords (Strict classifier):
 * Matches anything connected to money, wealth, net worth, budgets, expenses, income, debt, etc.
 */
const FINANCIAL_PATTERNS = [
  // Wealth & Net worth
  /\b(net\s*worth|wealth|wealthiest|wealthy|richest|rich|richer|billionaire|millionaire|trillionaire|fortune|affluent|prosperity)\b/i,
  // Currency & Money
  /\b(money|cash|fund|funds|currency|currencies|forex|fx|exchange\s*rate|monetary)\b/i,
  /\b(peso|pesos|dollar|dollars|usd|php|eur|gbp|jpy|cad|aud|bitcoin|btc|eth|crypto|cryptocurrency|token|coins?|[\$₱€£¥])\b/i,
  // Spending & Expenses
  /\b(spend|spent|spending|expense|expenses|cost|costs|costing|price|prices|pricing|afford|affordable|cheap|expensive|cheaper)\b/i,
  /\b(buy|bought|buying|purchase|purchased|purchasing|sell|sold|selling|shopping|grocer(y|ies)|dining|food|restaurant|fare|fuel|gasoline|petrol|toll)\b/i,
  // Income & Earnings
  /\b(earn|earned|earning|earnings|income|incomes|revenue|revenues|profit|profits|dividend|dividends|salary|salaries|wage|wages|pay|paid|paying|paycheck|bonus|compensation)\b/i,
  // Budgeting & Savings
  /\b(budget|budgets|budgeting|save|saving|savings|saver|bank|banking|deposit|deposits|withdrawal|withdraw|transfers?|remittance|remit)\b/i,
  /\b(50\/30\/20|burn\s*rate|cash\s*flow|financial|finances?|financially|capital)\b/i,
  // Investments, Assets & Debt
  /\b(invest|investing|investment|investments|investor|stock|stocks|shares?|equit(y|ies)|assets?|liabilit(y|ies)|portfolio|yield)\b/i,
  /\b(debt|debts|loans?|borrow|borrowing|lending|lend|owe|owed|owes|credit|debit|mortgage|interest|interest\s*rate|amortization)\b/i,
  // Bills & Overhead
  /\b(bills?|subscription|subscriptions|netflix|spotify|utilit(y|ies)|rent|renting|rental|landlord|electricity|water\s*bill|internet\s*bill)\b/i,
  // Taxes, Receipts & Economics
  /\b(tax|taxes|taxation|vat|bir|receipt|receipts|voucher|vouchers|discounts?|inflation|recession|gdp|economy|economic|economics)\b/i,
  // Payment methods
  /\b(gcash|maya|paymaya|paypal|wallet|credit\s*card|debit\s*card|atm|bank\s*account|checking\s*account|savings\s*account)\b/i,
  // Ledger action verbs when paired with numbers or financial entities
  /\b(add|log|record|create|set|update|modify|change|adjust|cancel|remove|delete)\b.*\b(\d+|budget|expense|income|category|bill|sub|subscription|money|peso|cash)\b/i,
];

/**
 * Classify a user prompt against guardrails:
 * 1. Health / mental health crisis -> triggers Philippine emergency and crisis hotlines
 * 2. Financial / Money topics -> allowed (including net worth, wealth, world rankings, etc.)
 * 3. Non-financial / unrelated -> strictly rejected
 */
export function checkPromptGuardrails(prompt: string, hasContext = false): GuardrailCheckResult {
  const clean = prompt.trim().toLowerCase();

  // 1. Health & Mental Health Crisis Trigger -> Send Philippine Hotlines
  for (const pattern of HEALTH_PATTERNS) {
    if (pattern.test(clean)) {
      return {
        allowed: false,
        type: 'health_emergency',
        message:
          'Your health and well-being are the top priority. While Moolah is strictly a personal finance app, free, confidential, and compassionate professional help is available in the Philippines right now. Please reach out to these crisis hotlines:',
        hotlines: EMERGENCY_HOTLINES,
      };
    }
  }

  // 2. Financial & Money-Connected Intent
  const hasFinancialIntent = FINANCIAL_PATTERNS.some((pattern) => pattern.test(clean));
  if (hasFinancialIntent) {
    return {
      allowed: true,
      type: 'financial',
    };
  }

  // Check for numerical transaction logs (e.g., "450 lunch gcash", "5000 salary")
  const hasAmountWithContext = /\b\d+(\.\d{1,2})?\s+(lunch|dinner|breakfast|food|coffee|transpo|grab|taxi|jeep|fare|gas|groceries|salary|rent|clothes|bill)\b/i.test(clean);
  if (hasAmountWithContext) {
    return {
      allowed: true,
      type: 'financial',
    };
  }

  // Ongoing conversation context adjustments (e.g. user modifies a pending proposal: "change amount to 400" or replies "yes/confirm")
  if (hasContext) {
    const isActionConfirmation = /^(yes|confirm|proceed|ok|okay|no|cancel|undo)$/i.test(clean);
    const isActionModification = /\b(make\s*it|change\s*(it|to|amount)?|set\s*(it|to)?|adjust|instead)\b.*\d+/i.test(clean);
    if (isActionConfirmation || isActionModification) {
      return {
        allowed: true,
        type: 'financial',
      };
    }
  }

  // 3. Greeting / pleasantry exception (warm financial welcome)
  const greetings = /^(hi|hello|hey|help|howdy|good\s*(morning|afternoon|evening)|what\s*can\s*you\s*do)\b/i;
  if (greetings.test(clean)) {
    return {
      allowed: true,
      type: 'financial',
    };
  }

  // 4. Non-Financial / Unrelated Query -> Strict Rejection
  return {
    allowed: false,
    type: 'unrelated',
    message:
      'I am your Moolah Copilot and I specialize exclusively in personal finance, money management, and wealth.\n\nI can only answer questions and execute actions connected to money (such as tracking expenses, setting budgets, net worth, investments, and savings).\n\nPlease ask a financial question or tell me what expense or income to record.',
  };
}

