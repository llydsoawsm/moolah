// ============================================================
// MoneyGuide — Local AI Deterministic Engine (Offline NLP & Coach)
// ============================================================
import {
  executeGetFinancialHealth,
  type LogTransactionParams,
  type CreateCategoryParams,
  type SetBudgetParams,
  type AddSubscriptionParams,
} from './actions-dispatcher';
import { generateId } from '../utils';
import type { EmergencyHotline } from './guardrails';

export interface CopilotCitation {
  source: string;
  note: string;
}

export interface CopilotActionProposal {
  id: string;
  type: 'log_transactions' | 'create_category' | 'set_budget' | 'add_subscription';
  title: string;
  description: string;
  payload: any;
  executed?: boolean;
}

export interface CopilotResponse {
  engine: 'local' | 'gemini';
  text: string;
  action?: CopilotActionProposal;
  citations: CopilotCitation[];
  hotlines?: EmergencyHotline[];
}

/**
 * Parses user input locally using regex and deterministic rule templates
 * when offline or when no Gemini API key is configured.
 */
export function processLocalQuery(query: string): CopilotResponse {
  const clean = query.trim();
  const lower = clean.toLowerCase();

  // ------------------------------------------------------------
  // 1. Transaction Logging Pattern Detection
  // Examples:
  // "Add expense 450 lunch gcash"
  // "Spent 120 coffee"
  // "Received 25000 salary bank"
  // "Add 200 taxi and 350 groceries"
  // ------------------------------------------------------------
  const isAddExpense =
    /\b(spent|spend|paid|expense|buy|bought|cost)\b/i.test(lower) ||
    (/\b(add|record|log)\b/i.test(lower) && !lower.includes('category') && !lower.includes('budget') && !lower.includes('subscription') && !lower.includes('bill'));

  const isAddIncome = /\b(received|earned|income|salary|deposit|got paid)\b/i.test(lower);

  if (isAddExpense || isAddIncome) {
    const transactions = parseTransactionItems(clean, isAddIncome ? 'income' : 'expense');
    if (transactions.length > 0) {
      const total = transactions.reduce((sum, t) => sum + t.amount, 0);
      const action: CopilotActionProposal = {
        id: generateId(),
        type: 'log_transactions',
        title: `Log ${transactions.length} ${transactions[0].type === 'income' ? 'Income' : 'Expense'}${transactions.length > 1 ? 's' : ''}`,
        description: `Ready to record ${transactions.length} item(s) totaling ${total.toLocaleString()}`,
        payload: { items: transactions },
      };

      const breakdown = transactions
        .map((t) => `• ${t.type.toUpperCase()}: ₱${t.amount.toLocaleString()} ${t.note ? `("${t.note}")` : ''} [${t.category_name || 'General'}] via ${t.payment_method_name || 'Cash'}`)
        .join('\n');

      return {
        engine: 'local',
        text: `I've prepared the transaction entry for you:\n\n${breakdown}\n\nTap **Confirm Action** below to save this directly to your Moolah offline database.`,
        action,
        citations: [
          {
            source: 'Local SQLite Engine',
            note: 'Parsed deterministic syntax from offline rules',
          },
        ],
      };
    }
  }

  // ------------------------------------------------------------
  // 2. Category Creation Pattern
  // Examples: "Add category Freelance income", "Create category Gym expense #EF4444"
  // ------------------------------------------------------------
  if (/\b(create|add|new)\s+category\b/i.test(lower)) {
    const catMatch = clean.match(/(?:create|add|new)\s+category\s+([^,]+)/i);
    if (catMatch && catMatch[1]) {
      const rest = catMatch[1].trim();
      const isIncome = /\b(income|earning)\b/i.test(rest);
      const name = rest.replace(/\b(income|expense)\b/gi, '').trim();

      if (name.length > 0) {
        const payload: CreateCategoryParams = {
          name,
          type: isIncome ? 'income' : 'expense',
        };
        return {
          engine: 'local',
          text: `I prepared a new ${isIncome ? 'Income' : 'Expense'} category **"${name}"** for your budget.`,
          action: {
            id: generateId(),
            type: 'create_category',
            title: `Create Category: ${name}`,
            description: `Type: ${isIncome ? 'Income' : 'Expense'}`,
            payload,
          },
          citations: [
            {
              source: 'Local Moolah Taxonomy',
              note: 'Categories are stored securely on-device in SQLite',
            },
          ],
        };
      }
    }
  }

  // ------------------------------------------------------------
  // 3. Set Budget Limit Pattern
  // Examples: "Set budget for Food to 5000", "Budget 3000 for Transport"
  // ------------------------------------------------------------
  if (/\bbudget\b/i.test(lower) && /\d+/.test(lower)) {
    const amountMatch = clean.match(/(\d+(?:,\d+)*(?:\.\d+)?)/);
    const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;
    
    // Find category name
    const forMatch = clean.match(/(?:for|on)\s+([a-zA-Z\s]+?)(?:\s+to|\s+at|\s+\d|$)/i);
    const catName = forMatch ? forMatch[1].trim() : 'Food';

    if (amount > 0) {
      const payload: SetBudgetParams = {
        category_name: catName,
        amount,
      };
      return {
        engine: 'local',
        text: `I can set a monthly spending cap of **₱${amount.toLocaleString()}** for **${catName}**.`,
        action: {
          id: generateId(),
          type: 'set_budget',
          title: `Set Budget: ${catName} (₱${amount.toLocaleString()})`,
          description: `Monthly allowance limit in SQLite`,
          payload,
        },
        citations: [
          {
            source: 'Zero-Based Budgeting Framework',
            note: 'Envelope spending limits prevent month-end cash flow shortfalls',
          },
        ],
      };
    }
  }

  // ------------------------------------------------------------
  // 4. Add Recurring Subscription / Bill
  // Examples: "Add subscription Netflix 549 on day 15", "Add bill Meralco 3500 due 20"
  // ------------------------------------------------------------
  if (/\b(subscription|bill|recurring)\b/i.test(lower)) {
    const amountMatch = clean.match(/(\d+(?:,\d+)*(?:\.\d+)?)/);
    const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;
    const dayMatch = clean.match(/(?:day|on|due)\s+(\d{1,2})/i);
    const billingDay = dayMatch ? parseInt(dayMatch[1], 10) : 1;

    // Extract name
    const nameMatch = clean.match(/(?:subscription|bill|recurring)\s+([a-zA-Z0-9\s]+?)(?:\s+\d|\s+day|\s+on|\s+due|$)/i);
    const name = nameMatch && nameMatch[1] ? nameMatch[1].trim() : 'Recurring Bill';

    if (amount > 0) {
      const payload: AddSubscriptionParams = {
        name,
        amount,
        billing_day: billingDay,
      };
      return {
        engine: 'local',
        text: `I've prepared a recurring subscription for **${name}** (₱${amount.toLocaleString()} due every ${billingDay}th of the month).`,
        action: {
          id: generateId(),
          type: 'add_subscription',
          title: `Add Subscription: ${name}`,
          description: `₱${amount.toLocaleString()} / month on day ${billingDay}`,
          payload,
        },
        citations: [
          {
            source: 'Subscription Auditing Best Practice',
            note: 'Explicit due-date tracking prevents overdraft fees and forgotten renewals',
          },
        ],
      };
    }
  }

  // ------------------------------------------------------------
  // 5. Financial Health / Insights & 50/30/20 Coaching
  // Examples: "How to budget wisely?", "Give me insights", "Review my finances", "50/30/20"
  // ------------------------------------------------------------
  const health = executeGetFinancialHealth();
  const savingsRate = health.savingsRate;
  const net = health.net;

  let advice = '';
  if (health.income === 0 && health.expenses === 0) {
    advice = `You don't have any income or expense records for ${health.month} yet in your offline database.\n\nTo build a healthy budget, the **50/30/20 Rule** recommends allocating:\n• **50% Needs**: Essential housing, utilities, groceries, and commute\n• **30% Wants**: Discretionary dining, hobbies, and streaming\n• **20% Savings & Debt**: Emergency fund and investments\n\nTry telling me: *"Add expense 150 coffee"* or *"Received 30000 salary bank"* to begin!`;
  } else {
    advice = `### 📊 Financial Health Snapshot (${health.month})\n\n` +
      `• **Total Income:** ₱${health.income.toLocaleString()}\n` +
      `• **Total Expenses:** ₱${health.expenses.toLocaleString()}\n` +
      `• **Net Balance:** ${net >= 0 ? '+' : ''}₱${net.toLocaleString()} (${savingsRate}% savings rate)\n` +
      `• **Daily Burn Rate:** ~₱${health.burnRatePerDay.toLocaleString()}/day (${health.daysRemainingInMonth} days left in month)\n` +
      `• **Projected Month-End:** ₱${health.projectedMonthEndBalance.toLocaleString()}\n\n`;

    if (health.topCategories.length > 0) {
      advice += `**Top Spending Drivers:**\n` +
        health.topCategories.map((c) => `• ${c.name}: ₱${c.amount.toLocaleString()} (${c.percentage}%)`).join('\n') +
        `\n\n`;
    }

    if (savingsRate >= 20) {
      advice += `⭐ **Great Job!** Your savings rate (${savingsRate}%) exceeds the recommended **20% threshold** of the 50/30/20 rule. Keep channeling this surplus into high-yield savings or retirement reserves.`;
    } else if (savingsRate > 0) {
      advice += `💡 **Optimization Tip:** Your current savings rate is ${savingsRate}%. To reach the standard 20% savings benchmark, review your top discretionary expense (${health.topCategories[0]?.name || 'discretionary spend'}) and consider setting a budget cap.`;
    } else {
      advice += `⚠️ **Deficit Alert:** Your expenses currently exceed your recorded income by ₱${Math.abs(net).toLocaleString()}. Pause non-essential purchases and consider trimming subscriptions.`;
    }
  }

  return {
    engine: 'local',
    text: advice,
    citations: [
      {
        source: 'Elizabeth Warren & Amelia Warren Tyagi (All Your Worth)',
        note: '50/30/20 Balanced Spending Formula (Needs/Wants/Savings)',
      },
      {
        source: 'Moolah SQLite Database',
        note: `Real ledger records for ${health.month}`,
      },
    ],
  };
}

