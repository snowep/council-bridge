// Runtime Lifecycle Manager - Single Active Runtime Enforcement
// Phase 10: Enables runtime switching with shared persistent intelligence

import { DatabaseInstance } from '../database.js';
import { randomUUID } from 'node:crypto';

export type RuntimeType = 'claude' | 'hermes';

export interface RuntimeConnectionState {
  activeRuntime: RuntimeType | null;
  connectionStatus:
    | 'disconnected'
    | 'connecting'
    | 'connected'
    | 'disconnecting'
    | 'switching'
    | 'error';
  sessionId: string | null;
  connectedAt: string | null;
  lastHeartbeatAt: string | null;
  leaseExpiresAt: string | null;
  lastError: string | null;
}

export interface ConnectRuntimeOptions {
  runtime: RuntimeType;
  sessionId?: string;
  clientIp?: string;
  userAgent?: string;
}

export interface DisconnectRuntimeOptions {
  sessionId: string;
}

export interface SwitchRuntimeOptions {
  newRuntime: RuntimeType;
  sessionId?: string;
  clientIp?: string;
  userAgent?: string;
}

export interface HeartbeatOptions {
  sessionId: string;
}

interface RuntimeSessionRow {
  runtime: RuntimeType;
  session_id: string;
  connection_status: string;
  connected_at: string | null;
  last_heartbeat_at: string | null;
  lease_expires_at: string | null;
  client_ip: string | null;
  user_agent: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

const LEASE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

function getCurrentTimestamp(): string {
  return String(Date.now());
}

export function parseUnixMs(value: unknown): number | null {
  // Strict validation: accept only valid Unix millisecond integers
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  const parsed = typeof value === 'number'
    ? value
    : Number(value);

  // Reject non-integers, NaN, Infinity, negative, zero
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export class RuntimeLifecycleManager {
  constructor(private db: DatabaseInstance) {}

  getState(): RuntimeConnectionState {
    const session = this.getActiveSession();
    if (!session) {
      return {
        activeRuntime: null,
        connectionStatus: 'disconnected',
        sessionId: null,
        connectedAt: null,
        lastHeartbeatAt: null,
        leaseExpiresAt: null,
        lastError: null
      };
    }

    return {
      activeRuntime: session.runtime,
      connectionStatus: this.parseConnectionStatus(session.connection_status),
      sessionId: session.session_id,
      connectedAt: session.connected_at,
      lastHeartbeatAt: session.last_heartbeat_at,
      leaseExpiresAt: session.lease_expires_at,
      lastError: session.last_error
    };
  }

  checkOwnership(sessionId: string): boolean {
    // Use atomic query to verify ownership
    const row = this.db.stmt.getRuntimeSessionBySession.get(sessionId) as RuntimeSessionRow | undefined;
    if (!row || row.session_id !== sessionId) {
      return false;
    }
    // Verify the session is connected and owns the active runtime
    const activeSession = this.db.stmt.getActiveRuntimeSession.get() as RuntimeSessionRow | undefined;
    return activeSession?.session_id === sessionId && activeSession?.connection_status === 'connected';
  }

  getSessionOwnership(sessionId: string): { runtime: RuntimeType | null; isOwner: boolean } {
    const row = this.db.stmt.getRuntimeSessionBySession.get(sessionId) as RuntimeSessionRow | undefined;
    if (!row || row.session_id !== sessionId) {
      return { runtime: null, isOwner: false };
    }
    return { runtime: row.runtime, isOwner: true };
  }

  connect(options: ConnectRuntimeOptions): { success: boolean; state?: RuntimeConnectionState; error?: string } {
    const { runtime, sessionId, clientIp, userAgent } = options;

    // Validate runtime
    if (runtime !== 'claude' && runtime !== 'hermes') {
      return { success: false, error: 'Invalid runtime identifier' };
    }

    const newSessionId = sessionId || randomUUID();
    const now = getCurrentTimestamp(); // Unix milliseconds string
    const leaseExpires = String(Number(now) + LEASE_DURATION_MS);

    try {
      this.db.runPreparedStatement('beginTransaction', []);

      // Check for existing active session
      const existing = this.db.stmt.getRuntimeSessionByRuntime.get(runtime) as RuntimeSessionRow | undefined;
      const active = this.db.stmt.getActiveRuntimeSession.get() as RuntimeSessionRow | undefined;

      // If same runtime already active with same session, be idempotent or reconnect
      if (existing && existing.session_id === newSessionId) {
        if (existing.connection_status === 'connected') {
          // Already connected - idempotent success
          this.db.runPreparedStatement('commitTransaction', []);
          const state = this.getState();
          return { success: true, state };
        }
        // Session exists but not connected - reactivate it with fresh timestamps
        this.db.db.prepare(`
          UPDATE runtime_sessions
          SET connection_status = 'connected',
              connected_at = ?,
              last_heartbeat_at = ?,
              lease_expires_at = ?,
              updated_at = datetime('now')
          WHERE session_id = ?
        `).run(now, now, leaseExpires, newSessionId);
        this.db.runPreparedStatement('commitTransaction', []);
        const newState = this.getState();
        return { success: true, state: newState };
      }

      // If another runtime is active, reject
      if (active && active.runtime !== runtime) {
        this.db.runPreparedStatement('rollbackTransaction', []);
        return {
          success: false,
          error: `Runtime already active: ${active.runtime} owns the connection. Disconnect or switch first.`
        };
      }

      // Insert or replace the session
      this.db.stmt.upsertRuntimeSession.run(
        runtime,
        newSessionId,
        'connected',
        now,
        now,
        leaseExpires,
        clientIp || null,
        userAgent || null,
        null,
        now,
        now
      );

      this.db.runPreparedStatement('commitTransaction', []);

      const newState = this.getState();
      return { success: true, state: newState };
    } catch (error) {
      this.db.runPreparedStatement('rollbackTransaction', []);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect runtime'
      };
    }
  }

  disconnect(options: DisconnectRuntimeOptions): { success: boolean; state?: RuntimeConnectionState; error?: string } {
    const { sessionId } = options;

    if (!sessionId) {
      return { success: false, error: 'Session ID required' };
    }

    // Verify ownership
    const session = this.db.stmt.getRuntimeSessionBySession.get(sessionId) as RuntimeSessionRow | undefined;
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    // Check if already disconnected
    if (session.connection_status === 'disconnected') {
      const state = this.getState();
      return { success: true, state };
    }

    try {
      this.db.runPreparedStatement('beginTransaction', []);

      this.db.stmt.updateRuntimeSessionStatus.run(
        'disconnected',
        null,
        session.session_id
      );

      this.db.runPreparedStatement('commitTransaction', []);
      const newState = this.getState();
      return { success: true, state: newState };
    } catch (error) {
      this.db.runPreparedStatement('rollbackTransaction', []);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to disconnect runtime'
      };
    }
  }

