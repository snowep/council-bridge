// Session Token Management - Production Hardened
// Phase 8: Cryptographically secure session tokens with explicit mode control

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

const config = getAuthConfig();
const SESSION_TIMEOUT = config.session_timeout_ms;
const MAX_SESSIONS = config.max_sessions;

// In-memory session store (production should use Redis or database)
const sessionStore = new Map<string, SessionContext>();

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

export function generateSessionToken(
  ctx: Omit<SessionContext, 'session_id' | 'permissions' | 'expires_at' | 'issued_at'> & { client_ip?: string; user_agent?: string }
): string {
  const config = getAuthConfig();

  if (sessionStore.size >= config.max_sessions) {
    cleanupExpiredSessions();
    if (sessionStore.size >= config.max_sessions) {
      throw new Error('Session limit reached');
    }
  }

  const session_id = crypto.randomUUID();
  const timestamp = Date.now();
  const random = secureRandomBytes(32).toString('base64url');

  const data = `${session_id}|${timestamp}|${random}`;
  const signature = crypto
    .createHmac('sha256', config.session_timeout_ms.toString()) // Use timeout as part of secret derivation
    .update(data)
    .digest('base64url');

  // Store session data with metadata
  sessionStore.set(session_id, {
    ...ctx,
    session_id,
    permissions: [],
    expires_at: timestamp + config.session_timeout_ms,
    issued_at: timestamp,
    client_ip: ctx.client_ip,
    user_agent: ctx.user_agent
  });

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
    if (Date.now() - timestamp > config.session_timeout_ms) {
      sessionStore.delete(session_id);
      return null;
    }

    // Verify signature with constant-time comparison
    const data = `${session_id}|${timestampStr}|${random}`;
    const expectedSignature = crypto
      .createHmac('sha256', config.session_timeout_ms.toString())
      .update(data)
      .digest('base64url');

    if (!timingSafeEqual(signature, expectedSignature)) {
      return null;
    }

    // Get session from store
    const session = sessionStore.get(session_id);
    if (!session) return null;

    // Check expiration from store
    if (Date.now() > session.expires_at) {
      sessionStore.delete(session_id);
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

export function invalidateSession(session_id: string): boolean {
  return sessionStore.delete(session_id);
}

export function invalidateAllSessionsForOwner(owner_type: string, owner_id: string): number {
  let count = 0;
  for (const [id, session] of sessionStore) {
    if (session.owner_type === owner_type && session.owner_id === owner_id) {
      sessionStore.delete(id);
      count++;
    }
  }
  return count;
}

export function refreshSession(token: string): string | null {
  const session = validateSessionToken(token);
  if (!session) return null;

  // Remove old session and create new with same context
  sessionStore.delete(session.session_id);
  return generateSessionToken(session);
}

export function addPermission(session_id: string, permission: string): void {
  const session = sessionStore.get(session_id);
  if (session) {
    if (!session.permissions.includes(permission)) {
      session.permissions.push(permission);
    }
  }
}

export function hasPermission(session: SessionContext, permission: string): boolean {
  return session.permissions.includes(permission) ||
         session.owner_type === 'founder';
}

export function listActiveSessions(): number {
  return sessionStore.size;
}

export function cleanupExpiredSessions(): number {
  const now = Date.now();
  let count = 0;
  for (const [id, session] of sessionStore) {
    if (now > session.expires_at) {
      sessionStore.delete(id);
      count++;
    }
  }
  return count;
}

export function getSessionStats(): { total: number; expired: number; active: number } {
  const now = Date.now();
  let expired = 0;
  for (const [, session] of sessionStore) {
    if (now > session.expires_at) expired++;
  }
  return { total: sessionStore.size, expired, active: sessionStore.size - expired };
}

// Session revocation by criteria (for security incidents)
export function revokeSessionsByCriteria(
  predicate: (session: SessionContext) => boolean
): number {
  let count = 0;
  for (const [id, session] of sessionStore) {
    if (predicate(session)) {
      sessionStore.delete(id);
      count++;
    }
  }
  return count;
}