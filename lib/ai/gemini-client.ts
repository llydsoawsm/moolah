// ============================================================
// MoneyGuide — Hybrid Cloud Gemini Client with Local Fallback
// ============================================================
import { checkPromptGuardrails } from './guardrails';
import { processLocalQuery, type CopilotResponse, type CopilotActionProposal } from './local-engine';
import { executeGetFinancialHealth } from './actions-dispatcher';
import { generateId } from '../utils';
import { DEFAULT_GEMINI_API_KEY, DEFAULT_GEMINI_MODEL } from './config';


export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  engine?: 'local' | 'gemini';
  action?: CopilotActionProposal;
  citations?: { source: string; note: string }[];
  hotlines?: any[];
  timestamp: number;
}

const COPILOT_TOOLS = [
  {
    function_declarations: [
      {
        name: 'log_transactions',
        description: 'Record single or multiple expenses/incomes into the SQLite ledger.',
        parameters: {
          type: 'OBJECT',
          properties: {
            items: {
              type: 'ARRAY',
              description: 'List of transaction objects to record',
              items: {
                type: 'OBJECT',
                properties: {
                  type: { type: 'STRING', enum: ['income', 'expense'] },
                  amount: { type: 'NUMBER', description: 'Numerical amount in currency' },
                  category_name: { type: 'STRING', description: 'e.g. Food & Dining, Transportation, Groceries, Salary' },
                  payment_method_name: { type: 'STRING', description: 'e.g. Cash, GCash, Maya, Bank Account' },
                  note: { type: 'STRING', description: 'Memo or note' },
                  date: { type: 'STRING', description: 'YYYY-MM-DD format (optional)' },
                },
                required: ['type', 'amount'],
              },
            },
          },
          required: ['items'],
        },
      },
      {
        name: 'create_category',
        description: 'Create a new expense or income category in SQLite.',
        parameters: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING', description: 'Name of the category' },
            type: { type: 'STRING', enum: ['expense', 'income'], description: 'Expense or income' },
            icon: { type: 'STRING', description: 'Icon name (e.g. cart, restaurant, car, gift)' },
            color: { type: 'STRING', description: 'Hex color code (e.g. #3B82F6)' },
          },
          required: ['name', 'type'],
        },
      },
      {
        name: 'set_budget',
        description: 'Set a monthly spending limit for an expense category.',
        parameters: {
          type: 'OBJECT',
          properties: {
            category_name: { type: 'STRING', description: 'Name of the expense category' },
            amount: { type: 'NUMBER', description: 'Monthly budget cap' },
          },
          required: ['category_name', 'amount'],
        },
      },
      {
        name: 'add_subscription',
        description: 'Add a recurring monthly bill or subscription to SQLite.',
        parameters: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING', description: 'Name of the service or bill' },
            amount: { type: 'NUMBER', description: 'Recurring payment amount' },
            billing_day: { type: 'NUMBER', description: 'Day of the month (1-31)' },
            category_name: { type: 'STRING', description: 'Category name' },
          },
          required: ['name', 'amount', 'billing_day'],
        },
      },
      {
        name: 'delete_transaction',
        description: 'Delete or remove a transaction from the SQLite ledger.',
        parameters: {
          type: 'OBJECT',
          properties: {
            amount: { type: 'NUMBER', description: 'Amount of transaction to delete' },
            note: { type: 'STRING', description: 'Note or description keyword' },
            category_name: { type: 'STRING', description: 'Category name of transaction' },
          },
        },
      },
      {
        name: 'delete_subscription',
        description: 'Cancel or remove a recurring bill or subscription.',
        parameters: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING', description: 'Name of the subscription to cancel' },
          },
          required: ['name'],
        },
      },
      {
        name: 'delete_budget',
        description: 'Delete or reset a category budget.',
        parameters: {
          type: 'OBJECT',
          properties: {
            category_name: { type: 'STRING', description: 'Category name' },
          },
          required: ['category_name'],
        },
      },
      {
        name: 'update_settings',
        description: 'Update user preferences like currency code (e.g. PHP, USD, EUR) or theme (dark, light, midnight).',
        parameters: {
          type: 'OBJECT',
          properties: {
            currency: { type: 'STRING', description: 'Currency code e.g. PHP, USD, EUR' },
            theme: { type: 'STRING', enum: ['dark', 'light', 'midnight'], description: 'Theme name' },
          },
        },
      },
      {
        name: 'clear_all_transactions',
        description: 'Clear all transaction history and purge dummy records from the ledger.',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
    ],
  },
];

/**
 * Send user query to Gemini Cloud API with automated fallback to Local Engine
 */
