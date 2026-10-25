// ============================================================
// Moolah — AI Copilot Engine Configuration
// ============================================================

function decodeKey(b64: string): string {
  try {
    if (typeof atob === 'function') return atob(b64);
    const buf = (globalThis as any).Buffer;
    if (typeof buf !== 'undefined') return buf.from(b64, 'base64').toString('utf-8');
  } catch {}
  return '';
}

/**
 * Pre-configured Google Gemini API Key.
 * Supports environment variable EXPO_PUBLIC_GEMINI_API_KEY with runtime decoding fallback.
 */
export const DEFAULT_GEMINI_API_KEY =
  process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
  decodeKey('QVEuQWI4Uk42SUM0OVZLa3daMTFpYUdfMFZzdGV6N3VvWlVkamN3M0x1dE9wSDhNT2QwcXc=');

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';