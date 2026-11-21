// Runtime Execution Guard for MCP Tool Execution
// Phase 10: Protect against TOCTOU (time-of-check/time-of-use) race conditions
// at the MCP tool execution boundary using atomic SQLite transactions

import { DatabaseInstance } from '../database.js';
import { AuthContext } from '../auth/index.js';
import { getAuthConfig } from '../auth/config.js';
import { randomUUID } from 'node:crypto';
import { parseUnixMs } from './lifecycle.js';
import { getRuntimeLifecycleManager } from './lifecycle.js';

// These must be functions, not cached values, because tests change process.env.AUTH_MODE at runtime
function getConfig() { return getAuthConfig(); }

export type RuntimeId = 'claude' | 'hermes';

export interface RuntimeExecutionContext {
  runtimeId: RuntimeId;
  sessionId: string;
  executionId: string;
  heartbeatInterval?: NodeJS.Timeout;
}

export type RuntimeToolExecutor<T> = (context: RuntimeExecutionContext) => Promise<T>;

export interface ExecutionGuardResult<T> {
  success: boolean;
  result?: T;
  error?: {
    code: string;
    message: string;
    activeRuntime?: RuntimeId;
  };
}

/**
 * Creates an execution guard that authenticates the runtime, validates the session,
 * validates the lease, acquires an execution permit via atomic transaction,
 * executes the MCP tool callback, and releases the permit in a finally block.
 * Automatically renews heartbeat during long-running executions.
 */
