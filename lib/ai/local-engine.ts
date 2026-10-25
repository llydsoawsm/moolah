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
  type:
    | 'log_transactions'
    | 'create_category'
    | 'set_budget'
    | 'add_subscription'
    | 'delete_transaction'
    | 'delete_subscription'
    | 'delete_budget'
    | 'update_settings';
  title: string;
  description: string;
  payload: any;
  executed?: boolean;
}

export interface CopilotResponse {
  engine: 'local' | 'gemini';
  text: string;
  action?: CopilotActionProposal;
  citations?: CopilotCitation[];
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
  // Greetings & Copilot Assistant Identity
  // ------------------------------------------------------------
  const isGreeting =
    /^(hello|hi|hey|greetings|kumusta|sup|good\s*(morning|afternoon|evening))\b/i.test(lower) &&
    !lower.includes('spent') &&
    !lower.includes('add') &&
    !lower.includes('log') &&
    !lower.includes('budget') &&
    !lower.includes('subscription');

  if (isGreeting) {
    return {
      engine: 'local',
      text: "👋 Hi there! I'm your Moolah Copilot. How can I assist you with your finances today? You can ask me to log an expense, set a budget, check your net balance, or analyze your spending.",
    };
  }

  const isCapabilitiesQuery =
    /^(what can you do|help|who are you|features|how to use)\b/i.test(lower);

