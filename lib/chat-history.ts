/**
 * lib/chat-history.ts — Chat session history framework
 *
 * Provides a typed interface and two storage backends:
 *   - BrowserChatHistory: localStorage, zero infra, resets on clear
 *   - ServerChatHistory: persists to a REST endpoint (implement when ready)
 *
 * Usage:
 *   const history = new BrowserChatHistory("ct-session");
 *   history.append({ role: "user", content: "Berapa OEE minggu ini?" });
 *   const ctx = history.getMessages();   // pass to Groq messages array
 *
 * To wire into FloatingChat: replace the local `messages` useState with
 * history.getMessages() + history.append() calls. The AI system prompt can
 * also include history.getSummary() for token-efficient context injection.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  /** ISO timestamp added automatically on append */
  timestamp?: string;
  /** Model that generated this message (assistant only) */
  model?: string;
}

export interface ChatSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  /** Active filter context when the session was started */
  context?: { plant?: string; startDate?: string; endDate?: string };
  messages: ChatMessage[];
}

export interface ChatHistoryStore {
  /** Start a new session (clears previous if single-session mode) */
  newSession(context?: ChatSession["context"]): ChatSession;
  /** Append a message to the active session */
  append(message: Omit<ChatMessage, "timestamp">): void;
  /** Return all messages in the active session (for Groq messages[]) */
  getMessages(): ChatMessage[];
  /** Return a compact text summary of the last N turns (for system prompt injection) */
  getSummary(maxTurns?: number): string;
  /** Load the active session metadata */
  getSession(): ChatSession | null;
  /** Clear active session */
  clear(): void;
  /** List stored session IDs (multi-session backends) */
  listSessions?(): string[];
  /** Load a previous session by ID */
  loadSession?(id: string): ChatSession | null;
}

// ── Browser (localStorage) backend ────────────────────────────────────────────

const MAX_STORED_MESSAGES = 100;

export class BrowserChatHistory implements ChatHistoryStore {
  private readonly storageKey: string;

  constructor(storageKey = "ct-chat-history") {
    this.storageKey = storageKey;
  }

  private read(): ChatSession | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? (JSON.parse(raw) as ChatSession) : null;
    } catch {
      return null;
    }
  }

  private write(session: ChatSession): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(session));
    } catch {
      // Storage quota exceeded — trim oldest messages and retry
      session.messages = session.messages.slice(-50);
      try { localStorage.setItem(this.storageKey, JSON.stringify(session)); } catch { /* ignore */ }
    }
  }

  newSession(context?: ChatSession["context"]): ChatSession {
    const session: ChatSession = {
      id:        crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      context,
      messages:  [],
    };
    this.write(session);
    return session;
  }

  append(message: Omit<ChatMessage, "timestamp">): void {
    const session = this.read() ?? this.newSession();
    session.messages.push({ ...message, timestamp: new Date().toISOString() });
    // Keep storage bounded
    if (session.messages.length > MAX_STORED_MESSAGES) {
      session.messages = session.messages.slice(-MAX_STORED_MESSAGES);
    }
    session.updatedAt = new Date().toISOString();
    this.write(session);
  }

  getMessages(): ChatMessage[] {
    return this.read()?.messages ?? [];
  }

  getSummary(maxTurns = 6): string {
    const msgs = this.getMessages().slice(-maxTurns * 2);
    if (msgs.length === 0) return "";
    return msgs
      .map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.content.slice(0, 200)}`)
      .join("\n");
  }

  getSession(): ChatSession | null {
    return this.read();
  }

  clear(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(this.storageKey);
  }

  listSessions(): string[] {
    // Single-session browser backend — only one active session
    const session = this.read();
    return session ? [session.id] : [];
  }
}

// ── Server (API) backend ───────────────────────────────────────────────────────
// Implement when you need persistence across devices/sessions or multi-user
// history. Wire up a /api/chat/history route backed by a DB (e.g. Postgres or
// Snowflake DATAMART table) and swap BrowserChatHistory for this class.
// Note: async counterpart to ChatHistoryStore — all methods return Promises.

export class ServerChatHistory {
  private readonly endpoint: string;
  private sessionId: string | null = null;
  private cache: ChatSession | null = null;

  constructor(endpoint = "/api/chat/history") {
    this.endpoint = endpoint;
  }

  async newSession(context?: ChatSession["context"]): Promise<ChatSession> {
    const res = await fetch(this.endpoint, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action: "create", context }),
    });
    const session = (await res.json()) as ChatSession;
    this.sessionId = session.id;
    this.cache = session;
    return session;
  }

  async append(message: Omit<ChatMessage, "timestamp">): Promise<void> {
    if (!this.sessionId) await this.newSession();
    await fetch(this.endpoint, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action: "append", sessionId: this.sessionId, message }),
    });
    this.cache = null; // invalidate local cache
  }

  async getMessages(): Promise<ChatMessage[]> {
    return (await this.getSession())?.messages ?? [];
  }

  getSummary(maxTurns = 6): string {
    const msgs = (this.cache?.messages ?? []).slice(-maxTurns * 2);
    return msgs
      .map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.content.slice(0, 200)}`)
      .join("\n");
  }

  async getSession(): Promise<ChatSession | null> {
    if (!this.sessionId) return null;
    if (this.cache) return this.cache;
    const res = await fetch(`${this.endpoint}?id=${this.sessionId}`);
    this.cache = (await res.json()) as ChatSession;
    return this.cache;
  }

  async clear(): Promise<void> {
    if (!this.sessionId) return;
    await fetch(`${this.endpoint}?id=${this.sessionId}`, { method: "DELETE" });
    this.sessionId = null;
    this.cache = null;
  }

  async listSessions(): Promise<string[]> {
    const res = await fetch(this.endpoint);
    const data = (await res.json()) as { sessions: string[] };
    return data.sessions;
  }

  async loadSession(id: string): Promise<ChatSession | null> {
    this.sessionId = id;
    this.cache = null;
    return this.getSession();
  }
}

// ── Default export: singleton browser history ─────────────────────────────────
// Import this anywhere in the client to share one history instance per tab.

export const chatHistory = typeof window !== "undefined"
  ? new BrowserChatHistory("ct-chat-history")
  : null;