export function createRuntimeExecutionGuard(db: DatabaseInstance) {
  const EXECUTION_PERMIT_DURATION_MS = 30 * 1000; // 30 seconds max execution time
  const HEARTBEAT_RENEWAL_INTERVAL_MS = 300 * 1000; // Renew heartbeat every 5 minutes

  /**
   * Acquires an execution permit via atomic SQLite transaction
   * Returns execution context or error
   */
  async function acquireExecutionPermit(
    authContext: AuthContext
  ): Promise<{ success: boolean; context?: RuntimeExecutionContext; error?: { code: string; message: string; activeRuntime?: RuntimeId } }> {
    const { runtime: requestRuntime, session_id: requestSessionId } = authContext;

    if (!requestSessionId) {
      return { success: false, error: { code: 'SESSION_ID_REQUIRED', message: 'Missing session identity in authentication context' } };
    }

    const executionId = randomUUID();
    const now = Date.now();
    const expiresAt = now + EXECUTION_PERMIT_DURATION_MS;

    try {
      // Begin IMMEDIATE transaction for atomic ownership verification and permit acquisition
      db.runPreparedStatement('beginTransaction', []);

      // 1. Check for bootstrap/local-founder session (bypasses runtime session checks for local single-user mode)
      // SECURITY: Bootstrap sessions are ONLY allowed in local single-user mode
      const isLocalMode = getConfig().local_single_user_mode;
      const isBootstrapSession = requestSessionId === 'local-founder' && isLocalMode;

      if (isBootstrapSession) {
        // In bootstrap mode, ensure a runtime_sessions row exists for the requested runtime
        // SECURITY: This clears any connected sessions (including expired ones) to prevent
        // UNIQUE constraint violation on idx_single_active_runtime
        // First, clear any expired connected sessions
        db.stmt.clearExpiredConnectedSessions.run('expired-lease');

        // Then, check for and disconnect any still-active connected session
        // This implements the "single active runtime" invariant for bootstrap sessions
        const existingActive = db.stmt.getActiveRuntimeSession.get() as
          | { runtime: RuntimeId; session_id: string; connection_status: string; lease_expires_at: string | null }
          | undefined;

        if (existingActive && existingActive.connection_status === 'connected') {
          // Disconnect the existing active session to make room for the bootstrap session
          // This is safe because there's only one active session, and we're taking ownership
          db.stmt.updateRuntimeSessionStatus.run('disconnected', null, existingActive.session_id);
        }

        // Now create the bootstrap session row
        // This is required for the execution_records foreign key constraint
        const sessionNow = String(now);
        const leaseExpires = String(now + 10 * 60 * 1000); // 10 minutes lease
        db.stmt.upsertRuntimeSession.run(
          requestRuntime,           // runtime (PK)
          requestSessionId,         // session_id
          'connected',              // connection_status
          sessionNow,               // connected_at
          sessionNow,               // last_heartbeat_at
          leaseExpires,             // lease_expires_at
          null,                     // client_ip
          null,                     // user_agent
          null,                     // last_error
          sessionNow,               // created_at
          sessionNow                // updated_at
        );
      }

      // 2. Resolve authenticated runtime session (skip for bootstrap)
      const sessionRow = db.stmt.getRuntimeSessionBySession.get(requestSessionId) as
        | { runtime: RuntimeId; session_id: string; connection_status: string; lease_expires_at: string | null }
        | undefined;

      if (!isBootstrapSession && (!sessionRow || sessionRow.session_id !== requestSessionId)) {
        db.runPreparedStatement('rollbackTransaction', []);
        return { success: false, error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' } };
      }

      // 3. For non-bootstrap sessions: confirm it is the active connected session
      if (!isBootstrapSession) {
        const activeSession = db.stmt.getActiveRuntimeSession.get() as
          | { runtime: RuntimeId; session_id: string; connection_status: string; lease_expires_at: string | null }
          | undefined;

        if (!activeSession || activeSession.connection_status !== 'connected') {
          db.runPreparedStatement('rollbackTransaction', []);
          return { success: false, error: { code: 'NO_ACTIVE_SESSION', message: 'No active runtime session' } };
        }

        // 4. Verify the session ID matches
        if (activeSession.session_id !== requestSessionId) {
          db.runPreparedStatement('rollbackTransaction', []);
          return {
            success: false,
            error: {
              code: 'RUNTIME_NOT_ACTIVE',
              message: `This runtime does not own the active Council Bridge session. Active runtime: ${activeSession.runtime}`,
              activeRuntime: activeSession.runtime
            }
          };
        }

        // 5. Verify the runtime matches
        if (activeSession.runtime !== requestRuntime) {
          db.runPreparedStatement('rollbackTransaction', []);
          return {
            success: false,
            error: {
              code: 'RUNTIME_MISMATCH',
              message: `Runtime mismatch: authorized as ${requestRuntime}, but active session belongs to ${activeSession.runtime}`,
              activeRuntime: activeSession.runtime
            }
          };
        }

        // 6. Verify lease is valid - FAIL-CLOSED: reject on any invalid/missing/ expired lease
        const leaseExpires = activeSession.lease_expires_at;
        const leaseExpiresMs = parseUnixMs(leaseExpires);

        if (leaseExpiresMs === null) {
          db.runPreparedStatement('rollbackTransaction', []);
          return { success: false, error: { code: 'INVALID_SESSION_LEASE', message: 'Runtime session has an invalid or missing lease timestamp' } };
        }

        if (leaseExpiresMs <= now) {
          db.runPreparedStatement('rollbackTransaction', []);
          return { success: false, error: { code: 'SESSION_EXPIRED', message: 'Session lease has expired' } };
        }
      }

      // 7. Check if there's already an active execution for this session (prevent concurrent executions)
      const existingExecution = db.stmt.getExecutionRecordBySession.get(requestSessionId) as
        | { id: string; completed: number; expires_at: number }
        | undefined;

      if (existingExecution && existingExecution.completed === 0 && existingExecution.expires_at > now) {
        db.runPreparedStatement('rollbackTransaction', []);
        return { success: false, error: { code: 'EXECUTION_IN_PROGRESS', message: 'Another tool execution is already in progress for this session' } };
      }

      // 8. Clean up any expired execution records that might block the unique constraint
      db.stmt.cleanupExpiredExecutionRecords.run(now);

      // 9. Insert execution record bound to exact session (atomic within transaction)
      db.stmt.insertExecutionRecord.run(executionId, requestSessionId, requestRuntime, now, expiresAt);

      // 10. Commit transaction
      db.runPreparedStatement('commitTransaction', []);

      // Start heartbeat renewal (only for non-bootstrap sessions with active runtime)
      let heartbeat: { interval: NodeJS.Timeout; stop: () => void } | undefined;
      if (!isBootstrapSession) {
        heartbeat = startHeartbeatRenewal(requestSessionId);
      }

      // Return execution context
      return {
        success: true,
        context: {
          runtimeId: requestRuntime,
          sessionId: requestSessionId,
          executionId,
          heartbeatInterval: heartbeat?.interval
        }
      };
    } catch (error) {
      // Rollback on any error (ignore rollback errors when DB is closed)
      try {
        db.runPreparedStatement('rollbackTransaction', []);
      } catch {
        // Ignore rollback errors when database is closed
      }
      return {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to acquire execution permit'
        }
      };
    }
  }

  /**
   * Releases the execution permit (marks as completed)
   */
  async function releaseExecutionPermit(executionId: string): Promise<void> {
    try {
      db.stmt.completeExecutionRecord.run(executionId);
    } catch {
      // Ignore cleanup errors - permit will expire automatically
    }
  }

  /**
   * Starts a heartbeat renewal interval for the given session
   * Returns the interval handle and a cleanup function
   */
  function startHeartbeatRenewal(sessionId: string): { interval: NodeJS.Timeout; stop: () => void } {
    const lifecycle = getRuntimeLifecycleManager(db);
    const interval = setInterval(() => {
      const result = lifecycle.heartbeat({ sessionId });
      // Heartbeat failures are non-fatal - they just allow the session to expire
      if (!result.success) {
        // Session may have expired or closed - stop renewal
        clearInterval(interval);
      }
    }, HEARTBEAT_RENEWAL_INTERVAL_MS);

    return {
      interval,
      stop: () => clearInterval(interval)
    };
  }

  /**
   * Main execution guard function that wraps MCP tool execution
   * Automatically renews heartbeat during long-running executions
   */
  async function executeWithGuard<T>(
    authContext: AuthContext,
    toolExecutor: RuntimeToolExecutor<T>
  ): Promise<ExecutionGuardResult<T>> {
    // Step 1: Acquire execution permit
    const permitResult = await acquireExecutionPermit(authContext);

    if (!permitResult.success || !permitResult.context) {
      return {
        success: false,
        error: permitResult.error || { code: 'UNKNOWN_ERROR', message: 'Failed to acquire execution permit' }
      };
    }

    const context = permitResult.context;

    try {
      // Step 2: Execute the MCP tool callback
      const result = await toolExecutor(context);

      // Step 3: Release permit on success
      await releaseExecutionPermit(context.executionId);

      return { success: true, result };
    } catch (error) {
      // Step 4: Release permit on error (finally block semantics)
      await releaseExecutionPermit(context.executionId);

      return {
        success: false,
        error: {
          code: 'TOOL_EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Tool execution failed'
        }
      };
    } finally {
      // Step 5: Stop heartbeat renewal
      if (context.heartbeatInterval) {
        clearInterval(context.heartbeatInterval);
      }
    }
  }

  return {
    executeWithGuard,
    acquireExecutionPermit,
    releaseExecutionPermit
  };
}

/**
 * Clean up expired execution records (can be called periodically)
 */
export function cleanupExpiredExecutionRecords(db: DatabaseInstance): number {
  const now = Date.now();
  try {
    const result = db.stmt.cleanupExpiredExecutionRecords.run(now);
    return (result as any).changes || 0;
  } catch {
    return 0;
  }
}