/**
 * Heuristic transaction parser supporting single or multi-line/comma inputs:
 * "450 lunch gcash, 200 taxi cash, 1200 groceries bdo"
 */
function parseTransactionItems(text: string, defaultType: 'expense' | 'income'): LogTransactionParams[] {
  const items: LogTransactionParams[] = [];
  
  // Split by newline or commas if multiple items are mentioned
  const segments = text
    .replace(/\band\b/gi, ',')
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const seg of segments) {
    const amountMatch = seg.match(/(\d+(?:,\d+)*(?:\.\d+)?)/);
    if (!amountMatch) continue;

    const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    if (isNaN(amount) || amount <= 0) continue;

    // Check payment method
    let paymentMethod = 'Cash';
    if (/\b(gcash)\b/i.test(seg)) paymentMethod = 'GCash';
    else if (/\b(maya|paymaya)\b/i.test(seg)) paymentMethod = 'Maya';
    else if (/\b(bank|bdo|bpi|metrobank|unionbank|card|credit|debit)\b/i.test(seg)) paymentMethod = 'Bank Account';

    // Check category keywords
    let categoryName = defaultType === 'income' ? 'Salary' : 'General';
    if (/\b(coffee|lunch|dinner|breakfast|food|burger|snack|restaurant|dining|jollibee|mcdo)\b/i.test(seg)) {
      categoryName = 'Food & Dining';
    } else if (/\b(taxi|grab|angkas|jeep|bus|mrt|lrt|gas|fuel|commute|transport)\b/i.test(seg)) {
      categoryName = 'Transportation';
    } else if (/\b(grocery|groceries|supermarket|puregold|sm)\b/i.test(seg)) {
      categoryName = 'Groceries';
    } else if (/\b(shopping|clothes|shoes|lazada|shopee|amazon)\b/i.test(seg)) {
      categoryName = 'Shopping';
    } else if (/\b(bill|electric|water|meralco|maynilad|wifi|internet|converge|pldt)\b/i.test(seg)) {
      categoryName = 'Bills & Utilities';
    } else if (/\b(salary|sweldo|wage|payroll)\b/i.test(seg)) {
      categoryName = 'Salary';
    } else if (/\b(freelance|client|project|side\s*hustle)\b/i.test(seg)) {
      categoryName = 'Freelance';
    }

    // Clean note description
    const cleanedNote = seg
      .replace(/(\badd\b|\bspent\b|\bspend\b|\bpaid\b|\bexpense\b|\breceived\b|\bearned\b)/gi, '')
      .replace(/\d+(?:,\d+)*(?:\.\d+)?/g, '')
      .replace(/\b(gcash|maya|bank|cash|peso|pesos|php|₱)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    items.push({
      type: defaultType,
      amount,
      category_name: categoryName,
      payment_method_name: paymentMethod,
      note: cleanedNote || categoryName,
    });
  }

  return items;
}
