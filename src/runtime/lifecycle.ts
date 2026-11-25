// Runtime Lifecycle Manager - Single Active Runtime Enforcement
// Phase 10: Enables runtime switching with shared persistent intelligence
// Phase 1: Problem D - MCP runtime authentication requires validateRuntimeCredential

import { DatabaseInstance } from '../database.js';
import { randomUUID } from 'node:crypto';
import { RuntimeSessionRow, IdleHeartbeatController } from './runtime-types.js';
import { validateRuntimeCredentialById } from '../auth/runtime-credentials.js';

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
  credentialId?: string;  // Workstream A-R1: bind session to credential
}

export interface DisconnectRuntimeOptions {
  sessionId: string;
}

export interface SwitchRuntimeOptions {
  newRuntime: RuntimeType;
  sessionId?: string;
  clientIp?: string;
  userAgent?: string;
  credentialId?: string;  // P2-03: bind target session to credential
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
      return {
        runtime: null,
        isOwner: false,
      };
    }

    const active = this.db.stmt.getActiveRuntimeSession.get() as RuntimeSessionRow | undefined;

    if (
      !active ||
      active.session_id !== sessionId ||
      active.runtime !== row.runtime ||
      active.connection_status !== 'connected'
    ) {
      return {
        runtime: row.runtime,
        isOwner: false,
      };
    }

    return {
      runtime: row.runtime,
      isOwner: true,
    };
  }

  connect(options: ConnectRuntimeOptions): { success: boolean; state?: RuntimeConnectionState; error?: string } {
    const { runtime, sessionId, clientIp, userAgent, credentialId } = options;

    // Validate runtime
    if (runtime !== 'claude' && runtime !== 'hermes') {
      return { success: false, error: 'Invalid runtime identifier' };
    }

    const newSessionId = sessionId || randomUUID();
    const now = getCurrentTimestamp(); // Unix milliseconds string
    const leaseExpires = String(Number(now) + LEASE_DURATION_MS);

    try {
      this.db.runPreparedStatement('beginTransaction', []);

      // Check for existing session by runtime (could be connected or disconnected)
      const existing = this.db.stmt.getRuntimeSessionByRuntime.get(runtime) as RuntimeSessionRow | undefined;
      const active = this.db.stmt.getActiveRuntimeSession.get() as RuntimeSessionRow | undefined;

      // If same runtime already active with same session, be idempotent
      if (existing && existing.session_id === newSessionId) {
        // Validate lease is present and valid - reject null/invalid lease sessions (P2-02)
        const existingLeaseMs = parseUnixMs(existing.lease_expires_at);
        const isExpiredLease = existingLeaseMs !== null && existingLeaseMs <= Date.now();
        const hasInvalidLease = !existingLeaseMs || isExpiredLease;

        // If lease is null, missing, empty, or expired - cannot be considered active connected
        if (existing.connection_status === 'connected' && hasInvalidLease) {
          // Session appears connected but has invalid lease - reactivate with fresh timestamps
          this.db.db.prepare(`
            UPDATE runtime_sessions
            SET connection_status = 'connected',
                connected_at = ?,
                last_heartbeat_at = ?,
                lease_expires_at = ?,
                credential_id = COALESCE(?, credential_id),
                last_error = NULL,
                updated_at = datetime('now')
            WHERE session_id = ?
          `).run(now, now, leaseExpires, credentialId || null, newSessionId);
          this.db.runPreparedStatement('commitTransaction', []);
          const newState = this.getState();
          return { success: true, state: newState };
        }
        if (existing.connection_status === 'connected') {
          // Already connected with valid lease - idempotent success
          this.db.runPreparedStatement('commitTransaction', []);
          const state = this.getState();
          return { success: true, state };
        }
        // Session exists but not connected - reactivate it with fresh timestamps
        // Also handles the case where session has null/expired lease but is marked disconnected
        this.db.db.prepare(`
          UPDATE runtime_sessions
          SET connection_status = 'connected',
              connected_at = ?,
              last_heartbeat_at = ?,
              lease_expires_at = ?,
              credential_id = COALESCE(?, credential_id),
              last_error = NULL,
              updated_at = datetime('now')
          WHERE session_id = ?
        `).run(now, now, leaseExpires, credentialId || null, newSessionId);
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

      // If same runtime has a session with different session_id
      if (existing && existing.session_id !== newSessionId) {
        // WORKSTREAM A-R1: Check if credential_id matches
        // If credential_id differs, the old session was for a different credential
        // (revoked/rotated) - we MUST create a new session (delete old execution records)
        // If credential_id matches, we should REUSE the existing session_id to maintain continuity
        const credentialMatches = credentialId && existing.credential_id === credentialId;

        if (credentialMatches) {
          // Same credential - reuse existing session_id for continuity
          // Update the existing session row with new timestamps and connection status
          this.db.db.prepare(`
            UPDATE runtime_sessions
            SET connection_status = 'connected',
                connected_at = ?,
                last_heartbeat_at = ?,
                lease_expires_at = ?,
                client_ip = ?,
                user_agent = ?,
                updated_at = datetime('now')
            WHERE session_id = ?
          `).run(now, now, leaseExpires, clientIp || null, userAgent || null, existing.session_id);

          this.db.runPreparedStatement('commitTransaction', []);
          const newState = this.getState();
          return { success: true, state: newState };
        } else {
          // Different credential (or no credential provided) - old session is for different credential
          // Clean up execution records for the old session to avoid FK constraint violation
          // when upsertRuntimeSession tries to change session_id
          this.db.db.prepare(`
            DELETE FROM execution_records WHERE session_id = ?
          `).run(existing.session_id);

          this.db.stmt.updateRuntimeSessionStatus.run('disconnected', null, existing.session_id);
        }
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
        credentialId || null,  // Workstream A-R1: store credential_id
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
      return {
        success: false,
        error: 'Session ID required',
      };
    }

    try {
      this.db.runPreparedStatement('beginTransaction', []);

      const session = this.db.stmt.getRuntimeSessionBySession.get(
        sessionId
      ) as RuntimeSessionRow | undefined;

      if (!session) {
        this.db.runPreparedStatement('rollbackTransaction', []);

        return {
          success: false,
          error: 'Session not found',
        };
      }

      if (session.connection_status === 'disconnected') {
        this.db.runPreparedStatement('commitTransaction', []);

        return {
          success: true,
          state: this.getState(),
        };
      }

      const executions = this.db.query(
        `SELECT id
         FROM execution_records
         WHERE session_id = ?
           AND completed = 0
         LIMIT 1`,
        [sessionId]
      );

      if (executions.length > 0) {
        this.db.runPreparedStatement('rollbackTransaction', []);

        return {
          success: false,
          error: 'Cannot disconnect while an MCP execution is active',
        };
      }

      const result = this.db.db.prepare(`
        UPDATE runtime_sessions
        SET connection_status = 'disconnected',
            generation = COALESCE(generation, 0) + 1,
            last_error = NULL,
            updated_at = ?
        WHERE session_id = ?
          AND connection_status = 'connected'
      `).run(String(Date.now()), sessionId);

      if (result.changes !== 1) {
        this.db.runPreparedStatement('rollbackTransaction', []);

        return {
          success: false,
          error: 'Runtime session changed during disconnect',
        };
      }

      this.db.runPreparedStatement('commitTransaction', []);

      return {
        success: true,
        state: this.getState(),
      };
    } catch (error) {
      try {
        this.db.runPreparedStatement('rollbackTransaction', []);
      } catch {
        // Preserve original error.
      }

      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : 'Failed to disconnect runtime',
      };
    }
  }

  switch(options: SwitchRuntimeOptions): { success: boolean; state?: RuntimeConnectionState; error?: string } {
    const { newRuntime, sessionId: providedSessionId, clientIp, userAgent, credentialId } = options;

    if (newRuntime !== 'claude' && newRuntime !== 'hermes') {
      return {
        success: false,
        error: 'Invalid runtime identifier',
      };
    }

    const nowMs = Date.now();
    const now = String(nowMs);
    const leaseExpires = String(nowMs + LEASE_DURATION_MS);

    try {
      this.db.runPreparedStatement('beginTransaction', []);

      const currentActive = this.db.stmt.getActiveRuntimeSession.get() as RuntimeSessionRow | undefined;

      // If sessionId not provided, use current active session's ID (self-initiated switch)
      const sourceSessionId = providedSessionId ?? currentActive?.session_id;

      if (!sourceSessionId) {
        this.db.runPreparedStatement('rollbackTransaction', []);

        return {
          success: false,
          error: 'Source session ID is required',
        };
      }

      if (
        !currentActive ||
        currentActive.session_id !== sourceSessionId ||
        currentActive.connection_status !== 'connected'
      ) {
        this.db.runPreparedStatement('rollbackTransaction', []);

        return {
          success: false,
          error: 'Source session is not the active connected runtime',
        };
      }

      if (currentActive.runtime === newRuntime) {
        this.db.runPreparedStatement('commitTransaction', []);

        return {
          success: true,
          state: this.getState(),
        };
      }

      // Never switch while an MCP execution is still active.
      // The current MCP tool handlers do not yet propagate cancellation
      // reliably through their service operations.
      const sourceExecutions = this.db.query(
        `SELECT id
         FROM execution_records
         WHERE session_id = ?
           AND completed = 0
         LIMIT 1`,
        [sourceSessionId]
      );

      if (sourceExecutions.length > 0) {
        this.db.runPreparedStatement('rollbackTransaction', []);

        return {
          success: false,
          error: 'Cannot switch while an MCP execution is active',
        };
      }

      // Reuse the target runtime's own historical session ID.
      // Never reuse the source runtime's session ID.
      const targetExisting = this.db.stmt.getRuntimeSessionByRuntime.get(newRuntime) as RuntimeSessionRow | undefined;

      if (
        targetExisting &&
        targetExisting.connection_status === 'connected'
      ) {
        this.db.runPreparedStatement('rollbackTransaction', []);

        return {
          success: false,
          error: 'Target runtime already has an active session',
        };
      }

      if (targetExisting) {
        const targetExecutions = this.db.query(
          `SELECT id
         FROM execution_records
         WHERE session_id = ?
           AND completed = 0
         LIMIT 1`,
          [targetExisting.session_id]
        );

        if (targetExecutions.length > 0) {
          this.db.runPreparedStatement('rollbackTransaction', []);

          return {
            success: false,
            error: 'Target runtime has an unfinished execution record',
          };
        }

        // P2-03: Validate target credential before committing switch
        // If target had a credential_id, it must still be valid (active, unexpired, not revoked)
        if (targetExisting.credential_id) {
          const validCredential = validateRuntimeCredentialById(this.db, targetExisting.credential_id);
          if (!validCredential) {
            this.db.runPreparedStatement('rollbackTransaction', []);
            return {
              success: false,
              error: `Target credential '${targetExisting.credential_id}' is no longer valid (revoked, expired, or not found). Cannot switch runtime.`,
            };
          }
        }
      }

      const targetSessionId =
        targetExisting?.session_id ?? randomUUID();

      const targetGeneration = targetExisting
        ? Math.max(Number(targetExisting.generation ?? 0) + 1, 1)
        : 1;

      const targetCredentialId =
        credentialId ?? targetExisting?.credential_id ?? null;

      // If a new credentialId is provided, validate it before committing switch
      if (credentialId) {
        const validCredential = validateRuntimeCredentialById(this.db, credentialId);
        if (!validCredential) {
          this.db.runPreparedStatement('rollbackTransaction', []);
          return {
            success: false,
            error: `Provided credential '${credentialId}' is not valid (revoked, expired, or not found). Cannot switch runtime.`,
          };
        }
      }

      // Retain the source session record and invalidate its generation.
      this.db.db.prepare(`
        UPDATE runtime_sessions
        SET connection_status = 'disconnected',
            generation = COALESCE(generation, 0) + 1,
            last_error = 'Session replaced by runtime switch',
            updated_at = ?
        WHERE runtime = ?
          AND session_id = ?
          AND connection_status = 'connected'
      `).run(
        now,
        currentActive.runtime,
        sourceSessionId
      );

      // Activate the target runtime using its own session identity.
      this.db.stmt.upsertRuntimeSession.run(
        newRuntime,
        targetSessionId,
        'connected',
        now,
        now,
        leaseExpires,
        clientIp ?? targetExisting?.client_ip ?? null,
        userAgent ?? targetExisting?.user_agent ?? null,
        null,
        targetGeneration,
        targetCredentialId,
        now,
        now
      );

      this.db.runPreparedStatement('commitTransaction', []);

      return {
        success: true,
        state: this.getState(),
      };
    } catch (error) {
      try {
        this.db.runPreparedStatement('rollbackTransaction', []);
      } catch {
        // Preserve the original database error.
      }

      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : 'Failed to switch runtime',
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

      // First, disconnect sessions with null or invalid lease that appear connected
      // This handles the P2-02 case: a missing/null lease cannot create an apparently successful but unusable session
      const nullLeaseStmt = this.db.db.prepare(`
        UPDATE runtime_sessions
        SET connection_status = 'disconnected',
            generation = COALESCE(generation, 0) + 1,
            last_error = ?,
            updated_at = datetime('now')
        WHERE connection_status = 'connected'
        AND (lease_expires_at IS NULL OR lease_expires_at = '')
      `);
      const nullLeaseResult = nullLeaseStmt.run('Session recovered: null or missing lease (invalid session state)');
      recovered += (nullLeaseResult as any).changes || 0;

      // Atomic update: only disconnect if still expired (race-safe)
      // This prevents recovering a session that was just renewed by heartbeat
      const stmt = this.db.db.prepare(`
        UPDATE runtime_sessions
        SET connection_status = 'disconnected',
            generation = COALESCE(generation, 0) + 1,
            last_error = ?,
            updated_at = datetime('now')
        WHERE connection_status = 'connected'
        AND lease_expires_at IS NOT NULL
        AND lease_expires_at != ''
        AND CAST(lease_expires_at AS INTEGER) <= ?
      `);

      const result = stmt.run(`Session recovered due to stale lease (${now})`, String(now));
      // better-sqlite3 returns changes on the statement object after run()
      recovered += (result as any).changes || 0;

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