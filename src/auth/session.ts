// Session Token Management - Production Hardened
// Phase 8: Cryptographically secure session tokens with explicit mode control
// Phase 9: Automatic periodic cleanup to prevent memory leaks in long-running production
// P2-10: Database-backed session storage for multi-instance support

import crypto from 'crypto';
import { getAuthConfig } from './config.js';

export type RuntimeType = 'claude' | 'hermes';

export interface SessionContext {
  owner_type: 'founder' | 'staff' | 'division' | 'seat';
  owner_id: string;
  runtime: RuntimeType;
  session_id: string;
  permissions: string[];
  expires_at: number;
  issued_at: number;
  client_ip?: string;
  user_agent?: string;
}

export interface SessionTokenPayload {
  session_id: string;
  timestamp: number;
  random: string;
  signature: string;
}

import type { DatabaseInstance } from '../database.js';

// Session store - can be in-memory or database-backed depending on environment
let sessionStore: Map<string, SessionContext>;
let dbSessionStore: DatabaseInstance | null = null;

// Initialize session store with appropriate backend
function initSessionStore() {
  sessionStore = new Map();
}

// Initialize on module load
initSessionStore();

// Periodic cleanup interval - prevents memory leaks in long-running production
let cleanupInterval: NodeJS.Timeout | null = null;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Start periodic cleanup of expired sessions
export function startSessionCleanupInterval(): NodeJS.Timeout {
  if (cleanupInterval) {
    return cleanupInterval;
  }
  cleanupInterval = setInterval(() => {
    cleanupExpiredSessions();
  }, CLEANUP_INTERVAL_MS);
  cleanupInterval.unref?.();
  return cleanupInterval;
}