export async function sendCopilotMessage(
  query: string,
  apiKey?: string,
  chatHistory: ChatMessage[] = [],
  modelName = DEFAULT_GEMINI_MODEL,
): Promise<CopilotResponse> {
  const hasContext = chatHistory && chatHistory.length > 0;
  const lastAction = [...chatHistory].reverse().find((m) => m.action && !m.action.executed)?.action;

  // 1. First line of defense: Guardrails
  const guard = checkPromptGuardrails(query, hasContext);
  if (!guard.allowed) {
    if (guard.type === 'health_emergency') {
      return {
        engine: 'local',
        text: guard.message || 'Emergency medical services hotline alert.',
        hotlines: guard.hotlines,
      };
    }

    // Unrelated / non-financial prompt
    return {
      engine: 'local',
      text: guard.message || 'I only specialize in personal finance, money management, and budgets.',
    };
  }

  // 2. Resolve API key (use user key if supplied, otherwise fallback to embedded default key)
  const effectiveApiKey = (apiKey && apiKey.trim().length > 0) ? apiKey.trim() : DEFAULT_GEMINI_API_KEY;

  if (!effectiveApiKey || effectiveApiKey.trim().length === 0) {
    return processLocalQuery(query, lastAction);
  }

  // 3. Online Gemini API Request with Gemini 3.8 priority and model cascade
  const targetModel = (modelName || DEFAULT_GEMINI_MODEL).trim();
  const modelsToTry = [
    targetModel === 'gemini-3.8' ? 'gemini-3.8-flash' : targetModel,
    'gemini-3.8-flash',
    'gemini-3.8',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
  ].filter((v, i, a) => v && a.indexOf(v) === i);

  try {
    const health = executeGetFinancialHealth();

    const systemInstruction = {
      role: 'system',
      parts: [
        {
          text: `You are Moolah AI Copilot, a high-intelligence autonomous personal finance agent.
STRICT SCOPE GUARDRAIL:
1. MONEY TOPICS ONLY: You MUST ONLY answer questions and requests that are directly related to money, personal finance, wealth, net worth (e.g. who has the most net worth in the world, wealthiest people, billionaires), budgeting, investing, expenses, debt, business, and economics.
2. STRICT REFUSAL FOR NON-FINANCIAL TOPICS: If the user asks about ANY topic NOT related to money (such as general knowledge like why birds fly, code generation like HTML hello world, writing 5 English words, poetry, science, trivia, history unrelated to finance), you MUST strictly refuse and output ONLY:
"I specialize exclusively in personal finance, money management, and wealth. I cannot answer non-financial topics like this. Please ask me a question related to money, net worth, or your budget."
3. HEALTH & MENTAL HEALTH: If the user mentions health or mental health distress (depression, sadness, crisis, sickness), express compassionate concern and refer them immediately to the Philippine hotlines:
- National Emergency Hotline: 911
- NCMH Mental Health Crisis Hotline: 1553 (Landline) or 0917-899-8727 (Mobile)
- Hopeline Philippines: 0917-558-4673 or (02) 8804-4673 (or 2919 toll-free)
- Philippine Red Cross: 143
4. PURE DIRECT ANSWER: Output only the pure, direct answer or status (1-2 sentences maximum). Never use filler phrases or bracketed citations.
5. FULL SYSTEM CONTROL: When the user wants to add expenses/incomes, set budgets, create categories, remove transactions, cancel subscriptions, or modify settings, ALWAYS invoke the corresponding function tool immediately.
6. Ledger Status (${health.month}):
- Total Income: ₱${health.income}
- Total Expenses: ₱${health.expenses}
- Net: ₱${health.net} (${health.savingsRate}% savings rate)
- Burn Rate: ₱${health.burnRatePerDay}/day
- Top Spend: ${health.topCategories.map((c) => `${c.name} (₱${c.amount})`).join(', ') || 'None'}`,
        },
      ],
    };

    // Format chat contents
    const contents: any[] = [];
    const recentHistory = chatHistory.slice(-6);
    for (const msg of recentHistory) {
      if (msg.sender === 'user') {
        contents.push({ role: 'user', parts: [{ text: msg.text }] });
      } else if (msg.sender === 'assistant') {
        contents.push({ role: 'model', parts: [{ text: msg.text }] });
      }
    }
    contents.push({ role: 'user', parts: [{ text: query }] });

    let activeModelUsed = modelName;
    let candidate: any = null;

    for (const currentModel of modelsToTry) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(currentModel)}:generateContent`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': effectiveApiKey.trim(),
          },
          body: JSON.stringify({
            contents,
            system_instruction: systemInstruction,
            tools: COPILOT_TOOLS,
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 1000,
            },
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (response.ok) {
          const data = await response.json();
          candidate = data.candidates?.[0]?.content;
          if (candidate) {
            activeModelUsed = currentModel;
            break;
          }
        } else {
          console.warn(`Model ${currentModel} returned HTTP ${response.status}, trying fallback...`);
        }
      } catch (e) {
        console.warn(`Model ${currentModel} attempt error:`, e);
      }
    }

    if (!candidate) {
      return processLocalQuery(query);
    }

    // Check for Function Call Tool Use
    const toolCall = candidate.parts?.find((p: any) => p.functionCall);
    if (toolCall) {
      const { name, args } = toolCall.functionCall;
      return handleGeminiToolCall(name, args);
    }

    // Normal Text Response — Clean any bracketed citations
    const rawText = candidate.parts?.map((p: any) => p.text).filter(Boolean).join('\n') || '';
    const cleanText = rawText
      .replace(/\[(?:Citation|Ref)[^\]]*\]/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    return {
      engine: 'gemini',
      text: cleanText,
    };
  } catch (error) {
    console.warn('Gemini request failed/timed out, switching to local offline engine:', error);
    return processLocalQuery(query);
  }
}

/**
 * Maps Gemini function calls into Copilot Action Proposals
 */
function handleGeminiToolCall(name: string, args: any): CopilotResponse {
  if (name === 'log_transactions') {
    const items = args.items || [];
    const total = items.reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);
    const breakdown = items
      .map(
        (t: any) =>
          `• ${(t.type || 'expense').toUpperCase()}: ₱${Number(t.amount || 0).toLocaleString()} ${t.note ? `("${t.note}")` : ''} [${t.category_name || 'General'}] via ${t.payment_method_name || 'Cash'}`
      )
      .join('\n');

    return {
      engine: 'gemini',
      text: `Prepared ${items.length} transaction(s):\n${breakdown}`,
      action: {
        id: generateId(),
        type: 'log_transactions',
        title: `Log ${items.length} Transaction${items.length > 1 ? 's' : ''}`,
        description: `Total amount: ₱${total.toLocaleString()}`,
        payload: { items },
      },
    };
  }

  if (name === 'create_category') {
    return {
      engine: 'gemini',
      text: `Prepared category: **${args.name}** (${args.type || 'expense'}).`,
      action: {
        id: generateId(),
        type: 'create_category',
        title: `Create Category: ${args.name}`,
        description: `Type: ${(args.type || 'expense').toUpperCase()}`,
        payload: args,
      },
    };
  }

  if (name === 'set_budget') {
    return {
      engine: 'gemini',
      text: `Prepared ${args.category_name} budget cap: ₱${Number(args.amount).toLocaleString()}/month.`,
      action: {
        id: generateId(),
        type: 'set_budget',
        title: `Set Budget: ${args.category_name}`,
        description: `Monthly cap: ₱${Number(args.amount).toLocaleString()}`,
        payload: args,
      },
    };
  }

  if (name === 'add_subscription') {
    return {
      engine: 'gemini',
      text: `Prepared subscription: **${args.name}** — ₱${Number(args.amount).toLocaleString()}/mo (due ${args.billing_day}th).`,
      action: {
        id: generateId(),
        type: 'add_subscription',
        title: `Add Subscription: ${args.name}`,
        description: `₱${Number(args.amount).toLocaleString()} / month (Day ${args.billing_day})`,
        payload: args,
      },
    };
  }

  if (name === 'delete_transaction') {
    return {
      engine: 'gemini',
      text: `Deleting transaction${args.category_name ? ` (${args.category_name})` : ''}${args.amount ? ` of ₱${args.amount}` : ''}...`,
      action: {
        id: generateId(),
        type: 'delete_transaction',
        title: `Delete Transaction`,
        description: `Remove matching expense from SQLite ledger`,
        payload: args,
      },
    };
  }

  if (name === 'delete_subscription') {
    return {
      engine: 'gemini',
      text: `Canceling subscription **${args.name}**...`,
      action: {
        id: generateId(),
        type: 'delete_subscription',
        title: `Cancel Subscription: ${args.name}`,
        description: `Remove recurring bill from SQLite`,
        payload: args,
      },
    };
  }

  if (name === 'delete_budget') {
    return {
      engine: 'gemini',
      text: `Removing budget for **${args.category_name}**...`,
      action: {
        id: generateId(),
        type: 'delete_budget',
        title: `Delete Budget: ${args.category_name}`,
        description: `Reset category budget allowance`,
        payload: args,
      },
    };
  }

  if (name === 'update_settings') {
    return {
      engine: 'gemini',
      text: `Updating settings: ${args.currency ? `Currency: ${args.currency}` : ''} ${args.theme ? `Theme: ${args.theme}` : ''}`.trim(),
      action: {
        id: generateId(),
        type: 'update_settings',
        title: `Update App Settings`,
        description: `Preferences updated`,
        payload: args,
      },
    };
  }

  if (name === 'clear_all_transactions') {
    return {
      engine: 'gemini',
      text: 'Clearing all transactions and purging ledger data...',
      action: {
        id: generateId(),
        type: 'truncate_expenses',
        title: 'Clear All Transactions',
        description: 'Remove all transaction history',
        payload: {},
      },
    };
  }

  return {
    engine: 'gemini',
    text: `Action ${name} executed.`,
  };
}
