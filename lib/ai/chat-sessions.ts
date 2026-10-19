// ============================================================
// MoneyGuide — Per-User SQLite Chat Session Persistence
// ============================================================
import { getDatabase } from '../../db/client';
import { generateId } from '../utils';
import type { ChatMessage } from './gemini-client';

export interface ChatSessionMeta {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

/**
 * Get or create an active chat session for a user
 */
export function getOrCreateActiveSession(userId: string): string {
  const db = getDatabase();
  const safeUser = userId || 'default_user';

  const existing = db.getFirstSync<{ id: string }>(
    'SELECT id FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1',
    safeUser,
  );

  if (existing) {
    return existing.id;
  }

  const newId = `session-${generateId()}`;
  db.runSync(
    'INSERT INTO chat_sessions (id, user_id, title) VALUES (?, ?, ?)',
    newId,
    safeUser,
    'Financial Chat',
  );
  return newId;
}

/**
 * Create a new empty session for the user
 */
export function createNewSession(userId: string, title = 'New Conversation'): string {
  const db = getDatabase();
  const safeUser = userId || 'default_user';
  const newId = `session-${generateId()}`;

  db.runSync(
    'INSERT INTO chat_sessions (id, user_id, title) VALUES (?, ?, ?)',
    newId,
    safeUser,
    title,
  );
  return newId;
}

/**
 * Load all messages for a session from SQLite
 */
export function loadSessionMessages(sessionId: string): ChatMessage[] {
  const db = getDatabase();
  const rows = db.getAllSync<any>(
    'SELECT id, sender, text, engine, action_json, citations_json, created_at FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC',
    sessionId,
  );

  return rows.map((r) => ({
    id: r.id,
    sender: r.sender,
    text: r.text,
    engine: r.engine || undefined,
    action: r.action_json ? JSON.parse(r.action_json) : undefined,
    citations: r.citations_json ? JSON.parse(r.citations_json) : undefined,
    timestamp: r.created_at,
  }));
}

/**
 * Persist a message into SQLite for the user and session
 */
export function persistMessage(sessionId: string, userId: string, msg: ChatMessage): void {
  const db = getDatabase();
  const safeUser = userId || 'default_user';

  db.runSync(
    `INSERT OR REPLACE INTO chat_messages (id, session_id, user_id, sender, text, engine, action_json, citations_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    msg.id,
    sessionId,
    safeUser,
    msg.sender,
    msg.text,
    msg.engine || null,
    msg.action ? JSON.stringify(msg.action) : null,
    msg.citations ? JSON.stringify(msg.citations) : null,
    msg.timestamp || Date.now(),
  );

  // Update session title dynamically from the first user message
  if (msg.sender === 'user') {
    const title = msg.text.slice(0, 32).trim();
    db.runSync(
      "UPDATE chat_sessions SET title = ?, updated_at = datetime('now') WHERE id = ?",
      title,
      sessionId,
    );
  } else {
    db.runSync(
      "UPDATE chat_sessions SET updated_at = datetime('now') WHERE id = ?",
      sessionId,
    );
  }
}

/**
 * Clear or reset messages in a session
 */
export function clearSession(sessionId: string): void {
  const db = getDatabase();
  db.runSync('DELETE FROM chat_messages WHERE session_id = ?', sessionId);
}