  if (isCapabilitiesQuery) {
    return {
      engine: 'local',
      text: "I am your Moolah Copilot! Here is what I can do:\n\n• **Log Transactions:** *\"Spent 450 for lunch GCash\"* or *\"Received 30000 salary\"*\n• **Set Budgets:** *\"Set budget for Food to 5000\"*\n• **Add Recurring Bills:** *\"Add subscription Netflix 549 on day 15\"*\n• **Manage Ledger:** *\"Delete last expense\"* or *\"Cancel subscription Netflix\"*\n• **Financial Coaching:** *\"Review my financial health\"* or *\"What is my balance?\"*",
    };
  }

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
      };
    }
  }

  // ------------------------------------------------------------
  // Deletion / Cancellation / Settings Patterns (Full Agent Control)
  // ------------------------------------------------------------
  if (/\b(delete|remove)\s+(last\s+)?(expense|income|transaction)\b/i.test(lower) || /\b(delete|remove)\s+expense\b/i.test(lower)) {
    const amountMatch = clean.match(/(\d+(?:,\d+)*(?:\.\d+)?)/);
    const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : undefined;
    return {
      engine: 'local',
      text: `Deleting ${amount ? `₱${amount.toLocaleString()} ` : 'last '}transaction from SQLite ledger.`,
      action: {
        id: generateId(),
        type: 'delete_transaction',
        title: 'Delete Transaction',
        description: amount ? `Remove ₱${amount.toLocaleString()} expense` : 'Remove most recent transaction',
        payload: { amount },
      },
    };
  }

  if (/\b(cancel|remove|delete)\s+(subscription|bill)?\s*([a-zA-Z0-9\s]+)\b/i.test(lower) && !lower.includes('expense') && !lower.includes('budget') && !lower.includes('category')) {
    const match = clean.match(/(?:cancel|remove|delete)\s+(?:subscription|bill)?\s*([a-zA-Z0-9\s]+)/i);
    const name = match && match[1] ? match[1].trim() : '';
    if (name) {
      return {
        engine: 'local',
        text: `Canceling subscription **${name}** from SQLite.`,
        action: {
          id: generateId(),
          type: 'delete_subscription',
          title: `Cancel Subscription: ${name}`,
          description: `Remove recurring bill`,
          payload: { name },
        },
      };
    }
  }

  if (/\b(delete|remove|clear|reset)\s+budget\b/i.test(lower)) {
    const forMatch = clean.match(/(?:for|on)\s+([a-zA-Z\s]+)/i);
    const catName = forMatch ? forMatch[1].trim() : 'Food';
    return {
      engine: 'local',
      text: `Removing monthly budget for **${catName}**.`,
      action: {
        id: generateId(),
        type: 'delete_budget',
        title: `Delete Budget: ${catName}`,
        description: 'Reset category budget',
        payload: { category_name: catName },
      },
    };
  }

  if (/\b(change|set)\s+(currency|theme)\b/i.test(lower)) {
    const isCurrency = lower.includes('currency');
    if (isCurrency) {
      const currMatch = clean.match(/\b(PHP|USD|EUR|GBP|JPY|CAD|AUD|SGD)\b/i);
      const currency = currMatch ? currMatch[1].toUpperCase() : 'PHP';
      return {
        engine: 'local',
        text: `Updating currency to **${currency}**.`,
        action: {
          id: generateId(),
          type: 'update_settings',
          title: `Update Currency: ${currency}`,
          description: `Set app currency`,
          payload: { currency },
        },
      };
    } else {
      const themeMatch = clean.match(/\b(dark|light|midnight)\b/i);
      const theme = (themeMatch ? themeMatch[1].toLowerCase() : 'dark') as any;
      return {
        engine: 'local',
        text: `Updating theme to **${theme}**.`,
        action: {
          id: generateId(),
          type: 'update_settings',
          title: `Update Theme: ${theme}`,
          description: `Set app theme`,
          payload: { theme },
        },
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
      };
    }
  }

  // ------------------------------------------------------------
  // 5. Targeted Query Answering (Biggest expense, balance, savings)
  // ------------------------------------------------------------
  const health = executeGetFinancialHealth();
  const savingsRate = Number(health?.savingsRate) || 0;
  const net = Number(health?.net) || 0;
  const income = Number(health?.income) || 0;
  const expenses = Number(health?.expenses) || 0;
  const burnRate = Number(health?.burnRatePerDay) || 0;
  const projectedEnd = Number(health?.projectedMonthEndBalance) || 0;
  const daysLeft = Number(health?.daysRemainingInMonth) || 1;

  // 5a. Biggest / Top Expense Query
  if (/\b(biggest|highest|most|top|largest)\s*(expense|spending|cost|spend)?\b/i.test(lower) || lower.includes('what is my biggest')) {
    if (health?.topCategories && health.topCategories.length > 0) {
      const top = health.topCategories[0];
      const topAmt = Number(top.amount) || 0;
      return {
        engine: 'local',
        text: `Your biggest expense this month is **${top.name}** at **₱${topAmt.toLocaleString()}** (${top.percentage || 0}% of total spending).`,
      };
    } else {
      return {
        engine: 'local',
        text: `No expenses recorded for ${health?.month || 'this month'} yet.`,
      };
    }
  }

  // 5b. Net Balance Query
  if (/\b(balance|net|how much (money )?do i have|remaining)\b/i.test(lower) && !lower.includes('budget')) {
    return {
      engine: 'local',
      text: `Your net balance for this month is **${net >= 0 ? '+' : ''}₱${net.toLocaleString()}** (Income: ₱${income.toLocaleString()}, Expenses: ₱${expenses.toLocaleString()}).`,
    };
  }

  // 5c. Daily Burn Rate Query
  if (/\b(burn rate|per day|daily spend|daily burn)\b/i.test(lower)) {
    return {
      engine: 'local',
      text: `Your average daily burn rate is **₱${burnRate.toLocaleString()}/day** with ${daysLeft} days remaining this month.`,
    };
  }

  // 5d. General Financial Health & 50/30/20 Coaching
  let advice = '';
  if (income === 0 && expenses === 0) {
    advice = `No transactions recorded for ${health?.month || 'this month'} yet.\n\n**50/30/20 Guideline:**\n• 50% Needs\n• 30% Wants\n• 20% Savings`;
  } else {
    advice = `### Financial Health (${health?.month || 'This Month'})\n` +
      `• **Income:** ₱${income.toLocaleString()} | **Expenses:** ₱${expenses.toLocaleString()}\n` +
      `• **Net:** ${net >= 0 ? '+' : ''}₱${net.toLocaleString()} (${savingsRate}% savings rate)\n` +
      `• **Daily Burn:** ~₱${burnRate.toLocaleString()}/day (${daysLeft}d left)\n` +
      `• **Projected End:** ₱${projectedEnd.toLocaleString()}\n\n`;

    if (health?.topCategories && health.topCategories.length > 0) {
      advice += `**Top Spend:** ` +
        health.topCategories.slice(0, 3).map((c) => `${c.name} (₱${(Number(c.amount) || 0).toLocaleString()})`).join(', ') +
        `\n\n`;
    }

    if (savingsRate >= 20) {
      advice += `Savings rate (${savingsRate}%) is on track.`;
    } else if (savingsRate > 0) {
      advice += `Current savings rate is ${savingsRate}%. Target is 20%.`;
    } else {
      advice += `Deficit of ₱${Math.abs(net).toLocaleString()} this month. Pause discretionary expenses.`;
    }
  }

  return {
    engine: 'local',
    text: advice,
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
