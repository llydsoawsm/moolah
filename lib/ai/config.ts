// ============================================================
// Moolah — AI Copilot Engine Configuration
// ============================================================

/**
 * Pre-configured Google Gemini API Key.
 * Default is left empty as requested by user.
 * Supports environment variable EXPO_PUBLIC_GEMINI_API_KEY if configured.
 */
export const DEFAULT_GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';