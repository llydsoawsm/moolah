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
  last_message?: string;
}

/**
 * Get or create an active chat session for a user
 */
export function getOrCreateActiveSession(userId: string): string {
  const safeUser = userId || 'default_user';
  try {
    const db = getDatabase();
    const existing = db.getFirstSync<{ id: string }>(
      'SELECT id FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1',
      safeUser,
    );

    if (existing && existing.id) {
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
  } catch (e) {
    console.warn('Failed getOrCreateActiveSession, fallback:', e);
    return `session-${Date.now()}`;
  }
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
 * Get all past chat sessions for a user, sorted by most recent
 */
export function getUserSessions(userId: string): ChatSessionMeta[] {
  const db = getDatabase();
  const safeUser = userId || 'default_user';

  const rows = db.getAllSync<any>(
    `SELECT s.id, s.user_id, s.title, s.created_at, s.updated_at,
            (SELECT COUNT(*) FROM chat_messages m WHERE m.session_id = s.id) as message_count,
            (SELECT text FROM chat_messages m WHERE m.session_id = s.id ORDER BY m.created_at DESC LIMIT 1) as last_message
     FROM chat_sessions s
     WHERE s.user_id = ?
     ORDER BY s.updated_at DESC`,
    safeUser,
  );

  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    title: r.title || 'Financial Chat',
    created_at: r.created_at,
    updated_at: r.updated_at,
    message_count: Number(r.message_count || 0),
    last_message: r.last_message || '',
  }));
}

/**
 * Delete a chat session and its associated messages
 */
export function deleteSession(sessionId: string): void {
  const db = getDatabase();
  db.runSync('DELETE FROM chat_messages WHERE session_id = ?', sessionId);
  db.runSync('DELETE FROM chat_sessions WHERE id = ?', sessionId);
}

/**
 * Load all messages for a session from SQLite
 */
export function loadSessionMessages(sessionId: string): ChatMessage[] {
  try {
    const db = getDatabase();
    const rows = db.getAllSync<any>(
      'SELECT id, sender, text, engine, action_json, citations_json, created_at FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC',
      sessionId,
    );

    return (rows || []).map((r) => ({
      id: r.id,
      sender: r.sender,
      text: r.text,
      engine: r.engine || undefined,
      action: r.action_json ? (typeof r.action_json === 'string' ? JSON.parse(r.action_json) : r.action_json) : undefined,
      citations: r.citations_json ? (typeof r.citations_json === 'string' ? JSON.parse(r.citations_json) : r.citations_json) : undefined,
      timestamp: Number(r.created_at || Date.now()),
    }));
  } catch (e) {
    console.warn('Failed loadSessionMessages:', e);
    return [];
  }
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