  switch(options: SwitchRuntimeOptions): { success: boolean; state?: RuntimeConnectionState; error?: string } {
    const { newRuntime, sessionId, clientIp, userAgent } = options;

    // Validate runtime
    if (newRuntime !== 'claude' && newRuntime !== 'hermes') {
      return { success: false, error: 'Invalid runtime identifier' };
    }

    const newSessionId = sessionId || randomUUID();
    const now = getCurrentTimestamp();
    const leaseExpires = String(Number(now) + LEASE_DURATION_MS);

    try {
      this.db.runPreparedStatement('beginTransaction', []);

      // Get current active session
      const currentActive = this.db.stmt.getActiveRuntimeSession.get() as RuntimeSessionRow | undefined;

      // Check if already active with same session
      if (currentActive && currentActive.runtime === newRuntime && currentActive.session_id === newSessionId) {
        this.db.runPreparedStatement('commitTransaction', []);
        const state = this.getState();
        return { success: true, state };
      }

      // If another runtime is active, disconnect it first
      if (currentActive && currentActive.runtime !== newRuntime) {
        // Verify session ownership if provided
        if (sessionId && currentActive.session_id !== sessionId) {
          this.db.runPreparedStatement('rollbackTransaction', []);
          return {
            success: false,
            error: 'Session ownership mismatch: you cannot switch away from another session'
          };
        }

        // Mark current session as switching then disconnected
        this.db.stmt.updateRuntimeSessionStatus.run(
          'disconnecting',
          null,
          currentActive.session_id
        );
      }

      // Insert new session
      this.db.stmt.upsertRuntimeSession.run(
        newRuntime,
        newSessionId,
        'connected',
        now,
        now,
        leaseExpires,
        clientIp || null,
        userAgent || null,
        null,
        now,
        now
      );

      this.db.runPreparedStatement('commitTransaction', []);

      const newState = this.getState();
      return { success: true, state: newState };
    } catch (error) {
      this.db.runPreparedStatement('rollbackTransaction', []);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to switch runtime'
      };
    }
  }

  heartbeat(options: HeartbeatOptions): { success: boolean; state?: RuntimeConnectionState; error?: string } {
    const { sessionId } = options;

    if (!sessionId) {
      return { success: false, error: 'Session ID required' };
    }

    // Check if session exists at all (for unknown session rejection)
    const session = this.db.stmt.getRuntimeSessionBySession.get(sessionId) as RuntimeSessionRow | undefined;
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    const now = Date.now();
    const newLeaseExpires = String(now + LEASE_DURATION_MS);

    try {
      // Atomic update: only succeeds if session is connected and not expired
      const result = this.db.runPreparedStatement('updateRuntimeSessionHeartbeat', [
        String(now),
        newLeaseExpires,
        sessionId
      ]);

      // Check if any row was actually updated (affected rows check)
      if (!result || result.changes === 0) {
        // No row updated means: not connected, or expired, or session doesn't own it
        return { success: false, error: 'Session not eligible for renewal (not connected or expired)' };
      }

      const newState = this.getState();
      return { success: true, state: newState };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update heartbeat'
      };
    }
  }

  recoverStaleSessions(): { recovered: number; errors: string[] } {
    const now = Date.now();
    let recovered = 0;
    const errors: string[] = [];

    try {
      // Begin transaction for atomic recovery
      this.db.runPreparedStatement('beginTransaction', []);

      // Atomic update: only disconnect if still expired (race-safe)
      // This prevents recovering a session that was just renewed by heartbeat
      const stmt = this.db.db.prepare(`
        UPDATE runtime_sessions
        SET connection_status = 'disconnected', last_error = ?, updated_at = datetime('now')
        WHERE connection_status = 'connected'
        AND lease_expires_at IS NOT NULL
        AND CAST(lease_expires_at AS INTEGER) <= ?
      `);

      const result = stmt.run(`Session recovered due to stale lease (${now})`, String(now));
      // better-sqlite3 returns changes on the statement object after run()
      const changedRows = (result as any).changes;
      recovered = changedRows || 0;

      this.db.runPreparedStatement('commitTransaction', []);
    } catch (error) {
      this.db.runPreparedStatement('rollbackTransaction', []);
      errors.push(error instanceof Error ? error.message : 'Recovery failed');
    }

    return { recovered, errors };
  }

  private getActiveSession(): RuntimeSessionRow | undefined {
    // First check if there's an active session
    let session = this.db.stmt.getActiveRuntimeSession.get() as RuntimeSessionRow | undefined;

    // If no active session found, try connected sessions fallback
    if (!session) {
      session = this.db.stmt.getConnectedRuntimeSession.get() as RuntimeSessionRow | undefined;
    }

    return session;
  }

  private parseConnectionStatus(status: string): RuntimeConnectionState['connectionStatus'] {
    const validStatuses: RuntimeConnectionState['connectionStatus'][] = [
      'disconnected', 'connecting', 'connected', 'disconnecting', 'switching', 'error'
    ];
    return validStatuses.includes(status as RuntimeConnectionState['connectionStatus'])
      ? (status as RuntimeConnectionState['connectionStatus'])
      : 'disconnected';
  }
}

// Singleton instance
let _instance: RuntimeLifecycleManager | null = null;

export function getRuntimeLifecycleManager(db: DatabaseInstance): RuntimeLifecycleManager {
  if (!_instance) {
    _instance = new RuntimeLifecycleManager(db);
  }
  return _instance;
}

export function resetRuntimeLifecycleManager(): void {
  _instance = null;
}