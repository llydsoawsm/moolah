// ============================================================
// MoneyGuide — AI Guardrails & Emergency Hotline System
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

/** Verified Emergency & Crisis Hotlines */
export const EMERGENCY_HOTLINES: EmergencyHotline[] = [
  {
    name: 'National Emergency Hotline',
    number: '911',
    description: 'Police, fire, and medical emergency dispatch',
    region: 'Philippines / US / Global',
  },
  {
    name: 'DOH Health Line (Department of Health)',
    number: '1555',
    description: 'Medical guidance & health emergency referral',
    region: 'Philippines',
  },
  {
    name: 'NCMH Mental Health Crisis Hotline',
    number: '1553',
    description: '24/7 toll-free crisis support & counseling (Landline)',
    region: 'Philippines',
  },
  {
    name: 'NCMH Mobile Hotline',
    number: '0917-899-8727',
    description: '24/7 Mobile / SMS crisis support',
    region: 'Philippines',
  },
  {
    name: 'Suicide & Crisis Lifeline',
    number: '988',
    description: '24/7 free and confidential mental health support',
    region: 'International / US / Canada',
  },
  {
    name: 'European Emergency Number',
    number: '112',
    description: 'Universal medical and rescue emergency services',
    region: 'Europe / International',
  },
];

/** Health & medical distress keywords */
const HEALTH_PATTERNS = [
  /\b(heart\s*attack|stroke|chest\s*pain|cannot\s*breathe|shortness\s*of\s*breath)\b/i,
  /\b(suicid|kill\s*myself|end\s*my\s*life|depression|depressed|want\s*to\s*die|self\s*harm)\b/i,
  /\b(hospital|emergency\s*room|ambulance|doctor|poison|overdose|severe\s*pain)\b/i,
  /\b(bleeding|seizure|unconscious|fainted|broken\s*bone|fever|infection)\b/i,
  /\b(mental\s*health|anxiety\s*attack|panic\s*attack|crisis|psychiatrist)\b/i,
];

/** Financial & Moolah app keywords (explicitly allowed) */
const FINANCIAL_PATTERNS = [
  /\b(spend|spent|expense|income|earn|earned|received|cash|money|peso|dollar|\$|₱|budget)\b/i,
  /\b(save|saving|savings|investment|invest|bank|gcash|maya|card|credit|debit|wallet)\b/i,
  /\b(subscription|bill|bills|pay|paid|cost|price|fee|debt|owe|loan|tax|afford)\b/i,
  /\b(category|categories|transaction|history|analytics|financial|wealth|fund)\b/i,
  /\b(groceries|food|dining|transport|shopping|salary|wage|bonus|netflix|spotify)\b/i,
  /\b(balance|net|receipt|voucher|discount|interest|inflation|50\/30\/20)\b/i,
];

/**
 * Classify a user prompt against guardrails:
 * 1. Health / medical crisis -> triggers verified emergency hotlines
 * 2. Financial / Moolah system intent -> allowed
 * 3. Unrelated / non-financial -> politely declined
 */
export function checkPromptGuardrails(prompt: string): GuardrailCheckResult {
  const clean = prompt.trim().toLowerCase();

  // 1. Health & Medical Crisis Trigger
  for (const pattern of HEALTH_PATTERNS) {
    if (pattern.test(clean)) {
      return {
        allowed: false,
        type: 'health_emergency',
        message:
          'It looks like you mentioned a health or emergency concern. Moolah is strictly an offline financial management tool and cannot provide medical assistance. If you or someone you know is in distress or experiencing a medical emergency, please contact professional emergency services immediately:',
        hotlines: EMERGENCY_HOTLINES,
      };
    }
  }

  // 2. Financial & System Control Intent
  const hasFinancialIntent = FINANCIAL_PATTERNS.some((pattern) => pattern.test(clean));
  const hasNumbers = /\d+/.test(clean); // E.g., "Add 500 lunch"

  if (hasFinancialIntent || (hasNumbers && (clean.includes('add') || clean.includes('create') || clean.includes('set')))) {
    return {
      allowed: true,
      type: 'financial',
    };
  }

  // 3. Greeting / pleasantry exception
  const greetings = /^(hi|hello|hey|help|howdy|good\s*(morning|afternoon|evening)|what\s*can\s*you\s*do)\b/i;
  if (greetings.test(clean)) {
    return {
      allowed: true,
      type: 'financial',
    };
  }

  // 4. Non-Financial / Unrelated Query -> Rejection
  return {
    allowed: false,
    type: 'unrelated',
    message:
      'I am your Moolah Financial Copilot. I specialize exclusively in personal finance, money management, budgets, and expenses. Please ask a financial question or ask me to record a transaction, set a budget, or review your spending.',
  };
}