// Stop the cleanup interval
export function stopSessionCleanupInterval(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

// Set database instance for production session persistence
// When set, sessions are stored in database for multi-instance support
export function setDbSessionStore(db: DatabaseInstance | null): void {
  dbSessionStore = db;
  if (db !== null) {
    initSessionStore();
  }
}

// Check if running in production mode - fail-closed if sessions required but not supported
export function validateSessionSupport(): { valid: boolean; error?: string } {
  const config = getAuthConfig();
  if (config.mode === 'production' && !config.allow_hardcoded_fallback) {
    // Production requires database-backed session storage for multi-instance support
    if (!dbSessionStore) {
      return {
        valid: false,
        error: 'Production mode requires database-backed session storage (setDbSessionStore must be called)'
      };
    }
  }
  return { valid: true };
}

// Generate cryptographically secure random bytes
function secureRandomBytes(length: number): Buffer {
  return crypto.randomBytes(length);
}

// Constant-time comparison for token parts
function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Get session timeout from config
function getSessionTimeout(): number {
  return getAuthConfig().session_timeout_ms;
}

// Get max sessions from config
function getMaxSessions(): number {
  return getAuthConfig().max_sessions;
}

// Get session secret from config
function getSessionSecret(): string {
  return getAuthConfig().session_secret;
}

// Helper: Save session to database (when dbSessionStore is available)
// Returns true on success, throws on failure
function saveSessionToDb(session: SessionContext): boolean {
  if (!dbSessionStore) return false;

  dbSessionStore.db.prepare(`
    INSERT OR REPLACE INTO api_sessions (
      session_id, owner_type, owner_id, runtime, client_ip, user_agent,
      expires_at, issued_at, last_used_at, permissions
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    session.session_id,
    session.owner_type,
    session.owner_id,
    session.runtime,
    session.client_ip ?? null,
    session.user_agent ?? null,
    session.expires_at,
    session.issued_at,
    Date.now(),
    JSON.stringify(session.permissions)
  );
  return true;
}

// Helper: Get session from database
function getSessionFromDb(sessionId: string): SessionContext | null {
  if (!dbSessionStore) return null;

  try {
    const row = dbSessionStore.db.prepare(`
      SELECT session_id, owner_type, owner_id, runtime, client_ip, user_agent,
             expires_at, issued_at, permissions
      FROM api_sessions WHERE session_id = ? AND invalidated = 0
    `).get(sessionId) as {
      session_id: string;
      owner_type: 'founder' | 'staff' | 'division' | 'seat';
      owner_id: string;
      runtime: 'claude' | 'hermes';
      client_ip: string | null;
      user_agent: string | null;
      expires_at: number;
      issued_at: number;
      permissions: string;
    } | undefined;

    if (!row) return null;

    const now = Date.now();
    if (now > row.expires_at) return null;

    return {
      session_id: row.session_id,
      owner_type: row.owner_type,
      owner_id: row.owner_id,
      runtime: row.runtime,
      permissions: JSON.parse(row.permissions || '[]'),
      expires_at: row.expires_at,
      issued_at: row.issued_at,
      client_ip: row.client_ip || undefined,
      user_agent: row.user_agent || undefined
    };
  } catch {
    return null;
  }
}

// Helper: Invalidate session in database
function invalidateSessionInDb(sessionId: string): boolean {
  if (!dbSessionStore) return false;

  try {
    const result = dbSessionStore.db.prepare(`
      UPDATE api_sessions SET invalidated = 1 WHERE session_id = ?
    `).run(sessionId);
    return (result as any).changes > 0;
  } catch {
    return false;
  }
}

export function generateSessionToken(
  ctx: Omit<SessionContext, 'session_id' | 'permissions' | 'expires_at' | 'issued_at'> & { client_ip?: string; user_agent?: string; runtime?: RuntimeType }
): string {
  const config = getAuthConfig();

  // Default runtime to 'claude' if not specified
  const runtime: RuntimeType = ctx.runtime ?? 'claude';

  // Check database store limit first, then memory store
  let totalCount = 0;
  if (dbSessionStore) {
    const dbCount = dbSessionStore.db.prepare(`
      SELECT COUNT(*) as count FROM api_sessions WHERE invalidated = 0 AND expires_at > ?
    `).get(Date.now()) as { count: number };
    totalCount = dbCount.count;
  }
  totalCount += sessionStore.size;

  if (totalCount >= getMaxSessions()) {
    cleanupExpiredSessions();
    totalCount = sessionStore.size;
    if (dbSessionStore) {
      const dbCount = dbSessionStore.db.prepare(`
        SELECT COUNT(*) as count FROM api_sessions WHERE invalidated = 0 AND expires_at > ?
      `).get(Date.now()) as { count: number };
      totalCount += dbCount.count;
    }
    if (totalCount >= getMaxSessions()) {
      throw new Error('Session limit reached');
    }
  }

  const session_id = crypto.randomUUID();
  const timestamp = Date.now();
  const random = secureRandomBytes(32).toString('base64url');

  const data = `${session_id}|${timestamp}|${random}`;
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(data)
    .digest('base64url');

  const session: SessionContext = {
    ...ctx,
    session_id,
    runtime,
    permissions: [],
    expires_at: timestamp + config.session_timeout_ms,
    issued_at: timestamp,
    client_ip: ctx.client_ip,
    user_agent: ctx.user_agent
  };

  // In database-backed mode, persist first (fail-closed)
  if (dbSessionStore) {
    try {
      saveSessionToDb(session);
    } catch (error) {
      // Remove from memory if DB persistence fails
      sessionStore.delete(session_id);
      throw new Error('Failed to persist session to database');
    }
  } else {
    // Memory-only mode for local/test use
    sessionStore.set(session_id, session);
  }

  return `${session_id}|${timestamp}|${random}|${signature}`;
}

export function validateSessionToken(
  token: string,
  expectedRuntime?: RuntimeType,
  clientIp?: string
): SessionContext | null {
  try {
    const parts = token.split('|');
    if (parts.length !== 4) return null;

    const [session_id, timestampStr, random, signature] = parts;
    const timestamp = parseInt(timestampStr, 10);

    // Validate timestamp
    if (isNaN(timestamp) || timestamp <= 0) return null;

    // Check token age (replay protection)
    if (Date.now() - timestamp > getSessionTimeout()) {
      sessionStore.delete(session_id);
      invalidateSessionInDb(session_id);
      return null;
    }

    // Verify signature with constant-time comparison
    const data = `${session_id}|${timestampStr}|${random}`;
    const expectedSignature = crypto
      .createHmac('sha256', getSessionSecret())
      .update(data)
      .digest('base64url');

    if (!timingSafeEqual(signature, expectedSignature)) {
      return null;
    }

    // Database mode: Always check database first (authoritative source)
    // Skip memory cache to prevent stale reads from different instances
    let session: SessionContext;
    if (dbSessionStore) {
      const dbSession = getSessionFromDb(session_id);
      if (!dbSession) return null;
      session = dbSession;
    } else {
      // Memory-only mode for tests/local development
      const memSession = sessionStore.get(session_id);
      if (!memSession) return null;
      session = memSession;
    }

    // Check expiration from store
    if (Date.now() > session.expires_at) {
      sessionStore.delete(session_id);
      invalidateSessionInDb(session_id);
      return null;
    }

    // Validate runtime if specified
    if (expectedRuntime && session.runtime !== expectedRuntime) {
      return null;
    }

    // Optional: Bind to client IP (configurable)
    if (clientIp && session.client_ip && session.client_ip !== clientIp) {
      // In production, this could be a warning or rejection based on config
    }

    return session;
  } catch (error) {
    return null;
  }
}

export function invalidateSession(session_id: string): { invalidated: boolean; error?: string } {
  // In database mode, database is authoritative - fail-closed
  if (dbSessionStore) {
    try {
      const dbInvalidated = invalidateSessionInDb(session_id);
      // Also remove from memory cache to prevent stale reads
      sessionStore.delete(session_id);
      return { invalidated: dbInvalidated };
    } catch (error) {
      return { invalidated: false, error: 'Failed to invalidate session in database' };
    }
  }
  // Memory-only mode for tests/local development
  const removed = sessionStore.delete(session_id);
  return { invalidated: removed };
}

export function invalidateAllSessionsForOwner(owner_type: string, owner_id: string): { count: number; error?: string } {
  // In database mode, database is authoritative - fail-closed
  if (dbSessionStore) {
    try {
      let count = 0;

      // First, invalidate from memory cache
      for (const [id, session] of sessionStore) {
        if (session.owner_type === owner_type && session.owner_id === owner_id) {
          sessionStore.delete(id);
          count++;
        }
      }

      // Then invalidate from database
      const dbResult = dbSessionStore.db.prepare(`
        UPDATE api_sessions SET invalidated = 1 WHERE owner_type = ? AND owner_id = ? AND invalidated = 0
      `).run(owner_type, owner_id);
      count += (dbResult as any).changes;

      return { count };
    } catch (error) {
      return { count: 0, error: 'Failed to invalidate sessions in database' };
    }
  }

  // Memory-only mode for tests/local development
  let count = 0;
  for (const [id, session] of sessionStore) {
    if (session.owner_type === owner_type && session.owner_id === owner_id) {
      sessionStore.delete(id);
      count++;
    }
  }
  return { count };
}

export function refreshSession(token: string): string | null {
  const session = validateSessionToken(token);
  if (!session) return null;

  // Remove old session and create new with same context
  invalidateSession(session.session_id);
  return generateSessionToken(session);
}

export function addPermission(session_id: string, permission: string): { success: boolean; error?: string } {
  // In database mode, get session from database (authoritative source)
  let session: SessionContext | undefined;
  if (dbSessionStore) {
    const dbSession = getSessionFromDb(session_id);
    if (!dbSession) return { success: false, error: 'Session not found' };
    session = dbSession;
  } else {
    session = sessionStore.get(session_id);
    if (!session) return { success: false, error: 'Session not found' };
  }

  if (!session.permissions.includes(permission)) {
    session.permissions.push(permission);
    // Always persist permission update to database in db mode
    if (dbSessionStore) {
      try {
        dbSessionStore.db.prepare(`
          UPDATE api_sessions SET permissions = ? WHERE session_id = ?
        `).run(JSON.stringify(session.permissions), session_id);
      } catch {
        return { success: false, error: 'Failed to persist permission update' };
      }
    } else {
      // Memory-only mode for tests/local development
      sessionStore.set(session_id, session);
    }
  }
  return { success: true };
}

export function hasPermission(session: SessionContext, permission: string): boolean {
  return session.permissions.includes(permission) ||
         session.owner_type === 'founder';
}

export function listActiveSessions(): number {
  // In database-backed mode, database is authoritative
  if (dbSessionStore) {
    const dbCount = dbSessionStore.db.prepare(`
      SELECT COUNT(*) as count FROM api_sessions WHERE invalidated = 0 AND expires_at > ?
    `).get(Date.now()) as { count: number };
    return dbCount.count;
  }
  // Memory-only mode for local/test use
  return sessionStore.size;
}

export function cleanupExpiredSessions(): number {
  const now = Date.now();
  let count = 0;

  // Clean memory store
  for (const [id, session] of sessionStore) {
    if (now > session.expires_at) {
      sessionStore.delete(id);
      count++;
    }
  }

  // Clean database store
  if (dbSessionStore) {
    count += dbSessionStore.db.prepare(`
      UPDATE api_sessions SET invalidated = 1 WHERE expires_at <= ? AND invalidated = 0
    `).run(now).changes;
  }

  return count;
}

export function getSessionStats(): { total: number; expired: number; active: number } {
  const now = Date.now();

  // In database-backed mode, database is authoritative
  if (dbSessionStore) {
    const dbTotal = dbSessionStore.db.prepare(`
      SELECT COUNT(*) as count FROM api_sessions
    `).get() as { count: number };

    const dbExpired = dbSessionStore.db.prepare(`
      SELECT COUNT(*) as count FROM api_sessions WHERE expires_at <= ?
    `).get(now) as { count: number };

    const total = dbTotal.count;
    const expired = dbExpired.count;
    return { total, expired, active: total - expired };
  }

  // Memory-only mode for local/test use
  let expired = 0;
  let total = 0;
  for (const session of sessionStore.values()) {
    total++;
    if (now > session.expires_at) expired++;
  }

  return { total, expired, active: total - expired };
}

// Session revocation by criteria (for security incidents)
export function revokeSessionsByCriteria(
  predicate: (session: SessionContext) => boolean
): number {
  let count = 0;

  // Revoke from memory store
  for (const [id, session] of sessionStore) {
    if (predicate(session)) {
      sessionStore.delete(id);
      count++;
    }
  }

  // Revoke from database store based on criteria
  if (dbSessionStore) {
    // For complex predicates, we need to evaluate each row
    const allSessions = dbSessionStore.db.prepare(`
      SELECT session_id, owner_type, owner_id, runtime FROM api_sessions WHERE invalidated = 0
    `).all() as Array<{ session_id: string; owner_type: 'founder' | 'staff' | 'division' | 'seat'; owner_id: string; runtime: 'claude' | 'hermes' }>;

    for (const row of allSessions) {
      const session: SessionContext = {
        session_id: row.session_id,
        owner_type: row.owner_type,
        owner_id: row.owner_id,
        runtime: row.runtime,
        permissions: [],
        expires_at: Date.now() + 86400000, // Default
        issued_at: Date.now(),
        client_ip: undefined,
        user_agent: undefined
      };

      if (predicate(session)) {
        if (sessionStore.has(row.session_id)) {
          sessionStore.delete(row.session_id);
          count++;
        }
        invalidateSessionInDb(row.session_id);
      }
    }
  }

  return count;
}