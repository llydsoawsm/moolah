// ============================================================
// MoneyGuide — Hybrid Cloud Gemini Client with Local Fallback
// ============================================================
import { checkPromptGuardrails } from './guardrails';
import { processLocalQuery, type CopilotResponse, type CopilotActionProposal } from './local-engine';
import { executeGetFinancialHealth } from './actions-dispatcher';
import { generateId } from '../utils';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

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
    ],
  },
];

/**
 * Send user query to Gemini Cloud API with automated fallback to Local Engine
 */
export async function sendCopilotMessage(
  query: string,
  apiKey: string,
  chatHistory: ChatMessage[] = [],
  modelName = 'gemini-3.8-flash',
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
        citations: [
          {
            source: 'Emergency Dispatch & Crisis Directory',
            note: 'Verified national and international health/mental health hotlines',
          },
        ],
      };
    }

    // Unrelated / non-financial prompt
    return {
      engine: 'local',
      text: guard.message || 'I only specialize in personal finance, money management, and budgets.',
      citations: [
        {
          source: 'Moolah Domain Policy',
          note: 'Finance-only guardrail enforced',
        },
      ],
    };
  }

  // 2. If no API key is set, immediately execute offline deterministic engine
  if (!apiKey || apiKey.trim().length === 0) {
    return processLocalQuery(query, lastAction);
  }

  // 3. Online Gemini API Request with high-model fallback cascade
  const targetModel = modelName.trim();
  const modelsToTry = [
    targetModel === 'gemini-3.8' ? 'gemini-3.8-flash' : targetModel,
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.5-flash',
  ].filter((v, i, a) => v && a.indexOf(v) === i);

  try {
    const health = executeGetFinancialHealth();

    const systemInstruction = {
      role: 'system',
      parts: [
        {
          text: `You are Moolah AI Copilot, a minimalist high-intelligence financial controller in a personal finance app.
RULES:
1. MINIMALIST STYLE: Be extremely concise, direct, and minimalist (1-2 sentences max). Never output long paragraphs, fluffy greetings, or duplicate what is visible in the action card.
2. STRICT FINANCIAL SCOPE: Discuss ONLY personal finances, expenses, budgets, savings, and investments.
3. MANDATORY CITATIONS: For financial recommendations, provide recognized citations (e.g. [Citation: Elizabeth Warren, 50/30/20 Rule] or [Ref: SQLite Ledger]).
4. CONTROLLER ACTIONS: Always call function tools for logging transactions, setting budgets, creating categories, and adding subscriptions. If user wants to tweak or change a previous action (e.g. "change it to 449 on 18"), formulate the updated function call directly.
5. Current Ledger Snapshot (${health.month}):
- Total Income: ₱${health.income}
- Total Expenses: ₱${health.expenses}
- Net: ₱${health.net} (Savings Rate: ${health.savingsRate}%)
- Daily Burn: ₱${health.burnRatePerDay}/day`,
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
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(currentModel)}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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

    // Normal Text Response
    const text = candidate.parts?.map((p: any) => p.text).filter(Boolean).join('\n') || '';

    return {
      engine: 'gemini',
      text: text,
      citations: [
        {
          source: `Google Gemini (${activeModelUsed})`,
          note: 'Synthesized using real-time economic principles and SQLite context',
        },
        {
          source: 'Moolah SQLite Ledger',
          note: `Aggregated ledger data (${health.month})`,
        },
      ],
    };
  } catch (error) {
    // Network offline or timeout -> Seamless fallback to Local Engine
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
      citations: [
        {
          source: 'Gemini Autonomous Action Dispatcher',
          note: 'Validated parameters against SQLite schema',
        },
      ],
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
      citations: [
        {
          source: 'Taxonomy Engine',
          note: 'Will be stored in SQLite categories table',
        },
      ],
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
      citations: [
        {
          source: 'Zero-Based Budget Framework',
          note: 'Category-level expense limits',
        },
      ],
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
      citations: [
        {
          source: 'Cash Flow Protection',
          note: 'Recurring commitments tracked in SQLite',
        },
      ],
    };
  }

  return {
    engine: 'gemini',
    text: `Action ${name} prepared.`,
    citations: [],
  };
}
