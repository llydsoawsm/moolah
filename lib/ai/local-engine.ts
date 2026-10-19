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
 * with multi-turn contextual action modifications.
 */
export function processLocalQuery(query: string, lastAction?: CopilotActionProposal): CopilotResponse {
  const clean = query.trim();
  const lower = clean.toLowerCase();

  // ------------------------------------------------------------
  // 0. Contextual Modification of Previous Action Proposal
  // Examples:
  // "change it to 449/ month of 18"
  // "make it 300"
  // "change date to 20th"
  // "actually 1500"
  // ------------------------------------------------------------
  const isModification =
    lastAction &&
    (/\b(change|update|make\s*it|instead|actually|adjust|correct|switch|replace|set\s*to)\b/i.test(lower) ||
      (/\d+/.test(lower) && (lower.includes('/') || lower.includes('month') || lower.includes('day') || lower.includes('of'))));

  if (isModification && lastAction) {
    if (lastAction.type === 'add_subscription') {
      const amountMatch = clean.match(/(\d+(?:,\d+)*(?:\.\d+)?)/);
      const newAmount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : lastAction.payload.amount;

      // Extract day: "month of 18", "day 18", "on 18", "18th", or second number
      const dayMatch = clean.match(/(?:day|on|due|of)\s+(\d{1,2})|\b(\d{1,2})(?:st|nd|rd|th)\b/i);
      let newDay = lastAction.payload.billing_day;
      if (dayMatch) {
        newDay = parseInt(dayMatch[1] || dayMatch[2], 10);
      } else {
        const allNums = clean.match(/\b\d+\b/g);
        if (allNums && allNums.length >= 2) {
          const second = parseInt(allNums[1], 10);
          if (second >= 1 && second <= 31) newDay = second;
        }
      }

      const updatedPayload: AddSubscriptionParams = {
        ...lastAction.payload,
        amount: newAmount,
        billing_day: newDay,
      };

      return {
        engine: 'local',
        text: `Updated ${lastAction.payload.name}: ₱${newAmount.toLocaleString()}/mo (due ${newDay}th).`,
        action: {
          ...lastAction,
          id: generateId(),
          title: `Add Subscription: ${lastAction.payload.name}`,
          description: `₱${newAmount.toLocaleString()} / month on day ${newDay}`,
          payload: updatedPayload,
        },
        citations: [
          {
            source: 'Subscription Auditing Best Practice',
            note: 'Updated recurring parameters',
          },
        ],
      };
    }

    if (lastAction.type === 'set_budget') {
      const amountMatch = clean.match(/(\d+(?:,\d+)*(?:\.\d+)?)/);
      const newAmount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : lastAction.payload.amount;
      const updatedPayload = { ...lastAction.payload, amount: newAmount };

      return {
        engine: 'local',
        text: `Updated ${lastAction.payload.category_name} budget cap to ₱${newAmount.toLocaleString()}.`,
        action: {
          ...lastAction,
          id: generateId(),
          title: `Set Budget: ${lastAction.payload.category_name} (₱${newAmount.toLocaleString()})`,
          description: `Monthly allowance limit in SQLite`,
          payload: updatedPayload,
        },
        citations: [
          {
            source: 'Zero-Based Budgeting Framework',
            note: 'Adjusted envelope cap',
          },
        ],
      };
    }

    if (lastAction.type === 'log_transactions') {
      const amountMatch = clean.match(/(\d+(?:,\d+)*(?:\.\d+)?)/);
      const newAmount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : (lastAction.payload.items?.[0]?.amount || 0);
      const items = (lastAction.payload.items || []).map((it: any, idx: number) =>
        idx === 0 ? { ...it, amount: newAmount } : it
      );
      const updatedPayload = { items };

      return {
        engine: 'local',
        text: `Updated transaction amount to ₱${newAmount.toLocaleString()}.`,
        action: {
          ...lastAction,
          id: generateId(),
          title: `Log Transaction: ₱${newAmount.toLocaleString()}`,
          description: `Adjusted amount`,
          payload: updatedPayload,
        },
        citations: [
          {
            source: 'Local SQLite Engine',
            note: 'Adjusted transaction parameter',
          },
        ],
      };
    }
  }

  // ------------------------------------------------------------
  // 1. Transaction Logging Pattern Detection
  // Examples: "Add expense 450 lunch gcash", "Spent 120 coffee"
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
        description: `Total: ₱${total.toLocaleString()}`,
        payload: { items: transactions },
      };

      const breakdown = transactions
        .map((t) => `• ${t.type.toUpperCase()}: ₱${t.amount.toLocaleString()} ${t.note ? `("${t.note}")` : ''} [${t.category_name || 'General'}] via ${t.payment_method_name || 'Cash'}`)
        .join('\n');

      return {
        engine: 'local',
        text: `Prepared ${transactions.length} transaction(s):\n${breakdown}`,
        action,
        citations: [
          {
            source: 'Local SQLite Engine',
            note: 'Parsed deterministic syntax',
          },
        ],
      };
    }
  }

  // ------------------------------------------------------------
  // 2. Category Creation Pattern
  // Examples: "Add category Freelance income"
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
          text: `Prepared category: **${name}** (${isIncome ? 'Income' : 'Expense'}).`,
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
              note: 'Stored on-device in SQLite',
            },
          ],
        };
      }
    }
  }

  // ------------------------------------------------------------
  // 3. Set Budget Limit Pattern
  // Examples: "Set budget for Food to 5000"
  // ------------------------------------------------------------
  if (/\bbudget\b/i.test(lower) && /\d+/.test(lower)) {
    const amountMatch = clean.match(/(\d+(?:,\d+)*(?:\.\d+)?)/);
    const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;
    
    const forMatch = clean.match(/(?:for|on)\s+([a-zA-Z\s]+?)(?:\s+to|\s+at|\s+\d|$)/i);
    const catName = forMatch ? forMatch[1].trim() : 'Food';

    if (amount > 0) {
      const payload: SetBudgetParams = {
        category_name: catName,
        amount,
      };
      return {
        engine: 'local',
        text: `Prepared ${catName} budget cap: ₱${amount.toLocaleString()}/month.`,
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
  // Examples: "Add subscription Netflix 549 on day 15"
  // ------------------------------------------------------------
  if (/\b(subscription|bill|recurring)\b/i.test(lower)) {
    const amountMatch = clean.match(/(\d+(?:,\d+)*(?:\.\d+)?)/);
    const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;
    const dayMatch = clean.match(/(?:day|on|due|of)\s+(\d{1,2})|\b(\d{1,2})(?:st|nd|rd|th)\b/i);
    const billingDay = dayMatch ? parseInt(dayMatch[1] || dayMatch[2], 10) : 1;

    const nameMatch = clean.match(/(?:subscription|bill|recurring)\s+([a-zA-Z0-9\s]+?)(?:\s+\d|\s+day|\s+on|\s+due|\s+of|$)/i);
    const name = nameMatch && nameMatch[1] ? nameMatch[1].trim() : 'Recurring Bill';

    if (amount > 0) {
      const payload: AddSubscriptionParams = {
        name,
        amount,
        billing_day: billingDay,
      };
      return {
        engine: 'local',
        text: `Prepared subscription: **${name}** — ₱${amount.toLocaleString()}/mo (due ${billingDay}th).`,
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
  // 5. Targeted Query Answering (Biggest expense, balance, savings)
  // ------------------------------------------------------------
  const health = executeGetFinancialHealth();
  const savingsRate = health.savingsRate;
  const net = health.net;

  // 5a. Biggest / Top Expense Query
  if (/\b(biggest|highest|most|top|largest)\s*(expense|spending|cost|spend)?\b/i.test(lower) || lower.includes('what is my biggest')) {
    if (health.topCategories.length > 0) {
      const top = health.topCategories[0];
      return {
        engine: 'local',
        text: `Your biggest expense this month is **${top.name}** at **₱${top.amount.toLocaleString()}** (${top.percentage}% of total spending).`,
        citations: [
          {
            source: 'Moolah SQLite Ledger',
            note: `Real ledger records for ${health.month}`,
          },
        ],
      };
    } else {
      return {
        engine: 'local',
        text: `No expenses recorded for ${health.month} yet.`,
        citations: [{ source: 'Moolah SQLite', note: 'Zero records' }],
      };
    }
  }

  // 5b. Net Balance Query
  if (/\b(balance|net|how much (money )?do i have|remaining)\b/i.test(lower) && !lower.includes('budget')) {
    return {
      engine: 'local',
      text: `Your net balance for this month is **${net >= 0 ? '+' : ''}₱${net.toLocaleString()}** (Income: ₱${health.income.toLocaleString()}, Expenses: ₱${health.expenses.toLocaleString()}).`,
      citations: [
        {
          source: 'Moolah SQLite Ledger',
          note: `Aggregated for ${health.month}`,
        },
      ],
    };
  }

  // 5c. Daily Burn Rate Query
  if (/\b(burn rate|per day|daily spend|daily burn)\b/i.test(lower)) {
    return {
      engine: 'local',
      text: `Your average daily burn rate is **₱${health.burnRatePerDay.toLocaleString()}/day** with ${health.daysRemainingInMonth} days remaining this month.`,
      citations: [
        {
          source: 'Cash Flow Velocity',
          note: `Calculated from ${health.month} ledger`,
        },
      ],
    };
  }

  // 5d. General Financial Health & 50/30/20 Coaching
  let advice = '';
  if (health.income === 0 && health.expenses === 0) {
    advice = `No transactions recorded for ${health.month} yet.\n\n**50/30/20 Benchmark:**\n• 50% Needs (Groceries, bills, rent)\n• 30% Wants (Dining, streaming)\n• 20% Savings (Emergency fund)\n\nTry: *"Add expense 150 coffee"* or *"Received 30000 salary bank"*.`;
  } else {
    advice = `### 📊 Financial Health (${health.month})\n` +
      `• **Income:** ₱${health.income.toLocaleString()} | **Expenses:** ₱${health.expenses.toLocaleString()}\n` +
      `• **Net:** ${net >= 0 ? '+' : ''}₱${net.toLocaleString()} (${savingsRate}% savings rate)\n` +
      `• **Daily Burn:** ~₱${health.burnRatePerDay.toLocaleString()}/day (${health.daysRemainingInMonth}d left)\n` +
      `• **Projected End:** ₱${health.projectedMonthEndBalance.toLocaleString()}\n\n`;

    if (health.topCategories.length > 0) {
      advice += `**Top Spend:** ` +
        health.topCategories.slice(0, 3).map((c) => `${c.name} (₱${c.amount.toLocaleString()})`).join(', ') +
        `\n\n`;
    }

    if (savingsRate >= 20) {
      advice += `⭐ Savings rate (${savingsRate}%) is on track with the 50/30/20 guideline.`;
    } else if (savingsRate > 0) {
      advice += `💡 Current savings rate is ${savingsRate}%. Target is 20%.`;
    } else {
      advice += `⚠️ Deficit of ₱${Math.abs(net).toLocaleString()} this month. Pause discretionary expenses.`;
    }
  }

  return {
    engine: 'local',
    text: advice,
    citations: [
      {
        source: 'Elizabeth Warren (All Your Worth)',
        note: '50/30/20 Rule',
      },
      {
        source: 'Moolah SQLite',
        note: `Ledger data (${health.month})`,
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

    let paymentMethod = 'Cash';
    if (/\b(gcash)\b/i.test(seg)) paymentMethod = 'GCash';
    else if (/\b(maya|paymaya)\b/i.test(seg)) paymentMethod = 'Maya';
    else if (/\b(bank|bdo|bpi|metrobank|unionbank|card|credit|debit)\b/i.test(seg)) paymentMethod = 'Bank Account';

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
