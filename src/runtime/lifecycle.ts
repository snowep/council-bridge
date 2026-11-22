// Runtime Lifecycle Manager - Single Active Runtime Enforcement
// Phase 10: Enables runtime switching with shared persistent intelligence

import { DatabaseInstance } from '../database.js';
import { randomUUID } from 'node:crypto';
import { RuntimeSessionRow, IdleHeartbeatController } from './runtime-types.js';

// Local alias for consistency with runtime_types exports
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

      // If another runtime is active, reject - user must disconnect or switch explicitly
      // This is the correct behavior for connect() - it should not silently switch runtimes
      if (active && active.runtime !== runtime) {
        this.db.runPreparedStatement('rollbackTransaction', []);
        return {
          success: false,
          error: `Runtime already active: ${active.runtime} owns the connection. Disconnect or switch first.`
        };
      }

      // If same runtime has a session with different session_id, disconnect old session first
      // This handles the case where a previous session needs to be replaced
      if (existing && existing.session_id !== newSessionId) {
        this.db.stmt.updateRuntimeSessionStatus.run('disconnected', null, existing.session_id);
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
        1,  // generation - initial value for new sessions
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

      // Check if already active with same session (same runtime, same session_id = idempotent)
      if (currentActive && currentActive.runtime === newRuntime && currentActive.session_id === newSessionId) {
        this.db.runPreparedStatement('commitTransaction', []);
        const state = this.getState();
        return { success: true, state };
      }

      // If another runtime is active, handle switch
      if (currentActive && currentActive.runtime !== newRuntime) {
        // Verify session ownership if provided - only allow switch with ownership
        if (sessionId && currentActive.session_id !== sessionId) {
          this.db.runPreparedStatement('rollbackTransaction', []);
          return {
            success: false,
            error: 'Session ownership mismatch: you cannot switch away from another session'
          };
        }

        // Disconnect the old session instead of deleting it
        // This preserves historical session data for audit and recovery
        const nowStr = getCurrentTimestamp();
        this.db.db.prepare(`
          UPDATE runtime_sessions
          SET connection_status = 'disconnected',
              last_error = 'Session replaced by runtime switch',
              updated_at = ?
          WHERE runtime = ? AND session_id = ?
        `).run(nowStr, currentActive.runtime, currentActive.session_id);

        // Increment generation for the old session to invalidate any pending operations
        this.db.db.prepare(`
          UPDATE execution_records
          SET generation = generation + 1,
              completed = 1
          WHERE session_id = ? AND completed = 0
        `).run(currentActive.session_id);
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
        1,  // generation - initial value for new sessions
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


/**
 * Idle heartbeat controller - manages automatic heartbeat during idle periods
 * Runs every 30 seconds to keep the session alive without active execution
 */
const IDLE_HEARTBEAT_INTERVAL_MS = 30 * 1000; // 30 seconds

/**
 * Creates an idle heartbeat controller for a session
 * Automatically sends heartbeat every 30 seconds while the session is connected
 * Stops when the session disconnects or controller.stop() is called
 * @param db - Database instance
 * @param sessionId - The session ID to monitor and heartbeat
 * @returns An IdleHeartbeatController with start/stop/isRunning methods
 */
export function createIdleHeartbeat(db: DatabaseInstance, sessionId: string): IdleHeartbeatController {
  const lifecycle = getRuntimeLifecycleManager(db);
  let intervalId: NodeJS.Timeout | null = null;
  let running = false;

  function start() {
    if (running) return;

    running = true;
    intervalId = setInterval(() => {
      // Check if session is still connected before sending heartbeat
      const state = lifecycle.getState();
      if (state.sessionId === sessionId && state.connectionStatus === 'connected') {
        lifecycle.heartbeat({ sessionId });
      } else {
        // Session disconnected or changed - stop the interval
        stop();
      }
    }, IDLE_HEARTBEAT_INTERVAL_MS);
  }

  function stop() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    running = false;
  }

  function isRunning() {
    return running;
  }

  // Start immediately
  start();

  return { start, stop, isRunning };
}

// Registry for singleton instances per database path
// This ensures each test database gets its own lifecycle manager
const _instances = new Map<string, RuntimeLifecycleManager>();

export function getRuntimeLifecycleManager(db: DatabaseInstance): RuntimeLifecycleManager {
  const dbPath = getDbPath(db);
  let instance = _instances.get(dbPath);
  if (!instance) {
    instance = new RuntimeLifecycleManager(db);
    _instances.set(dbPath, instance);
  }
  return instance;
}

// Helper to get database path for singleton key
function getDbPath(db: DatabaseInstance): string {
  return (db as any).db?.pathname || 'default';
}

// Reset all instances - for testing only
export function resetRuntimeLifecycleManager(): void {
  _instances.clear();
}

// Reset specific instance - useful for targeted test cleanup
export function resetRuntimeLifecycleManagerForDb(db: DatabaseInstance): void {
  const dbPath = getDbPath(db);
  _instances.delete(dbPath);
}